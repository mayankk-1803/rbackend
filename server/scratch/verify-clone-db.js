import prisma from "../src/config/prisma.js";

async function main() {
  try {
    const sourceSlabId = 1;
    console.log("=== STEP 1: FETCH ORIGINAL SLAB ===");
    const sourceSlab = await prisma.slab.findUnique({
      where: { id: sourceSlabId }
    });
    console.log("Original Slab:", JSON.stringify(sourceSlab, null, 2));

    const sourceRechargeCount = await prisma.rechargeCommissionRule.count({
      where: { slabId: sourceSlabId, isDeleted: false }
    });
    const sourceRangeCount = await prisma.rangeCommissionRule.count({
      where: { slabId: sourceSlabId, isDeleted: false }
    });
    console.log(`Original Slab rules - Recharge: ${sourceRechargeCount}, Range: ${sourceRangeCount}`);

    console.log("\n=== STEP 2: SIMULATE CLONE TRANSACTION ===");
    const cloneName = `Test Clone ${Date.now()}`;
    const newSlab = await prisma.$transaction(async (tx) => {
      // 1. Create slab
      const slab = await tx.slab.create({
        data: {
          name: cloneName,
          description: `Cloned from ${sourceSlab.name}`,
          isActive: true
        }
      });

      // 2. Clone Recharge Rules
      const rechargeRules = await tx.rechargeCommissionRule.findMany({
        where: { slabId: sourceSlabId, isDeleted: false }
      });

      for (const rule of rechargeRules) {
        await tx.rechargeCommissionRule.create({
          data: {
            slabId: slab.id,
            operatorId: rule.operatorId,
            serviceCategoryId: rule.serviceCategoryId,
            role: rule.role,
            commissionType: rule.commissionType,
            commissionValue: rule.commissionValue,
            realCommission: rule.realCommission,
            surchargeType: rule.surchargeType,
            surchargeValue: rule.surchargeValue,
            profitType: rule.profitType,
            profitValue: rule.profitValue,
            feeType: rule.feeType,
            feeValue: rule.feeValue,
            maxCommission: rule.maxCommission,
            fixedCharge: rule.fixedCharge,
            effectiveFrom: rule.effectiveFrom,
            effectiveTo: rule.effectiveTo,
            status: rule.status,
            version: 1
          }
        });
      }

      // 3. Clone Range Rules
      const rangeRules = await tx.rangeCommissionRule.findMany({
        where: { slabId: sourceSlabId, isDeleted: false }
      });

      for (const rule of rangeRules) {
        await tx.rangeCommissionRule.create({
          data: {
            slabId: slab.id,
            operatorId: rule.operatorId,
            serviceCategoryId: rule.serviceCategoryId,
            amountFrom: rule.amountFrom,
            amountTo: rule.amountTo,
            role: rule.role,
            commissionType: rule.commissionType,
            commissionValue: rule.commissionValue,
            realCommission: rule.realCommission,
            surchargeType: rule.surchargeType,
            surchargeValue: rule.surchargeValue,
            profitType: rule.profitType,
            profitValue: rule.profitValue,
            feeType: rule.feeType,
            feeValue: rule.feeValue,
            maxCommission: rule.maxCommission,
            fixedCharge: rule.fixedCharge,
            effectiveFrom: rule.effectiveFrom,
            effectiveTo: rule.effectiveTo,
            status: rule.status,
            version: 1
          }
        });
      }

      return slab;
    });

    console.log("\n=== STEP 3: VERIFY CLONED INSERT PROOF ===");
    console.log("New Slab ID:", newSlab.id);
    console.log("New Slab Name:", newSlab.name);

    const clonedRechargeCount = await prisma.rechargeCommissionRule.count({
      where: { slabId: newSlab.id, isDeleted: false }
    });
    const clonedRangeCount = await prisma.rangeCommissionRule.count({
      where: { slabId: newSlab.id, isDeleted: false }
    });
    console.log(`Cloned Slab rules in DB - Recharge: ${clonedRechargeCount}, Range: ${clonedRangeCount}`);

    console.log("\n=== STEP 4: CLEAN UP CLONED SLAB ===");
    // Delete cloned rules
    await prisma.rechargeCommissionRule.deleteMany({ where: { slabId: newSlab.id } });
    await prisma.rangeCommissionRule.deleteMany({ where: { slabId: newSlab.id } });
    // Delete slab
    await prisma.slab.delete({ where: { id: newSlab.id } });
    console.log("Successfully removed cloned test records.");

  } catch (err) {
    console.error("Clone verification failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
