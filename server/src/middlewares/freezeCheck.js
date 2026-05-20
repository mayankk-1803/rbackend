import { getFreezeStatus } from "../services/freezeService.js";

/**
 * Middleware to block requests if the system or user is under HARD freeze.
 * Allows recharges and top-ups under soft freeze, but blocks them under hard freeze.
 */
export const requireNoHardFreeze = async (req, res, next) => {
  try {
    const userId = req.user?.id ? Number(req.user.id) : null;
    const { isHard, reason } = await getFreezeStatus(userId);

    if (isHard) {
      return res.status(403).json({
        success: false,
        message: "Payment could not be completed.", // Sanitized approved error message
        reason: reason || "Financial mutations are temporarily frozen."
      });
    }

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Middleware to block requests if the system or user is under SOFT or HARD freeze.
 * Blocks rewards, coin redemptions, and cashback actions.
 */
export const requireNoSoftFreeze = async (req, res, next) => {
  try {
    const userId = req.user?.id ? Number(req.user.id) : null;
    const { isSoft, reason } = await getFreezeStatus(userId);

    if (isSoft) {
      return res.status(403).json({
        success: false,
        message: "Unable to redeem coins.", // Sanitized approved error message
        reason: reason || "Rewards and redemptions are temporarily suspended."
      });
    }

    next();
  } catch (err) {
    next(err);
  }
};
