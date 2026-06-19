import prisma from "./src/config/prisma.js";

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      phone: true,
      role: true,
      commissionRole: true,
      isActive: true
    }
  });
  console.log("Users in Database:", JSON.stringify(users, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
