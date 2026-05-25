import dotenv from "dotenv";
import { getBalance } from "../src/services/providers/apibox/balance.js";
import { redisClient } from "../src/config/redis.js";

dotenv.config();

// Stub Redis
redisClient.get = async () => null;
redisClient.setex = async () => "OK";
redisClient.del = async () => 1;
redisClient.incr = async () => 1;
redisClient.expire = async () => 1;

async function test() {
  console.log("Calling getBalance(false)...");
  await getBalance(false);

  console.log("\nCalling getBalance(true)...");
  await getBalance(true);

  process.exit(0);
}

test();
