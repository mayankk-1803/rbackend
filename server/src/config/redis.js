import IORedis from "ioredis";

// redis object for BullMQ connection configuration
export const redis = {
  host: "127.0.0.1",
  port: 6379,
  maxRetriesPerRequest: null, // Required for BullMQ compatibility
  retryStrategy(times) {
    if (times > 1) {
      return null; // Stop retrying and emit error
    }
    return 10; // retry once after 10ms
  }
};

// redisClient instance for service-level operations (get, set, etc.)
export const redisClient = new IORedis(redis);

redisClient.on("connect", () => {
  console.log("Redis client connected successfully");
});

redisClient.on("error", (err) => {
  console.error("Redis connection error:", err);
});