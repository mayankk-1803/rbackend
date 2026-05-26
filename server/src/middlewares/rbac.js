import AppError from "../utils/AppError.js";

/**
 * Role hierarchy for permission levels.
 */
const ROLE_LEVELS = {
  USER: 1,
  API_USER: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4
};

/**
 * Middleware to restrict access based on user role.
 * @param {string[]} allowedRoles - Roles allowed to access the route.
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError("Authentication required", 401, "AUTH_REQUIRED"));
    }

    const userRole = (req.user.role || 'USER').toUpperCase();
    
    // Check if user has one of the specifically allowed roles
    if (allowedRoles.includes(userRole)) {
      return next();
    }

    // Check if user has a higher role in the hierarchy
    const maxAllowedLevel = Math.max(...allowedRoles.map(role => ROLE_LEVELS[role.toUpperCase()] || 0));
    const userLevel = ROLE_LEVELS[userRole] || 0;

    if (userLevel >= maxAllowedLevel) {
      return next();
    }

    return next(new AppError("Access denied: insufficient permissions", 403, "FORBIDDEN"));
  };
};

/**
 * Shortcut for admin-only routes.
 */
export const adminOnly = authorize('ADMIN', 'SUPER_ADMIN');

/**
 * Shortcut for super-admin-only routes.
 */
export const superAdminOnly = authorize('SUPER_ADMIN');
