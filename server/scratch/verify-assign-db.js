import prisma from "../src/config/prisma.js";

async function main() {
  try {
    const userIds = [3, 4];
    const slabId = 1;

    console.log("=== STEP 1: BEFORE ASSIGNMENT ===");
    const beforeUsers = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, slabId: true, slabAssignedAt: true }
    });
    console.log(JSON.stringify(beforeUsers, null, 2));

    console.log("\n=== STEP 2: PERFORMING ASSIGNMENT ===");
    const assignResult = await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: {
        slabId: slabId,
        slabAssignedAt: new Date()
      }
    });
    console.log(`Updated ${assignResult.count} users successfully.`);

    console.log("\n=== STEP 3: AFTER ASSIGNMENT ===");
    const afterUsers = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, slabId: true, slabAssignedAt: true }
    });
    console.log(JSON.stringify(afterUsers, null, 2));

    console.log("\n=== STEP 4: RESTORING ORIGINAL NULL STATES ===");
    const restoreResult = await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: {
        slabId: null,
        slabAssignedAt: null
      }
    });
    console.log(`Restored ${restoreResult.count} users back to slabId: null.`);

  } catch (err) {
    console.error("Assignment validation failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
