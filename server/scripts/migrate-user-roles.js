import prisma from "../src/config/prisma.js";

async function main() {
  console.log("Starting safe role migration...");
  
  // Find all users
  const users = await prisma.user.findMany({
    include: {
      apiKeys: true
    }
  });
  
  let migratedCount = 0;
  let skippedCount = 0;
  let warningsCount = 0;

  for (const user of users) {
    let targetRole = user.role;

    // Check if the user has active API keys, in which case they should be upgraded to API_USER role
    if (user.role === "USER" && user.apiKeys.length > 0) {
      targetRole = "API_USER";
    }

    // Ensure we handle invalid/unsupported cases if any
    if (!["USER", "API_USER", "ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      console.warn(`[WARNING] User ${user.id} has invalid role: ${user.role}. Defaulting to USER.`);
      targetRole = "USER";
      warningsCount++;
    }

    if (user.role !== targetRole) {
      console.log(`Migrating user ${user.id} (${user.email || user.phone}) from ${user.role} to ${targetRole}`);
      await prisma.user.update({
        where: { id: user.id },
        data: { role: targetRole }
      });
      migratedCount++;
    } else {
      skippedCount++;
    }
  }

  console.log("Migration complete!");
  console.log(`Migrated: ${migratedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Warnings: ${warningsCount}`);
}

main()
  .catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
