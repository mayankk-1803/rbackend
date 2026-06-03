import prisma from "../src/config/prisma.js";

async function main() {
  const flags = await prisma.featureFlag.findMany({
    orderBy: { key: 'asc' }
  });
  console.log("Database Feature Flags:");
  console.table(flags);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
