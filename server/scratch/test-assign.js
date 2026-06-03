import prisma from "../src/config/prisma.js";

async function main() {
  try {
    console.log("Testing assign users to slab...");
    const slabId = 1;
    const userIds = [2];

    const result = await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: {
        slabId: slabId,
        slabAssignedAt: new Date()
      }
    });
    console.log("Update success:", result);
  } catch (err) {
    console.error("Assign Users Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
