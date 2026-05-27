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

      // SUPER_ADMIN automatically bypasses all RBAC constraints
      if (user.role === "SUPER_ADMIN") {
        return next();
      }

      const role = user.role;
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
