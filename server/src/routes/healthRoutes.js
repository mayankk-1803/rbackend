import express from 'express';
import prisma from '../config/prisma.js';
import { redisClient } from '../config/redis.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    prisma: false,
    redis: false,
    smsConfigured: !!(process.env.SMS_API_KEY && process.env.SMS_API_URL)
  };

  try {
    // Lightweight Prisma check
    await prisma.$queryRaw`SELECT 1`;
    healthStatus.prisma = true;

    // Lightweight Redis check
    const pong = await redisClient.ping();
    healthStatus.redis = (pong === 'PONG');

    const overallStatus = healthStatus.prisma && healthStatus.redis ? 'ok' : 'degraded';
    res.status(overallStatus === 'ok' ? 200 : 503).json({
      status: overallStatus,
      ...healthStatus
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: error.message,
      ...healthStatus
    });
  }
});

export default router;
