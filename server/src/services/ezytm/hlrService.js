import axios from "axios";
import { redisClient } from "../../config/redis.js";
import { operatorMap, fallback3DigitMap } from "../../utils/operatorMap.js";
import { normalizeOperator } from "../operatorMapper.js";
import { normalizeCircle } from "../circleMapper.js";

const CACHE_TTL = 86400; // 24 hours
const EZYTM_TIMEOUT = 5000; // 5 seconds timeout
const MAX_RETRIES = 1; // 1 retry on failure

/**
 * Performs live HLR operator and circle detection via EzyTM API.
 * Uses Redis caching (hlr:{mobile}), retries, timeout handling, and local prefix fallback.
 * 
 * @param {string} mobile - 10-digit mobile number.
 * @returns {object} - { success: true, operator: { name, code }, circle: { name, code }, source: string }
 */
export const detectHLR = async (mobile) => {
  if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
    throw new Error("Invalid 10-digit mobile number");
  }

  const cacheKey = `hlr:${mobile}`;

  // 1. Check Redis Cache
  try {
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      console.log(`[HLR CACHE HIT] Mobile: ${mobile}`);
      return JSON.parse(cachedData);
    }
  } catch (err) {
    console.error("[HLR Cache Error]:", err.message);
  }

  const memberId = process.env.EZYTM_MEMBER_ID;
  const password = process.env.EZYTM_API_PASSWORD;

  let operatorObj = null;
  let circleObj = null;
  let source = "ezytm_api";

  // 2. Attempt Live EzyTM API Call with Retries
  if (memberId && password && memberId !== "ezytm_demo_member_id") {
    let attempt = 0;
    while (attempt <= MAX_RETRIES && !operatorObj) {
      try {
        attempt++;
        console.log(`[EZYTM HLR REQUEST] Attempt ${attempt} for ${mobile}`);
        const response = await axios.get("https://ezytm.net/api/v3/hlr-check", {
          params: {
            member_id: memberId,
            api_password: password,
            mobile: mobile
          },
          timeout: EZYTM_TIMEOUT,
          headers: { "User-Agent": "Dizipay-HLR-Engine/1.0" }
        });

        if (response.data && (response.data.status === 1 || response.data.success)) {
          const rawOp = response.data.operator || response.data.OperatorName;
          const rawCircle = response.data.circle || response.data.CircleName;

          operatorObj = normalizeOperator(rawOp);
          circleObj = normalizeCircle(rawCircle);
          console.log(`[EZYTM HLR SUCCESS] Mobile: ${mobile} | Operator: ${operatorObj?.name} | Circle: ${circleObj?.name}`);
        } else {
          console.warn(`[EZYTM HLR WARN] API returned failure status for ${mobile}:`, response.data);
        }
      } catch (apiErr) {
        console.error(`[EZYTM HLR ERROR] Attempt ${attempt} failed for ${mobile}:`, apiErr.message);
        if (attempt > MAX_RETRIES) break;
      }
    }
  }

  // 3. Fallback to Local Prefix Map if EzyTM failed or unconfigured
  if (!operatorObj) {
    console.log(`[HLR FALLBACK] Using local prefix mapping for ${mobile}`);
    source = "local_prefix";
    const prefix4 = mobile.substring(0, 4);
    const prefix3 = mobile.substring(0, 3);

    let matchedOpName = operatorMap[prefix4] || fallback3DigitMap[prefix3];
    if (!matchedOpName) {
      // Default fallback for unknown Indian numbers
      matchedOpName = "JIO";
    }

    operatorObj = normalizeOperator(matchedOpName);
    circleObj = normalizeCircle("Delhi NCR"); // Default circle fallback
  }

  const result = {
    success: true,
    operator: operatorObj || { name: "Jio", code: 5 },
    circle: circleObj || { name: "Delhi NCR", code: 5 },
    source
  };

  // 4. Cache Result in Redis
  try {
    await redisClient.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
  } catch (err) {
    console.error("[HLR Cache Set Error]:", err.message);
  }

  return result;
};
