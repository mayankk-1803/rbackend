# Go-Live Preparedness, Rollback Procedures & Incident Recovery Plan

This document serves as the enterprise operational playbook for the production rollout of the NexGATE-backed admin wallet funding system. It outlines the feature activation strategy, emergency rollback runbooks, incident response checklists, and stress validation findings.

---

## 1. Feature Enforced Strategy

To ensure strict financial compliance and zero data drifts (orphans), the legacy direct-credit fallback path has been **completely removed** from the codebase. Every administrative user top-up request must create a pending payment and checkout via the NexGATE gateway.

### System Verification Behavior

| Stage | Mode | Variable Value | Behavior Description |
| :--- | :--- | :--- | :--- |
| **Current** | **Enforced Gateway** | Any / N/A | Every admin user-funding request triggers a payment session creation at NexGATE, returns a `paymentUrl`, and requires successful webhook/worker callback to credit the wallet. |

---

## 2. Incident & Payment Reconciliation Playbook

Since direct credit fallback has been removed to prevent data drifts and unlinked ledger records, any operational issues with NexGATE should be mitigated using standard API gateways or worker sweeps.

### Reconciling Pending Gateway Transactions
If any admin funding payments are stuck in `PENDING` status:
*   **Do NOT credit manually without audit:** Direct mutation has been removed to guarantee data consistency.
*   **Run the Reconciliation Script:** Run the background sweep or single payment verifier:
     ```bash
     node scratch/reconcile_audit.js
     ```
     This script identifies aged pending payments and scans for inconsistencies.
*   **Verify State via Provider Portal:** Check the NexGATE provider dashboard for the corresponding `paymentId` to confirm if it was successfully paid or declined.
*   **State Recovery:**
    *   If the user actually completed the payment at the gateway: Trigger the webhook callback payload internally using a signed request, or run the verification worker to fetch and credit.
    *   If the payment failed or was aborted: Mark the payment status as `FAILED` in the database to close the lifecycle.

---

## 3. Incident Recovery Checklist

| Incident Scenario | Root Cause | Immediate Mitigation Steps | Recovery Path |
| :--- | :--- | :--- | :--- |
| **NexGATE Gateway Outage** | Provider server down or DNS failure | 1. Contact NexGATE support.<br>2. Queue admin adjustments to be retry-fired upon gateway restoration. | 1. Direct credit is completely removed to prevent ledger gaps.<br>2. When NexGATE is restored, execute queued sessions. |
| **Redis Outage** | Cache server offline | 1. None required. The system auto-detects `redisClient.status !== 'ready'`. | 1. Row-level `Serializable` database locking (`SELECT ... FOR UPDATE`) takes over.<br>2. When Redis is back, locks migrate back automatically. |
| **Delayed Webhooks** | Provider callback queue backlog | 1. The verification queue in BullMQ sweeps pending payments.<br>2. Retries up to 3 times with a 15-second delay. | 1. If still pending after 3 retries, status is updated to `PROCESSING_REVIEW`. |
| **Duplicate Callbacks** | Network retry storms from gateway | 1. Blocked automatically at Redis level via nonce cache.<br>2. Blocked at DB level via unique `idempotencyRecord`. | 1. Subsequent callbacks are skipped safely with an immediate HTTP 200 to prevent gateway retries. |
| **Worker Process Crash** | PM2/Node runtime crash | 1. PM2 automatically restarts the process.<br>2. BullMQ preserves the queue states. | 1. Transactions resume verification from where they were interrupted without double credits. |

---

## 4. Final Stress & Concurrency Validation

We performed rigorous stress testing under simulated latency, high-load concurrency, and failover conditions:

1.  **Concurrent Webhooks:** Simulating multiple callback requests for the same payment ID simultaneously.
    *   *Result:* The first request acquired the lock (or DB lock fallback) and marked the payment as `SUCCESS`. The secondary request read the updated status, logged `[PAYMENT_WEBHOOK_DUPLICATE_SKIP]`, and exited. **No double credits occurred.**
2.  **Redis Offline Failover:** Simulating a complete Redis crash (`redisClient.status = 'end'`).
    *   *Result:* Logged `[REDIS_LOCK_FALLBACK_ACTIVE]` warning. Isolation level fallback correctly executed DB-level row-locking. Concurrency protection remained fully active. **Zero ledger drift.**
3.  **Realtime Telemetry Pushes:** Broadcasting events over Socket.IO under a load of 500 concurrent connections.
    *   *Result:* Event listeners remained stable under `useCallback` deduplication. Realtime stats refreshed seamlessly on the administrator dashboard.

---

## 5. Go-Live Verification Checklist

Before final go-live approval, the following components are verified as stable:

*   `[x]` **Core Recharges:** Customer mobile recharges and bill payments are completely unaffected.
*   `[x]` **User Top-ups:** Direct user UPI checkout remains functional.
*   `[x]` **Reports & Analytics:** Commission calculations, cashback engines, and ledger reports run normally.
*   `[x]` **Telemetry Feed:** Socket.IO transactions broadcast correctly to the active operator monitors.
*   `[x]` **Audit Consistency:** All administrative balances adjustments are attributed to the initiating `adminId` and recorded in the database.
*   `[x]` **Production Credentials:** Confirmed no debug keys or test gateway adapters remain active in server code (mock environments are encapsulated strictly inside scratch testing units).
