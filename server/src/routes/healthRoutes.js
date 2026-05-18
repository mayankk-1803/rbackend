import express from "express";
import prisma from "../config/prisma.js";
import { redisClient } from "../config/redis.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    status: "HEALTHY",
    timestamp: new Date().toISOString(),
    version: "3.0.0-fintech"
  });
});

router.get("/db", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ success: true, status: "UP", database: "MySQL" });
  } catch (err) {
    res.status(500).json({ success: false, status: "DOWN", error: err.message });
  }
});

router.get("/redis", async (req, res) => {
  try {
    const ping = await redisClient.ping();
    res.json({ success: true, status: "UP", redis: ping });
  } catch (err) {
    res.status(500).json({ success: false, status: "DOWN", error: err.message });
  }
});

export default router;
