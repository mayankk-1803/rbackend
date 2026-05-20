import axios from "axios";
import { redisClient } from "../../config/redis.js";
import { operatorMap, fallback3DigitMap } from "../../utils/operatorMap.js";
import { normalizeOperator } from "../operatorMapper.js";
import { normalizeCircle } from "../circleMapper.js";

const CACHE_TTL_LIVE = 86400; // 24 hours
const CACHE_TTL_FALLBACK = 1800; // 30 minutes
const MPLAN_HLR_TIMEOUT = 8000; // 8 seconds timeout
const MAX_RETRIES = 1; // 1 retry on failure
const ENABLE_EZYTM_FALLBACK = false; // Disabled by default as requested

/**
 * LEGACY / DISABLED MPlan HLR Service
 * Preserved for emergency rollback and debugging. Do not import in primary execution flow.
 * 
 * @param {string} mobile - 10-digit mobile number.
 * @returns {object} - { success: true, operator: { name, code }, circle: { name, code }, source: string }
 */
export const detectHLR = async (mobile) => {
  if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
    throw new Error("Invalid 10-digit mobile number");
  }

  const liveCacheKey = `mplan:hlr:live:${mobile}`;
  const fallbackCacheKey = `mplan:hlr:fallback:${mobile}`;

  const apiKey = process.env.MPLAN_API_KEY;
  let operatorObj = null;
  let circleObj = null;
  let source = "mplan_hlr_api";
  let isLiveFailed = false;

  // 1. ALWAYS Attempt Live MPlan HLR API Call FIRST
  if (apiKey && apiKey !== "mplan_demo_api_key_3675") {
    const maskedKey = apiKey.substring(0, 4) + "..." + apiKey.substring(apiKey.length - 4);
    const baseUrl = process.env.MPLAN_BASE_URL || "https://www.mplan.in";
    
    // Comprehensive audit of all documented and potential MPlan HLR endpoints with exact parameter structures
    const endpointConfigs = [
      // Standard clean mobile parameter variations
      { url: `${baseUrl}/apiv2/checkoperator`, params: { apikey: apiKey, mobile: mobile } },
      { url: `${baseUrl}/apiv2/telco`, params: { apikey: apiKey, mobile: mobile } },
      { url: `${baseUrl}/apiv2/checkmobile`, params: { apikey: apiKey, mobile: mobile } },
      { url: `${baseUrl}/apiv2/operatorcheck`, params: { apikey: apiKey, mobile: mobile } },
      { url: `${baseUrl}/apiv2/hlr`, params: { apikey: apiKey, mobile: mobile } },
      { url: `${baseUrl}/apiv2/mnp`, params: { apikey: apiKey, mobile: mobile } },
      { url: `${baseUrl}/apiv2/getoperator`, params: { apikey: apiKey, mobile: mobile } },
      
      // Variations with msisdn parameter
      { url: `${baseUrl}/apiv2/checkoperator`, params: { apikey: apiKey, msisdn: mobile } },
      { url: `${baseUrl}/apiv2/telco`, params: { apikey: apiKey, msisdn: mobile } },
      { url: `${baseUrl}/apiv2/checkmobile`, params: { apikey: apiKey, msisdn: mobile } }
    ];

    for (const config of endpointConfigs) {
      if (operatorObj) break;
      let attempt = 0;
      while (attempt <= MAX_RETRIES && !operatorObj) {
        try {
          attempt++;
          const paramKey = Object.keys(config.params).find(k => k !== 'apikey');
          console.log(`[MPLAN HLR REQUEST] Attempt ${attempt} via ${config.url} (${paramKey}=${mobile}) | APIKey: ${maskedKey}`);
          
          const response = await axios.get(config.url, {
            params: config.params,
            timeout: MPLAN_HLR_TIMEOUT,
            headers: { "User-Agent": "Dizipay-MPlan-HLR-Engine/4.0" }
          });

          const maskedBody = JSON.stringify(response.data, (key, val) => {
            if (key.toLowerCase().includes("key") || key.toLowerCase().includes("token") || key.toLowerCase().includes("secret") || key.toLowerCase().includes("pass")) {
              return "********";
            }
            return val;
          });
          console.log(`[MPLAN HLR RESPONSE] Status: ${response.status} | Body: ${maskedBody}`);

          if (response.data) {
            // Flexible, deep parsing for MPlan HLR response across root, records, data, result, and hlr objects
            const d = response.data;
            const rawOp = d.operator || d.OperatorName || d.telco || d.operator_name || d.OperatorCode || d.operator_code ||
                          d.records?.operator || d.records?.telco || d.records?.OperatorName || d.records?.OperatorCode || d.records?.operator_code ||
                          d.data?.operator || d.data?.telco || d.data?.OperatorName || d.data?.OperatorCode || d.data?.operator_code ||
                          d.result?.operator || d.result?.telco || d.result?.OperatorName || d.hlr?.operator || d.hlr?.telco;

            const rawCircle = d.circle || d.CircleName || d.circle_name || d.CircleCode || d.circle_code ||
                              d.records?.circle || d.records?.CircleName || d.records?.CircleCode || d.records?.circle_code ||
                              d.data?.circle || d.data?.CircleName || d.data?.CircleCode || d.data?.circle_code ||
                              d.result?.circle || d.result?.CircleName || d.hlr?.circle;

            if (rawOp) {
              operatorObj = normalizeOperator(rawOp);
              circleObj = normalizeCircle(rawCircle || "Delhi NCR");
              console.log(`[MPLAN HLR SUCCESS] Mobile: ${mobile} | Operator: ${operatorObj?.name} (${operatorObj?.code}) | Circle: ${circleObj?.name} (${circleObj?.code})`);
              break;
            }
          }
        } catch (apiErr) {
          console.error(`[MPLAN HLR ERROR] Attempt ${attempt} failed on ${config.url} for ${mobile}:`, apiErr.message);
          if (attempt > MAX_RETRIES) break;
        }
      }
    }

    if (!operatorObj) {
      isLiveFailed = true;
    }
  } else {
    isLiveFailed = true;
  }

  // 2. ONLY IF Live MPlan HLR API fails: Check Redis HLR Cache (Fallback Only)
  if (!operatorObj || isLiveFailed) {
    try {
      // First check live success cache
      const cachedLive = await redisClient.get(liveCacheKey);
      if (cachedLive) {
        console.log(`[MPLAN HLR FALLBACK CACHE HIT] Mobile: ${mobile}`);
        return JSON.parse(cachedLive);
      }

      // Then check fallback cache
      const cachedFallback = await redisClient.get(fallbackCacheKey);
      if (cachedFallback) {
        console.log(`[MPLAN HLR FALLBACK CACHE HIT] Mobile: ${mobile}`);
        return JSON.parse(cachedFallback);
      }
    } catch (err) {
      console.error("[HLR Fallback Cache Get Error]:", err.message);
    }
  }

  // 3. Optional Emergency EzyTM Fallback (Disabled by default)
  if (!operatorObj && ENABLE_EZYTM_FALLBACK) {
    const memberId = process.env.EZYTM_MEMBER_ID;
    const password = process.env.EZYTM_API_PASSWORD;
    if (memberId && password && memberId !== "ezytm_demo_member_id") {
      try {
        console.log(`[EZYTM HLR REQUEST] Emergency fallback for ${mobile}`);
        const response = await axios.get("https://ezytm.net/api/v3/hlr-check", {
          params: { member_id: memberId, api_password: password, mobile: mobile },
          timeout: 5000
        });
        if (response.data && (response.data.status === 1 || response.data.success)) {
          const rawOp = response.data.operator || response.data.OperatorName;
          const rawCircle = response.data.circle || response.data.CircleName;
          operatorObj = normalizeOperator(rawOp);
          circleObj = normalizeCircle(rawCircle);
          source = "ezytm_emergency_fallback";
          console.log(`[EZYTM HLR SUCCESS] Mobile: ${mobile} | Operator: ${operatorObj?.name}`);
        }
      } catch (apiErr) {
        console.error(`[EZYTM HLR ERROR] Emergency fallback failed for ${mobile}:`, apiErr.message);
      }
    }
  }

  // 4. Fallback to Local Prefix Map if MPlan HLR and EzyTM failed
  if (!operatorObj) {
    console.log(`[MPLAN HLR FALLBACK] Using local prefix mapping for ${mobile}`);
    source = "local_prefix";
    const prefix4 = mobile.substring(0, 4);
    const prefix3 = mobile.substring(0, 3);

    let matchedOpName = operatorMap[prefix4] || fallback3DigitMap[prefix3];
    if (!matchedOpName) {
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

  // 5. Cache Result in Redis under appropriate key with appropriate TTL
  try {
    if (source === "mplan_hlr_api") {
      console.log(`[MPLAN HLR CACHE SAVE] Saving live HLR to cache for ${mobile}`);
      await redisClient.set(liveCacheKey, JSON.stringify(result), 'EX', CACHE_TTL_LIVE);
    } else {
      console.log(`[MPLAN HLR CACHE SAVE] Saving fallback HLR to cache for ${mobile}`);
      await redisClient.set(fallbackCacheKey, JSON.stringify(result), 'EX', CACHE_TTL_FALLBACK);
    }
  } catch (err) {
    console.error("[HLR Cache Set Error]:", err.message);
  }

  return result;
};
