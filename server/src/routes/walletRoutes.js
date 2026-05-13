import express from "express";
import { auth } from "../middlewares/auth.js";
import { getWallet, redeemCoins, getCoinsHistory } from "../controllers/walletController.js";
import { updateWalletBalance } from "../services/walletService.js";
import rateLimit from "express-rate-limit";

const router = express.Router();

const redeemRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 5, // Limit each IP to 5 redemption requests per window
  message: { success: false, message: "Too many redemption requests. Please try again later." }
});

router.get("/", auth, getWallet);
router.get("/coins-history", auth, getCoinsHistory);

/**
 * @swagger
 * /api/wallet/redeem-coins:
 *   post:
 *     summary: Redeem 50 Earned Coins for ₹1 Wallet Balance
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully redeemed coins
 *       400:
 *         description: Insufficient coins
 *       429:
 *         description: Too many requests
 */
router.post("/redeem-coins", auth, redeemRateLimiter, redeemCoins);

router.post("/top-up", auth, async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;

    const { wallet, transaction } = await updateWalletBalance(
      userId,
      Number(amount),
      "TOPUP",
      {
        gatewayTxnId: "SIM_" + Date.now(),
        paymentGateway: "simulated",
        status: "SUCCESS"
      }
    );

    res.json({ success: true, message: "Money added successfully", balance: wallet.balance });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
