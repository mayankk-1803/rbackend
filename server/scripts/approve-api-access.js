import prisma from "../src/config/prisma.js";

async function main() {
  const userIdArg = process.argv[2];
  if (!userIdArg) {
    console.log("\n=======================================================");
    console.log("DiziPay API Partner CLI Approval Tool");
    console.log("=======================================================");
    console.log("Usage: node scripts/approve-api-access.js <userId>");
    console.log("Example: node scripts/approve-api-access.js 3\n");
    process.exit(1);
  }

  const userId = Number(userIdArg);
  if (isNaN(userId)) {
    console.error("Error: User ID must be a numeric value");
    process.exit(1);
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      console.error(`Error: User with ID ${userId} not found in database`);
      process.exit(1);
    }

    console.log(`\nFound User: ${user.name || 'N/A'} (Email: ${user.email}, Phone: ${user.phone})`);
    console.log(`Current Role: ${user.role}`);
    console.log("Upgrading account to API_USER and activating key access...");

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { role: "API_USER" }
      }),
      prisma.apiAccess.updateMany({
        where: { userId },
        data: { isActive: true }
      })
    ]);

    console.log("\n>>> SUCCESS: User role upgraded to 'API_USER' and API key access activated successfully!\n");
  } catch (err) {
    console.error("Failed to approve access request:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
