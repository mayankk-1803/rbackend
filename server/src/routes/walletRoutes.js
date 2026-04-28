import express from "express";
import { auth } from "../middlewares/auth.js";
import { getWallet } from "../controllers/walletController.js";
import { updateWalletBalance } from "../services/walletService.js";

const router = express.Router();

router.get("/", auth, getWallet);

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
