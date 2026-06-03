import prisma from "./src/config/prisma.js";
import { redisClient } from "./src/config/redis.js";
import ops from "./src/controllers/operationsController.js";

// ==========================================================================
// IN-MEMORY REDIS CLIENT MOCK
// ==========================================================================
const redisMockStore = {};

const mockPipeline = () => {
  const commands = [];
  const p = {
    del: (key) => {
      commands.push(() => {
        delete redisMockStore[key];
      });
      return p;
    },
    hset: (key, fieldOrObj, value) => {
      commands.push(() => {
        if (!redisMockStore[key]) redisMockStore[key] = {};
        if (typeof fieldOrObj === "object" && fieldOrObj !== null) {
          for (const [k, v] of Object.entries(fieldOrObj)) {
            redisMockStore[key][k] = typeof v === "object" ? JSON.stringify(v) : String(v);
          }
        } else {
          redisMockStore[key][fieldOrObj] = typeof value === "object" ? JSON.stringify(value) : String(value);
        }
      });
      return p;
    },
    exec: async () => {
      for (const cmd of commands) cmd();
      return [];
    }
  };
  return p;
};

redisClient.pipeline = mockPipeline;
redisClient.hgetall = async (key) => redisMockStore[key] || {};
redisClient.hset = async (key, f, v) => {
  if (!redisMockStore[key]) redisMockStore[key] = {};
  redisMockStore[key][f] = String(v);
  return 1;
};
redisClient.get = async (key) => redisMockStore[key] || null;
redisClient.set = async (key, val) => {
  redisMockStore[key] = String(val);
  return "OK";
};
redisClient.del = async (key) => {
  delete redisMockStore[key];
  return 1;
};
redisClient.incr = async (key) => 1;

async function runOperationsSuiteTests() {
  console.log("==========================================================================");
  console.log("STARTING OPERATIONS SUITE E2E VERIFICATION SCRIPT");
  console.log("==========================================================================");

  let passed = 0;
  let failed = 0;

  const assert = (condition, message) => {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  };

  try {
    const configBefore = await prisma.routingConfig.findUnique({ where: { id: 1 } });
    const initialVersion = configBefore ? configBefore.currentVersion : 1;

    // 1. Create a Section Master
    console.log("\n1. Testing Section creation...");
    const reqSec = {
      body: {
        name: "Test Fastag Operations",
        code: "FASTAG_TEST",
        description: "E2E fastag operations",
        serviceType: "FASTAG",
        displayOrder: 15
      },
      user: { id: 79, email: "superadmin@dizipay.in", role: "SUPER_ADMIN" }
    };

    let createdSec = null;
    const resSec = {
      status: (code) => resSec,
      json: (data) => {
        createdSec = data.data;
        return resSec;
      }
    };

    await ops.createSection(reqSec, resSec);
    assert(createdSec && createdSec.name === "Test Fastag Operations", "Section successfully created in DB");

    // 2. Fetch all sections
    console.log("\n2. Testing Section retrieval...");
    let sectionList = null;
    const resList = {
      status: (code) => resList,
      json: (data) => {
        sectionList = data.data;
        return resList;
      }
    };
    await ops.getSections({}, resList);
    assert(sectionList && sectionList.length > 0, "Sections successfully loaded");

    // 3. Update Section
    console.log("\n3. Testing Section update...");
    const reqUpdate = {
      params: { id: createdSec.id },
      body: { name: "Updated Fastag Ops", displayOrder: 20 },
      user: { id: 79, email: "superadmin@dizipay.in", role: "SUPER_ADMIN" }
    };
    let updatedSec = null;
    const resUpdate = {
      status: (code) => resUpdate,
      json: (data) => {
        updatedSec = data.data;
        return resUpdate;
      }
    };
    await ops.updateSection(reqUpdate, resUpdate);
    assert(updatedSec && updatedSec.name === "Updated Fastag Ops" && updatedSec.displayOrder === 20, "Section successfully updated");

    // 4. Test Emergency Override and Rollback Snapshotting
    console.log("\n4. Testing Emergency Override update & rollback snapshotting...");
    const reqEmergency = {
      body: {
        globalFreeze: true,
        forcedProvider: "APIBOX",
        reason: "Test Emergency Global Freeze for E2E verification"
      },
      user: { id: 79, email: "superadmin@dizipay.in", role: "SUPER_ADMIN" }
    };

    let emergencyData = null;
    const resEmergency = {
      status: (code) => resEmergency,
      json: (data) => {
        emergencyData = data.data;
        return resEmergency;
      }
    };
    await ops.updateOverride(reqEmergency, resEmergency);
    assert(emergencyData && emergencyData.globalFreeze === "true", "Emergency Override globalFreeze successfully set in Redis");

    const snapshot = await prisma.emergencyOverrideSnapshot.findFirst({
      where: { createdBy: "superadmin@dizipay.in" },
      orderBy: { timestamp: "desc" }
    });
    assert(snapshot !== null && snapshot.reason === "Test Emergency Global Freeze for E2E verification", "EmergencyOverrideSnapshot created in DB successfully");

    // Rollback Emergency Action
    console.log("\n5. Testing Rollback of Emergency Override...");
    const reqRollback = {
      body: { reason: "Rolling back freeze during E2E verification" },
      user: { id: 79, email: "superadmin@dizipay.in", role: "SUPER_ADMIN" }
    };
    let rollbackData = null;
    const resRollback = {
      status: (code) => resRollback,
      json: (data) => {
        rollbackData = data.data;
        return resRollback;
      }
    };
    await ops.rollbackOverride(reqRollback, resRollback);
    // Since original value of globalFreeze was empty/undefined, it should be deleted/missing
    assert(rollbackData && rollbackData.globalFreeze === undefined, "Global freeze successfully removed after rollback");

    // 5. Verify version config was updated
    const configAfter = await prisma.routingConfig.findUnique({ where: { id: 1 } });
    const finalVersion = configAfter ? configAfter.currentVersion : 1;
    assert(finalVersion > initialVersion, `RoutingConfig version successfully incremented from ${initialVersion} to ${finalVersion}`);

    // Clean up created section
    await prisma.serviceSection.delete({ where: { id: createdSec.id } });

  } catch (err) {
    console.error("Operations suite E2E test threw an error:", err);
    failed++;
  } finally {
    await prisma.$disconnect();
    console.log("\n==========================================================================");
    console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log("==========================================================================");
    process.exit(failed > 0 ? 1 : 0);
  }
}

runOperationsSuiteTests();
