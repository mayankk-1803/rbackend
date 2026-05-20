import { safeTransactionPayloadV1 } from "../src/config/socket.js";

async function runTests() {
  console.log("=== STARTING SOCKET PAYLOAD SANITIZATION TESTS ===");

  try {
    const sensitivePayload = {
      userId: 42,
      amount: 100.00,
      providerTxnId: "PROV-12345",
      gatewayTxnId: "GATE-999",
      idempotencyKey: "idem-key-abc",
      financialSequenceId: "SEQ-FIN-777",
      cost: 95.00,
      profit: 5.00,
      commission: 2.00,
      transaction: {
        id: 101,
        providerTxnId: "PROV-NESTED",
        idempotencyKey: "idem-nested",
        financialSequenceId: "seq-nested",
        profit: 3.00,
        cost: 97.00,
        commission: 1.00
      }
    };

    console.log("Sanitizing sensitive payload...");
    const sanitized = safeTransactionPayloadV1(sensitivePayload);
    console.log("Sanitized output:", JSON.stringify(sanitized, null, 2));

    // Verify fields are stripped at root level
    const bannedRootKeys = [
      "providerTxnId",
      "gatewayTxnId",
      "idempotencyKey",
      "financialSequenceId",
      "cost",
      "profit",
      "commission"
    ];

    for (const key of bannedRootKeys) {
      if (key in sanitized) {
        throw new Error(`Sanitization failed: Banned root key "${key}" is still present!`);
      }
    }

    // Verify fields are stripped in nested transaction
    const bannedNestedKeys = [
      "providerTxnId",
      "idempotencyKey",
      "financialSequenceId",
      "profit",
      "cost",
      "commission"
    ];

    for (const key of bannedNestedKeys) {
      if (key in sanitized.transaction) {
        throw new Error(`Sanitization failed: Banned nested transaction key "${key}" is still present!`);
      }
    }

    // Verify whitelist fields are intact
    if (sanitized.userId !== 42 || sanitized.amount !== 100.00 || sanitized.transaction.id !== 101) {
      throw new Error("Sanitization removed whitelisted safe fields!");
    }

    // Verify emitId and timestamp exist
    if (!sanitized.emitId || !sanitized.timestamp) {
      throw new Error("Sanitization failed to append emitId or timestamp!");
    }

    console.log("Websocket payload sanitization verified successfully (Zero-Trust enforced).");
    console.log("=== ALL SOCKET PAYLOAD SANITIZATION TESTS PASSED ===");
  } catch (error) {
    console.error("TEST FAILED:", error);
    process.exit(1);
  }
}

runTests();
