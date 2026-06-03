import prisma from "../src/config/prisma.js";

async function main() {
  try {
    console.log("=== DB AUDIT START ===");
    
    // 1. Fetch all role permissions
    const perms = await prisma.rolePermission.findMany();
    console.log("Role Permissions count:", perms.length);
    console.log(JSON.stringify(perms, null, 2));

    // 2. Fetch API Keys info
    const keysCount = await prisma.apiKey.count();
    console.log("ApiKey records count:", keysCount);
    
    const apiAccessCount = await prisma.apiAccess.count();
    console.log("ApiAccess records count:", apiAccessCount);

    // 3. Let's inspect users just to see admin ids/emails
    const users = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
      select: { id: true, email: true, role: true }
    });
    console.log("Admin/SuperAdmin users:", JSON.stringify(users, null, 2));
    
    console.log("=== DB AUDIT END ===");
  } catch (err) {
    console.error("DB Audit error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
