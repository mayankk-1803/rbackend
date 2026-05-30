import prisma from "../config/prisma.js";
import { logAction } from "../services/auditService.js";
import { redisClient } from "../config/redis.js";
import { acquireLock, releaseLock } from "../utils/redisLock.js";
import { getHighestPriorityRule } from "../utils/getHighestPriorityRule.js";

/**
 * Increment global commission version in both Database and Redis.
 */
export const incrementConfigVersion = async (tx = null) => {
  const client = tx || prisma;
  const config = await client.commissionConfig.upsert({
    where: { id: 1 },
    update: { currentVersion: { increment: 1 } },
    create: { id: 1, currentVersion: 1 }
  });

  try {
    await redisClient.set("commissionConfigVersion", config.currentVersion.toString());
  } catch (err) {
    console.warn("[CACHE] Redis failed to update commissionConfigVersion:", err.message);
  }

  return config.currentVersion;
};

/**
 * GET /api/admin/commission/slabs
 * Fetch slabs with pagination, search, and usage stats.
 */
export const getSlabs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const status = req.query.status; // 'active', 'inactive'

    const where = {
      isDeleted: false
    };

    if (search) {
      where.name = { contains: search };
    }

    if (status === "active") {
      where.isActive = true;
    } else if (status === "inactive") {
      where.isActive = false;
    }

    const [slabs, total] = await prisma.$transaction([
      prisma.slab.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" }
      }),
      prisma.slab.count({ where })
    ]);

    // Fetch usage statistics for each slab
    const slabsWithStats = await Promise.all(slabs.map(async (slab) => {
      // Packages linked directly to this slab
      const packageCount = await prisma.packageServiceSlab.count({
        where: { slabId: slab.id }
      });

      // Users linked to packages that reference this slab OR directly assigned to this slab
      const userCount = await prisma.user.count({
        where: {
          OR: [
            { slabId: slab.id },
            {
              package: {
                packageSlabs: {
                  some: { slabId: slab.id }
                }
              }
            }
          ]
        }
      });


      return {
        ...slab,
        packageCount,
        userCount
      };
    }));

    return res.json({
      success: true,
      data: {
        slabs: slabsWithStats,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error("[Slabs] Get Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/admin/commission/slabs
 * Create a new Slab.
 */
export const createSlab = async (req, res) => {
  try {
    const { name, description, isActive } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: "Slab name is required" });
    }

    // Check duplicate
    const duplicate = await prisma.slab.findFirst({
      where: { name, isDeleted: false }
    });

    if (duplicate) {
      return res.status(400).json({ success: false, message: "A slab with this name already exists" });
    }

    const slab = await prisma.slab.create({
      data: {
        name,
        description,
        isActive: isActive !== undefined ? isActive : true
      }
    });

    await logAction({
      action: "SLAB_CREATE",
      adminId: req.user.id,
      entity: "Slab",
      entityId: slab.id,
      details: { name, isActive },
      req
    });

    await incrementConfigVersion();

    return res.json({ success: true, message: "Slab created successfully", data: slab });
  } catch (error) {
    console.error("[Slabs] Create Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * PUT /api/admin/commission/slabs/:id
 * Update Slab details.
 */
export const updateSlab = async (req, res) => {
  try {
    const slabId = parseInt(req.params.id);
    const { name, description, isActive } = req.body;

    if (isNaN(slabId)) {
      return res.status(400).json({ success: false, message: "Invalid Slab ID" });
    }

    const slab = await prisma.slab.findUnique({
      where: { id: slabId }
    });

    if (!slab || slab.isDeleted) {
      return res.status(404).json({ success: false, message: "Slab not found" });
    }

    // Default Slab Protection: Prevent disabling default slab
    if (slab.isDefault && isActive === false) {
      return res.status(400).json({ success: false, message: "Default slab cannot be disabled" });
    }

    // Duplicate Check
    if (name) {
      const duplicate = await prisma.slab.findFirst({
        where: { name, id: { not: slabId }, isDeleted: false }
      });
      if (duplicate) {
        return res.status(400).json({ success: false, message: "A slab with this name already exists" });
      }
    }

    const updated = await prisma.slab.update({
      where: { id: slabId },
      data: {
        name,
        description,
        isActive: isActive !== undefined ? isActive : slab.isActive
      }
    });

    await logAction({
      action: "SLAB_UPDATE",
      adminId: req.user.id,
      entity: "Slab",
      entityId: slabId,
      details: {
        old: { name: slab.name, isActive: slab.isActive },
        new: { name: updated.name, isActive: updated.isActive }
      },
      req
    });

    await incrementConfigVersion();

    return res.json({ success: true, message: "Slab updated successfully", data: updated });
  } catch (error) {
    console.error("[Slabs] Update Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * DELETE /api/admin/commission/slabs/:id
 * Soft delete a slab.
 */
export const deleteSlab = async (req, res) => {
  try {
    const slabId = parseInt(req.params.id);

    if (isNaN(slabId)) {
      return res.status(400).json({ success: false, message: "Invalid Slab ID" });
    }

    const slab = await prisma.slab.findUnique({
      where: { id: slabId }
    });

    if (!slab || slab.isDeleted) {
      return res.status(404).json({ success: false, message: "Slab not found" });
    }

    // 1. Prevent deleting default slab
    if (slab.isDefault) {
      return res.status(400).json({ success: false, message: "Default slab cannot be deleted" });
    }

    // 2. Prevent deleting slab linked to packages
    const packageCount = await prisma.packageServiceSlab.count({
      where: { slabId }
    });
    if (packageCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Deletion rejected: Slab is assigned to ${packageCount} active package(s).`
      });
    }

    // 3. Prevent deleting slab linked to active users (directly or via packages)
    const userCount = await prisma.user.count({
      where: {
        OR: [
          { slabId },
          {
            package: {
              packageSlabs: {
                some: { slabId }
              }
            }
          }
        ]
      }
    });
    if (userCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Deletion rejected: Slab is active for ${userCount} user(s) (either directly assigned or via their packages).`
      });
    }

    // Soft delete
    const deleted = await prisma.slab.update({
      where: { id: slabId },
      data: {
        isDeleted: true,
        deletedAt: new Date()
      }
    });

    await logAction({
      action: "SLAB_DELETE",
      adminId: req.user.id,
      entity: "Slab",
      entityId: slabId,
      details: { name: slab.name },
      req
    });

    await incrementConfigVersion();

    return res.json({ success: true, message: "Slab deleted successfully (soft delete)" });
  } catch (error) {
    console.error("[Slabs] Delete Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/admin/commission/slabs/:id/clone
 * Clone/Copy slab and all its rules.
 */
export const cloneSlab = async (req, res) => {
  try {
    const sourceSlabId = parseInt(req.params.id);
    const { name, description } = req.body;

    if (isNaN(sourceSlabId)) {
      return res.status(400).json({ success: false, message: "Invalid Slab ID" });
    }

    if (!name) {
      return res.status(400).json({ success: false, message: "New slab name is required" });
    }

    // Check duplicate name
    const duplicate = await prisma.slab.findFirst({
      where: { name, isDeleted: false }
    });
    if (duplicate) {
      return res.status(400).json({ success: false, message: "A slab with this name already exists" });
    }

    const sourceSlab = await prisma.slab.findUnique({
      where: { id: sourceSlabId }
    });
    if (!sourceSlab || sourceSlab.isDeleted) {
      return res.status(404).json({ success: false, message: "Source slab not found" });
    }

    // Execute clone inside safe transaction
    const newSlab = await prisma.$transaction(async (tx) => {
      // 1. Create slab
      const slab = await tx.slab.create({
        data: {
          name,
          description: description || `Clone of ${sourceSlab.name}`,
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

    await logAction({
      action: "SLAB_CLONE",
      adminId: req.user.id,
      entity: "Slab",
      entityId: newSlab.id,
      details: { sourceSlabId, name },
      req
    });

    await incrementConfigVersion();

    return res.json({ success: true, message: "Slab cloned successfully", data: newSlab });
  } catch (error) {
    console.error("[Slabs] Clone Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/admin/commission/slabs/:id/assign-users
 * Assign a set of users to a package linked to this slab.
 */
export const assignUsersToSlab = async (req, res) => {
  try {
    const slabId = parseInt(req.params.id);
    const { userIds } = req.body;

    if (isNaN(slabId)) {
      return res.status(400).json({ success: false, message: "Invalid Slab ID" });
    }

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: "userIds array is required" });
    }

    const slab = await prisma.slab.findUnique({
      where: { id: slabId }
    });

    if (!slab || slab.isDeleted) {
      return res.status(404).json({ success: false, message: "Slab not found" });
    }

    // Update users slabId and slabAssignedAt (Leave packageId untouched)
    await prisma.user.updateMany({
      where: { id: { in: userIds.map(id => parseInt(id)) } },
      data: {
        slabId: slabId,
        slabAssignedAt: new Date()
      }
    });

    await logAction({
      action: "SLAB_ASSIGN",
      adminId: req.user.id,
      entity: "Slab",
      entityId: slabId,
      details: { 
        userIds, 
        userCount: userIds.length, 
        slabId, 
        timestamp: new Date() 
      },
      req
    });

    await incrementConfigVersion();

    return res.json({ success: true, message: `Successfully assigned ${userIds.length} users to slab: ${slab.name}` });
  } catch (error) {
    console.error("[Slabs] Assign Users Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/admin/commission/service-categories
 * Fetch active service categories.
 */
export const getServiceCategories = async (req, res) => {
  try {
    const categories = await prisma.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" }
    });
    return res.json({ success: true, data: categories });
  } catch (error) {
    console.error("[Packages] Get Service Categories Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/admin/commission/packages
 * Fetch packages list with search, pagination, status filter, and live usage stats.
 */
export const getPackages = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const status = req.query.status;

    const where = {
      isDeleted: false
    };

    if (search) {
      where.name = { contains: search };
    }

    if (status === "active") {
      where.isActive = true;
    } else if (status === "inactive") {
      where.isActive = false;
    }

    const [packages, total] = await prisma.$transaction([
      prisma.commissionPackage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" }
      }),
      prisma.commissionPackage.count({ where })
    ]);

    const packagesWithStats = await Promise.all(packages.map(async (pkg) => {
      const assignedUsers = await prisma.user.count({
        where: { packageId: pkg.id }
      });

      const slabCount = await prisma.packageServiceSlab.count({
        where: { packageId: pkg.id }
      });

      // Get mappings for service matrix
      const mappings = await prisma.packageServiceSlab.findMany({
        where: { packageId: pkg.id },
        select: {
          serviceCategoryId: true,
          slabId: true
        }
      });

      const matrix = {};
      mappings.forEach(m => {
        matrix[m.serviceCategoryId] = m.slabId;
      });

      return {
        ...pkg,
        assignedUsers,
        slabCount,
        matrix
      };
    }));

    return res.json({
      success: true,
      data: {
        packages: packagesWithStats,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error("[Packages] Get Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/admin/commission/packages
 * Create package + service matrix mapping.
 */
export const createPackage = async (req, res) => {
  try {
    const { name, description, cost, expiryDays, selfAssignment, isActive, matrix } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: "Package name is required" });
    }

    const duplicate = await prisma.commissionPackage.findFirst({
      where: { name, isDeleted: false }
    });

    if (duplicate) {
      return res.status(400).json({ success: false, message: "A package with this name already exists" });
    }

    const newPkg = await prisma.$transaction(async (tx) => {
      const pkg = await tx.commissionPackage.create({
        data: {
          name,
          description,
          cost: cost !== undefined ? parseFloat(cost) : 0.0,
          expiryDays: expiryDays ? parseInt(expiryDays) : null,
          selfAssignment: selfAssignment !== undefined ? selfAssignment : false,
          isActive: isActive !== undefined ? isActive : true,
          isDefault: false
        }
      });

      if (matrix && typeof matrix === "object") {
        for (const [catId, slabId] of Object.entries(matrix)) {
          if (slabId) {
            await tx.packageServiceSlab.create({
              data: {
                packageId: pkg.id,
                serviceCategoryId: parseInt(catId),
                slabId: parseInt(slabId)
              }
            });
          }
        }
      }

      return pkg;
    });

    await logAction({
      action: "PACKAGE_CREATE",
      adminId: req.user.id,
      entity: "CommissionPackage",
      entityId: newPkg.id,
      details: { name, cost, expiryDays, selfAssignment, isActive, matrix },
      req
    });

    await incrementConfigVersion();

    return res.json({ success: true, message: "Package created successfully", data: newPkg });
  } catch (error) {
    console.error("[Packages] Create Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * PUT /api/admin/commission/packages/:id
 * Update package details + service matrix mapping.
 */
export const updatePackage = async (req, res) => {
  try {
    const packageId = parseInt(req.params.id);
    const { name, description, cost, expiryDays, selfAssignment, isActive, matrix } = req.body;

    if (isNaN(packageId)) {
      return res.status(400).json({ success: false, message: "Invalid Package ID" });
    }

    const pkg = await prisma.commissionPackage.findUnique({
      where: { id: packageId }
    });

    if (!pkg || pkg.isDeleted) {
      return res.status(404).json({ success: false, message: "Package not found" });
    }

    if (pkg.isDefault && isActive === false) {
      return res.status(400).json({ success: false, message: "Default package cannot be disabled" });
    }

    if (name) {
      const duplicate = await prisma.commissionPackage.findFirst({
        where: { name, id: { not: packageId }, isDeleted: false }
      });
      if (duplicate) {
        return res.status(400).json({ success: false, message: "A package with this name already exists" });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const uPkg = await tx.commissionPackage.update({
        where: { id: packageId },
        data: {
          name,
          description,
          cost: cost !== undefined ? parseFloat(cost) : pkg.cost,
          expiryDays: expiryDays !== undefined ? (expiryDays ? parseInt(expiryDays) : null) : pkg.expiryDays,
          selfAssignment: selfAssignment !== undefined ? selfAssignment : pkg.selfAssignment,
          isActive: isActive !== undefined ? isActive : pkg.isActive
        }
      });

      if (matrix && typeof matrix === "object") {
        await tx.packageServiceSlab.deleteMany({
          where: { packageId }
        });

        for (const [catId, slabId] of Object.entries(matrix)) {
          if (slabId) {
            await tx.packageServiceSlab.create({
              data: {
                packageId,
                serviceCategoryId: parseInt(catId),
                slabId: parseInt(slabId)
              }
            });
          }
        }
      }

      return uPkg;
    });

    await logAction({
      action: "PACKAGE_UPDATE",
      adminId: req.user.id,
      entity: "CommissionPackage",
      entityId: packageId,
      details: {
        old: { name: pkg.name, cost: pkg.cost, isActive: pkg.isActive },
        new: { name: updated.name, cost: updated.cost, isActive: updated.isActive }
      },
      req
    });

    await incrementConfigVersion();

    return res.json({ success: true, message: "Package updated successfully", data: updated });
  } catch (error) {
    console.error("[Packages] Update Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * DELETE /api/admin/commission/packages/:id
 * Soft delete package.
 */
export const deletePackage = async (req, res) => {
  try {
    const packageId = parseInt(req.params.id);

    if (isNaN(packageId)) {
      return res.status(400).json({ success: false, message: "Invalid Package ID" });
    }

    const pkg = await prisma.commissionPackage.findUnique({
      where: { id: packageId }
    });

    if (!pkg || pkg.isDeleted) {
      return res.status(404).json({ success: false, message: "Package not found" });
    }

    if (pkg.isDefault) {
      return res.status(400).json({ success: false, message: "Default package cannot be deleted" });
    }

    const userCount = await prisma.user.count({
      where: { packageId }
    });
    if (userCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Deletion rejected: Package is assigned to ${userCount} active user(s).`
      });
    }

    const activeLinksCount = await prisma.packageServiceSlab.count({
      where: {
        packageId,
        slab: {
          isActive: true,
          isDeleted: false
        }
      }
    });
    if (activeLinksCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Deletion rejected: Package is linked to ${activeLinksCount} active slab(s).`
      });
    }

    await prisma.commissionPackage.update({
      where: { id: packageId },
      data: {
        isDeleted: true,
        deletedAt: new Date()
      }
    });

    await logAction({
      action: "PACKAGE_DELETE",
      adminId: req.user.id,
      entity: "CommissionPackage",
      entityId: packageId,
      details: { name: pkg.name },
      req
    });

    await incrementConfigVersion();

    return res.json({ success: true, message: "Package deleted successfully (soft delete)" });
  } catch (error) {
    console.error("[Packages] Delete Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/admin/commission/packages/:id/clone
 * Clone package cost, expiry, self assignment metadata, and service category mappings.
 */
export const clonePackage = async (req, res) => {
  try {
    const sourcePackageId = parseInt(req.params.id);
    const { name, description } = req.body;

    if (isNaN(sourcePackageId)) {
      return res.status(400).json({ success: false, message: "Invalid Source Package ID" });
    }

    if (!name) {
      return res.status(400).json({ success: false, message: "New package name is required" });
    }

    const duplicate = await prisma.commissionPackage.findFirst({
      where: { name, isDeleted: false }
    });
    if (duplicate) {
      return res.status(400).json({ success: false, message: "A package with this name already exists" });
    }

    const sourcePkg = await prisma.commissionPackage.findUnique({
      where: { id: sourcePackageId }
    });
    if (!sourcePkg || sourcePkg.isDeleted) {
      return res.status(404).json({ success: false, message: "Source package not found" });
    }

    const cloned = await prisma.$transaction(async (tx) => {
      const pkg = await tx.commissionPackage.create({
        data: {
          name,
          description: description || `Clone of ${sourcePkg.name}`,
          cost: sourcePkg.cost,
          expiryDays: sourcePkg.expiryDays,
          selfAssignment: sourcePkg.selfAssignment,
          isActive: true,
          isDefault: false
        }
      });

      const sourceLinks = await tx.packageServiceSlab.findMany({
        where: { packageId: sourcePackageId }
      });

      for (const link of sourceLinks) {
        await tx.packageServiceSlab.create({
          data: {
            packageId: pkg.id,
            serviceCategoryId: link.serviceCategoryId,
            slabId: link.slabId
          }
        });
      }

      return pkg;
    });

    await logAction({
      action: "PACKAGE_CLONE",
      adminId: req.user.id,
      entity: "CommissionPackage",
      entityId: cloned.id,
      details: { sourcePackageId, name },
      req
    });

    await incrementConfigVersion();

    return res.json({ success: true, message: "Package cloned successfully", data: cloned });
  } catch (error) {
    console.error("[Packages] Clone Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/admin/commission/packages/:id/assign-users
 * Assign target userIds to this package.
 */
export const assignUsersToPackage = async (req, res) => {
  try {
    const packageId = parseInt(req.params.id);
    const { userIds } = req.body;

    if (isNaN(packageId)) {
      return res.status(400).json({ success: false, message: "Invalid Package ID" });
    }

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: "userIds array is required" });
    }

    const pkg = await prisma.commissionPackage.findUnique({
      where: { id: packageId }
    });

    if (!pkg || pkg.isDeleted) {
      return res.status(404).json({ success: false, message: "Package not found" });
    }

    if (!pkg.isActive) {
      return res.status(400).json({ success: false, message: "Cannot assign users to an inactive package." });
    }

    await prisma.user.updateMany({
      where: { id: { in: userIds.map(id => parseInt(id)) } },
      data: {
        packageId: packageId,
        packageAssignedAt: new Date(),
        packageExpiresAt: pkg.expiryDays ? new Date(Date.now() + pkg.expiryDays * 24 * 60 * 60 * 1000) : null
      }
    });

    await logAction({
      action: "PACKAGE_ASSIGN",
      adminId: req.user.id,
      entity: "CommissionPackage",
      entityId: packageId,
      details: { 
        userIds, 
        userCount: userIds.length, 
        packageId, 
        timestamp: new Date() 
      },
      req
    });

    await incrementConfigVersion();

    return res.json({ success: true, message: `Successfully assigned ${userIds.length} users to package: ${pkg.name}` });
  } catch (error) {
    console.error("[Packages] Assign Users Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const normalizeDateFrom = (dateStr) => {
  if (!dateStr) return null;
  const str = typeof dateStr === "string" ? dateStr : dateStr.toISOString();
  const datePart = str.substring(0, 10);
  return new Date(`${datePart}T00:00:00.000Z`);
};

const normalizeDateTo = (dateStr) => {
  if (!dateStr) return null;
  const str = typeof dateStr === "string" ? dateStr : dateStr.toISOString();
  const datePart = str.substring(0, 10);
  return new Date(`${datePart}T23:59:59.999Z`);
};

/**
 * Helper to check if a new/modified rule overlaps in time range with existing ACTIVE/APPROVED rules
 */
const checkOverlap = async (slabId, operatorId, serviceCategoryId, role, effectiveFrom, effectiveTo, excludeId = null) => {
  const rules = await prisma.rechargeCommissionRule.findMany({
    where: {
      slabId,
      operatorId,
      serviceCategoryId,
      role,
      status: { in: ["ACTIVE", "APPROVED"] },
      isDeleted: false,
      id: excludeId ? { not: excludeId } : undefined
    }
  });

  const from = effectiveFrom ? normalizeDateFrom(effectiveFrom) : null;
  const to = effectiveTo ? normalizeDateTo(effectiveTo) : null;

  for (const rule of rules) {
    const ruleFrom = rule.effectiveFrom ? new Date(rule.effectiveFrom) : null;
    const ruleTo = rule.effectiveTo ? new Date(rule.effectiveTo) : null;

    const startA = from ? from.getTime() : 0;
    const endA = to ? to.getTime() : Infinity;
    const startB = ruleFrom ? ruleFrom.getTime() : 0;
    const endB = ruleTo ? ruleTo.getTime() : Infinity;

    if (startA <= endB && endA >= startB) {
      return true;
    }
  }
  return false;
};

/**
 * GET /api/admin/commission/recharge-rules
 * Fetch rules with search, pagination, and multi-filters.
 */
export const getRechargeRules = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const { slabId, operatorId, serviceCategoryId, role, status } = req.query;

    const where = {
      isDeleted: false
    };

    if (slabId) where.slabId = parseInt(slabId);
    if (operatorId) where.operatorId = parseInt(operatorId);
    if (serviceCategoryId) where.serviceCategoryId = parseInt(serviceCategoryId);
    if (role) where.role = role;
    if (status) where.status = status;

    if (search) {
      where.OR = [
        { operatorRel: { name: { contains: search } } },
        { serviceCategory: { name: { contains: search } } }
      ];
    }

    const [rules, total] = await prisma.$transaction([
      prisma.rechargeCommissionRule.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          slab: { select: { name: true } },
          operatorRel: { select: { name: true } },
          serviceCategory: { select: { name: true, code: true } }
        }
      }),
      prisma.rechargeCommissionRule.count({ where })
    ]);

    return res.json({
      success: true,
      data: {
        rules,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error("[Rules] Get Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/admin/commission/recharge-rules
 * Create a new rule.
 */
export const createRechargeRule = async (req, res) => {
  try {
    const {
      slabId,
      operatorId,
      serviceCategoryId,
      role,
      commissionType,
      commissionValue,
      realCommission,
      surchargeType,
      surchargeValue,
      profitType,
      profitValue,
      feeType,
      feeValue,
      maxCommission,
      fixedCharge,
      effectiveFrom,
      effectiveTo,
      status // ignore incoming status field
    } = req.body;

    if (!slabId || !operatorId || !serviceCategoryId || !role) {
      return res.status(400).json({ success: false, message: "Missing required rule parameters." });
    }

    const normFrom = effectiveFrom ? normalizeDateFrom(effectiveFrom) : null;
    const normTo = effectiveTo ? normalizeDateTo(effectiveTo) : null;

    const rule = await prisma.rechargeCommissionRule.create({
      data: {
        slabId: parseInt(slabId),
        operatorId: parseInt(operatorId),
        serviceCategoryId: parseInt(serviceCategoryId),
        role,
        commissionType: commissionType || "PERCENTAGE",
        commissionValue: parseFloat(commissionValue || 0),
        realCommission: parseFloat(realCommission || 0),
        surchargeType: surchargeType || "PERCENTAGE",
        surchargeValue: parseFloat(surchargeValue || 0),
        profitType: profitType || "PERCENTAGE",
        profitValue: parseFloat(profitValue || 0),
        feeType: feeType || "PERCENTAGE",
        feeValue: parseFloat(feeValue || 0),
        maxCommission: maxCommission ? parseFloat(maxCommission) : null,
        fixedCharge: parseFloat(fixedCharge || 0),
        effectiveFrom: normFrom,
        effectiveTo: normTo,
        status: "PENDING", // Always force status to PENDING
        version: 1
      }
    });

    await prisma.commissionRuleHistory.create({
      data: {
        ruleId: rule.id,
        ruleType: "RECHARGE",
        operatorId: parseInt(operatorId),
        role,
        oldValue: 0.0,
        newValue: parseFloat(commissionValue || 0),
        changedById: req.user.id,
        ipAddress: req.ip
      }
    });

    await logAction({
      action: "RULE_CREATE",
      adminId: req.user.id,
      entity: "RechargeCommissionRule",
      entityId: rule.id,
      details: { slabId, operatorId, serviceCategoryId, role, commissionValue },
      req
    });

    await incrementConfigVersion();

    return res.json({ success: true, message: "Recharge rule created successfully", data: rule });
  } catch (error) {
    console.error("[Rules] Create Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * PUT /api/admin/commission/recharge-rules/:id
 * Update an existing rule.
 */
export const updateRechargeRule = async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id);
    if (isNaN(ruleId)) {
      return res.status(400).json({ success: false, message: "Invalid Rule ID" });
    }

    const rule = await prisma.rechargeCommissionRule.findUnique({
      where: { id: ruleId }
    });

    if (!rule || rule.isDeleted) {
      return res.status(404).json({ success: false, message: "Rule not found" });
    }

    const {
      commissionType,
      commissionValue,
      realCommission,
      surchargeType,
      surchargeValue,
      profitType,
      profitValue,
      feeType,
      feeValue,
      maxCommission,
      fixedCharge,
      effectiveFrom,
      effectiveTo,
      status // ignore incoming status field
    } = req.body;

    const checkValDiff = (incoming, existing) => {
      if (incoming === undefined) return false;
      return parseFloat(incoming) !== existing;
    };

    const checkStrDiff = (incoming, existing) => {
      if (incoming === undefined) return false;
      return incoming !== existing;
    };

    const checkDateDiff = (incoming, existing) => {
      if (incoming === undefined) return false;
      if (!incoming && !existing) return false;
      if (incoming && !existing) return true;
      if (!incoming && existing) return true;
      const incTime = incoming ? normalizeDateFrom(incoming).getTime() : 0;
      const extTime = existing ? new Date(existing).getTime() : 0;
      return incTime !== extTime;
    };

    const checkDateToDiff = (incoming, existing) => {
      if (incoming === undefined) return false;
      if (!incoming && !existing) return false;
      if (incoming && !existing) return true;
      if (!incoming && existing) return true;
      const incTime = incoming ? normalizeDateTo(incoming).getTime() : 0;
      const extTime = existing ? new Date(existing).getTime() : 0;
      return incTime !== extTime;
    };

    let isContentChanged = false;

    if (
      checkStrDiff(commissionType, rule.commissionType) ||
      checkValDiff(commissionValue, rule.commissionValue) ||
      checkValDiff(realCommission, rule.realCommission) ||
      checkStrDiff(surchargeType, rule.surchargeType) ||
      checkValDiff(surchargeValue, rule.surchargeValue) ||
      checkStrDiff(profitType, rule.profitType) ||
      checkValDiff(profitValue, rule.profitValue) ||
      checkStrDiff(feeType, rule.feeType) ||
      checkValDiff(feeValue, rule.feeValue) ||
      checkValDiff(maxCommission, rule.maxCommission) ||
      checkValDiff(fixedCharge, rule.fixedCharge) ||
      checkDateDiff(effectiveFrom, rule.effectiveFrom) ||
      checkDateToDiff(effectiveTo, rule.effectiveTo)
    ) {
      isContentChanged = true;
    }

    const targetStatus = isContentChanged ? "PENDING" : rule.status;

    const normFrom = effectiveFrom !== undefined ? (effectiveFrom ? normalizeDateFrom(effectiveFrom) : null) : rule.effectiveFrom;
    const normTo = effectiveTo !== undefined ? (effectiveTo ? normalizeDateTo(effectiveTo) : null) : rule.effectiveTo;

    const updated = await prisma.rechargeCommissionRule.update({
      where: { id: ruleId },
      data: {
        commissionType: commissionType || rule.commissionType,
        commissionValue: commissionValue !== undefined ? parseFloat(commissionValue) : rule.commissionValue,
        realCommission: realCommission !== undefined ? parseFloat(realCommission) : rule.realCommission,
        surchargeType: surchargeType || rule.surchargeType,
        surchargeValue: surchargeValue !== undefined ? parseFloat(surchargeValue) : rule.surchargeValue,
        profitType: profitType || rule.profitType,
        profitValue: profitValue !== undefined ? parseFloat(profitValue) : rule.profitValue,
        feeType: feeType || rule.feeType,
        feeValue: feeValue !== undefined ? parseFloat(feeValue) : rule.feeValue,
        maxCommission: maxCommission !== undefined ? (maxCommission ? parseFloat(maxCommission) : null) : rule.maxCommission,
        fixedCharge: fixedCharge !== undefined ? parseFloat(fixedCharge) : rule.fixedCharge,
        effectiveFrom: normFrom,
        effectiveTo: normTo,
        status: targetStatus,
        version: { increment: 1 }
      }
    });

    if (commissionValue !== undefined && parseFloat(commissionValue) !== rule.commissionValue) {
      await prisma.commissionRuleHistory.create({
        data: {
          ruleId,
          ruleType: "RECHARGE",
          operatorId: rule.operatorId,
          role: rule.role,
          oldValue: rule.commissionValue,
          newValue: parseFloat(commissionValue),
          changedById: req.user.id,
          ipAddress: req.ip
        }
      });
    }

    await logAction({
      action: "RULE_UPDATE",
      adminId: req.user.id,
      entity: "RechargeCommissionRule",
      entityId: ruleId,
      details: {
        old: { commissionValue: rule.commissionValue, status: rule.status },
        new: { commissionValue: updated.commissionValue, status: updated.status }
      },
      req
    });

    await incrementConfigVersion();

    return res.json({ success: true, message: "Rule updated successfully", data: updated });
  } catch (error) {
    console.error("[Rules] Update Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * DELETE /api/admin/commission/recharge-rules/:id
 * Soft delete a rule.
 */
export const deleteRechargeRule = async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id);
    if (isNaN(ruleId)) {
      return res.status(400).json({ success: false, message: "Invalid Rule ID" });
    }

    const rule = await prisma.rechargeCommissionRule.findUnique({
      where: { id: ruleId }
    });

    if (!rule || rule.isDeleted) {
      return res.status(404).json({ success: false, message: "Rule not found" });
    }

    await prisma.rechargeCommissionRule.update({
      where: { id: ruleId },
      data: {
        isDeleted: true,
        deletedAt: new Date()
      }
    });

    await logAction({
      action: "RULE_DELETE",
      adminId: req.user.id,
      entity: "RechargeCommissionRule",
      entityId: ruleId,
      details: { operatorId: rule.operatorId, role: rule.role },
      req
    });

    await incrementConfigVersion();

    return res.json({ success: true, message: "Rule deleted successfully" });
  } catch (error) {
    console.error("[Rules] Delete Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/admin/commission/recharge-rules/:id/clone
 * Clone rule as PENDING status.
 */
export const cloneRechargeRule = async (req, res) => {
  try {
    const sourceRuleId = parseInt(req.params.id);
    if (isNaN(sourceRuleId)) {
      return res.status(400).json({ success: false, message: "Invalid Rule ID" });
    }

    const sourceRule = await prisma.rechargeCommissionRule.findUnique({
      where: { id: sourceRuleId }
    });

    if (!sourceRule || sourceRule.isDeleted) {
      return res.status(404).json({ success: false, message: "Source rule not found" });
    }

    const { slabId, operatorId, serviceCategoryId, role } = req.body;

    const cloned = await prisma.rechargeCommissionRule.create({
      data: {
        slabId: slabId ? parseInt(slabId) : sourceRule.slabId,
        operatorId: operatorId ? parseInt(operatorId) : sourceRule.operatorId,
        serviceCategoryId: serviceCategoryId ? parseInt(serviceCategoryId) : sourceRule.serviceCategoryId,
        role: role || sourceRule.role,
        commissionType: sourceRule.commissionType,
        commissionValue: sourceRule.commissionValue,
        realCommission: sourceRule.realCommission,
        surchargeType: sourceRule.surchargeType,
        surchargeValue: sourceRule.surchargeValue,
        profitType: sourceRule.profitType,
        profitValue: sourceRule.profitValue,
        feeType: sourceRule.feeType,
        feeValue: sourceRule.feeValue,
        maxCommission: sourceRule.maxCommission,
        fixedCharge: sourceRule.fixedCharge,
        effectiveFrom: sourceRule.effectiveFrom,
        effectiveTo: sourceRule.effectiveTo,
        status: "PENDING",
        version: 1
      }
    });

    await logAction({
      action: "RULE_CLONE",
      adminId: req.user.id,
      entity: "RechargeCommissionRule",
      entityId: cloned.id,
      details: { sourceRuleId, slabId, operatorId, serviceCategoryId, role },
      req
    });

    await incrementConfigVersion();

    return res.json({ success: true, message: "Rule cloned successfully in PENDING status", data: cloned });
  } catch (error) {
    console.error("[Rules] Clone Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/admin/commission/recharge-rules/:id/approve
 * Approve and activate a rule.
 */
export const approveRechargeRule = async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id);
    const { comment } = req.body;

    if (isNaN(ruleId)) {
      return res.status(400).json({ success: false, message: "Invalid Rule ID" });
    }

    const rule = await prisma.rechargeCommissionRule.findUnique({
      where: { id: ruleId }
    });

    if (!rule || rule.isDeleted) {
      return res.status(404).json({ success: false, message: "Rule not found" });
    }

    const isOverlapping = await checkOverlap(
      rule.slabId,
      rule.operatorId,
      rule.serviceCategoryId,
      rule.role,
      rule.effectiveFrom,
      rule.effectiveTo,
      rule.id
    );
    if (isOverlapping) {
      return res.status(400).json({ success: false, message: "Cannot approve: Rule overlaps with an existing active/approved rule." });
    }

    // Atomic update where status is PENDING
    const result = await prisma.rechargeCommissionRule.updateMany({
      where: {
        id: ruleId,
        status: "PENDING",
        isDeleted: false
      },
      data: {
        status: "ACTIVE",
        approvedById: req.user.id,
        approvedAt: new Date(),
        approvalComment: comment || "Approved by Admin"
      }
    });

    if (result.count === 0) {
      return res.status(400).json({ success: false, message: "Rule has already been approved, rejected, or is not in PENDING status." });
    }

    // Refetch on success
    const approved = await prisma.rechargeCommissionRule.findUnique({
      where: { id: ruleId }
    });

    await logAction({
      action: "RULE_APPROVE",
      adminId: req.user.id,
      entity: "RechargeCommissionRule",
      entityId: ruleId,
      details: { comment },
      req
    });

    await incrementConfigVersion();

    return res.json({ success: true, message: "Rule approved and activated successfully", data: approved });
  } catch (error) {
    console.error("[Rules] Approve Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/admin/commission/recharge-rules/:id/reject
 * Reject a rule.
 */
export const rejectRechargeRule = async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id);
    const { comment } = req.body;

    if (isNaN(ruleId)) {
      return res.status(400).json({ success: false, message: "Invalid Rule ID" });
    }

    const rule = await prisma.rechargeCommissionRule.findUnique({
      where: { id: ruleId }
    });

    if (!rule || rule.isDeleted) {
      return res.status(404).json({ success: false, message: "Rule not found" });
    }

    // Atomic update where status is PENDING
    const result = await prisma.rechargeCommissionRule.updateMany({
      where: {
        id: ruleId,
        status: "PENDING",
        isDeleted: false
      },
      data: {
        status: "REJECTED",
        approvedById: req.user.id,
        approvedAt: new Date(),
        approvalComment: comment || "Rejected by Admin"
      }
    });

    if (result.count === 0) {
      return res.status(400).json({ success: false, message: "Rule has already been approved, rejected, or is not in PENDING status." });
    }

    // Refetch on success
    const rejected = await prisma.rechargeCommissionRule.findUnique({
      where: { id: ruleId }
    });

    await logAction({
      action: "RULE_REJECT",
      adminId: req.user.id,
      entity: "RechargeCommissionRule",
      entityId: ruleId,
      details: { comment },
      req
    });

    await incrementConfigVersion();

    return res.json({ success: true, message: "Rule rejected successfully", data: rejected });
  } catch (error) {
    console.error("[Rules] Reject Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/admin/commission/operators
 * Fetch active operators.
 */
export const getCommissionOperators = async (req, res) => {
  try {
    const ops = await prisma.operator.findMany({
      where: { active: true },
      orderBy: { name: "asc" }
    });
    return res.json({ success: true, data: ops });
  } catch (error) {
    console.error("[Rules] Get Operators Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/admin/commission/commission-roles
 * Fetch CommissionRole enum values.
 */
export const getCommissionRoles = async (req, res) => {
  try {
    const roles = ["SUPER_ADMIN", "SUB_ADMIN", "MASTER_DISTRIBUTOR", "DISTRIBUTOR", "RETAILER", "API_USER", "CUSTOMER"];
    return res.json({ success: true, data: roles });
  } catch (error) {
    console.error("[Rules] Get Commission Roles Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Helper to check if a new/modified range rule overlaps in amount and time range with existing ACTIVE/APPROVED rules
 */
const checkRangeOverlap = async (slabId, operatorId, serviceCategoryId, role, mode, amountFrom, amountTo, effectiveFrom, effectiveTo, excludeId = null) => {
  const rules = await prisma.rangeCommissionRule.findMany({
    where: {
      slabId: parseInt(slabId),
      operatorId: parseInt(operatorId),
      serviceCategoryId: parseInt(serviceCategoryId),
      role,
      mode,
      status: { in: ["ACTIVE", "APPROVED"] },
      isDeleted: false,
      id: excludeId ? { not: excludeId } : undefined
    }
  });

  const fromDate = effectiveFrom ? normalizeDateFrom(effectiveFrom) : null;
  const toDate = effectiveTo ? normalizeDateTo(effectiveTo) : null;

  const startA = fromDate ? fromDate.getTime() : 0;
  const endA = toDate ? toDate.getTime() : Infinity;

  const amtFromA = parseFloat(amountFrom);
  const amtToA = parseFloat(amountTo);

  for (const rule of rules) {
    const ruleFrom = rule.effectiveFrom ? new Date(rule.effectiveFrom) : null;
    const ruleTo = rule.effectiveTo ? new Date(rule.effectiveTo) : null;

    const startB = ruleFrom ? ruleFrom.getTime() : 0;
    const endB = ruleTo ? ruleTo.getTime() : Infinity;

    const overlapDates = startA <= endB && endA >= startB;
    if (!overlapDates) continue;

    const amtFromB = rule.amountFrom;
    const amtToB = rule.amountTo;

    const overlapAmounts = amtFromA <= amtToB && amtToA >= amtFromB;
    if (overlapAmounts) {
      return true;
    }
  }
  return false;
};

/**
 * GET /api/admin/commission/range-rules
 * Fetch range rules with search, pagination, and multi-filters.
 */
export const getRangeRules = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const { slabId, operatorId, serviceCategoryId, role, status, mode } = req.query;

    const where = {
      isDeleted: false
    };

    if (slabId) where.slabId = parseInt(slabId);
    if (operatorId) where.operatorId = parseInt(operatorId);
    if (serviceCategoryId) where.serviceCategoryId = parseInt(serviceCategoryId);
    if (role) where.role = role;
    if (status) where.status = status;
    if (mode) where.mode = mode;

    if (search) {
      where.OR = [
        { operatorRel: { name: { contains: search } } },
        { serviceCategory: { name: { contains: search } } }
      ];
    }

    const [rules, total] = await prisma.$transaction([
      prisma.rangeCommissionRule.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          slab: { select: { name: true } },
          operatorRel: { select: { name: true } },
          serviceCategory: { select: { name: true, code: true } }
        }
      }),
      prisma.rangeCommissionRule.count({ where })
    ]);

    return res.json({
      success: true,
      data: {
        rules,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error("[RangeRules] Get Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/admin/commission/range-rules
 * Create a new range rule.
 */
export const createRangeRule = async (req, res) => {
  try {
    const {
      slabId,
      operatorId,
      serviceCategoryId,
      amountFrom,
      amountTo,
      role,
      mode,
      commissionType,
      commissionValue,
      realCommission,
      surchargeType,
      surchargeValue,
      profitType,
      profitValue,
      feeType,
      feeValue,
      maxCommission,
      fixedCharge,
      effectiveFrom,
      effectiveTo,
    } = req.body;

    if (!slabId || !operatorId || !serviceCategoryId || amountFrom === undefined || amountTo === undefined || !role) {
      return res.status(400).json({ success: false, message: "Missing required range rule parameters." });
    }

    const amtFrom = parseFloat(amountFrom);
    const amtTo = parseFloat(amountTo);

    if (isNaN(amtFrom) || isNaN(amtTo) || amtFrom < 0 || amtTo < amtFrom) {
      return res.status(400).json({ success: false, message: "Invalid amount range configuration." });
    }

    const normFrom = effectiveFrom ? normalizeDateFrom(effectiveFrom) : null;
    const normTo = effectiveTo ? normalizeDateTo(effectiveTo) : null;

    const isOverlapping = await checkRangeOverlap(
      slabId,
      operatorId,
      serviceCategoryId,
      role,
      mode || "GENERAL",
      amtFrom,
      amtTo,
      normFrom,
      normTo
    );
    if (isOverlapping) {
      return res.status(400).json({ success: false, message: "Cannot create rule: Overlaps with an existing active/approved range rule." });
    }

    const rule = await prisma.rangeCommissionRule.create({
      data: {
        slabId: parseInt(slabId),
        operatorId: parseInt(operatorId),
        serviceCategoryId: parseInt(serviceCategoryId),
        amountFrom: amtFrom,
        amountTo: amtTo,
        role,
        mode: mode || "GENERAL",
        commissionType: commissionType || "PERCENTAGE",
        commissionValue: parseFloat(commissionValue || 0),
        realCommission: parseFloat(realCommission || 0),
        surchargeType: surchargeType || "PERCENTAGE",
        surchargeValue: parseFloat(surchargeValue || 0),
        profitType: profitType || "PERCENTAGE",
        profitValue: parseFloat(profitValue || 0),
        feeType: feeType || "PERCENTAGE",
        feeValue: parseFloat(feeValue || 0),
        maxCommission: maxCommission ? parseFloat(maxCommission) : null,
        fixedCharge: parseFloat(fixedCharge || 0),
        effectiveFrom: normFrom,
        effectiveTo: normTo,
        status: "PENDING",
        version: 1
      }
    });

    await prisma.commissionRuleHistory.create({
      data: {
        ruleId: rule.id,
        ruleType: "RANGE",
        operatorId: parseInt(operatorId),
        role,
        oldValue: 0.0,
        newValue: parseFloat(commissionValue || 0),
        newMode: mode || "GENERAL",
        newAmountFrom: amtFrom,
        newAmountTo: amtTo,
        changedById: req.user.id,
        ipAddress: req.ip
      }
    });

    await logAction({
      action: "RANGE_RULE_CREATE",
      adminId: req.user.id,
      entity: "RangeCommissionRule",
      entityId: rule.id,
      details: { slabId, operatorId, serviceCategoryId, role, mode, amountFrom: amtFrom, amountTo: amtTo, commissionValue },
      req
    });

    await incrementConfigVersion();

    return res.json({ success: true, message: "Range rule created successfully in PENDING status", data: rule });
  } catch (error) {
    console.error("[RangeRules] Create Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * PUT /api/admin/commission/range-rules/:id
 * Update an existing range rule.
 */
export const updateRangeRule = async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id);
    if (isNaN(ruleId)) {
      return res.status(400).json({ success: false, message: "Invalid Rule ID" });
    }

    const rule = await prisma.rangeCommissionRule.findUnique({
      where: { id: ruleId }
    });

    if (!rule || rule.isDeleted) {
      return res.status(404).json({ success: false, message: "Rule not found" });
    }

    const {
      amountFrom,
      amountTo,
      mode,
      commissionType,
      commissionValue,
      realCommission,
      surchargeType,
      surchargeValue,
      profitType,
      profitValue,
      feeType,
      feeValue,
      maxCommission,
      fixedCharge,
      effectiveFrom,
      effectiveTo,
    } = req.body;

    const checkValDiff = (incoming, existing) => {
      if (incoming === undefined) return false;
      return parseFloat(incoming) !== existing;
    };

    const checkStrDiff = (incoming, existing) => {
      if (incoming === undefined) return false;
      return incoming !== existing;
    };

    const checkDateDiff = (incoming, existing) => {
      if (incoming === undefined) return false;
      if (!incoming && !existing) return false;
      if (incoming && !existing) return true;
      if (!incoming && existing) return true;
      const incTime = incoming ? normalizeDateFrom(incoming).getTime() : 0;
      const extTime = existing ? new Date(existing).getTime() : 0;
      return incTime !== extTime;
    };

    const checkDateToDiff = (incoming, existing) => {
      if (incoming === undefined) return false;
      if (!incoming && !existing) return false;
      if (incoming && !existing) return true;
      if (!incoming && existing) return true;
      const incTime = incoming ? normalizeDateTo(incoming).getTime() : 0;
      const extTime = existing ? new Date(existing).getTime() : 0;
      return incTime !== extTime;
    };

    let isContentChanged = false;

    if (
      checkValDiff(amountFrom, rule.amountFrom) ||
      checkValDiff(amountTo, rule.amountTo) ||
      checkStrDiff(mode, rule.mode) ||
      checkStrDiff(commissionType, rule.commissionType) ||
      checkValDiff(commissionValue, rule.commissionValue) ||
      checkValDiff(realCommission, rule.realCommission) ||
      checkStrDiff(surchargeType, rule.surchargeType) ||
      checkValDiff(surchargeValue, rule.surchargeValue) ||
      checkStrDiff(profitType, rule.profitType) ||
      checkValDiff(profitValue, rule.profitValue) ||
      checkStrDiff(feeType, rule.feeType) ||
      checkValDiff(feeValue, rule.feeValue) ||
      checkValDiff(maxCommission, rule.maxCommission) ||
      checkValDiff(fixedCharge, rule.fixedCharge) ||
      checkDateDiff(effectiveFrom, rule.effectiveFrom) ||
      checkDateToDiff(effectiveTo, rule.effectiveTo)
    ) {
      isContentChanged = true;
    }

    const normFrom = effectiveFrom !== undefined ? (effectiveFrom ? normalizeDateFrom(effectiveFrom) : null) : rule.effectiveFrom;
    const normTo = effectiveTo !== undefined ? (effectiveTo ? normalizeDateTo(effectiveTo) : null) : rule.effectiveTo;
    const targetAmtFrom = amountFrom !== undefined ? parseFloat(amountFrom) : rule.amountFrom;
    const targetAmtTo = amountTo !== undefined ? parseFloat(amountTo) : rule.amountTo;
    const targetMode = mode !== undefined ? mode : rule.mode;

    if (isNaN(targetAmtFrom) || isNaN(targetAmtTo) || targetAmtFrom < 0 || targetAmtTo < targetAmtFrom) {
      return res.status(400).json({ success: false, message: "Invalid amount range configuration." });
    }

    const targetStatus = isContentChanged ? "PENDING" : rule.status;

    if (isContentChanged && (rule.status === "ACTIVE" || rule.status === "APPROVED")) {
      const isOverlapping = await checkRangeOverlap(
        rule.slabId,
        rule.operatorId,
        rule.serviceCategoryId,
        rule.role,
        targetMode,
        targetAmtFrom,
        targetAmtTo,
        normFrom,
        normTo,
        rule.id
      );
      if (isOverlapping) {
        return res.status(400).json({ success: false, message: "Cannot update rule: Overlaps with an existing active/approved range rule." });
      }
    }

    const updated = await prisma.rangeCommissionRule.update({
      where: { id: ruleId },
      data: {
        amountFrom: targetAmtFrom,
        amountTo: targetAmtTo,
        mode: targetMode,
        commissionType: commissionType || rule.commissionType,
        commissionValue: commissionValue !== undefined ? parseFloat(commissionValue) : rule.commissionValue,
        realCommission: realCommission !== undefined ? parseFloat(realCommission) : rule.realCommission,
        surchargeType: surchargeType || rule.surchargeType,
        surchargeValue: surchargeValue !== undefined ? parseFloat(surchargeValue) : rule.surchargeValue,
        profitType: profitType || rule.profitType,
        profitValue: profitValue !== undefined ? parseFloat(profitValue) : rule.profitValue,
        feeType: feeType || rule.feeType,
        feeValue: feeValue !== undefined ? parseFloat(feeValue) : rule.feeValue,
        maxCommission: maxCommission !== undefined ? (maxCommission ? parseFloat(maxCommission) : null) : rule.maxCommission,
        fixedCharge: fixedCharge !== undefined ? parseFloat(fixedCharge) : rule.fixedCharge,
        effectiveFrom: normFrom,
        effectiveTo: normTo,
        status: targetStatus,
        version: { increment: 1 }
      }
    });

    if (isContentChanged) {
      await prisma.commissionRuleHistory.create({
        data: {
          ruleId,
          ruleType: "RANGE",
          operatorId: rule.operatorId,
          role: rule.role,
          oldValue: rule.commissionValue,
          newValue: updated.commissionValue,
          oldMode: rule.mode,
          newMode: updated.mode,
          oldAmountFrom: rule.amountFrom,
          newAmountFrom: updated.amountFrom,
          oldAmountTo: rule.amountTo,
          newAmountTo: updated.amountTo,
          changedById: req.user.id,
          ipAddress: req.ip
        }
      });
    }

    await logAction({
      action: "RANGE_RULE_UPDATE",
      adminId: req.user.id,
      entity: "RangeCommissionRule",
      entityId: ruleId,
      details: {
        old: { amountFrom: rule.amountFrom, amountTo: rule.amountTo, commissionValue: rule.commissionValue, status: rule.status, mode: rule.mode },
        new: { amountFrom: updated.amountFrom, amountTo: updated.amountTo, commissionValue: updated.commissionValue, status: updated.status, mode: updated.mode }
      },
      req
    });

    await incrementConfigVersion();

    return res.json({ success: true, message: "Range rule updated successfully", data: updated });
  } catch (error) {
    console.error("[RangeRules] Update Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * DELETE /api/admin/commission/range-rules/:id
 * Soft delete a range rule.
 */
export const deleteRangeRule = async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id);
    if (isNaN(ruleId)) {
      return res.status(400).json({ success: false, message: "Invalid Rule ID" });
    }

    const rule = await prisma.rangeCommissionRule.findUnique({
      where: { id: ruleId }
    });

    if (!rule || rule.isDeleted) {
      return res.status(404).json({ success: false, message: "Rule not found" });
    }

    await prisma.rangeCommissionRule.update({
      where: { id: ruleId },
      data: {
        isDeleted: true,
        deletedAt: new Date()
      }
    });

    await logAction({
      action: "RANGE_RULE_DELETE",
      adminId: req.user.id,
      entity: "RangeCommissionRule",
      entityId: ruleId,
      details: { operatorId: rule.operatorId, role: rule.role, amountFrom: rule.amountFrom, amountTo: rule.amountTo },
      req
    });

    await incrementConfigVersion();

    return res.json({ success: true, message: "Range rule deleted successfully" });
  } catch (error) {
    console.error("[RangeRules] Delete Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/admin/commission/range-rules/:id/clone
 * Clone range rule as PENDING status.
 */
export const cloneRangeRule = async (req, res) => {
  try {
    const sourceRuleId = parseInt(req.params.id);
    if (isNaN(sourceRuleId)) {
      return res.status(400).json({ success: false, message: "Invalid Rule ID" });
    }

    const sourceRule = await prisma.rangeCommissionRule.findUnique({
      where: { id: sourceRuleId }
    });

    if (!sourceRule || sourceRule.isDeleted) {
      return res.status(404).json({ success: false, message: "Source rule not found" });
    }

    const { slabId, operatorId, serviceCategoryId, role, amountFrom, amountTo, mode } = req.body;

    const targetSlabId = slabId ? parseInt(slabId) : sourceRule.slabId;
    const targetOperatorId = operatorId ? parseInt(operatorId) : sourceRule.operatorId;
    const targetServiceCategoryId = serviceCategoryId ? parseInt(serviceCategoryId) : sourceRule.serviceCategoryId;
    const targetRole = role || sourceRule.role;
    const targetAmtFrom = amountFrom !== undefined ? parseFloat(amountFrom) : sourceRule.amountFrom;
    const targetAmtTo = amountTo !== undefined ? parseFloat(amountTo) : sourceRule.amountTo;
    const targetMode = mode || sourceRule.mode;

    const cloned = await prisma.rangeCommissionRule.create({
      data: {
        slabId: targetSlabId,
        operatorId: targetOperatorId,
        serviceCategoryId: targetServiceCategoryId,
        role: targetRole,
        amountFrom: targetAmtFrom,
        amountTo: targetAmtTo,
        mode: targetMode,
        commissionType: sourceRule.commissionType,
        commissionValue: sourceRule.commissionValue,
        realCommission: sourceRule.realCommission,
        surchargeType: sourceRule.surchargeType,
        surchargeValue: sourceRule.surchargeValue,
        profitType: sourceRule.profitType,
        profitValue: sourceRule.profitValue,
        feeType: sourceRule.feeType,
        feeValue: sourceRule.feeValue,
        maxCommission: sourceRule.maxCommission,
        fixedCharge: sourceRule.fixedCharge,
        effectiveFrom: sourceRule.effectiveFrom,
        effectiveTo: sourceRule.effectiveTo,
        status: "PENDING",
        version: 1
      }
    });

    await logAction({
      action: "RANGE_RULE_CLONE",
      adminId: req.user.id,
      entity: "RangeCommissionRule",
      entityId: cloned.id,
      details: { sourceRuleId, slabId: targetSlabId, operatorId: targetOperatorId, serviceCategoryId: targetServiceCategoryId, role: targetRole, amountFrom: targetAmtFrom, amountTo: targetAmtTo, mode: targetMode },
      req
    });

    await incrementConfigVersion();

    return res.json({ success: true, message: "Range rule cloned successfully in PENDING status", data: cloned });
  } catch (error) {
    console.error("[RangeRules] Clone Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/admin/commission/range-rules/:id/approve
 * Approve and activate a range rule.
 */
export const approveRangeRule = async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id);
    const { comment } = req.body;

    if (isNaN(ruleId)) {
      return res.status(400).json({ success: false, message: "Invalid Rule ID" });
    }

    const rule = await prisma.rangeCommissionRule.findUnique({
      where: { id: ruleId }
    });

    if (!rule || rule.isDeleted) {
      return res.status(404).json({ success: false, message: "Rule not found" });
    }

    const isOverlapping = await checkRangeOverlap(
      rule.slabId,
      rule.operatorId,
      rule.serviceCategoryId,
      rule.role,
      rule.mode,
      rule.amountFrom,
      rule.amountTo,
      rule.effectiveFrom,
      rule.effectiveTo,
      rule.id
    );
    if (isOverlapping) {
      return res.status(400).json({ success: false, message: "Cannot approve: Rule overlaps with an existing active/approved range rule." });
    }

    const result = await prisma.rangeCommissionRule.updateMany({
      where: {
        id: ruleId,
        status: "PENDING",
        isDeleted: false
      },
      data: {
        status: "ACTIVE",
        approvedById: req.user.id,
        approvedAt: new Date(),
        approvalComment: comment || "Approved by Admin"
      }
    });

    if (result.count === 0) {
      return res.status(400).json({ success: false, message: "Rule has already been approved, rejected, or is not in PENDING status." });
    }

    const approved = await prisma.rangeCommissionRule.findUnique({
      where: { id: ruleId }
    });

    await logAction({
      action: "RANGE_RULE_APPROVE",
      adminId: req.user.id,
      entity: "RangeCommissionRule",
      entityId: ruleId,
      details: { comment },
      req
    });

    await incrementConfigVersion();

    return res.json({ success: true, message: "Range rule approved and activated successfully", data: approved });
  } catch (error) {
    console.error("[RangeRules] Approve Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/admin/commission/range-rules/:id/reject
 * Reject a range rule.
 */
export const rejectRangeRule = async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id);
    const { comment } = req.body;

    if (isNaN(ruleId)) {
      return res.status(400).json({ success: false, message: "Invalid Rule ID" });
    }

    const rule = await prisma.rangeCommissionRule.findUnique({
      where: { id: ruleId }
    });

    if (!rule || rule.isDeleted) {
      return res.status(404).json({ success: false, message: "Rule not found" });
    }

    const result = await prisma.rangeCommissionRule.updateMany({
      where: {
        id: ruleId,
        status: "PENDING",
        isDeleted: false
      },
      data: {
        status: "REJECTED",
        approvedById: req.user.id,
        approvedAt: new Date(),
        approvalComment: comment || "Rejected by Admin"
      }
    });

    if (result.count === 0) {
      return res.status(400).json({ success: false, message: "Rule has already been approved, rejected, or is not in PENDING status." });
    }

    const rejected = await prisma.rangeCommissionRule.findUnique({
      where: { id: ruleId }
    });

    await logAction({
      action: "RANGE_RULE_REJECT",
      adminId: req.user.id,
      entity: "RangeCommissionRule",
      entityId: ruleId,
      details: { comment },
      req
    });

    await incrementConfigVersion();

    return res.json({ success: true, message: "Range rule rejected successfully", data: rejected });
  } catch (error) {
    console.error("[RangeRules] Reject Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ====================================================
// CHANNEL SLAB BULK SETTING IMPLEMENTATION
// ====================================================

function getFieldName(targetField) {
  switch (targetField) {
    case "COMMISSION": return "commissionValue";
    case "SURCHARGE": return "surchargeValue";
    case "PROFIT": return "profitValue";
    case "FEE": return "feeValue";
    default: return "commissionValue";
  }
}

function calculateNewValue(oldValue, action, params) {
  let newValue = oldValue;
  const value = parseFloat(params.value || 0);
  const valueType = params.valueType || "FLAT";

  if (action === "INCREASE") {
    if (valueType === "PERCENTAGE") {
      newValue = oldValue * (1 + value / 100);
    } else {
      newValue = oldValue + value;
    }
  } else if (action === "DECREASE") {
    if (valueType === "PERCENTAGE") {
      newValue = oldValue * (1 - value / 100);
    } else {
      newValue = oldValue - value;
    }
  } else if (action === "REPLACE") {
    newValue = value;
  } else if (action === "RESET") {
    newValue = 0.0;
  }

  newValue = Math.max(0.0, newValue);
  return Number(newValue.toFixed(4));
}

async function getMatchingRules({ ruleType, slabIds, packageIds, operatorIds, serviceCategoryIds, roles, mode }) {
  let targetSlabIds = [];
  if (slabIds && slabIds.length > 0) {
    targetSlabIds = slabIds.map(id => parseInt(id));
  }
  if (packageIds && packageIds.length > 0) {
    const pkgSlabs = await prisma.packageServiceSlab.findMany({
      where: { packageId: { in: packageIds.map(id => parseInt(id)) } },
      select: { slabId: true }
    });
    const packageSlabIds = pkgSlabs.map(ps => ps.slabId);
    targetSlabIds = [...new Set([...targetSlabIds, ...packageSlabIds])];
  }

  const where = {
    isDeleted: false,
    status: { in: ["ACTIVE", "APPROVED"] }
  };

  if (targetSlabIds.length > 0) {
    where.slabId = { in: targetSlabIds };
  }
  if (operatorIds && operatorIds.length > 0) {
    where.operatorId = { in: operatorIds.map(id => parseInt(id)) };
  }
  if (serviceCategoryIds && serviceCategoryIds.length > 0) {
    where.serviceCategoryId = { in: serviceCategoryIds.map(id => parseInt(id)) };
  }
  if (roles && roles.length > 0) {
    where.role = { in: roles };
  }

  if (ruleType === "RANGE") {
    if (mode) {
      where.mode = mode;
    }
    const rules = await prisma.rangeCommissionRule.findMany({
      where,
      include: {
        slab: true,
        operatorRel: true,
        serviceCategory: true
      }
    });
    return { rules, targetSlabIds };
  } else {
    const rules = await prisma.rechargeCommissionRule.findMany({
      where,
      include: {
        slab: true,
        operatorRel: true,
        serviceCategory: true
      }
    });
    return { rules, targetSlabIds };
  }
}

async function checkCopyOverlaps(tx, ruleType, targetSlabId, sourceRule) {
  if (ruleType === "RANGE") {
    const overlapping = await tx.rangeCommissionRule.findMany({
      where: {
        slabId: targetSlabId,
        operatorId: sourceRule.operatorId,
        serviceCategoryId: sourceRule.serviceCategoryId,
        role: sourceRule.role,
        mode: sourceRule.mode,
        status: { in: ["ACTIVE", "APPROVED"] },
        isDeleted: false
      }
    });
    
    const fromA = sourceRule.amountFrom;
    const toA = sourceRule.amountTo;
    
    for (const rule of overlapping) {
      const fromB = rule.amountFrom;
      const toB = rule.amountTo;
      if (fromA <= toB && toA >= fromB) {
        const startA = sourceRule.effectiveFrom ? new Date(sourceRule.effectiveFrom).getTime() : 0;
        const endA = sourceRule.effectiveTo ? new Date(sourceRule.effectiveTo).getTime() : Infinity;
        const startB = rule.effectiveFrom ? new Date(rule.effectiveFrom).getTime() : 0;
        const endB = rule.effectiveTo ? new Date(rule.effectiveTo).getTime() : Infinity;
        if (startA <= endB && endA >= startB) {
          return true;
        }
      }
    }
  } else {
    const overlapping = await tx.rechargeCommissionRule.findMany({
      where: {
        slabId: targetSlabId,
        operatorId: sourceRule.operatorId,
        serviceCategoryId: sourceRule.serviceCategoryId,
        role: sourceRule.role,
        status: { in: ["ACTIVE", "APPROVED"] },
        isDeleted: false
      }
    });
    
    for (const rule of overlapping) {
      const startA = sourceRule.effectiveFrom ? new Date(sourceRule.effectiveFrom).getTime() : 0;
      const endA = sourceRule.effectiveTo ? new Date(sourceRule.effectiveTo).getTime() : Infinity;
      const startB = rule.effectiveFrom ? new Date(rule.effectiveFrom).getTime() : 0;
      const endB = rule.effectiveTo ? new Date(rule.effectiveTo).getTime() : Infinity;
      if (startA <= endB && endA >= startB) {
        return true;
      }
    }
  }
  return false;
}

/**
 * GET /api/admin/commission/bulk/jobs
 * List of executed bulk commission setting jobs.
 */
export const getBulkJobs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const action = req.query.action;
    const status = req.query.status;

    const where = {};
    if (action) where.action = action;
    if (status) where.status = status;

    const [jobs, total] = await prisma.$transaction([
      prisma.bulkCommissionJob.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          slabs: {
            include: {
              slab: true
            }
          }
        }
      }),
      prisma.bulkCommissionJob.count({ where })
    ]);

    const formattedJobs = jobs.map(job => {
      const formatRecord = (r) => {
        if (!r) return r;
        const resObj = { ...r };
        ['oldValue', 'newValue', 'commissionValue', 'surchargeValue', 'profitValue', 'feeValue', 'realCommission'].forEach(f => {
          if (resObj[f] !== undefined && resObj[f] !== null) {
            resObj[f] = Number(Number(resObj[f]).toFixed(4));
          }
        });
        return resObj;
      };

      return {
        ...job,
        oldValues: Array.isArray(job.oldValues) ? job.oldValues.map(formatRecord) : job.oldValues,
        newValues: Array.isArray(job.newValues) ? job.newValues.map(formatRecord) : job.newValues
      };
    });

    return res.json({
      success: true,
      data: {
        jobs: formattedJobs,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error("[BulkJobs] List Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/admin/commission/bulk/preview
 * Generate preview list for a bulk operation.
 */
export const getBulkPreview = async (req, res) => {
  try {
    const { action, ruleType, targetField, filters, params } = req.body;

    if (!action || !ruleType || !targetField || !filters || !params) {
      return res.status(400).json({ success: false, message: "Missing bulk preview parameters." });
    }

    const fieldName = getFieldName(targetField);
    let affectedRecords = [];

    if (action === "COPY") {
      if (!params.sourceSlabId) {
        return res.status(400).json({ success: false, message: "Source slab ID is required for copy action." });
      }

      const { rules: sourceRules } = await getMatchingRules({
        ruleType,
        slabIds: [params.sourceSlabId],
        operatorIds: filters.operatorIds,
        serviceCategoryIds: filters.serviceCategoryIds,
        roles: filters.roles,
        mode: filters.mode
      });

      const { rules: targetRules, targetSlabIds } = await getMatchingRules({
        ruleType,
        slabIds: filters.slabIds,
        packageIds: filters.packageIds,
        operatorIds: filters.operatorIds,
        serviceCategoryIds: filters.serviceCategoryIds,
        roles: filters.roles,
        mode: filters.mode
      });

      for (const targetSlabId of targetSlabIds) {
        if (targetSlabId === parseInt(params.sourceSlabId)) continue;

        const targetSlab = await prisma.slab.findUnique({ where: { id: targetSlabId } });
        const slabName = targetSlab ? targetSlab.name : `Slab ${targetSlabId}`;

        for (const sourceRule of sourceRules) {
          const matchingTarget = targetRules.find(tr => 
            tr.slabId === targetSlabId &&
            tr.operatorId === sourceRule.operatorId &&
            tr.serviceCategoryId === sourceRule.serviceCategoryId &&
            tr.role === sourceRule.role &&
            (ruleType === "RANGE" ? (tr.amountFrom === sourceRule.amountFrom && tr.amountTo === sourceRule.amountTo) : true)
          );

          const oldValue = matchingTarget ? Number(matchingTarget[fieldName].toFixed(4)) : null;
          const newValue = Number(sourceRule[fieldName].toFixed(4));

          affectedRecords.push({
            ruleId: matchingTarget ? matchingTarget.id : null,
            ruleType,
            slabName,
            operatorName: sourceRule.operatorRel?.name || `Operator ${sourceRule.operatorId}`,
            serviceCategoryName: sourceRule.serviceCategory?.name || `Category ${sourceRule.serviceCategoryId}`,
            role: sourceRule.role,
            mode: ruleType === "RANGE" ? sourceRule.mode : "GENERAL",
            amountRange: ruleType === "RANGE" ? `${sourceRule.amountFrom} - ${sourceRule.amountTo}` : "N/A",
            fieldName,
            oldValue,
            newValue,
            difference: oldValue !== null ? Number((newValue - oldValue).toFixed(4)) : newValue,
            meta: {
              targetSlabId,
              operatorId: sourceRule.operatorId,
              serviceCategoryId: sourceRule.serviceCategoryId,
              role: sourceRule.role,
              amountFrom: sourceRule.amountFrom,
              amountTo: sourceRule.amountTo,
              mode: sourceRule.mode,
              commissionType: sourceRule.commissionType,
              commissionValue: Number(sourceRule.commissionValue.toFixed(4)),
              realCommission: Number(sourceRule.realCommission.toFixed(4)),
              surchargeType: sourceRule.surchargeType,
              surchargeValue: Number(sourceRule.surchargeValue.toFixed(4)),
              profitType: sourceRule.profitType,
              profitValue: Number(sourceRule.profitValue.toFixed(4)),
              feeType: sourceRule.feeType,
              feeValue: Number(sourceRule.feeValue.toFixed(4)),
              maxCommission: sourceRule.maxCommission ? Number(sourceRule.maxCommission.toFixed(4)) : null,
              fixedCharge: Number(sourceRule.fixedCharge.toFixed(4)),
              effectiveFrom: sourceRule.effectiveFrom,
              effectiveTo: sourceRule.effectiveTo
            }
          });
        }
      }
    } else {
      const { rules } = await getMatchingRules({
        ruleType,
        slabIds: filters.slabIds,
        packageIds: filters.packageIds,
        operatorIds: filters.operatorIds,
        serviceCategoryIds: filters.serviceCategoryIds,
        roles: filters.roles,
        mode: filters.mode
      });

      for (const rule of rules) {
        const oldValue = Number(rule[fieldName].toFixed(4));
        const newValue = calculateNewValue(oldValue, action, params);

        affectedRecords.push({
          ruleId: rule.id,
          ruleType,
          slabName: rule.slab?.name || `Slab ${rule.slabId}`,
          operatorName: rule.operatorRel?.name || `Operator ${rule.operatorId}`,
          serviceCategoryName: rule.serviceCategory?.name || `Category ${rule.serviceCategoryId}`,
          role: rule.role,
          mode: ruleType === "RANGE" ? rule.mode : "GENERAL",
          amountRange: ruleType === "RANGE" ? `${rule.amountFrom} - ${rule.amountTo}` : "N/A",
          fieldName,
          oldValue,
          newValue,
          difference: Number((newValue - oldValue).toFixed(4))
        });
      }
    }

    const config = await prisma.commissionConfig.findUnique({ where: { id: 1 } });
    const currentVersion = config ? config.currentVersion : 1;

    await logAction({
      action: "BULK_PREVIEW",
      adminId: req.user.id,
      entity: "BulkCommissionJob",
      details: { action, ruleType, targetField, affectedCount: affectedRecords.length },
      req
    });

    return res.json({
      success: true,
      data: {
        previewVersion: currentVersion,
        affectedCount: affectedRecords.length,
        action,
        targetField,
        affectedRecords
      }
    });
  } catch (error) {
    console.error("[BulkJobs] Preview Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/admin/commission/bulk/execute
 * Execute bulk commission setting updates.
 */
export const executeBulkJob = async (req, res) => {
  let lockToken = null;
  try {
    const { action, ruleType, targetField, filters, params, previewVersion } = req.body;

    if (!action || !ruleType || !targetField || !filters || !params || previewVersion === undefined) {
      return res.status(400).json({ success: false, message: "Missing bulk execution parameters." });
    }

    lockToken = await acquireLock("commission_bulk_lock", 15000);
    if (!lockToken) {
      return res.status(423).json({
        success: false,
        message: "Another bulk commission operation is currently running."
      });
    }

    const config = await prisma.commissionConfig.findUnique({ where: { id: 1 } });
    const currentVersion = config ? config.currentVersion : 1;

    if (previewVersion !== currentVersion) {
      return res.status(409).json({
        success: false,
        message: "Bulk preview is stale. Please regenerate preview."
      });
    }

    const isSuperAdmin = req.user.role === "SUPER_ADMIN" || 
      (await prisma.user.findUnique({ where: { id: req.user.id } }).then(u => u?.commissionRole === "SUPER_ADMIN"));

    const autoActivate = params.autoActivate === true && isSuperAdmin;

    const fieldName = getFieldName(targetField);
    let affectedRecords = [];

    if (action === "COPY") {
      const { rules: sourceRules } = await getMatchingRules({
        ruleType,
        slabIds: [params.sourceSlabId],
        operatorIds: filters.operatorIds,
        serviceCategoryIds: filters.serviceCategoryIds,
        roles: filters.roles,
        mode: filters.mode
      });

      const { rules: targetRules, targetSlabIds } = await getMatchingRules({
        ruleType,
        slabIds: filters.slabIds,
        packageIds: filters.packageIds,
        operatorIds: filters.operatorIds,
        serviceCategoryIds: filters.serviceCategoryIds,
        roles: filters.roles,
        mode: filters.mode
      });

      for (const targetSlabId of targetSlabIds) {
        if (targetSlabId === parseInt(params.sourceSlabId)) continue;

        for (const sourceRule of sourceRules) {
          const matchingTarget = targetRules.find(tr => 
            tr.slabId === targetSlabId &&
            tr.operatorId === sourceRule.operatorId &&
            tr.serviceCategoryId === sourceRule.serviceCategoryId &&
            tr.role === sourceRule.role &&
            (ruleType === "RANGE" ? (tr.amountFrom === sourceRule.amountFrom && tr.amountTo === sourceRule.amountTo) : true)
          );

          const oldValue = matchingTarget ? Number(matchingTarget[fieldName].toFixed(4)) : null;
          const newValue = Number(sourceRule[fieldName].toFixed(4));

          affectedRecords.push({
            ruleId: matchingTarget ? matchingTarget.id : null,
            ruleType,
            slabName: matchingTarget?.slab?.name || `Slab ${targetSlabId}`,
            operatorName: sourceRule.operatorRel?.name || `Operator ${sourceRule.operatorId}`,
            serviceCategoryName: sourceRule.serviceCategory?.name || `Category ${sourceRule.serviceCategoryId}`,
            role: sourceRule.role,
            mode: ruleType === "RANGE" ? sourceRule.mode : "GENERAL",
            amountRange: ruleType === "RANGE" ? `${sourceRule.amountFrom} - ${sourceRule.amountTo}` : "N/A",
            fieldName,
            oldValue,
            newValue,
            difference: oldValue !== null ? Number((newValue - oldValue).toFixed(4)) : newValue,
            meta: {
              targetSlabId,
              operatorId: sourceRule.operatorId,
              serviceCategoryId: sourceRule.serviceCategoryId,
              role: sourceRule.role,
              amountFrom: sourceRule.amountFrom,
              amountTo: sourceRule.amountTo,
              mode: sourceRule.mode,
              commissionType: sourceRule.commissionType,
              commissionValue: Number(sourceRule.commissionValue.toFixed(4)),
              realCommission: Number(sourceRule.realCommission.toFixed(4)),
              surchargeType: sourceRule.surchargeType,
              surchargeValue: Number(sourceRule.surchargeValue.toFixed(4)),
              profitType: sourceRule.profitType,
              profitValue: Number(sourceRule.profitValue.toFixed(4)),
              feeType: sourceRule.feeType,
              feeValue: Number(sourceRule.feeValue.toFixed(4)),
              maxCommission: sourceRule.maxCommission ? Number(sourceRule.maxCommission.toFixed(4)) : null,
              fixedCharge: Number(sourceRule.fixedCharge.toFixed(4)),
              effectiveFrom: sourceRule.effectiveFrom,
              effectiveTo: sourceRule.effectiveTo
            }
          });
        }
      }
    } else {
      const { rules } = await getMatchingRules({
        ruleType,
        slabIds: filters.slabIds,
        packageIds: filters.packageIds,
        operatorIds: filters.operatorIds,
        serviceCategoryIds: filters.serviceCategoryIds,
        roles: filters.roles,
        mode: filters.mode
      });

      for (const rule of rules) {
        const oldValue = Number(rule[fieldName].toFixed(4));
        const newValue = calculateNewValue(oldValue, action, params);

        affectedRecords.push({
          ruleId: rule.id,
          ruleType,
          slabName: rule.slab?.name || `Slab ${rule.slabId}`,
          operatorName: rule.operatorRel?.name || `Operator ${rule.operatorId}`,
          serviceCategoryName: rule.serviceCategory?.name || `Category ${rule.serviceCategoryId}`,
          role: rule.role,
          mode: ruleType === "RANGE" ? rule.mode : "GENERAL",
          amountRange: ruleType === "RANGE" ? `${rule.amountFrom} - ${rule.amountTo}` : "N/A",
          fieldName,
          oldValue,
          newValue,
          difference: Number((newValue - oldValue).toFixed(4))
        });
      }
    }

    if (affectedRecords.length === 0) {
      return res.status(400).json({ success: false, message: "No records found matching filters to execute bulk operation." });
    }

    const resultJob = await prisma.$transaction(async (tx) => {
      let targetSlabIds = [];
      if (filters.slabIds && filters.slabIds.length > 0) {
        targetSlabIds = filters.slabIds.map(id => parseInt(id));
      }
      if (filters.packageIds && filters.packageIds.length > 0) {
        const pkgSlabs = await tx.packageServiceSlab.findMany({
          where: { packageId: { in: filters.packageIds.map(id => parseInt(id)) } },
          select: { slabId: true }
        });
        targetSlabIds = [...new Set([...targetSlabIds, ...pkgSlabs.map(ps => ps.slabId)])];
      }

      const job = await tx.bulkCommissionJob.create({
        data: {
          action: action,
          mode: ruleType === "RANGE" ? (filters.mode || "GENERAL") : "GENERAL",
          commissionType: targetField,
          params: params,
          oldValues: affectedRecords.map(r => ({ ruleId: r.ruleId, oldValue: r.oldValue })),
          newValues: affectedRecords.map(r => ({ ruleId: r.ruleId, newValue: r.newValue })),
          status: "COMPLETED",
          createdById: req.user.id
        }
      });

      if (targetSlabIds.length > 0) {
        await tx.bulkCommissionJobSlab.createMany({
          data: targetSlabIds.map(slabId => ({
            jobId: job.id,
            slabId
          }))
        });
      }

      const snapshot = [];

      for (const record of affectedRecords) {
        if (record.ruleId) {
          if (ruleType === "RANGE") {
            const rule = await tx.rangeCommissionRule.update({
              where: { id: record.ruleId },
              data: {
                [fieldName]: record.newValue,
                version: { increment: 1 }
              }
            });

            await tx.commissionRuleHistory.create({
              data: {
                ruleId: rule.id,
                ruleType: "RANGE",
                operatorId: rule.operatorId,
                role: rule.role,
                oldValue: record.oldValue,
                newValue: record.newValue,
                oldMode: rule.mode,
                newMode: rule.mode,
                oldRole: rule.role,
                newRole: rule.role,
                oldAmountFrom: rule.amountFrom,
                newAmountFrom: rule.amountFrom,
                oldAmountTo: rule.amountTo,
                newAmountTo: rule.amountTo,
                changedById: req.user.id,
                ipAddress: req.ip
              }
            });
          } else {
            const rule = await tx.rechargeCommissionRule.update({
              where: { id: record.ruleId },
              data: {
                [fieldName]: record.newValue,
                version: { increment: 1 }
              }
            });

            await tx.commissionRuleHistory.create({
              data: {
                ruleId: rule.id,
                ruleType: "RECHARGE",
                operatorId: rule.operatorId,
                role: rule.role,
                oldValue: record.oldValue,
                newValue: record.newValue,
                changedById: req.user.id,
                ipAddress: req.ip
              }
            });
          }

          snapshot.push({
            ruleId: record.ruleId,
            ruleType,
            fieldName,
            oldValue: record.oldValue,
            newValue: record.newValue
          });
        } else {
          const meta = record.meta;
          meta[fieldName] = record.newValue;
          
          if (autoActivate) {
            const overlapExists = await checkCopyOverlaps(tx, ruleType, meta.targetSlabId, meta);
            if (overlapExists) {
              throw new Error(`Overlapping rule detected for target slab ID ${meta.targetSlabId}, Operator: ${record.operatorName}, Role: ${meta.role}`);
            }
            meta.status = "ACTIVE";
          } else {
            meta.status = "PENDING";
          }
          meta.version = 1;

          let newRule;
          if (ruleType === "RANGE") {
            newRule = await tx.rangeCommissionRule.create({
              data: meta
            });

            await tx.commissionRuleHistory.create({
              data: {
                ruleId: newRule.id,
                ruleType: "RANGE",
                operatorId: newRule.operatorId,
                role: newRule.role,
                oldValue: 0.0,
                newValue: record.newValue,
                oldMode: newRule.mode,
                newMode: newRule.mode,
                oldRole: newRule.role,
                newRole: newRule.role,
                oldAmountFrom: newRule.amountFrom,
                newAmountFrom: newRule.amountFrom,
                oldAmountTo: newRule.amountTo,
                newAmountTo: newRule.amountTo,
                changedById: req.user.id,
                ipAddress: req.ip
              }
            });
          } else {
            newRule = await tx.rechargeCommissionRule.create({
              data: {
                slabId: meta.targetSlabId,
                operatorId: meta.operatorId,
                serviceCategoryId: meta.serviceCategoryId,
                role: meta.role,
                commissionType: meta.commissionType,
                commissionValue: meta.commissionValue,
                realCommission: meta.realCommission,
                surchargeType: meta.surchargeType,
                surchargeValue: meta.surchargeValue,
                profitType: meta.profitType,
                profitValue: meta.profitValue,
                feeType: meta.feeType,
                feeValue: meta.feeValue,
                maxCommission: meta.maxCommission,
                fixedCharge: meta.fixedCharge,
                effectiveFrom: meta.effectiveFrom,
                effectiveTo: meta.effectiveTo,
                status: meta.status,
                version: 1
              }
            });

            await tx.commissionRuleHistory.create({
              data: {
                ruleId: newRule.id,
                ruleType: "RECHARGE",
                operatorId: newRule.operatorId,
                role: newRule.role,
                oldValue: 0.0,
                newValue: record.newValue,
                changedById: req.user.id,
                ipAddress: req.ip
              }
            });
          }

          snapshot.push({
            ruleId: newRule.id,
            ruleType,
            fieldName,
            oldValue: null,
            newValue: record.newValue
          });
        }
      }

      await tx.bulkCommissionAudit.create({
        data: {
          jobId: job.id,
          action: "BULK_UPDATE",
          details: { snapshot, previewVersion },
          ipAddress: req.ip
        }
      });

      await tx.commissionConfig.upsert({
        where: { id: 1 },
        update: { currentVersion: { increment: 1 } },
        create: { id: 1, currentVersion: 1 }
      });

      const latestConfig = await tx.commissionConfig.findUnique({ where: { id: 1 } });
      try {
        await redisClient.set("commissionConfigVersion", latestConfig.currentVersion.toString());
      } catch (err) {
        console.warn("[CACHE] Redis failed to update commissionConfigVersion:", err.message);
      }

      return { job, autoActivated: autoActivate };
    });

    await logAction({
      action: resultJob.autoActivated ? "BULK_COPY_ACTIVATION" : "BULK_EXECUTE",
      adminId: req.user.id,
      entity: "BulkCommissionJob",
      entityId: resultJob.job.id,
      details: { action, ruleType, targetField, affectedCount: affectedRecords.length, autoActivated: resultJob.autoActivated },
      req
    });

    return res.json({
      success: true,
      message: resultJob.autoActivated 
        ? "Bulk copy and activation executed successfully." 
        : "Bulk commission job executed successfully.",
      data: {
        jobId: resultJob.job.id,
        affectedCount: affectedRecords.length
      }
    });
  } catch (error) {
    console.error("[BulkJobs] Execution Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  } finally {
    if (lockToken) {
      await releaseLock("commission_bulk_lock", lockToken);
    }
  }
};

/**
 * POST /api/admin/commission/bulk/rollback/:id
 * Rollback an executed bulk job.
 */
export const rollbackBulkJob = async (req, res) => {
  try {
    const jobId = parseInt(req.params.id);
    if (isNaN(jobId)) {
      return res.status(400).json({ success: false, message: "Invalid job ID" });
    }

    const job = await prisma.bulkCommissionJob.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      return res.status(404).json({ success: false, message: "Bulk job not found." });
    }

    if (job.status === "ROLLED_BACK") {
      return res.status(400).json({ success: false, message: "Bulk job has already been rolled back." });
    }

    const auditRecord = await prisma.bulkCommissionAudit.findFirst({
      where: { jobId, action: "BULK_UPDATE" }
    });

    if (!auditRecord || !auditRecord.details || !auditRecord.details.snapshot) {
      return res.status(400).json({ success: false, message: "Rollback snapshot not found for this bulk job." });
    }

    const snapshot = auditRecord.details.snapshot;

    await prisma.$transaction(async (tx) => {
      for (const record of snapshot) {
        const { ruleId, ruleType, fieldName, oldValue } = record;

        if (oldValue === null) {
          if (ruleType === "RANGE") {
            const existing = await tx.rangeCommissionRule.findUnique({ where: { id: ruleId } });
            if (existing) {
              const rule = await tx.rangeCommissionRule.delete({ where: { id: ruleId } });
              await tx.commissionRuleHistory.create({
                data: {
                  ruleId: ruleId,
                  ruleType: "RANGE",
                  operatorId: rule.operatorId,
                  role: rule.role,
                  oldValue: Number(record.newValue.toFixed(4)),
                  newValue: 0.0,
                  oldMode: rule.mode,
                  newMode: rule.mode,
                  oldRole: rule.role,
                  newRole: rule.role,
                  oldAmountFrom: rule.amountFrom,
                  newAmountFrom: rule.amountFrom,
                  oldAmountTo: rule.amountTo,
                  newAmountTo: rule.amountTo,
                  changedById: req.user.id,
                  ipAddress: req.ip
                }
              });
            }
          } else {
            const existing = await tx.rechargeCommissionRule.findUnique({ where: { id: ruleId } });
            if (existing) {
              const rule = await tx.rechargeCommissionRule.delete({ where: { id: ruleId } });
              await tx.commissionRuleHistory.create({
                data: {
                  ruleId: ruleId,
                  ruleType: "RECHARGE",
                  operatorId: rule.operatorId,
                  role: rule.role,
                  oldValue: Number(record.newValue.toFixed(4)),
                  newValue: 0.0,
                  changedById: req.user.id,
                  ipAddress: req.ip
                }
              });
            }
          }
        } else {
          if (ruleType === "RANGE") {
            const existing = await tx.rangeCommissionRule.findUnique({ where: { id: ruleId } });
            if (existing && !existing.isDeleted) {
              const rule = await tx.rangeCommissionRule.update({
                where: { id: ruleId },
                data: {
                  [fieldName]: Number(oldValue.toFixed(4)),
                  version: { increment: 1 }
                }
              });

              await tx.commissionRuleHistory.create({
                data: {
                  ruleId: ruleId,
                  ruleType: "RANGE",
                  operatorId: rule.operatorId,
                  role: rule.role,
                  oldValue: Number(record.newValue.toFixed(4)),
                  newValue: Number(oldValue.toFixed(4)),
                  oldMode: rule.mode,
                  newMode: rule.mode,
                  oldRole: rule.role,
                  newRole: rule.role,
                  oldAmountFrom: rule.amountFrom,
                  newAmountFrom: rule.amountFrom,
                  oldAmountTo: rule.amountTo,
                  newAmountTo: rule.amountTo,
                  changedById: req.user.id,
                  ipAddress: req.ip
                }
              });
            }
          } else {
            const existing = await tx.rechargeCommissionRule.findUnique({ where: { id: ruleId } });
            if (existing && !existing.isDeleted) {
              const rule = await tx.rechargeCommissionRule.update({
                where: { id: ruleId },
                data: {
                  [fieldName]: Number(oldValue.toFixed(4)),
                  version: { increment: 1 }
                }
              });

              await tx.commissionRuleHistory.create({
                data: {
                  ruleId: ruleId,
                  ruleType: "RECHARGE",
                  operatorId: rule.operatorId,
                  role: rule.role,
                  oldValue: Number(record.newValue.toFixed(4)),
                  newValue: Number(oldValue.toFixed(4)),
                  changedById: req.user.id,
                  ipAddress: req.ip
                }
              });
            }
          }
        }
      }

      await tx.bulkCommissionJob.update({
        where: { id: jobId },
        data: { status: "ROLLED_BACK" }
      });

      await tx.bulkCommissionAudit.create({
        data: {
          jobId,
          action: "ROLLBACK",
          details: { snapshot },
          ipAddress: req.ip
        }
      });

      await tx.commissionConfig.upsert({
        where: { id: 1 },
        update: { currentVersion: { increment: 1 } },
        create: { id: 1, currentVersion: 1 }
      });

      const latestConfig = await tx.commissionConfig.findUnique({ where: { id: 1 } });
      try {
        await redisClient.set("commissionConfigVersion", latestConfig.currentVersion.toString());
      } catch (err) {
        console.warn("[CACHE] Redis failed to update commissionConfigVersion:", err.message);
      }
    });

    await logAction({
      action: "BULK_ROLLBACK",
      adminId: req.user.id,
      entity: "BulkCommissionJob",
      entityId: jobId,
      details: { affectedCount: snapshot.length },
      req
    });

    return res.json({
      success: true,
      message: "Bulk commission job rolled back successfully."
    });
  } catch (error) {
    console.error("[BulkJobs] Rollback Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Short-lived in-memory cache for simulator rules to prevent DB bottlenecks during bulk tests
const SIMULATOR_RULES_CACHE = new Map();
const CACHE_TTL = 3000; // 3 seconds TTL

export const clearSimulatorCache = () => {
  SIMULATOR_RULES_CACHE.clear();
};

const getCachedData = async (key, fetchFn) => {
  const now = Date.now();
  const cached = SIMULATOR_RULES_CACHE.get(key);
  if (cached && (now - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }
  const data = await fetchFn();
  SIMULATOR_RULES_CACHE.set(key, { timestamp: now, data });
  return data;
};

const getSimulatorRangeRules = async (slabId, operatorId, serviceCategoryId) => {
  const key = `range_${slabId}_${operatorId}_${serviceCategoryId}`;
  const now = Date.now();
  const cached = SIMULATOR_RULES_CACHE.get(key);
  if (cached && (now - cached.timestamp < CACHE_TTL)) {
    return cached.rules;
  }
  const rules = await prisma.rangeCommissionRule.findMany({
    where: {
      slabId,
      operatorId,
      serviceCategoryId,
      isDeleted: false
    }
  });
  const processedRules = rules.map(r => ({
    ...r,
    effectiveFromTime: r.effectiveFrom ? new Date(r.effectiveFrom).getTime() : 0,
    effectiveToTime: r.effectiveTo ? new Date(r.effectiveTo).getTime() : Infinity
  }));
  SIMULATOR_RULES_CACHE.set(key, { timestamp: now, rules: processedRules });
  return processedRules;
};

const getSimulatorRechargeRules = async (slabId, operatorId, serviceCategoryId) => {
  const key = `recharge_${slabId}_${operatorId}_${serviceCategoryId}`;
  const now = Date.now();
  const cached = SIMULATOR_RULES_CACHE.get(key);
  if (cached && (now - cached.timestamp < CACHE_TTL)) {
    return cached.rules;
  }
  const rules = await prisma.rechargeCommissionRule.findMany({
    where: {
      slabId,
      operatorId,
      serviceCategoryId,
      isDeleted: false
    }
  });
  const processedRules = rules.map(r => ({
    ...r,
    effectiveFromTime: r.effectiveFrom ? new Date(r.effectiveFrom).getTime() : 0,
    effectiveToTime: r.effectiveTo ? new Date(r.effectiveTo).getTime() : Infinity
  }));
  SIMULATOR_RULES_CACHE.set(key, { timestamp: now, rules: processedRules });
  return processedRules;
};

/**
 * POST /api/admin/commission/simulate
 * Run a read-only commission simulation for a hypothetical transaction.
 */
export const simulateCommission = async (req, res) => {
  try {
    const {
      userId,
      packageId,
      slabId,
      operatorId,
      serviceCategoryId,
      amount,
      mode,
      commissionType
    } = req.body;

    if (!operatorId || !serviceCategoryId || amount === undefined || isNaN(parseFloat(amount))) {
      return res.status(400).json({ success: false, message: "Missing or invalid required simulation parameters." });
    }

    const searchAmount = parseFloat(amount);

    // Fetch operator and service category
    const operatorObj = await getCachedData(`op_${operatorId}`, () =>
      prisma.operator.findUnique({
        where: { id: parseInt(operatorId) }
      })
    );
    if (!operatorObj) {
      return res.status(400).json({ success: false, message: "Operator not found." });
    }

    const serviceCategoryObj = await getCachedData(`cat_${serviceCategoryId}`, () =>
      prisma.serviceCategory.findUnique({
        where: { id: parseInt(serviceCategoryId) }
      })
    );
    if (!serviceCategoryObj) {
      return res.status(400).json({ success: false, message: "Service category not found." });
    }

    let resolvedUser = null;
    let resolvedRole = "RETAILER";
    let resolvedTier = "Standard";
    let resolvedSlabId = null;
    let resolvedPackageId = null;
    let slabSource = "DEFAULT_FALLBACK";
    const resolutionPath = [];
    const trace = [];

    // 1. Fetch user context if userId is provided
    if (userId) {
      const user = await getCachedData(`user_${userId}`, () =>
        prisma.user.findUnique({
          where: { id: parseInt(userId) },
          select: {
            id: true,
            name: true,
            slabId: true,
            packageId: true,
            commissionRole: true,
            tier: true
          }
        })
      );
      if (user) {
        resolvedUser = {
          id: user.id,
          name: user.name,
          role: user.commissionRole,
          tier: user.tier
        };
        resolvedRole = user.commissionRole || "RETAILER";
        resolvedTier = user.tier || "Standard";
        resolvedSlabId = user.slabId;
        resolvedPackageId = user.packageId;
        resolutionPath.push({
          step: "USER_IDENTIFIED",
          details: `User context loaded: ${user.name} (${resolvedRole}), Tier: ${resolvedTier}`
        });
      }
    }

    // 2. Resolve Slab Precedence: Slab Override -> User Slab Override -> Package Slab -> Default Fallback
    if (slabId) {
      resolvedSlabId = parseInt(slabId);
      slabSource = "MANUAL_SLAB_OVERRIDE";
      resolutionPath.push({
        step: "SLAB_RESOLUTION",
        source: slabSource,
        slabId: resolvedSlabId,
        details: `Slab overridden manually to Slab ID ${resolvedSlabId}`
      });
    } else if (resolvedSlabId) {
      slabSource = "USER_SLAB_OVERRIDE";
      resolutionPath.push({
        step: "SLAB_RESOLUTION",
        source: slabSource,
        slabId: resolvedSlabId,
        details: `Slab Override assigned directly to user: Slab ID ${resolvedSlabId}`
      });
    } else {
      let targetPackageId = packageId ? parseInt(packageId) : resolvedPackageId;
      let packageSource = packageId ? "MANUAL_PACKAGE_OVERRIDE" : "USER_PACKAGE_ASSIGNMENT";
      
      if (targetPackageId) {
        const packageMapping = await getCachedData(`pkgmap_${targetPackageId}_${serviceCategoryObj.id}`, () =>
          prisma.packageServiceSlab.findUnique({
            where: {
              packageId_serviceCategoryId: {
                packageId: targetPackageId,
                serviceCategoryId: serviceCategoryObj.id
              }
            }
          })
        );
        if (packageMapping) {
          resolvedSlabId = packageMapping.slabId;
          slabSource = "PACKAGE_SLAB_RESOLUTION";
          resolutionPath.push({
            step: "SLAB_RESOLUTION",
            source: slabSource,
            slabId: resolvedSlabId,
            packageId: targetPackageId,
            details: `Slab resolved via package service mapping (${packageSource}: Package ID ${targetPackageId})`
          });
        } else {
          resolutionPath.push({
            step: "SLAB_RESOLUTION_WARNING",
            details: `No slab mapping found for Package ID ${targetPackageId} and Service Category ID ${serviceCategoryObj.id}.`
          });
        }
      }
    }

    if (!resolvedSlabId) {
      const defaultSlab = await getCachedData(`default_slab`, () =>
        prisma.slab.findFirst({
          where: { isDefault: true, isDeleted: false }
        })
      );
      if (defaultSlab) {
        resolvedSlabId = defaultSlab.id;
        slabSource = "DEFAULT_FALLBACK";
        resolutionPath.push({
          step: "SLAB_RESOLUTION",
          source: slabSource,
          slabId: resolvedSlabId,
          details: `Falling back to Default Slab: ${defaultSlab.name}`
        });
      } else {
        resolutionPath.push({
          step: "SLAB_RESOLUTION_ERROR",
          details: "No active slab could be resolved and no default slab exists in the database. Falling back to legacy/default rule paths."
        });
      }
    }

    // Resolve target slab details
    let targetSlab = null;
    if (resolvedSlabId) {
      targetSlab = await getCachedData(`slab_${resolvedSlabId}`, () =>
        prisma.slab.findUnique({ where: { id: resolvedSlabId } })
      );
    }

    let winningRule = null;
    let ruleSource = "DEFAULT_FALLBACK";
    const now = new Date();
    const nowMs = now.getTime();

    if (resolvedSlabId) {
      const rangeCandidates = [];
      const rechargeCandidates = [];

      // Evaluate all Range Rules for the resolved slab, operator, and category
      const rangeRules = await getSimulatorRangeRules(resolvedSlabId, operatorObj.id, serviceCategoryObj.id);

      for (const rule of rangeRules) {
        const roleMatch = rule.role === resolvedRole;
        const amountMatch = searchAmount >= rule.amountFrom && searchAmount <= rule.amountTo;
        
        const start = rule.effectiveFromTime ?? (rule.effectiveFrom ? new Date(rule.effectiveFrom).getTime() : 0);
        const end = rule.effectiveToTime ?? (rule.effectiveTo ? new Date(rule.effectiveTo).getTime() : Infinity);
        const dateMatch = nowMs >= start && nowMs <= end;
        
        const statusMatch = rule.status === "ACTIVE" || rule.status === "APPROVED";
        const modeMatch = mode ? rule.mode === mode : true;
        const priorityScore = rule.mode === "REAL" ? 2 : (rule.mode === "GENERAL" ? 1 : 0);

        let decision = "MATCHED";
        let reason = "Matched Range Rule Criteria";

        if (!roleMatch) {
          decision = "REJECTED_ROLE";
          reason = `Role mismatch (expected: ${resolvedRole}, rule: ${rule.role})`;
        } else if (!statusMatch) {
          decision = "REJECTED_STATUS";
          reason = `Status is ${rule.status} (must be ACTIVE or APPROVED)`;
        } else if (!amountMatch) {
          decision = "REJECTED_AMOUNT";
          reason = `Amount ${searchAmount} out of range (${rule.amountFrom} - ${rule.amountTo})`;
        } else if (!dateMatch) {
          decision = "REJECTED_DATE";
          reason = "Current timestamp falls outside rule effective date window";
        } else if (!modeMatch) {
          decision = "REJECTED_MODE";
          reason = `Mode mismatch (expected: ${mode}, rule: ${rule.mode})`;
        }

        if (decision === "MATCHED") {
          rangeCandidates.push(rule);
        }

        trace.push({
          ruleId: rule.id,
          ruleType: "RANGE",
          operatorMatch: true,
          categoryMatch: true,
          roleMatch,
          amountMatch,
          dateMatch,
          statusMatch,
          modeMatch,
          priorityScore,
          mode: rule.mode,
          amountRange: `${rule.amountFrom} - ${rule.amountTo}`,
          decision,
          reason
        });
      }

      // Evaluate all Recharge Rules for the resolved slab, operator, and category
      const rechargeRules = await getSimulatorRechargeRules(resolvedSlabId, operatorObj.id, serviceCategoryObj.id);

      for (const rule of rechargeRules) {
        const roleMatch = rule.role === resolvedRole;
        
        const start = rule.effectiveFromTime ?? (rule.effectiveFrom ? new Date(rule.effectiveFrom).getTime() : 0);
        const end = rule.effectiveToTime ?? (rule.effectiveTo ? new Date(rule.effectiveTo).getTime() : Infinity);
        const dateMatch = nowMs >= start && nowMs <= end;
        
        const statusMatch = rule.status === "ACTIVE" || rule.status === "APPROVED";

        let decision = "MATCHED";
        let reason = "Matched Recharge Rule Criteria";

        if (!roleMatch) {
          decision = "REJECTED_ROLE";
          reason = `Role mismatch (expected: ${resolvedRole}, rule: ${rule.role})`;
        } else if (!statusMatch) {
          decision = "REJECTED_STATUS";
          reason = `Status is ${rule.status} (must be ACTIVE or APPROVED)`;
        } else if (!dateMatch) {
          decision = "REJECTED_DATE";
          reason = "Current timestamp falls outside rule effective date window";
        }

        if (decision === "MATCHED") {
          rechargeCandidates.push(rule);
        }

        trace.push({
          ruleId: rule.id,
          ruleType: "RECHARGE",
          operatorMatch: true,
          categoryMatch: true,
          roleMatch,
          amountMatch: true,
          dateMatch,
          statusMatch,
          modeMatch: true,
          priorityScore: 1,
          mode: "GENERAL",
          amountRange: "N/A",
          decision,
          reason
        });
      }

      if (rangeCandidates.length > 0) {
        winningRule = getHighestPriorityRule(rangeCandidates);
        ruleSource = `RANGE_RULE (${slabSource})`;
        
        // Update trace status
        trace.forEach(t => {
          if (t.ruleType === "RANGE" && t.decision === "MATCHED") {
            if (t.ruleId === winningRule.id) {
              t.decision = "SELECTED";
              t.reason = "Selected winning range rule matching highest priority / tie-breaker.";
            } else {
              t.decision = winningRule.mode === "REAL" && t.mode === "GENERAL" ? "OUTRANKED_BY_REAL_MODE" : "REJECTED";
              t.reason = `Outranked by Range Rule #${winningRule.id} (Priority/Tie-Breaker)`;
            }
          } else if (t.ruleType === "RECHARGE" && t.decision === "MATCHED") {
            t.decision = "OUTRANKED_BY_RANGE";
            t.reason = `Outranked by Range Rule #${winningRule.id} (Range rules have higher precedence than Recharge rules)`;
          }
        });
      } else if (rechargeCandidates.length > 0) {
        winningRule = getHighestPriorityRule(rechargeCandidates);
        ruleSource = `RECHARGE_RULE (${slabSource})`;

        trace.forEach(t => {
          if (t.ruleType === "RECHARGE" && t.decision === "MATCHED") {
            if (t.ruleId === winningRule.id) {
              t.decision = "SELECTED";
              t.reason = "Selected winning recharge rule matching highest priority / tie-breaker.";
            } else {
              t.decision = "REJECTED";
              t.reason = `Outranked by Recharge Rule #${winningRule.id} (Priority/Tie-Breaker)`;
            }
          }
        });
      }
    }

    // 3. Fallback to Legacy rules if no rule resolved inside slab
    if (!winningRule) {
      const legacyRule = await prisma.commissionRule.findFirst({
        where: {
          operator: operatorObj.name,
          userTier: resolvedTier,
          isActive: true
        },
        orderBy: { priority: "desc" }
      });
      if (legacyRule) {
        const simulatedLegacyRule = {
          id: legacyRule.id,
          commissionType: "PERCENTAGE",
          commissionValue: legacyRule.commissionPercent,
          cashbackPercent: legacyRule.cashbackPercent,
          surchargeType: "PERCENTAGE",
          surchargeValue: 0.0,
          profitType: "PERCENTAGE",
          profitValue: legacyRule.commissionPercent - legacyRule.cashbackPercent,
          feeType: "PERCENTAGE",
          feeValue: 0.0,
          maxCommission: null,
          fixedCharge: 0.0,
          mode: "GENERAL"
        };
        winningRule = simulatedLegacyRule;
        ruleSource = "LEGACY_RULE";
        
        trace.push({
          ruleId: legacyRule.id,
          ruleType: "LEGACY",
          operatorMatch: true,
          categoryMatch: true,
          roleMatch: true,
          amountMatch: true,
          dateMatch: true,
          statusMatch: true,
          modeMatch: true,
          priorityScore: 0,
          mode: "GENERAL",
          amountRange: "N/A",
          decision: "SELECTED",
          reason: `Resolved via legacy operator rule (${resolvedTier} tier)`
        });
      }
    }

    // 4. Default Fallback if still nothing resolved
    if (!winningRule) {
      const simulatedDefaultRule = {
        id: 0,
        commissionType: "PERCENTAGE",
        commissionValue: 5.0,
        surchargeType: "PERCENTAGE",
        surchargeValue: 0.0,
        profitType: "PERCENTAGE",
        profitValue: 4.0,
        feeType: "PERCENTAGE",
        feeValue: 0.0,
        maxCommission: null,
        fixedCharge: 0.0,
        mode: "GENERAL"
      };
      winningRule = simulatedDefaultRule;
      ruleSource = "DEFAULT_FALLBACK";

      trace.push({
        ruleId: 0,
        ruleType: "DEFAULT",
        operatorMatch: true,
        categoryMatch: true,
        roleMatch: true,
        amountMatch: true,
        dateMatch: true,
        statusMatch: true,
        modeMatch: true,
        priorityScore: 0,
        mode: "GENERAL",
        amountRange: "N/A",
        decision: "SELECTED",
        reason: "Default fallback rule applied (5% standard)"
      });
    }

    // Perform financial calculations
    const finalCommType = commissionType || winningRule.commissionType;
    let baseCommission = finalCommType === "PERCENTAGE"
      ? (searchAmount * winningRule.commissionValue) / 100
      : winningRule.commissionValue;
    
    if (winningRule.maxCommission !== null && baseCommission > winningRule.maxCommission) {
      baseCommission = winningRule.maxCommission;
    }
    if (winningRule.fixedCharge) {
      baseCommission += winningRule.fixedCharge;
    }

    const surchargeVal = winningRule.surchargeValue || 0.0;
    const surchargeType = winningRule.surchargeType || "PERCENTAGE";
    const baseSurcharge = surchargeType === "PERCENTAGE"
      ? (searchAmount * surchargeVal) / 100
      : surchargeVal;

    const profitVal = winningRule.profitValue || 0.0;
    const profitType = winningRule.profitType || "PERCENTAGE";
    const baseProfit = profitType === "PERCENTAGE"
      ? (searchAmount * profitVal) / 100
      : profitVal;

    const feeVal = winningRule.feeValue || 0.0;
    const feeType = winningRule.feeType || "PERCENTAGE";
    const baseFee = feeType === "PERCENTAGE"
      ? (searchAmount * feeVal) / 100
      : feeVal;

    const netCost = searchAmount - baseCommission + baseSurcharge + baseFee;
    const walletImpact = -netCost;

    // Clean up winning rule details for representation
    const ruleRepresentation = {
      id: winningRule.id,
      slabId: winningRule.slabId || resolvedSlabId,
      slabName: targetSlab ? targetSlab.name : (resolvedSlabId ? `Slab ${resolvedSlabId}` : "N/A"),
      operatorId: winningRule.operatorId || operatorObj.id,
      serviceCategoryId: winningRule.serviceCategoryId || serviceCategoryObj.id,
      role: winningRule.role || resolvedRole,
      commissionType: finalCommType,
      commissionValue: Number(winningRule.commissionValue.toFixed(4)),
      surchargeType: surchargeType,
      surchargeValue: Number(surchargeVal.toFixed(4)),
      profitType: profitType,
      profitValue: Number(profitVal.toFixed(4)),
      feeType: feeType,
      feeValue: Number(feeVal.toFixed(4)),
      maxCommission: winningRule.maxCommission ? Number(winningRule.maxCommission.toFixed(4)) : null,
      fixedCharge: Number((winningRule.fixedCharge || 0).toFixed(4)),
      mode: winningRule.mode || "GENERAL"
    };

    return res.json({
      success: true,
      data: {
        resolutionPath: {
          slabSource,
          targetSlabId: resolvedSlabId,
          slabName: targetSlab ? targetSlab.name : (resolvedSlabId ? `Slab ${resolvedSlabId}` : "N/A"),
          ruleSource
        },
        winningRule: ruleRepresentation,
        financials: {
          amount: searchAmount.toFixed(4),
          commission: baseCommission.toFixed(4),
          surcharge: baseSurcharge.toFixed(4),
          profit: baseProfit.toFixed(4),
          fee: baseFee.toFixed(4),
          walletImpactEstimate: walletImpact.toFixed(4),
          calculationSource: "SIMULATOR_ONLY"
        },
        trace: trace
      }
    });
  } catch (error) {
    console.error("[Simulator] Run Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/admin/commission/shadow-validation/stats
 * Fetch aggregate metrics for Shadow Commission Validation.
 */
export const getShadowValidationStats = async (req, res) => {
  try {
    const { startDate, endDate, operatorId, userId, packageId, slabId, mismatchType, matchStatus } = req.query;

    const where = {};
    if (userId) where.userId = parseInt(userId);
    if (operatorId) where.operatorId = parseInt(operatorId);
    if (mismatchType) where.mismatchReason = mismatchType;
    
    if (matchStatus !== undefined && matchStatus !== '') {
      if (matchStatus === 'true' || matchStatus === 'match') where.isMatch = true;
      if (matchStatus === 'false' || matchStatus === 'mismatch') where.isMatch = false;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (packageId || slabId) {
      const userWhere = {};
      if (packageId) userWhere.packageId = parseInt(packageId);
      if (slabId) userWhere.slabId = parseInt(slabId);

      const users = await prisma.user.findMany({
        where: userWhere,
        select: { id: true }
      });
      where.userId = { in: users.map(u => u.id) };
    }

    const totalCompared = await prisma.commissionShadowValidation.count({ where });
    const matches = await prisma.commissionShadowValidation.count({ where: { ...where, isMatch: true } });
    const mismatches = await prisma.commissionShadowValidation.count({ where: { ...where, isMatch: false } });
    
    const matchPercent = totalCompared > 0 ? Number(((matches / totalCompared) * 100).toFixed(2)) : 100;

    // Top Mismatch Reasons
    const mismatchGroups = await prisma.commissionShadowValidation.groupBy({
      by: ['mismatchReason'],
      where: { ...where, isMatch: false },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    });
    const topMismatchReasons = mismatchGroups.map(g => ({
      reason: g.mismatchReason || 'UNKNOWN',
      count: g._count.id
    }));

    // Operator Breakdown
    const operatorGroups = await prisma.commissionShadowValidation.groupBy({
      by: ['operatorId', 'isMatch'],
      where,
      _count: { id: true }
    });

    const allOperators = await prisma.operator.findMany({ select: { id: true, name: true } });
    const opNameMap = {};
    allOperators.forEach(o => { opNameMap[o.id] = o.name; });

    const operatorBreakdownMap = {};
    operatorGroups.forEach(g => {
      const opId = g.operatorId;
      const opName = opNameMap[opId] || `Operator ${opId}`;
      if (!operatorBreakdownMap[opId]) {
        operatorBreakdownMap[opId] = { operatorId: opId, name: opName, total: 0, matches: 0, mismatches: 0 };
      }
      const count = g._count.id;
      operatorBreakdownMap[opId].total += count;
      if (g.isMatch) operatorBreakdownMap[opId].matches += count;
      else operatorBreakdownMap[opId].mismatches += count;
    });
    const operatorBreakdown = Object.values(operatorBreakdownMap);

    // Daily Trend (Last 30 days)
    const trendStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const trendRecords = await prisma.commissionShadowValidation.findMany({
      where: {
        ...where,
        createdAt: { gte: trendStartDate }
      },
      select: { createdAt: true, isMatch: true }
    });

    const dailyTrendMap = {};
    trendRecords.forEach(r => {
      const dateStr = r.createdAt.toISOString().slice(0, 10);
      if (!dailyTrendMap[dateStr]) {
        dailyTrendMap[dateStr] = { date: dateStr, total: 0, matches: 0, mismatches: 0 };
      }
      dailyTrendMap[dateStr].total++;
      if (r.isMatch) dailyTrendMap[dateStr].matches++;
      else dailyTrendMap[dateStr].mismatches++;
    });

    // Fill missing dates in daily trend with 0s to make the chart smooth
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().slice(0, 10);
      if (!dailyTrendMap[dateStr]) {
        dailyTrendMap[dateStr] = { date: dateStr, total: 0, matches: 0, mismatches: 0 };
      }
    }

    const dailyTrend = Object.values(dailyTrendMap).sort((a, b) => a.date.localeCompare(b.date));

    return res.json({
      success: true,
      data: {
        totalCompared,
        matches,
        mismatches,
        matchPercent,
        topMismatchReasons,
        dailyTrend,
        operatorBreakdown
      }
    });
  } catch (error) {
    console.error("[ShadowValidation] Stats Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/admin/commission/shadow-validation/list
 * Fetch individual Shadow Commission Validation records with filters and pagination.
 */
export const getShadowValidationList = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { startDate, endDate, operatorId, userId, packageId, slabId, mismatchType, matchStatus } = req.query;

    const where = {};
    if (userId) where.userId = parseInt(userId);
    if (operatorId) where.operatorId = parseInt(operatorId);
    if (mismatchType) where.mismatchReason = mismatchType;
    
    if (matchStatus !== undefined && matchStatus !== '') {
      if (matchStatus === 'true' || matchStatus === 'match') where.isMatch = true;
      if (matchStatus === 'false' || matchStatus === 'mismatch') where.isMatch = false;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (packageId || slabId) {
      const userWhere = {};
      if (packageId) userWhere.packageId = parseInt(packageId);
      if (slabId) userWhere.slabId = parseInt(slabId);

      const users = await prisma.user.findMany({
        where: userWhere,
        select: { id: true }
      });
      where.userId = { in: users.map(u => u.id) };
    }

    const [validations, total] = await prisma.$transaction([
      prisma.commissionShadowValidation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" }
      }),
      prisma.commissionShadowValidation.count({ where })
    ]);

    // Map User and Operator names
    const userIds = [...new Set(validations.map(v => v.userId))];
    const operatorIds = [...new Set(validations.map(v => v.operatorId))];

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, commissionRole: true, tier: true }
    });
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u; });

    const operators = await prisma.operator.findMany({
      where: { id: { in: operatorIds } },
      select: { id: true, name: true }
    });
    const operatorMap = {};
    operators.forEach(o => { operatorMap[o.id] = o.name; });

    const results = validations.map(v => ({
      ...v,
      userName: userMap[v.userId]?.name || `User ${v.userId}`,
      userEmail: userMap[v.userId]?.email || "",
      userTier: userMap[v.userId]?.tier || "Standard",
      userRole: userMap[v.userId]?.commissionRole || "RETAILER",
      operatorName: operatorMap[v.operatorId] || `Operator ${v.operatorId}`
    }));

    return res.json({
      success: true,
      data: {
        records: results,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error("[ShadowValidation] List Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/admin/commission/config
 * Retrieve the current active commission engine version and rollout configuration.
 */
export const getCommissionConfig = async (req, res) => {
  try {
    let config = await prisma.commissionConfig.findUnique({ where: { id: 1 } });
    if (!config) {
      config = await prisma.commissionConfig.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1, currentVersion: 1, commissionEngineVersion: "LEGACY", rolloutPercent: 0 }
      });
    }
    return res.json({ success: true, data: config });
  } catch (error) {
    console.error("[Config] Fetch Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * PUT /api/admin/commission/config
 * Update rollout percentage or feature flag version and write audit trail log.
 */
export const updateCommissionConfig = async (req, res) => {
  try {
    const { commissionEngineVersion, rolloutPercent } = req.body;

    if (commissionEngineVersion && !["LEGACY", "NEW", "HYBRID"].includes(commissionEngineVersion)) {
      return res.status(400).json({ success: false, message: "Invalid commission engine version." });
    }

    if (rolloutPercent !== undefined && ![0, 10, 25, 50, 100].includes(parseInt(rolloutPercent))) {
      return res.status(400).json({ success: false, message: "Invalid rollout percentage." });
    }

    let config = await prisma.commissionConfig.findUnique({ where: { id: 1 } });
    if (!config) {
      config = await prisma.commissionConfig.create({
        data: { id: 1, currentVersion: 1, commissionEngineVersion: "LEGACY", rolloutPercent: 0 }
      });
    }

    const oldVersion = config.commissionEngineVersion;
    const oldRolloutPercent = config.rolloutPercent;

    const newVersion = commissionEngineVersion || oldVersion;
    const newRolloutPercent = rolloutPercent !== undefined ? parseInt(rolloutPercent) : oldRolloutPercent;

    // Update configuration
    const updated = await prisma.commissionConfig.update({
      where: { id: 1 },
      data: {
        commissionEngineVersion: newVersion,
        rolloutPercent: newRolloutPercent,
        currentVersion: { increment: 1 }
      }
    });

    // Write COMMISSION_ENGINE_SWITCH audit entry
    await logAction({
      action: "COMMISSION_ENGINE_SWITCH",
      adminId: req.user.id,
      entity: "CommissionConfig",
      entityId: updated.id,
      details: {
        oldVersion,
        newVersion,
        oldRolloutPercent,
        newRolloutPercent
      },
      req
    });

    // Invalidate caches if needed or sync configVersion in Redis
    try {
      await redisClient.set("commissionConfigVersion", updated.currentVersion.toString());
    } catch (err) {
      console.warn("[CACHE] Redis failed to update config version:", err.message);
    }

    return res.json({ 
      success: true, 
      message: "Commission engine migration configuration updated successfully", 
      data: updated 
    });
  } catch (error) {
    console.error("[Config] Update Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/admin/commission/migration/metrics
 * Dynamic monitoring metrics: Fallback Rate, Rule Not Found Rate, Mismatch Rate, averages.
 */
export const getCommissionMigrationMetrics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const where = {
      status: "SUCCESS",
      type: { in: ["RECHARGE", "BILL_PAYMENT"] }
    };
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const txns = await prisma.transaction.findMany({
      where,
      select: {
        id: true,
        amount: true,
        commission: true,
        profit: true,
        commissionSnapshot: true
      }
    });

    let legacyCount = 0;
    let newCount = 0;
    let totalLegacyComm = 0;
    let totalNewComm = 0;

    let fallbackCount = 0; // Resolves to LEGACY_RULE or DEFAULT_FALLBACK under NEW engine
    let ruleNotFoundCount = 0; // Resolves to DEFAULT_FALLBACK under NEW engine

    txns.forEach(t => {
      let isNew = false;
      let snapshot = null;
      if (t.commissionSnapshot) {
        try {
          snapshot = typeof t.commissionSnapshot === "string" 
            ? JSON.parse(t.commissionSnapshot) 
            : t.commissionSnapshot;
          if (snapshot && snapshot.engine === "NEW") {
            isNew = true;
          }
        } catch (e) {
          // ignore parsing error
        }
      }

      const comm = Number(t.commission);

      if (isNew) {
        newCount++;
        totalNewComm += comm;
        if (snapshot && (snapshot.ruleSource === "LEGACY_RULE" || snapshot.ruleSource === "DEFAULT_FALLBACK")) {
          fallbackCount++;
        }
        if (snapshot && snapshot.ruleSource === "DEFAULT_FALLBACK") {
          ruleNotFoundCount++;
        }
      } else {
        legacyCount++;
        totalLegacyComm += comm;
      }
    });

    const totalCompared = txns.length;
    const avgCommission = totalCompared > 0 
      ? Number(((totalLegacyComm + totalNewComm) / totalCompared).toFixed(4)) 
      : 0.0;

    // Calculate Mismatch Rate from CommissionShadowValidation table
    const shadowCount = await prisma.commissionShadowValidation.count({
      where: startDate || endDate ? {
        createdAt: {
          gte: startDate ? new Date(startDate) : undefined,
          lte: endDate ? new Date(endDate) : undefined
        }
      } : {}
    });
    
    const mismatchCount = await prisma.commissionShadowValidation.count({
      where: {
        isMatch: false,
        ...(startDate || endDate ? {
          createdAt: {
            gte: startDate ? new Date(startDate) : undefined,
            lte: endDate ? new Date(endDate) : undefined
          }
        } : {})
      }
    });

    const mismatchRate = shadowCount > 0 
      ? Number(((mismatchCount / shadowCount) * 100).toFixed(2)) 
      : 0.0;

    const fallbackRate = newCount > 0 
      ? Number(((fallbackCount / newCount) * 100).toFixed(2)) 
      : 0.0;

    const ruleNotFoundRate = newCount > 0 
      ? Number(((ruleNotFoundCount / newCount) * 100).toFixed(2)) 
      : 0.0;

    return res.json({
      success: true,
      data: {
        transactionsProcessed: {
          total: totalCompared,
          legacy: legacyCount,
          new: newCount
        },
        averageCommission: avgCommission,
        mismatchRate,
        fallbackRate,
        ruleNotFoundRate
      }
    });
  } catch (error) {
    console.error("[Metrics] Fetch Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};





