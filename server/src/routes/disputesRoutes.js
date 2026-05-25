import express from "express";
import { auth as authenticateUser } from "../middlewares/auth.js";
import { createDispute } from "../controllers/disputeController.js";

const router = express.Router();

router.post("/", authenticateUser, createDispute);

export default router;
