import prisma from "./server/src/config/prisma.js";

async function main() {
  const sectionCount = await prisma.serviceSection.count();
  const deletedSectionCount = await prisma.serviceSection.count({ where: { isDeleted: true } });
  
  const categoryCount = await prisma.serviceCategory.count();
  const activeCategoryCount = await prisma.serviceCategory.count({ where: { isActive: true } });
  
  const operatorCount = await prisma.operator.count();
  const activeOperatorCount = await prisma.operator.count({ where: { active: true } });
  
  const slabCount = await prisma.slab.count();
  const nonDeletedSlabCount = await prisma.slab.count({ where: { isDeleted: false } });
  const activeSlabCount = await prisma.slab.count({ where: { isActive: true, isDeleted: false } });
  
  const packageCount = await prisma.commissionPackage.count();
  const activePackageCount = await prisma.commissionPackage.count({ where: { isActive: true, isDeleted: false } });
  const deletedPackageCount = await prisma.commissionPackage.count({ where: { isDeleted: true } });

  const packageServiceSlabCount = await prisma.packageServiceSlab.count();
  
  const rechargeRuleCount = await prisma.rechargeCommissionRule.count();
  const activeRechargeRuleCount = await prisma.rechargeCommissionRule.count({ 
    where: { isDeleted: false, status: { in: ["ACTIVE", "APPROVED"] } } 
  });
  const pendingRechargeRuleCount = await prisma.rechargeCommissionRule.count({
    where: { isDeleted: false, status: "PENDING" }
  });

  const rangeRuleCount = await prisma.rangeCommissionRule.count();
  const activeRangeRuleCount = await prisma.rangeCommissionRule.count({
    where: { isDeleted: false, status: { in: ["ACTIVE", "APPROVED"] } }
  });
  const pendingRangeRuleCount = await prisma.rangeCommissionRule.count({
    where: { isDeleted: false, status: "PENDING" }
  });

  console.log(JSON.stringify({
    section: { total: sectionCount, deleted: deletedSectionCount },
    serviceCategory: { total: categoryCount, active: activeCategoryCount },
    operator: { total: operatorCount, active: activeOperatorCount },
    slab: { total: slabCount, nonDeleted: nonDeletedSlabCount, active: activeSlabCount },
    package: { total: packageCount, active: activePackageCount, deleted: deletedPackageCount },
    packageServiceSlab: { total: packageServiceSlabCount },
    rechargeRule: { total: rechargeRuleCount, active: activeRechargeRuleCount, pending: pendingRechargeRuleCount },
    rangeRule: { total: rangeRuleCount, active: activeRangeRuleCount, pending: pendingRangeRuleCount }
  }, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
