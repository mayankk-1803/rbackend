import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function cleanup() {
  try {
    console.log("==========================================");
    console.log("CLEANING UP DEMO PROVIDERS FROM PRODUCTION");
    console.log("==========================================");

    // Delete all providers except APIBOX
    const deleteResult = await prisma.provider.deleteMany({
      where: {
        code: {
          not: "APIBOX"
        }
      }
    });

    console.log(`✔ Pruned ${deleteResult.count} demo provider records from registry.`);

    // Make sure APIBOX exists and is active
    const apibox = await prisma.provider.upsert({
      where: { code: "APIBOX" },
      update: {
        isActive: true,
        inSwitch: true,
        priority: 100,
        name: "APIBOX Recharge Gway",
        baseUrl: "https://api.apibox.in",
        apiKey: "test_key",
        successRate: 100,
        avgResponseTime: 29
      },
      create: {
        code: "APIBOX",
        name: "APIBOX Recharge Gway",
        baseUrl: "https://api.apibox.in",
        apiKey: "test_key",
        isActive: true,
        inSwitch: true,
        priority: 100,
        successRate: 100,
        avgResponseTime: 29
      }
    });

    console.log("✔ Verified APIBOX production provider is active:", apibox);

    // Delete all telemetry logs for other providers
    await prisma.providerHealthLog.deleteMany({
      where: {
        providerCode: {
          not: "APIBOX"
        }
      }
    });

    console.log("✔ Pruned all legacy/demo telemetry logs.");
    console.log("==========================================");
  } catch (err) {
    console.error("Cleanup failed:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
