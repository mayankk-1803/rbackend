import prisma from "../src/config/prisma.js";

async function main() {
  try {
    const users = await prisma.user.findMany({
      where: {
        id: { in: [1, 2, 3, 4, 5] }
      },
      select: {
        id: true,
        email: true,
        slabId: true,
        slabAssignedAt: true
      }
    });
    console.log("Current user slab assignments:");
    console.dir(users, { depth: null });
  } catch (err) {
    console.error("Error retrieving user slab assignments:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
