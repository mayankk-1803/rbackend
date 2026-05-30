import eventBus from "../../config/eventBus.js";
import prisma from "../../config/prisma.js";
import { sendWhatsappMessage } from "./nexbyteProvider.js";
import logger from "../logging/logger.js";

// Safe enterprise feature flags configuration
const enterpriseFeatures = {
  whatsappSystem: true
};

/**
 * Enterprise WhatsApp Dispatch Orchestrator
 */
export const dispatchNotification = async ({ recipient, templateName, variables }) => {
  if (!enterpriseFeatures.whatsappSystem) {
    logger.debug("[WHATSAPP] WhatsApp notifications are globally disabled via feature flags.");
    return;
  }

  // Execute fully asynchronously in the background so recharge processing threads never block
  (async () => {
    try {
      // 1. Fetch template from database
      let template = await prisma.whatsappTemplate.findUnique({
        where: { name: templateName }
      });

      // 2. Auto-seed standard default templates if they are missing
      if (!template) {
        let defaultBody = "Notification alert received.";
        if (templateName === "recharge_success") {
          defaultBody = "Dear customer, your recharge of ₹{amount} for mobile {mobile} on {operator} was SUCCESSFUL. Ref ID: {refId}. Thank you for using Dizipay!";
        } else if (templateName === "recharge_failed") {
          defaultBody = "Dear customer, your recharge of ₹{amount} for mobile {mobile} was FAILED. Any deducted amount has been refunded back to your wallet ledger. Support Ref: {txnId}.";
        } else if (templateName === "wallet_alert") {
          defaultBody = "Dizipay Alert: Your wallet has been {action} with ₹{amount}. New wallet balance: ₹{balance}. Description: {description}.";
        }

        template = await prisma.whatsappTemplate.create({
          data: {
            name: templateName,
            templateId: `NB_${templateName.toUpperCase()}`,
            body: defaultBody,
            variables: JSON.stringify(Object.keys(variables || {})),
            isActive: true
          }
        }).catch(() => null); // Silent catch if concurrent insert occurs
      }

      // If template is inactive, skip sending
      if (template && !template.isActive) {
        logger.debug(`[WHATSAPP] Skipping notification. Template ${templateName} is inactive.`);
        return;
      }

      // 3. Resolve template body parameters for logs/records
      let resolvedBody = template ? template.body : "";
      if (variables) {
        Object.entries(variables).forEach(([key, val]) => {
          resolvedBody = resolvedBody.replace(new RegExp(`{${key}}`, "g"), String(val));
        });
      }

      // 4. Send using NexByte Provider
      const result = await sendWhatsappMessage({
        recipient,
        templateName: template ? template.templateId : templateName,
        variables
      });

      // 5. Audit Log to NotificationLog
      await prisma.notificationLog.create({
        data: {
          recipient,
          channel: "WHATSAPP",
          templateName,
          status: result.status,
          response: {
            resolvedBody,
            providerResponse: result.response,
            reason: result.reason || null
          }
        }
      });

    } catch (err) {
      logger.error("Failed to execute async WhatsApp notification", { err: err.message, recipient, templateName });
    }
  })();
};

/**
 * Event Bus Central Handlers mapping
 */
export const registerNotificationEventListeners = () => {
  logger.info("[WHATSAPP] Registering async WhatsApp event bus listeners...");

  // Recharge Success Hook
  eventBus.on("recharge_success", async (data) => {
    logger.debug("[WHATSAPP] Success event received", data);
    const { txnId, userId } = data;
    try {
      const txn = await prisma.transaction.findUnique({
        where: { id: Number(txnId) },
        include: { user: true }
      });
      if (txn && txn.user && txn.user.phone) {
        await dispatchNotification({
          recipient: txn.user.phone,
          templateName: "recharge_success",
          variables: {
            amount: txn.amount.toString(),
            mobile: txn.mobile || "N/A",
            operator: txn.operator || "Network",
            refId: txn.providerTxnId || txn.id.toString()
          }
        });
      }
    } catch (err) {
      logger.error("Failed on recharge_success WhatsApp dispatch hook", { err: err.message, txnId });
    }
  });

  // Recharge Fail Hook
  eventBus.on("recharge_failed", async (data) => {
    logger.debug("[WHATSAPP] Fail event received", data);
    const { txnId, userId } = data;
    try {
      const txn = await prisma.transaction.findUnique({
        where: { id: Number(txnId) },
        include: { user: true }
      });
      if (txn && txn.user && txn.user.phone) {
        await dispatchNotification({
          recipient: txn.user.phone,
          templateName: "recharge_failed",
          variables: {
            amount: txn.amount.toString(),
            mobile: txn.mobile || "N/A",
            txnId: txn.id.toString()
          }
        });
      }
    } catch (err) {
      logger.error("Failed on recharge_failed WhatsApp dispatch hook", { err: err.message, txnId });
    }
  });

  // Wallet Alert Hook (custom trigger)
  eventBus.on("wallet_alert_triggered", async (data) => {
    logger.debug("[WHATSAPP] Wallet alert event received", data);
    const { phone, action, amount, balance, description } = data;
    if (phone) {
      await dispatchNotification({
        recipient: phone,
        templateName: "wallet_alert",
        variables: {
          action: action || "updated",
          amount: String(amount),
          balance: String(balance),
          description: description || "Wallet transaction adjustment"
        }
      });
    }
  });
};

// Immediate registration on script boot
registerNotificationEventListeners();

export default {
  dispatchNotification,
  registerNotificationEventListeners
};
