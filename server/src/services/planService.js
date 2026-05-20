import axios from "axios";
import { redisClient } from "../config/redis.js";

const CACHE_TTL = 1800; // 30 minutes
const PLAN_API_TIMEOUT = 8000; // 8 seconds timeout

// High-quality premium fallback plans for each operator
const FALLBACK_PLANS = {
  "1": [ // Vi
    { amount: 299, validity: "28 Days", data: "1.5GB/Day", description: "Binge All Night + Weekend Data Rollover + Vi Movies & TV", category: "Popular", ott: "Vi Movies & TV", calls: "Truly Unlimited" },
    { amount: 479, validity: "56 Days", data: "1.5GB/Day", description: "Binge All Night + Weekend Data Rollover + 5GB Extra Data", category: "Popular", ott: "Vi Movies", calls: "Truly Unlimited" },
    { amount: 719, validity: "84 Days", data: "1.5GB/Day", description: "Binge All Night + Data Delight + Weekend Rollover", category: "Truly Unlimited", ott: "Vi Movies & TV", calls: "Truly Unlimited" },
    { amount: 3099, validity: "365 Days", data: "2GB/Day", description: "1 Year Validity + Disney+ Hotstar Mobile 1 Year + Binge All Night", category: "Annual", ott: "Disney+ Hotstar", calls: "Truly Unlimited" },
    { amount: 19, validity: "1 Day", data: "1GB Total", description: "1GB Emergency Data Pack", category: "Data", ott: "None", calls: "None" },
    { amount: 155, validity: "24 Days", data: "1GB Total", description: "Truly Unlimited Calls + 300 SMS", category: "Talktime", ott: "None", calls: "Truly Unlimited" }
  ],
  "2": [ // Airtel
    { amount: 299, validity: "28 Days", data: "1.5GB/Day", description: "Truly Unlimited Calls + Unlimited 5G Data + Apollo 24|7 Circle", category: "Popular", ott: "Apollo 24|7", calls: "Truly Unlimited" },
    { amount: 479, validity: "56 Days", data: "1.5GB/Day", description: "Truly Unlimited Calls + Unlimited 5G Data + Wynk Music", category: "Popular", ott: "Wynk Music", calls: "Truly Unlimited" },
    { amount: 719, validity: "84 Days", data: "1.5GB/Day", description: "Truly Unlimited Calls + Unlimited 5G Data + Xstream Mobile Pack", category: "Truly Unlimited", ott: "Xstream", calls: "Truly Unlimited" },
    { amount: 3359, validity: "365 Days", data: "2.5GB/Day", description: "Disney+ Hotstar 1 Year + Apollo 24|7 + Wynk Music Premium", category: "Annual", ott: "Disney+ Hotstar", calls: "Truly Unlimited" },
    { amount: 58, validity: "Existing Pack", data: "3GB Total", description: "3GB High Speed Data Add-on", category: "Data", ott: "None", calls: "None" },
    { amount: 179, validity: "28 Days", data: "2GB Total", description: "Truly Unlimited Calls + 300 SMS + Wynk Music", category: "Talktime", ott: "Wynk Music", calls: "Truly Unlimited" }
  ],
  "3": [ // MTNL
    { amount: 260, validity: "28 Days", data: "2GB/Day", description: "Unlimited Calls + 100 SMS/day", category: "Popular", ott: "None", calls: "Truly Unlimited" },
    { amount: 429, validity: "56 Days", data: "2GB/Day", description: "Unlimited Calls + 100 SMS/day", category: "Truly Unlimited", ott: "None", calls: "Truly Unlimited" },
    { amount: 1499, validity: "365 Days", data: "2GB/Day", description: "Annual Plan with Unlimited Calls", category: "Annual", ott: "None", calls: "Truly Unlimited" },
    { amount: 98, validity: "28 Days", data: "3GB Total", description: "High speed data pack", category: "Data", ott: "None", calls: "None" }
  ],
  "4": [ // BSNL
    { amount: 197, validity: "70 Days", data: "2GB/Day", description: "Unlimited Calls for first 18 days + Zing App", category: "Popular", ott: "Zing", calls: "Unlimited (18 Days)" },
    { amount: 397, validity: "150 Days", data: "2GB/Day", description: "Unlimited Calls for first 30 days + Lokdhun", category: "Popular", ott: "Lokdhun", calls: "Unlimited (30 Days)" },
    { amount: 797, validity: "300 Days", data: "2GB/Day", description: "Unlimited Calls for first 60 days + 2GB/day", category: "Annual", ott: "None", calls: "Unlimited (60 Days)" },
    { amount: 107, validity: "35 Days", data: "3GB Total", description: "200 Min Local/STD + 3GB Data", category: "Talktime", ott: "None", calls: "200 Mins" },
    { amount: 151, validity: "28 Days", data: "40GB Total", description: "Work from home data pack + Zing", category: "Data", ott: "Zing", calls: "None" }
  ],
  "5": [ // Jio
    { amount: 299, validity: "28 Days", data: "2GB/Day", description: "Truly Unlimited Calls + True 5G Data + JioTV, JioCinema, JioCloud", category: "Popular", ott: "JioCinema / JioTV", calls: "Truly Unlimited" },
    { amount: 666, validity: "84 Days", data: "1.5GB/Day", description: "Truly Unlimited Calls + True 5G Data + JioTV, JioCinema", category: "Popular", ott: "JioCinema / JioTV", calls: "Truly Unlimited" },
    { amount: 749, validity: "90 Days", data: "2GB/Day", description: "Truly Unlimited Calls + True 5G Data + JioTV, JioCinema", category: "Truly Unlimited", ott: "JioCinema / JioTV", calls: "Truly Unlimited" },
    { amount: 2999, validity: "365 Days", data: "2.5GB/Day", description: "1 Year Validity + True 5G Data + JioTV, JioCinema, JioCloud Premium", category: "Annual", ott: "JioCinema / JioTV", calls: "Truly Unlimited" },
    { amount: 61, validity: "Existing Pack", data: "6GB Total", description: "6GB High Speed Data Add-on", category: "Data", ott: "None", calls: "None" },
    { amount: 155, validity: "28 Days", data: "2GB Total", description: "Truly Unlimited Calls + 300 SMS + Jio Apps", category: "Talktime", ott: "Jio Apps", calls: "Truly Unlimited" }
  ]
};

