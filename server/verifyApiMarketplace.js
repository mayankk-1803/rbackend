import prisma from "./src/config/prisma.js";
import featureFlags, { FLAGS } from "./src/services/featureFlagsService.js";
import { generateApiKey, rotateApiKey, revokeApiKey } from "./src/services/apiMarketplaceService.js";

async function main() {
  console.log("=== STARTING API MARKETPLACE VERIFICATION SUITE ===");

  try {
    // Enable marketplace
    await featureFlags.setFlag(FLAGS.API_MARKETPLACE_ENABLED, true);

    const user = await prisma.user.findFirst() || await prisma.user.create({
      data: { phone: "9876543212", password: "hash" }
    });

    console.log("[TEST 1] Testing API Key generation (Hashed keys only)...");
    const key = await generateApiKey(user.id);
    if (!key.rawKey || !key.rawKey.startsWith("dp_") || key.prefix.length !== 7) {
      throw new Error("API Key format is invalid.");
    }
    console.log(`✔ API Key successfully generated (Prefix: ${key.prefix}, Raw visual: ${key.rawKey.substring(0, 10)}...).`);

    // Verify database hashed key record
    const record = await prisma.apiKeyRecord.findUnique({
      where: { id: key.id }
    });
    if (!record || record.hashedKey === key.rawKey) {
      throw new Error("Raw key was persisted in plaintext or database record is missing!");
    }
    console.log("✔ Security check validated: Hashed keys only are saved.");

    console.log("[TEST 2] Testing Key rotation...");
    const rotated = await rotateApiKey(key.id, user.id);
    const oldKey = await prisma.apiKeyRecord.findUnique({ where: { id: key.id } });
    if (oldKey.isActive) {
      throw new Error("Old rotated key should have been deactivated.");
    }
    console.log(`✔ Key rotated successfully (New Prefix: ${rotated.prefix}).`);

    console.log("[TEST 3] Testing Key revocation...");
    await revokeApiKey(rotated.id, user.id);
    const revokedKey = await prisma.apiKeyRecord.findUnique({ where: { id: rotated.id } });
    if (revokedKey.isActive) {
      throw new Error("Revoked key should be inactive.");
    }
    console.log("✔ Key successfully revoked.");

    console.log("✔ ALL API MARKETPLACE TESTS PASSED SUCCESSFULLY!");
  } catch (err) {
    console.error("❌ API MARKETPLACE VERIFICATION FAILED:", err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
