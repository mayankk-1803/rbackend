import { rechargeQueue } from "../config/rechargeQueue.js";

export const addRechargeJob = (data) => {
  const delayMs = Math.floor(Math.random() * (120000 - 60000 + 1)) + 60000;
  
  return rechargeQueue.add("recharge", data, {
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