import eventBus from "../src/config/eventBus.js";
import prisma from "../src/config/prisma.js";
import { initSocket, enrichAndNormalizeTransaction } from "../src/config/socket.js";
import http from "http";

async function runTest() {
  console.log("=== TELEMETRY VALIDATION TEST (MOCK SOCKET) ===");

  // Create a mock server to initialize socket
  const server = http.createServer();
  
  // Set up mock emitters to capture events
  let capturedEvent = null;
  let capturedPayload = null;

  // Mock global io object and namespace
  const mockNamespace = {
    emit: (event, data) => {
      console.log(`[MOCK NAMESPACE] Captured emit: "${event}"`);
      capturedEvent = event;
      capturedPayload = data;
    }
  };

  // We can test the helper directly first
  console.log("Testing helper directly...");
  const user = await prisma.user.findFirst();
  if (!user) {
    throw new Error("No user found in database to test");
  }
  console.log(`Found database user: ID=${user.id}, Email=${user.email}, Phone=${user.phone}`);

  const mockTxn = {
    id: 9999,
    userId: user.id,
    amount: 150.00,
    type: "TOPUP",
    status: "SUCCESS",
    mobile: null,
    provider: null,
    paymentGateway: "NexGATE"
  };

  const enriched = await enrichAndNormalizeTransaction(mockTxn);
  console.log("\nDirect Enrichment Result:");
  console.log(`Enriched Mobile: ${enriched.mobile}`);
  console.log(`Enriched Provider: ${enriched.provider}`);

  if (enriched.mobile !== user.phone && enriched.mobile !== user.email) {
    throw new Error("Direct Enrichment Failed: mobile number was not correctly resolved to user phone/email");
  }
  if (enriched.provider !== "NexGATE") {
    throw new Error("Direct Enrichment Failed: provider was not correctly resolved to paymentGateway");
  }
  console.log("Direct Enrichment tests PASSED!");

  // Initialize socket with server
  const io = initSocket(server);
  
  // Override adminNamespace.emit with our spy
  const adminNamespace = io.of("/admin");
  adminNamespace.emit = (event, data) => {
    console.log(`[SPY] Captured adminNamespace.emit for event "${event}"`);
    capturedEvent = event;
    capturedPayload = data;
  };

  // Emit eventBus event
  console.log("\nTriggering eventBus transaction_updated...");
  eventBus.emit("transaction_updated", {
    transactionId: 284,
    status: "SUCCESS",
    userId: user.id,
    transaction: mockTxn
  });

  // Since eventBus handler is async, wait a tick
  await new Promise((resolve) => setTimeout(resolve, 500));

  if (!capturedPayload) {
    throw new Error("Failed to capture socket broadcast from eventBus listener");
  }

  console.log("\nCaptured Broadcast Payload:");
  console.log(JSON.stringify(capturedPayload, null, 2));

  if (!capturedPayload.transaction) {
    throw new Error("Validation Failed: payload does not contain transaction object");
  }
  if (capturedPayload.transaction.mobile !== user.phone && capturedPayload.transaction.mobile !== user.email) {
    throw new Error("Validation Failed: broadcast transaction mobile number not normalized");
  }
  if (capturedPayload.transaction.provider !== "NexGATE") {
    throw new Error("Validation Failed: broadcast transaction provider not normalized");
  }

  console.log("\n=== ALL TELEMETRY VALIDATIONS PASSED ===");
  process.exit(0);
}

runTest().catch(err => {
  console.error("\n=== TEST EXCEPTION ===");
  console.error(err);
  process.exit(1);
});
