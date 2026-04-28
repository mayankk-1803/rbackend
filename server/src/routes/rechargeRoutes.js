import express from "express";
import { auth } from "../middlewares/auth.js";
import { initiateRecharge } from "../controllers/rechargeController.js";

const router = express.Router();

router.post("/", auth, initiateRecharge);

export default router;
