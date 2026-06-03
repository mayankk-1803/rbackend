import prisma from "../src/config/prisma.js";

async function main() {
  const operators = await prisma.operator.findMany();
  console.log("Current Operators in DB:", JSON.stringify(operators, null, 2));
  
  const mappings = await prisma.operatorMapping.findMany();
  console.log("Current OperatorMappings in DB:", JSON.stringify(mappings, null, 2));

  const providerMappings = await prisma.operatorProviderMapping.findMany();
  console.log("Current OperatorProviderMappings in DB:", JSON.stringify(providerMappings, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);
