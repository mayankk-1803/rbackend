import prisma from "../src/config/prisma.js";

async function main() {
  try {
    const user = await prisma.user.findUnique({
      where: { id: 2 },
      select: { id: true, email: true, role: true, commissionRole: true }
    });
    console.log("Admin user in DB:", JSON.stringify(user, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
