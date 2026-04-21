import { connection as redis } from "../config/redis.js";

const IDEMPOTENCY_TTL = 86400; // 24 hours

export const idempotencyMiddleware = async (req, res, next) => {
    const idempotencyKey = req.headers['x-idempotency-key'];
    
    // Only apply to POST requests containing the key
    if (req.method !== 'POST' || !idempotencyKey) {
        return next();
    }
    
    try {
        const redisKey = `idempotency:${idempotencyKey}`;
        const cachedResponse = await redis.get(redisKey);
        
        if (cachedResponse) {
            console.log(`[IDEMPOTENCY] Returning cached response for key: ${idempotencyKey}`);
            return res.status(200).json(JSON.parse(cachedResponse));
        }
        
        // Intercept res.json to cache the output after processing
        const originalJson = res.json;
        res.json = function(body) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                // Background caching
                redis.set(redisKey, JSON.stringify(body), "EX", IDEMPOTENCY_TTL)
                    .catch(e => console.error("Redis Idempotency Set Error:", e));
            }
            return originalJson.call(this, body);
        };
        
        next();
    } catch (err) {
        console.error("Idempotency Middleware Error:", err);
        next(); // Fallback to normal processing if Redis is completely down
    }
};
