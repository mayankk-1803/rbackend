import axios from "axios";
import { redisClient } from "../../config/redis.js";
import { operatorMap, fallback3DigitMap } from "../../utils/operatorMap.js";
import { normalizeEzytmResponse } from "../../config/mplanMappings.js";

const CACHE_TTL = 86400; // 24 hours
const EZYTM_TIMEOUT = 5000; // 5 seconds timeout
const THROTTLE_TTL = 15; // 15 seconds rate limit throttle

/**
 * Performs live HLR operator and circle detection via EzyTM API.
 * Aligned precisely with the working EzyTM dashboard/operator lookup panel behavior.
 * 
 * @param {string} mobile - 10-digit mobile number.
 * @returns {object} - Normalized EzyTM response structure.
 */
export const detectEzytmHLR = async (mobile) => {
  if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
    throw new Error("Invalid 10-digit mobile number");
  }

  const cacheKey = `v1:hlr:ezytm:${mobile}`;
  const throttleKey = `v1:throttle:hlr:${mobile}`;

  // 1. Check Redis Cache
  try {
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      console.log(`[EZYTM HLR CACHE HIT] Mobile: ${mobile}`);
      return JSON.parse(cachedData);
    }
  } catch (err) {
    console.error("[HLR Cache Error]:", err.message);
  }

  // 2. Rate Limit Protection (Throttle Check)
  try {
    const isThrottled = await redisClient.get(throttleKey);
    if (isThrottled) {
      console.log(`[EZYTM HLR THROTTLED] Rate limit active for ${mobile}`);
      return {
        success: false,
        message: "Unable to detect network currently. Please retry in a few seconds."
      };
    }
    // Set throttle key
    await redisClient.set(throttleKey, "1", 'EX', THROTTLE_TTL);
  } catch (err) {
    console.error("[HLR Throttle Error]:", err.message);
  }

  const apiUserId = process.env.EZYTM_API_USER_ID;
  const apiPassword = process.env.EZYTM_API_PASSWORD;

  let operatorObj = null;
  let shouldFallbackToPrefix = false;

  // 3. Attempt Live EzyTM API Call (Strict Aligned GET request)
  if (apiUserId && apiPassword && apiUserId !== "ezytm_demo_user_id") {
    try {
      console.log(`[EZYTM HLR REQUEST]`);
      
      const maskedPassword = apiPassword ? "*".repeat(Math.max(3, apiPassword.length - 3)) + apiPassword.slice(-3) : "";
      console.log(`[EZYTM RAW URL]`);
      console.log(`https://planapi.in/api/Mobile/OperatorFetchNew?ApiUserID=${apiUserId}&ApiPassword=${maskedPassword}&Mobileno=${mobile}`);

      const response = await axios.get("https://planapi.in/api/Mobile/OperatorFetchNew", {
        params: {
          ApiUserID: apiUserId,
          ApiPassword: apiPassword,
          Mobileno: mobile
        },
        timeout: EZYTM_TIMEOUT,
        headers: { "User-Agent": "Dizipay-EzyTM-Engine/3.0" }
      });

      if (response && response.data) {
        const d = response.data;

        // Log [EZYTM RAW RESPONSE] exactly as requested
        const maskedRawResponse = JSON.stringify(d, (key, val) => {
          if (key.toLowerCase().includes("password") || key.toLowerCase().includes("userid") || key.toLowerCase().includes("key")) {
            return "********";
          }
          return val;
        });
        console.log(`[EZYTM RAW RESPONSE]`);
        console.log(maskedRawResponse);

        const rawOp = d.Operator || d.operator || d.OperatorName;
        const rawCircle = d.Circle || d.circle || d.CircleName;
        const statusVal = String(d.STATUS !== undefined ? d.STATUS : (d.status !== undefined ? d.status : (d.Status !== undefined ? d.Status : ""))).trim();

        // Log [EZYTM PARSED RESPONSE]
        console.log(`[EZYTM PARSED RESPONSE]`);
        console.log(`STATUS:${statusVal}`);
        console.log(`Operator:${rawOp || ""}`);
        console.log(`Circle:${rawCircle || ""}`);

        // Success Detection: success ONLY when STATUS is "1" OR valid Operator exists
        const isSuccess = (statusVal === "1") || (rawOp && String(rawOp).trim().length > 0);

        if (isSuccess && rawOp && rawCircle) {
          const normResult = normalizeEzytmResponse(rawOp, rawCircle);
          
          operatorObj = {
            operator: normResult.operator,
            operatorCode: normResult.operatorCode,
            circle: normResult.circle,
            circleCode: normResult.circleCode,
            source: "ezytm-live"
          };

          // Expected EZYTM HLR SUCCESS logs
          console.log(`[EZYTM HLR SUCCESS]`);
          console.log(`Operator:${operatorObj.operator}`);
          console.log(`Circle:${operatorObj.circle}`);
          console.log(`OpCode:${operatorObj.operatorCode}`);
          console.log(`CircleCode:${operatorObj.circleCode}`);
        } else if (statusVal === "0" && !rawOp) {
          console.warn(`[EZYTM HLR WARN] STATUS=0 with null operator for ${mobile}`);
          shouldFallbackToPrefix = true;
        } else {
          console.warn(`[EZYTM HLR WARN] Non-success status response for ${mobile} (STATUS: ${statusVal})`);
          // DO NOT fallback to prefix for other successful HTTP 200 responses like STATUS=5
          return {
            success: false,
            message: "Unable to detect network currently. Please retry in a few seconds."
          };
        }
      } else {
        console.warn(`[EZYTM HLR WARN] Empty response from EzyTM for ${mobile}`);
        shouldFallbackToPrefix = true;
      }
    } catch (apiErr) {
      console.error(`[EZYTM HLR ERROR] Live fetch failed for ${mobile}:`, apiErr.message);
      // Fallback activates ONLY for timeout, DNS failure, invalid JSON, empty response, or network errors
      shouldFallbackToPrefix = true;
    }
  } else {
    console.warn(`[EZYTM HLR WARN] Credentials missing or unconfigured for ${mobile}`);
    shouldFallbackToPrefix = true;
  }

  // 4. Fallback to Local Prefix Map if allowed by safeguards
  if (!operatorObj) {
    if (shouldFallbackToPrefix) {
      console.log(`[EZYTM HLR FALLBACK] Using local prefix mapping for ${mobile}`);
      const prefix4 = mobile.substring(0, 4);
      const prefix3 = mobile.substring(0, 3);

      let matchedOpName = operatorMap[prefix4] || fallback3DigitMap[prefix3] || "JIO";

      operatorObj = {
        operator: matchedOpName.toUpperCase(),
        operatorCode: "",
        circle: "Delhi NCR",
        circleCode: "",
        source: "local_prefix"
      };
    } else {
      return {
        success: false,
        message: "Unable to detect network currently. Please retry in a few seconds."
      };
    }
  }

  const result = {
    success: true,
    ...operatorObj
  };

  // 5. Cache Result in Redis under versioned key
  try {
    console.log(`[EZYTM HLR CACHE SAVE] Saving EzyTM HLR for ${mobile}`);
    await redisClient.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL);
  } catch (err) {
    console.error("[HLR Cache Set Error]:", err.message);
  }

  return result;
};
