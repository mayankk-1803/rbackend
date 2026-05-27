import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("======================================================================");
  console.log("       ENTERPRISE ADMIN FUNDING RECONCILIATION & AUDIT TOOL           ");
  console.log("======================================================================\n");

  try {
    // 1. Load data from the database
    console.log("[1/4] Querying payment orders...");
    const payments = await prisma.payment.findMany({
      where: {
        idempotencyKey: {
          startsWith: 'admin_funding:'
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`[2/4] Querying financial transactions...`);
    const transactions = await prisma.transaction.findMany({
      where: {
        type: 'TOPUP'
      }
    });

    console.log(`[3/4] Querying ledger entries...`);
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: {
        type: 'TOPUP_CREDIT'
      }
    });

    console.log(`[4/4] Querying operational audit logs...`);
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        action: {
          in: ['LEDGER_WRITE', 'WALLET_ADJUSTMENT']
        }
      }
    });

    console.log("\n[5] Analyzing consistency and integrity...\n");

    const totalCount = payments.length;
    const successPayments = payments.filter(p => p.status === 'SUCCESS');
    const failedPayments = payments.filter(p => p.status === 'FAILED');
    const pendingPayments = payments.filter(p => p.status === 'PENDING');

    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const agedPendingPayments = pendingPayments.filter(p => p.createdAt < twoHoursAgo);

    console.log("------------------- SUMMARY METRICS -------------------");
    console.log(`Total Admin Funding Payments:  ${totalCount}`);
    console.log(`- SUCCESS:                     ${successPayments.length}`);
    console.log(`- FAILED:                      ${failedPayments.length}`);
    console.log(`- PENDING:                     ${pendingPayments.length}`);
    console.log(`- AGED PENDING (> 2 hours):    ${agedPendingPayments.length}`);
    console.log("-------------------------------------------------------\n");

    if (agedPendingPayments.length > 0) {
      console.warn(" [ALERT] STUCK PENDING PAYMENTS DETECTED (> 2 hours old):");
      agedPendingPayments.forEach(p => {
        const ageHours = ((now.getTime() - p.createdAt.getTime()) / (1000 * 60 * 60)).toFixed(1);
        console.warn(`  - Payment ID: ${p.id} | User ID: ${p.userId} | Amount: ₹${p.amount} | Age: ${ageHours} hours | Created: ${p.createdAt.toISOString()}`);
      });
      console.log("");
    }

    if (failedPayments.length > 0) {
      console.log("------------------- FAILED PAYMENT SUMMARY -------------------");
      failedPayments.forEach(p => {
        console.log(`Payment ID: ${p.id} | User ID: ${p.userId} | Amount: ₹${p.amount} | Failed: ${p.updatedAt.toISOString()} | Reason: ${p.errorMessage || 'Unknown error'}`);
      });
      console.log("--------------------------------------------------------------\n");
    }

    console.log("------------------- CONSISTENCY AUDITING -------------------");
    let anomaliesCount = 0;
    const verifiedPaymentsList = [];

    for (const p of payments) {
      // Extract adminId and correlationId
      let adminId = null;
      let reason = '';
      let correlationId = '';
      
      const parts = p.idempotencyKey.split(':');
      if (parts.length >= 4) {
        correlationId = parts[3];
        const adminIdPart = parts[1]?.split('=')[1];
        adminId = adminIdPart ? Number(adminIdPart) : null;
        reason = decodeURIComponent(parts[2]?.split('=')[1] || '');
      } else {
        correlationId = p.idempotencyKey;
      }

      if (p.status === 'SUCCESS') {
        const issues = [];

        // Check 1: Matching transaction
        const txn = transactions.find(t => 
          t.idempotencyKey === `topup:${p.id}` || 
          (correlationId && t.financialSequenceId === correlationId)
        );

        if (!txn) {
          issues.push("Missing transaction record");
        } else {
          if (txn.status !== 'SUCCESS') {
            issues.push(`Transaction is in status "${txn.status}" (Expected: SUCCESS)`);
          }
          if (Number(txn.amount) !== Number(p.amount)) {
            issues.push(`Transaction amount mismatch: Payment is ₹${p.amount}, Transaction is ₹${txn.amount}`);
          }
        }

        // Check 2: Matching ledger entry via LEDGER_WRITE audit log
        let ledger = null;
        const ledgerAudit = auditLogs.find(a => 
          a.action === 'LEDGER_WRITE' && 
          a.details && 
          typeof a.details === 'object' && 
          a.details.correlationId === correlationId
        );

        if (ledgerAudit) {
          ledger = ledgerEntries.find(l => l.id === ledgerAudit.entityId);
        }

        // Fallback matching logic: match by user, amount, and timestamp proximity
        if (!ledger) {
          ledger = ledgerEntries.find(l => 
            l.userId === p.userId && 
            Math.abs(Number(l.amount) - Number(p.amount)) < 0.01 && 
            Math.abs(l.createdAt.getTime() - p.updatedAt.getTime()) < 15000
          );
        }

        if (!ledger) {
          issues.push("Missing ledger entry (TOPUP_CREDIT)");
        } else {
          if (Number(ledger.amount) !== Number(p.amount)) {
            issues.push(`Ledger amount mismatch: Payment is ₹${p.amount}, Ledger is ₹${ledger.amount}`);
          }
        }

        // Check 3: Attributability via WALLET_ADJUSTMENT audit log
        const adjustAudit = auditLogs.find(a => 
          a.action === 'WALLET_ADJUSTMENT' && 
          (a.entityId === p.id || (a.details && typeof a.details === 'object' && a.details.paymentId === p.id))
        );

        if (!adjustAudit) {
          issues.push("Missing admin WALLET_ADJUSTMENT audit trace");
        } else if (!adjustAudit.adminId) {
          issues.push("Audit trace exists but is missing adminId attribution");
        } else if (adminId && adjustAudit.adminId !== adminId) {
          issues.push(`Admin attribution mismatch: Idempotency admin is ${adminId}, Audit admin is ${adjustAudit.adminId}`);
        }

        if (issues.length > 0) {
          anomaliesCount++;
          console.error(` [ANOMALY] Payment ID: ${p.id} | User ID: ${p.userId} | Amount: ₹${p.amount}`);
          issues.forEach(issue => console.error(`    -> ${issue}`));
        } else {
          verifiedPaymentsList.push({
            paymentId: p.id,
            adminId: adminId || adjustAudit?.adminId,
            userId: p.userId,
            amount: p.amount,
            reason: reason || ledger?.description || 'Admin Funding',
            timestamp: p.updatedAt
          });
        }
      }
    }

    // 6. Check for orphaned database states
    console.log("\n[6] Scanning for orphaned or un-attributable states...");
    
    // Orphaned Transactions (Type TOPUP, status SUCCESS, key starts with topup: but no payment order)
    const orphanedTxns = transactions.filter(t => {
      if (t.status !== 'SUCCESS') return false;
      if (!t.idempotencyKey || !t.idempotencyKey.startsWith('topup:')) return false;
      const paymentId = Number(t.idempotencyKey.split(':')[1]);
      return !payments.some(p => p.id === paymentId);
    });

    if (orphanedTxns.length > 0) {
      anomaliesCount += orphanedTxns.length;
      orphanedTxns.forEach(t => {
        console.error(` [ORPHANED TXN] Transaction #${t.id} of type TOPUP is SUCCESS, but has no matching Payment Order record.`);
      });
    }

    // Orphaned Ledger Entries (TOPUP_CREDIT but no matching transaction or payment)
    const orphanedLedgers = ledgerEntries.filter(l => {
      // Find audit log linking it to correlationId
      const ledgerAudit = auditLogs.find(a => a.action === 'LEDGER_WRITE' && a.entityId === l.id);
      const corrId = ledgerAudit?.details && typeof ledgerAudit.details === 'object' ? ledgerAudit.details.correlationId : null;
      if (!corrId) return false;

      // Check if this correlationId matches any payment idempotency key
      const matchesPayment = payments.some(p => p.idempotencyKey.includes(corrId));
      return !matchesPayment;
    });

    if (orphanedLedgers.length > 0) {
      anomaliesCount += orphanedLedgers.length;
      orphanedLedgers.forEach(l => {
        console.error(` [ORPHANED LEDGER] Ledger Entry #${l.id} (TOPUP_CREDIT) exists but is not linked to any admin funding payment.`);
      });
    }

    console.log("------------------------------------------------------------");
    if (anomaliesCount === 0) {
      console.log(" SUCCESS: No data anomalies or reconciliation drifts found.");
      console.log(` Verified and aligned all ${verifiedPaymentsList.length} completed admin funding payments.`);
    } else {
      console.warn(` WARNING: Found ${anomaliesCount} data anomalies or orphaned states during reconciliation.`);
    }
    console.log("------------------------------------------------------------\n");

    if (verifiedPaymentsList.length > 0) {
      console.log("------------------- VERIFIED HISTORICAL LEDGER -------------------");
      console.log("PaymentID | AdminID | TargetUserID | Amount (₹) | Reason | Timestamp");
      console.log("------------------------------------------------------------------");
      verifiedPaymentsList.slice(0, 15).forEach(v => {
        console.log(`${String(v.paymentId).padEnd(9)} | ${String(v.adminId).padEnd(7)} | ${String(v.userId).padEnd(12)} | ${String(v.amount).padEnd(10)} | ${v.reason.substring(0, 20).padEnd(20)} | ${v.timestamp.toISOString()}`);
      });
      if (verifiedPaymentsList.length > 15) {
        console.log(`... and ${verifiedPaymentsList.length - 15} more records.`);
      }
      console.log("------------------------------------------------------------------\n");
    }

  } catch (error) {
    console.error("Reconciliation execution failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
