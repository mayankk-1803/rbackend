import prisma from "../config/prisma.js";

/**
 * Dynamic RBAC check middleware
 * @param {string} moduleName - Module name (e.g. 'users', 'wallets', 'outlets', 'employees', 'audit')
 * @param {string} actionType - Action type ('read', 'write', 'delete', 'approve', 'adjust')
 */
export const checkPermission = (moduleName, actionType) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: "Unauthorized request" });
      }

      // Fetch user from DB to verify active status and fetch DB roles (commissionRole / role)
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true, commissionRole: true }
      });

      if (!dbUser) {
        return res.status(401).json({ success: false, message: "User not found" });
      }

      // SUPER_ADMIN automatically bypasses all RBAC constraints
      if (dbUser.role === "SUPER_ADMIN" || dbUser.commissionRole === "SUPER_ADMIN") {
        return next();
      }

      // Enforce read-only bounds for SUB_ADMIN
      if (dbUser.commissionRole === "SUB_ADMIN") {
        if (actionType === "read") {
          return next();
        }
        return res.status(403).json({
          success: false,
          message: `Access Denied: Sub-Admins have read-only access to module ${moduleName}`
        });
      }

      // If they are not ADMIN/SUPER_ADMIN at UserRole level, block them
      if (dbUser.role !== "ADMIN") {
        return res.status(403).json({ success: false, message: "Access Denied: Administrative access required" });
      }

      const role = dbUser.role;
      const permission = await prisma.rolePermission.findUnique({
        where: {
          role_module: {
            role,
            module: moduleName
          }
        }
      });

      if (!permission) {
        return res.status(403).json({ success: false, message: `Access Denied: No access configured for role ${role} in module ${moduleName}` });
      }

      const fieldMap = {
        read: "canRead",
        write: "canWrite",
        delete: "canDelete",
        approve: "canApprove",
        adjust: "canAdjust"
      };

      const dbField = fieldMap[actionType];
      if (!dbField || !permission[dbField]) {
        return res.status(403).json({ success: false, message: `Access Denied: Role ${role} does not hold ${actionType} authorization in module ${moduleName}` });
      }

      next();
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  };
};

export const adminOnly = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized request",
      });
    }

    if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const superAdminOnly = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized request",
      });
    }

    if (user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Super Admin access required",
      });
    }

    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
