import { encodeTxnId, decodeTxnId } from "../src/utils/referenceHelper.js";
import assert from "assert";

console.log("=== STARTING REFERENCE HELPER VERIFICATION ===");

const batchSize = 10000;
const startId = 1;
let successCount = 0;

const startTime = process.hrtime.bigint();

for (let i = 0; i < batchSize; i++) {
  const testId = startId + i;
  const encoded = encodeTxnId(testId);
  
  // Verify format
  if (!encoded || !/^IRE-TXN-[0-9A-Z]{8}$/.test(encoded)) {
    throw new Error(`Format validation failed for ID ${testId}: got ${encoded}`);
  }
  
  const decoded = decodeTxnId(encoded);
  
  if (decoded !== testId) {
    throw new Error(`Decode failed: Expected ${testId}, got ${decoded}`);
  }
  
  successCount++;
}

// Test edge cases
assert.strictEqual(encodeTxnId(0), "IRE-TXN-00000000");
assert.strictEqual(decodeTxnId("IRE-TXN-00000000"), 0);
assert.ok(isNaN(decodeTxnId("IRE-TXN-!!!")));
assert.ok(isNaN(decodeTxnId("")));
assert.ok(isNaN(decodeTxnId(null)));
assert.ok(isNaN(decodeTxnId(undefined)));

// Test backward compatibility with legacy decimal string and numbers
assert.strictEqual(decodeTxnId(12345), 12345);
assert.strictEqual(decodeTxnId("12345"), 12345);

const endTime = process.hrtime.bigint();
const durationMs = Number(endTime - startTime) / 1_000_000;

console.log(`Successfully verified ${successCount} sequentially encoded and decoded IDs.`);
console.log(`Sequential batch verification time: ${durationMs.toFixed(3)} ms`);
console.log(`Edge cases verified successfully.`);
console.log("=== REFERENCE HELPER VERIFICATION COMPLETED (PASS) ===");
