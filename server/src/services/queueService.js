import { rechargeQueue } from "../config/rechargeQueue.js";
import { connection as redis } from "../config/redis.js";

export const addRechargeJob = async (data) => {
  let delayMs = 0; // Default instant processing

  // Check Redis for recent success of the same mobile within 120s
  if (data.mobile) {
    const recentSuccess = await redis.get(`recent_success:${data.mobile}`);
    if (recentSuccess) {
      // Delay only this job (60-120 sec random)
      delayMs = Math.floor(Math.random() * (120000 - 60000 + 1)) + 60000;
      console.log(`[SMART DELAY] Delaying recharge for ${data.mobile} by ${delayMs}ms due to recent success.`);
    }
  }
  
  return rechargeQueue.add("recharge", data, {
    delay: delayMs,
    attempts: 1, // Reduced to 1 to avoid DLQ spam; fallback handled in worker
    backoff: {
      type: "exponential",
      delay: 5000
    },
    removeOnComplete: true,
    removeOnFail: false
  });
};