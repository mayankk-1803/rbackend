import express from "express";
import { auth } from "../middlewares/auth.js";
import { createPaymentLink } from "../services/walletService.js";

const router = express.Router();

router.post("/add-money", auth, async (req, res) => {
  const url = await createPaymentLink(req.user.id, req.body.amount);
  res.json({ paymentUrl: url });
});

export default router;