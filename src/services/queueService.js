import { rechargeQueue } from "../config/rechargeQueue.js";

export const addRechargeJob = (data) => {
  return rechargeQueue.add("recharge", data, {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000
    },
    removeOnComplete: true,
    removeOnFail: false
  });
};