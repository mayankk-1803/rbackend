import { masterKeySessionMiddleware } from "./masterKeySessionMiddleware.js";

/**
 * Helper pipeline wrapper combining permission middlewares and the masterKeySessionMiddleware.
 * @param {Function|Array} permissions - Permission checking middleware(s) (e.g. checkPermission)
 * @param {Function} controller - The final controller action
 * @returns {Array} Middleware chain array
 */
export const masterKeyProtected = (permissions, controller) => {
  const permissionArray = Array.isArray(permissions) ? permissions : [permissions];
  return [...permissionArray, masterKeySessionMiddleware, controller];
};