/**
 * Fetches live recharge plans from PlanAPI / MPlan or falls back to premium local plans.
 * Caches plans in Redis (plans:{operatorCode}:{circleCode}) for 30 minutes.
 * 
 * @param {number|string} operatorCode - Standard operator code (1-5).
 * @param {number|string} circleCode - Standard circle code.
 * @returns {Array} - Array of raw plan objects.
 */
export const fetchLivePlans = async (operatorCode, circleCode) => {
  const opCodeStr = String(operatorCode).trim();
  const circleCodeStr = String(circleCode).trim();

  const cacheKey = `plans:${opCodeStr}:${circleCodeStr}`;

  // 1. Check Redis Cache
  try {
    const cachedPlans = await redisClient.get(cacheKey);
    if (cachedPlans) {
      console.log(`[PLANS CACHE HIT] Op: ${opCodeStr} | Circle: ${circleCodeStr}`);
      return JSON.parse(cachedPlans);
    }
  } catch (err) {
    console.error("[Plans Cache Error]:", err.message);
  }

  const memberId = process.env.PLAN_API_MEMBER_ID;
  const password = process.env.PLAN_API_PASSWORD;

  let plans = [];

  // 2. Attempt Live PlanAPI Call
  if (memberId && password && memberId !== "planapi_demo_member_id") {
    try {
      console.log(`[PLANAPI REQUEST] Fetching live plans for Op: ${opCodeStr} | Circle: ${circleCodeStr}`);
      const response = await axios.get("https://planapi.in/api/Mobile/MobileRechargePlan", {
        params: {
          apimember_id: memberId,
          api_password: password,
          operatorcode: opCodeStr,
          circle: circleCodeStr
        },
        timeout: PLAN_API_TIMEOUT,
        headers: { "User-Agent": "Dizipay-Plan-Engine/1.0" }
      });

      if (response.data && (response.data.status === 1 || response.data.success) && Array.isArray(response.data.data)) {
        plans = response.data.data;
      }
    } catch (apiErr) {
      console.error(`[PLANAPI ERROR] Live fetch failed for Op: ${opCodeStr}:`, apiErr.message);
    }
  }

  // 3. Fallback to Premium Local Plans if API failed or unconfigured
  if (plans.length === 0) {
    console.log(`[PLANS FALLBACK] Using premium local plans for Op: ${opCodeStr}`);
    plans = FALLBACK_PLANS[opCodeStr] || FALLBACK_PLANS["5"]; // Default to Jio if unknown
  }

  // 4. Cache Plans in Redis
  if (plans.length > 0) {
    try {
      await redisClient.setex(cacheKey, CACHE_TTL, JSON.stringify(plans));
    } catch (err) {
      console.error("[Plans Cache Set Error]:", err.message);
    }
  }

  return plans;
};
