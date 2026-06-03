import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function run() {
  const perms = await prisma.rolePermission.findMany();
  console.log("=== RolePermission Records ===");
  console.log(JSON.stringify(perms, null, 2));
  await prisma.$disconnect();
}
run().catch(console.error);
