import prisma from "../src/config/prisma.js";

async function main() {
  try {
    const users = await prisma.user.findMany({
      take: 20,
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        isActive: true
      }
    });
    console.log("Users in database:", users);
  } catch (err) {
    console.error("Database query failed:", err);
  } finally {
    process.exit(0);
  }
}

main();
