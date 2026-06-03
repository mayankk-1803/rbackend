import prisma from "./src/config/prisma.js";
import { logThreat } from "./src/services/apiMarketplaceService.js";

async function main() {
  console.log("=== STARTING THREAT DETECTION VERIFICATION SUITE ===");

  try {
    const clientId = 99991;
    const threatType = "SIGNATURE_FAILURE";
    const endpoint = "/api/v1/recharge";
    const ipAddress = "192.168.1.100";
    const severity = 4; // HIGH severity
    const details = "Failed HMAC payload signature match check";

    console.log("[TEST 1] Logging custom signature failure threat...");
    await logThreat(clientId, threatType, endpoint, ipAddress, severity, details);
    console.log("✔ Threat log written successfully.");

    // Query DB persistence
    const logs = await prisma.apiThreatLog.findMany({
      where: { clientId, threatType }
    });

    if (logs.length === 0) {
      throw new Error("Threat log was not persisted in database.");
    }

    const tLog = logs[0];
    if (tLog.severity !== severity || tLog.ipAddress !== ipAddress || tLog.details !== details) {
      throw new Error("Persisted threat log parameters are invalid.");
    }
    console.log(`✔ Threat persistence verified (Log ID: ${tLog.id}, Threat: ${tLog.threatType}, Severity Level: ${tLog.severity} - HIGH).`);

    console.log("✔ ALL THREAT DETECTION TESTS PASSED SUCCESSFULLY!");
  } catch (err) {
    console.error("❌ THREAT DETECTION VERIFICATION FAILED:", err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
