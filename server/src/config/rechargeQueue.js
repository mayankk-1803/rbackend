import { Queue } from "bullmq";
import { connection } from "./redis.js";

export const rechargeQueue = new Queue("recharge", { connection });