import prisma from "../src/config/prisma.js";
import { logAction } from "../src/services/auditService.js";
import { incrementConfigVersion } from "../src/controllers/commissionAdminController.js";

async function main() {
  try {
    console.log("Simulating full assignUsersToSlab...");
    const slabId = 1;
    const userIds = [2];

    const slab = await prisma.slab.findUnique({
      where: { id: slabId }
    });

    if (!slab || slab.isDeleted) {
      console.log("Slab not found!");
      return;
    }

    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: {
        slabId: slabId,
        slabAssignedAt: new Date()
      }
    });
    console.log("User updated successfully");

    await logAction({
      action: "SLAB_ASSIGN",
      adminId: 2, // admin user id from audit-db output
      entity: "Slab",
      entityId: slabId,
      details: { 
        userIds, 
        userCount: userIds.length, 
        slabId, 
        timestamp: new Date() 
      },
      req: {
        ip: "127.0.0.1",
        headers: { "user-agent": "test" }
      }
    });
    console.log("Audit log saved successfully");

    await incrementConfigVersion();
    console.log("Config version incremented successfully");
  } catch (err) {
    console.error("Full Assign simulation error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
