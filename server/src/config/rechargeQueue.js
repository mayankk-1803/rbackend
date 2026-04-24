import { Queue } from "bullmq";
import { redis } from "./redis.js";

export const rechargeQueue = new Queue("recharge", { redis });