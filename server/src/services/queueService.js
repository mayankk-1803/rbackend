import { rechargeQueue } from "../config/rechargeQueue.js";
import { redis, redisClient } from "../config/redis.js";

export const addRechargeJob = async (data) => {
  let delayMs = 0; // Default instant processing

  // Check Redis for recent success of the same mobile within 120s
  if (data.mobile) {
    const recentSuccess = await redisClient.get(`recent_success:${data.mobile}`);
    if (recentSuccess) {
      // Delay only this job (60-120 sec random)
      delayMs = Math.floor(Math.random() * (120000 - 60000 + 1)) + 60000;
      console.log(`[SMART DELAY] Delaying recharge for ${data.mobile} by ${delayMs}ms due to recent success.`);
    }
  }
  
  const retryCount = data.retryCount || 0;
  const jobId = data.txnId 
    ? `recharge_${data.txnId}_retry_${retryCount}_${Date.now()}` 
    : `recharge_${data.idempotencyKey}_${Date.now()}`;

  console.log(`[QUEUE][ADD] → Txn: ${data.txnId} | JobID: ${jobId} | Delay: ${delayMs}ms`);
  console.log(
    `[QUEUE_JOB_CREATED] Job successfully queued for Txn: ${data.txnId} | JobID: ${jobId}`
  );

  return rechargeQueue.add("recharge", data, {
    jobId,
    delay: delayMs,
    attempts: 3, 
    backoff: {
      type: "exponential",
      delay: 5000
    },
    removeOnComplete: true,
    removeOnFail: false
  });
};