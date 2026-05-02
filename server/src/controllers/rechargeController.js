import prisma from "../config/prisma.js";
import { recharge } from "../services/rechargeService.js";

export const initiateRecharge = async (req, res) => {
  try {
    const { mobile, amount } = req.body;
    const operator = req.body.operator || "Unknown";
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "UNAUTHORIZED" });
    }

    if (!mobile || !amount) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount"
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(userId) }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "USER_NOT_FOUND"
      });
    }

    const result = await recharge({
      userId: Number(userId),
      mobile,
      operator,
      amount: Number(amount),
      testProviders: req.body.testProviders || null
    });

    return res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error("🔥 RECHARGE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Recharge failed"
    });
  }
};
