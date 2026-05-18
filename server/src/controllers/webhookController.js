import prisma from "../config/prisma.js";
import { normalizeTransactionStatus } from "../utils/statusHelper.js";
import { logTransactionEvent, TXN_EVENTS } from "../services/transactionEventService.js";
import { issueReward } from "../services/rewardEngine.js";
import { recordFinancialEntry } from "../services/ledgerService.js";

/**
 * Universal Webhook Controller for Provider Callbacks.
 */
export const handleProviderWebhook = async (req, res) => {
  const { providerCode } = req.params;
  const data = req.method === 'GET' ? req.query : req.body;

  console.log(`[Webhook] Received from ${providerCode}:`, JSON.stringify(data));

  try {
    // 1. Identify transaction (Provider-specific logic would go here)
    // For this example, we assume providers pass our internal txnId or their providerTxnId
    const txnId = data.txnId || data.AGENTID || data.client_id;
    const providerTxnId = data.operator_id || data.OPID || data.provider_id;
    const status = normalizeTransactionStatus(data.status || data.STATUS);

    if (!txnId) return res.status(400).send("MISSING_TXN_ID");

    const txn = await prisma.transaction.findUnique({
      where: { id: parseInt(txnId) },
      include: { user: true }
    });

    if (!txn) return res.status(404).send("TXN_NOT_FOUND");

    // 2. Only process if transaction is still PENDING
    if (txn.status !== 'PENDING') {
      console.log(`[Webhook] TXN:${txnId} already ${txn.status}. Skipping.`);
      return res.status(200).send("ALREADY_PROCESSED");
    }

    // 3. Handle Status
    if (status === 'success') {
      await prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: txn.id },
          data: { status: 'SUCCESS', providerTxnId }
        });
        await logTransactionEvent(txn.id, TXN_EVENTS.SUCCESS, { source: "webhook", provider: providerCode });
        await issueReward(txn.id);
      });
    } else if (status === 'failed') {
      await prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: txn.id },
          data: { status: 'FAILED', refundStatus: 'refunded', refundedAt: new Date() }
        });

        await recordFinancialEntry({
          userId: txn.userId,
          amount: txn.amount,
          type: 'REFUND_CREDIT',
          transactionId: txn.id,
          description: `Auto-Refund (Webhook): ${data.message || 'Provider failed'}`,
          tx
        });

        await logTransactionEvent(txn.id, TXN_EVENTS.FAILED, { source: "webhook", provider: providerCode });
      });
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error(`[Webhook Error] ${providerCode}:`, err.message);
    res.status(500).send("INTERNAL_ERROR");
  }
};
