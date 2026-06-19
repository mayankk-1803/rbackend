import prisma from "../config/prisma.js";
import eventBus from "../config/eventBus.js";
import { Prisma } from "@prisma/client";
import { issueReward } from "../services/rewardEngine.js";
import { recordFinancialEntry } from "../services/ledgerService.js";
import { claimIdempotencyKey } from "../utils/idempotency.js";
import {
  recordWebhookSuccess,
  recordWebhookFailure,
  recordWebhookDuplicate,
  recordRefund,
  recordServerError
} from "../services/webhookMonitoringService.js";
import { isFinalizedStatus, isValidStatusTransition } from "../utils/transactionStateGuard.js";
import { isValidOperatorRef } from "../utils/validators.js";
import { getProviderOperatorCode } from "../config/operators.js";

const PROCESSABLE_STATUSES = ["PENDING", "PENDING_REVIEW", "PROCESSING"];

export const handleApiboxCallback = async (req, res) => {
  const startTime = Date.now();

  const query = req.query || {};
  const body = req.body || {};

  const normalizedPayload = {
    status:
      query.STATUS ||
      query.status ||
      query.Status ||
      body?.STATUS ||
      body?.status ||
      body?.Status,

    providerTxnId:
      query.OPTXNID ||
      query.optxnid ||
      query.OPTxnId ||
      query.OPtxnId ||
      query.opTxnId ||
      body?.OPTXNID ||
      body?.OPtxnId,

    txnId:
      query.RefTxnId ||
      query.refTxnId ||
      query.REFTXNID ||
      query.OurTxnId ||
      query.OURTXNID ||
      query.ourTxnId ||
      query.TTT ||
      query.ttt ||
      body?.RefTxnId ||
      body?.refTxnId ||
      body?.OurTxnId ||
      body?.ourTxnId ||
      body?.TTT ||
      body?.ttt,

    message:
      query.MSG ||
      query.msg ||
      query.Message ||
      body?.MSG ||
      body?.msg
  };

  // [WEBHOOK_RECEIVED] Logging incoming attempt safely
  const ip = (req.headers && req.headers["x-forwarded-for"]) || (req.socket && req.socket.remoteAddress) || "127.0.0.1";
  const userAgent = (req.headers && req.headers["user-agent"]) || "MockedAgent";
  console.log(`[WEBHOOK_RECEIVED] Method: ${req.method} | URL: ${req.originalUrl} | Query: ${JSON.stringify(query)} | Body: ${JSON.stringify(body)} | UA: ${userAgent} | IP: ${ip}`);

  // 1. Webhook authentication
  const expectedSecret = process.env.APIBOX_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET;
  if (expectedSecret) {
    const incomingToken = req.headers["x-webhook-token"] || req.query.token || req.query.secret || req.query.key;
    if (incomingToken !== expectedSecret) {
      console.warn(`[WEBHOOK_AUTH_FAILED] Webhook authentication failed: secret mismatch`);
      return res.status(401).send("Unauthorized");
    }
  }

  const allowedIps = process.env.ALLOWED_PROVIDER_IPS;
  if (allowedIps) {
    const ipList = allowedIps.split(",").map(i => i.trim());
    if (!ipList.includes(ip)) {
      console.warn(`[WEBHOOK_AUTH_FAILED] Unauthorized IP attempt: ${ip}`);
      return res.status(401).send("Unauthorized IP");
    }
  }

  const webhookStatus = String(normalizedPayload.status || "").trim().toUpperCase();
  console.log(`[WEBHOOK_NORMALIZED] Payload: ${JSON.stringify(normalizedPayload)} | webhookStatus: ${webhookStatus}`);
  console.log(`[WEBHOOK_PARSED] txnId: ${normalizedPayload.txnId || 'NONE'} | providerTxnId: ${normalizedPayload.providerTxnId || 'NONE'} | status: ${normalizedPayload.status || 'NONE'} | webhookStatus: ${webhookStatus}`);

  if (!normalizedPayload.txnId) {
    console.warn(`[WEBHOOK_INVALID_PAYLOAD] Missing RefTxnId/txnId in callback | query: ${JSON.stringify(query)} | body: ${JSON.stringify(body)}`);
    return res.status(400).send("Missing RefTxnId");
  }

  try {
    const webhookTxnId = String(normalizedPayload.txnId).trim();
    const txnIdNum = Number(webhookTxnId);

    const txn = await prisma.transaction.findUnique({
      where: {
        id: !isNaN(txnIdNum) && Number.isInteger(txnIdNum) ? txnIdNum : -1
      }
    });

    if (!txn) {
      console.warn(`[WEBHOOK_TXN_NOT_FOUND] Transaction not found | txnId: ${webhookTxnId}`);
      return res.status(404).send("Transaction not found");
    }

    console.log(`[WEBHOOK_MATCH]\nmatchedTxn: ${txn.id}`);
    console.log(`[WEBHOOK_TXN_FOUND] Transaction found | txnId: ${txn.id} | currentStatus: ${txn.status}`);

    if (isFinalizedStatus(txn.status)) {
      console.log(`[FINAL_STATE_BLOCKED] Webhook ignored for finalized txn ${txn.id}`);
      recordWebhookDuplicate();
      return res.status(200).send("OK");
    }

    if (!PROCESSABLE_STATUSES.includes(txn.status)) {
      console.log(`[WEBHOOK_SKIPPED_DUPLICATE] Early return after transaction block check | txnId: ${txn.id} | currentStatus: ${txn.status} | providerTxnId: ${txn.providerTxnId || normalizedPayload.providerTxnId || 'NONE'} | webhookStatus: ${webhookStatus}`);
      recordWebhookDuplicate();
      return res.status(200).send("OK");
    }

    // Safe status normalization
    let finalStatus = "PENDING";
    let isRefund = false;

    // Support flexible status names
    if (webhookStatus === "1" || webhookStatus === "SUCCESS" || webhookStatus === "SUCCESSFUL") {
      finalStatus = "SUCCESS";
    } else if (webhookStatus === "3" || webhookStatus === "FAILED" || webhookStatus === "FAILURE") {
      finalStatus = "FAILED";
      isRefund = true;
    } else if (webhookStatus === "2" || webhookStatus === "PENDING" || webhookStatus === "PROCESSING") {
      finalStatus = "PENDING";
    } else {
      console.warn(`[WEBHOOK_INVALID_PAYLOAD] Unhandled webhook status | txnId: ${txn.id} | currentStatus: ${txn.status} | providerTxnId: ${normalizedPayload.providerTxnId || 'NONE'} | webhookStatus: ${webhookStatus}`);
      recordWebhookDuplicate();
      return res.status(200).send("OK");
    }

    if (finalStatus === "PENDING") {
      console.log(`[WEBHOOK_PROCESSING] Status is pending. Ignoring to prevent downgrades or duplicate polling. txnId: ${txn.id}`);
      return res.status(200).send("OK");
    }

    // [WEBHOOK_PROCESSING] Processing webhook update
    console.log(`[WEBHOOK_PROCESSING] Processing webhook update | txnId: ${txn.id} | currentStatus: ${txn.status} | providerTxnId: ${normalizedPayload.providerTxnId || 'NONE'} | webhookStatus: ${webhookStatus}`);

    const result = await prisma.$transaction(async (tx) => {
      // Lock and check transaction status inside transaction block to prevent concurrent processing
      const lockedTxns = await tx.$queryRaw`SELECT * FROM transaction WHERE id = ${txn.id} FOR UPDATE`;
      const lockedTxn = lockedTxns && lockedTxns.length > 0 ? lockedTxns[0] : null;

      if (!lockedTxn) {
        throw new Error("Transaction not found during lock");
      }

      if (isFinalizedStatus(lockedTxn.status)) {
        console.log(`[FINAL_STATE_BLOCKED] Webhook ignored for finalized txn inside lock ${txn.id}`);
        return { updatedTxn: lockedTxn, updatedWallet: null, alreadyProcessed: true };
      }

      if (!PROCESSABLE_STATUSES.includes(lockedTxn.status)) {
        console.log(`[WEBHOOK_SKIPPED_DUPLICATE] Transaction already processed inside lock | txnId: ${txn.id} | currentStatus: ${lockedTxn.status} | providerTxnId: ${lockedTxn.providerTxnId || normalizedPayload.providerTxnId || 'NONE'} | webhookStatus: ${webhookStatus}`);
        return { updatedTxn: lockedTxn, updatedWallet: null, alreadyProcessed: true };
      }

      if (!isValidStatusTransition(lockedTxn.status, finalStatus)) {
        console.log(`[INVALID_TRANSITION_BLOCKED] ${lockedTxn.status} -> ${finalStatus} blocked for txn ${txn.id}`);
        return { updatedTxn: lockedTxn, updatedWallet: null, alreadyProcessed: true };
      }

      // Claim webhook provider txn idempotency key if present to prevent replays
      const providerTxId = normalizedPayload.providerTxnId;
      if (providerTxId) {
        const canClaimWebhook = await claimIdempotencyKey(`webhook:${providerTxId}:${finalStatus}`, tx);
        if (!canClaimWebhook) {
          console.log(`[WEBHOOK_SKIPPED_DUPLICATE] Webhook provider txn ID already claimed | txnId: ${txn.id} | currentStatus: ${lockedTxn.status} | providerTxnId: ${providerTxId} | webhookStatus: ${webhookStatus}`);
          return { updatedTxn: lockedTxn, updatedWallet: null, alreadyProcessed: true };
        }
      }

      // Parse existing apiResponse safely to allow merging
      let existingApiResponse = {};
      if (lockedTxn.apiResponse) {
        if (typeof lockedTxn.apiResponse === 'string') {
          try {
            existingApiResponse = JSON.parse(lockedTxn.apiResponse);
          } catch (e) {
            existingApiResponse = {};
          }
        } else if (typeof lockedTxn.apiResponse === 'object') {
          existingApiResponse = lockedTxn.apiResponse;
        }
      }

      // Safely merge parameters and preserve history
      let mergedResponse = {};
      try {
        const webhookHistory = Array.isArray(existingApiResponse.webhookHistory)
          ? existingApiResponse.webhookHistory
          : [];
        
        mergedResponse = {
          ...existingApiResponse,
          webhookPayload: normalizedPayload,
          webhookHistory: [
            ...webhookHistory,
            {
              receivedAt: new Date().toISOString(),
              payload: normalizedPayload
            }
          ]
        };
      } catch (e) {
        console.error(`[API_RESPONSE_MERGE_ERROR] Failed to merge for Txn #${txn.id}:`, e);
        mergedResponse = {
          ...existingApiResponse,
          webhookPayload: normalizedPayload
        };
      }

      let updatedTxn;

      if (finalStatus === "SUCCESS") {
        const hasExistingValidRef = isValidOperatorRef(lockedTxn.providerRef, lockedTxn);
        const isNewRefValid = isValidOperatorRef(providerTxId, lockedTxn);
        let finalProviderRef = lockedTxn.providerRef;
        if (!hasExistingValidRef && isNewRefValid) {
          finalProviderRef = providerTxId;
        }

        let updatedSnapshot = lockedTxn.invoiceSnapshot;
        if (updatedSnapshot && typeof updatedSnapshot === 'object') {
          updatedSnapshot = {
            ...updatedSnapshot,
            providerRef: finalProviderRef || updatedSnapshot.providerRef || null
          };
        }

        const updateResult = await tx.transaction.updateMany({
          where: {
            id: txn.id,
            status: { in: ['PENDING', 'PENDING_REVIEW', 'PROCESSING'] }
          },
          data: {
            status: 'SUCCESS',
            providerTxnId: finalProviderRef || providerTxId || lockedTxn.providerTxnId,
            providerRef: finalProviderRef || null,
            invoiceSnapshot: updatedSnapshot || undefined,
            apiResponse: mergedResponse,
            processedAt: new Date()
          }
        });

        if (updateResult.count === 0) {
          console.log(`[FINAL_STATE_BLOCKED] Txn already finalized or not found: ${txn.id}`);
          return { updatedTxn: lockedTxn, updatedWallet: null, alreadyProcessed: true };
        }

        updatedTxn = await tx.transaction.findUnique({ where: { id: txn.id } });

        const opCode = getProviderOperatorCode(txn.operator);
        const isDth = ["6", "7", "8", "9", "10"].includes(opCode);
        if (isDth) {
          console.log(`[DTH_RECHARGE_SUCCESS] transactionId=${txn.id}, operator=${txn.operator}, subscriberId=${txn.mobile}, amount=${txn.amount}, providerRef=${updatedTxn.providerRef || 'N/A'}, providerTxnId=${updatedTxn.providerTxnId || 'N/A'}, status=SUCCESS`);
        }
      }

      let updatedWallet = null;

      // 2. FAILED Logic: Refund
      if (finalStatus === "FAILED" && isRefund) {
        // Double check lockedTxn state to ensure refund not already processed
        if (lockedTxn.refundStatus === "refunded" || lockedTxn.status === "REFUNDED" || lockedTxn.status === "FAILED") {
          console.log(`[WEBHOOK_SKIPPED_DUPLICATE] Refund already processed or transaction failed | txnId: ${txn.id} | currentStatus: ${lockedTxn.status} | providerTxnId: ${lockedTxn.providerTxnId || normalizedPayload.providerTxnId} | webhookStatus: ${webhookStatus}`);
          return { updatedTxn: lockedTxn, updatedWallet: null, alreadyProcessed: true };
        }

        // Check if refund ledger already exists
        const existingRefundLedger = await tx.ledgerEntry.findFirst({
          where: {
            transactionId: txn.id,
            type: 'REFUND_CREDIT'
          }
        });

        if (existingRefundLedger) {
          console.log(`[DUPLICATE_REFUND_PREVENTED] Refund ledger already exists for txn ${txn.id}`);
          return { updatedTxn: lockedTxn, updatedWallet: null, alreadyProcessed: true };
        }

        const idempotencyKey = `refund:${txn.id}`;
        const existingRefundTx = await tx.transaction.findFirst({
          where: {
            type: "REFUND",
            idempotencyKey
          }
        });

        if (existingRefundTx) {
          console.log(`[DUPLICATE_REFUND_PREVENTED] Refund transaction already exists for txn ${txn.id}`);
          return { updatedTxn: lockedTxn, updatedWallet: null, alreadyProcessed: true };
        }

        // [WEBHOOK_FAILED] logging
        console.log(`[WEBHOOK_FAILED] FAILED status callback received | txnId: ${txn.id} | currentStatus: ${lockedTxn.status} | providerTxnId: ${providerTxId || 'NONE'} | webhookStatus: ${webhookStatus}`);

        const canClaimRefund = await claimIdempotencyKey(idempotencyKey, tx);
        if (!canClaimRefund) {
          console.log(`[WEBHOOK_SKIPPED_DUPLICATE] Refund key ${idempotencyKey} already claimed | txnId: ${txn.id} | currentStatus: ${lockedTxn.status} | providerTxnId: ${lockedTxn.providerTxnId || normalizedPayload.providerTxnId} | webhookStatus: ${webhookStatus}`);
          return { updatedTxn: lockedTxn, updatedWallet: null, alreadyProcessed: true };
        }

        const hasExistingValidRef = isValidOperatorRef(lockedTxn.providerRef, lockedTxn);
        const isNewRefValid = isValidOperatorRef(providerTxId, lockedTxn);
        let finalProviderRef = lockedTxn.providerRef;
        if (!hasExistingValidRef && isNewRefValid) {
          finalProviderRef = providerTxId;
        }

        // Step 1: transition to FAILED
        const updateFailed = await tx.transaction.updateMany({
          where: {
            id: txn.id,
            status: { in: ['PENDING', 'PENDING_REVIEW', 'PROCESSING'] }
          },
          data: {
            status: 'FAILED',
            providerTxnId: finalProviderRef || providerTxId || lockedTxn.providerTxnId,
            providerRef: finalProviderRef || null,
            apiResponse: mergedResponse
          }
        });

        if (updateFailed.count === 0) {
          console.log(`[FINAL_STATE_BLOCKED] FAILED transition blocked or already finalized: ${txn.id}`);
          return { updatedTxn: lockedTxn, updatedWallet: null, alreadyProcessed: true };
        }

        const opCode = getProviderOperatorCode(txn.operator);
        const isDth = ["6", "7", "8", "9", "10"].includes(opCode);
        if (isDth) {
          console.log(`[DTH_RECHARGE_FAILED] transactionId=${txn.id}, operator=${txn.operator}, subscriberId=${txn.mobile}, amount=${txn.amount}, providerRef=${finalProviderRef || 'N/A'}, providerTxnId=${providerTxId || 'N/A'}, status=FAILED`);
        }

        // Step 2: transition from FAILED to REFUNDED
        const updateRefunded = await tx.transaction.updateMany({
          where: {
            id: txn.id,
            status: 'FAILED'
          },
          data: {
            status: 'REFUNDED',
            refundStatus: "refunded",
            refundedAt: new Date(),
            processedAt: new Date()
          }
        });

        if (updateRefunded.count === 0) {
          console.log(`[FINAL_STATE_BLOCKED] REFUNDED transition blocked or already finalized: ${txn.id}`);
          return { updatedTxn: lockedTxn, updatedWallet: null, alreadyProcessed: true };
        }

        if (isDth) {
          console.log(`[DTH_RECHARGE_REFUNDED] transactionId=${txn.id}, operator=${txn.operator}, subscriberId=${txn.mobile}, amount=${txn.amount}, providerRef=${finalProviderRef || 'N/A'}, providerTxnId=${providerTxId || 'N/A'}, status=REFUNDED`);
        }

        updatedTxn = await tx.transaction.findUnique({ where: { id: txn.id } });

        const res = await recordFinancialEntry({
          userId: txn.userId,
          amount: txn.amount,
          type: 'REFUND_CREDIT',
          transactionId: txn.id,
          description: `Refund for failed recharge ${txn.id} via webhook`,
          tx
        });

        await tx.transaction.create({
          data: { 
            userId: txn.userId, 
            amount: txn.amount, 
            type: "REFUND", 
            status: "SUCCESS", 
            direction: "CREDIT",
            description: `Refund for recharge ${txn.id}: ${normalizedPayload.message || 'Provider failed'}`,
            balanceAfter: res.balanceAfter,
            idempotencyKey
          }
        });
        
        updatedWallet = await tx.wallet.findUnique({ where: { userId: txn.userId } });
        console.log(`[REFUND] Apibox Txn ${txn.id} refunded to user ${txn.userId}`);
      }

      if (!updatedWallet) {
        updatedWallet = await tx.wallet.findUnique({ where: { userId: txn.userId } });
      }

      return { updatedTxn, updatedWallet, alreadyProcessed: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (result.alreadyProcessed) {
      return res.status(200).send("OK");
    }

    const latency = Date.now() - startTime;

    // [CRITICAL] Reward Issuance (NON-BLOCKING background call)
    if (finalStatus === "SUCCESS") {
      console.log(`[WEBHOOK_SUCCESS] Webhook success processed | txnId: ${txn.id} | currentStatus: ${result.updatedTxn.status} | providerTxnId: ${result.updatedTxn.providerTxnId} | webhookStatus: ${webhookStatus}`);
      recordWebhookSuccess(latency);
      // Trigger cashback reward engine asynchronously without await to keep response time < 200ms
      issueReward(txn.id).catch(err => console.error("Reward Error:", err));
    } else if (finalStatus === "FAILED") {
      recordWebhookFailure();
      if (isRefund) {
        recordRefund();
      }
    }

    // [CRITICAL] EVENT BUS EMITS
    if (finalStatus === "SUCCESS" || finalStatus === "FAILED") {
      const emitStatus = finalStatus === "FAILED" ? "REFUNDED" : "SUCCESS";

      console.log(`[SOCKET_ROW_UPDATE] Emitting ${emitStatus} update for TXN:${txn.id}`);
      eventBus.emit(`recharge_${emitStatus.toLowerCase()}`, {
        transactionId: txn.id,
        status: emitStatus.toLowerCase(),
        transaction: result.updatedTxn,
        reason: normalizedPayload.message,
        userId: txn.userId,
        amount: txn.amount,
        providerTxnId: result.updatedTxn.providerTxnId
      });
      
      eventBus.emit("transaction_updated", {
        transactionId: txn.id,
        status: emitStatus,
        transaction: result.updatedTxn,
        amount: txn.amount,
        providerTxnId: result.updatedTxn.providerTxnId,
        userId: txn.userId
      });
    }

    if (result.updatedWallet) {
      eventBus.emit("wallet_updated", { userId: txn.userId.toString() });
    }

    // [WEBHOOK_COMPLETED] logging
    console.log(`[WEBHOOK_COMPLETED] Webhook completed | txnId: ${txn.id} | currentStatus: ${result.updatedTxn.status} | providerTxnId: ${result.updatedTxn.providerTxnId || 'NONE'} | webhookStatus: ${webhookStatus}`);

    return res.status(200).send("OK");
  } catch (err) {
    console.error("[APIBOX] Webhook Error:", err.message);
    recordServerError();
    return res.status(500).send("Error");
  }
};

