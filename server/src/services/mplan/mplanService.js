import axios from "axios";
import { redisClient } from "../../config/redis.js";

const CACHE_TTL_LIVE = 1800; // 30 minutes
const CACHE_TTL_FALLBACK = 300; // 5 minutes
const MPLAN_TIMEOUT = 12000; // 12 seconds timeout

// High-quality premium fallback plans for each operator
const FALLBACK_RECORDS = {
  "1": { // Vi
    "Truly Unlimited": [
      { rs: "299", validity: "28", desc: "Truly Unlimited Calls + 1.5GB/Day + Binge All Night + Vi Movies & TV" },
      { rs: "479", validity: "56", desc: "Truly Unlimited Calls + 1.5GB/Day + Binge All Night + 5GB Extra Data" },
      { rs: "719", validity: "84", desc: "Truly Unlimited Calls + 1.5GB/Day + Binge All Night + Data Delight" }
    ],
    "Annual Plans": [
      { rs: "3099", validity: "365", desc: "Truly Unlimited Calls + 2GB/Day + Disney+ Hotstar Mobile 1 Year" }
    ],
    "Data Packs": [
      { rs: "19", validity: "1", desc: "1GB Emergency Data Pack" }
    ],
    "Talktime": [
      { rs: "155", validity: "24", desc: "Truly Unlimited Calls + 1GB Total Data + 300 SMS" }
    ],
    "SMS": [
      { rs: "36", validity: "28", desc: "1000 Local/STD SMS Pack" }
    ],
    "OTT": [
      { rs: "151", validity: "30", desc: "Disney+ Hotstar Mobile 3 Months + 8GB Data" }
    ],
    "ISD": [
      { rs: "45", validity: "28", desc: "International Roaming & ISD Ratecutter Pack" }
    ],
    "Topup": [
      { rs: "100", validity: "Unlimited", desc: "₹81.75 Talktime Topup" },
      { rs: "500", validity: "Unlimited", desc: "₹420.73 Talktime Topup" }
    ]
  },
  "2": { // Airtel
    "Truly Unlimited": [
      { rs: "299", validity: "28", desc: "Truly Unlimited Calls + 1.5GB/Day + Unlimited 5G Data + Apollo 24|7 Circle" },
      { rs: "479", validity: "56", desc: "Truly Unlimited Calls + 1.5GB/Day + Unlimited 5G Data + Wynk Music" },
      { rs: "719", validity: "84", desc: "Truly Unlimited Calls + 1.5GB/Day + Unlimited 5G Data + Xstream Mobile Pack" }
    ],
    "Annual Plans": [
      { rs: "3359", validity: "365", desc: "Truly Unlimited Calls + 2.5GB/Day + Disney+ Hotstar 1 Year + Apollo 24|7" }
    ],
    "Data Packs": [
      { rs: "58", validity: "Existing Pack", desc: "3GB High Speed Data Add-on" }
    ],
    "Talktime": [
      { rs: "179", validity: "28", desc: "Truly Unlimited Calls + 2GB Total Data + 300 SMS + Wynk Music" }
    ],
    "SMS": [
      { rs: "46", validity: "28", desc: "500 Local/STD SMS Pack" }
    ],
    "OTT": [
      { rs: "149", validity: "30", desc: "Xstream Premium Pack + 15GB Data" }
    ],
    "ISD": [
      { rs: "65", validity: "28", desc: "ISD Calling Pack for US/Canada/UK" }
    ],
    "Topup": [
      { rs: "100", validity: "Unlimited", desc: "₹81.75 Talktime Topup" },
      { rs: "500", validity: "Unlimited", desc: "₹420.73 Talktime Topup" }
    ]
  },
  "3": { // MTNL
    "Truly Unlimited": [
      { rs: "260", validity: "28", desc: "Unlimited Calls + 2GB/Day + 100 SMS/day" },
      { rs: "429", validity: "56", desc: "Unlimited Calls + 2GB/Day + 100 SMS/day" }
    ],
    "Annual Plans": [
      { rs: "1499", validity: "365", desc: "Annual Plan with Unlimited Calls + 2GB/Day" }
    ],
    "Data Packs": [
      { rs: "98", validity: "28", desc: "3GB High speed data pack" }
    ],
    "Talktime": [],
    "SMS": [],
    "OTT": [],
    "ISD": [],
    "Topup": []
  },
  "4": { // BSNL
    "Truly Unlimited": [
      { rs: "197", validity: "70", desc: "Unlimited Calls for first 18 days + 2GB/Day + Zing App" },
      { rs: "397", validity: "150", desc: "Unlimited Calls for first 30 days + 2GB/Day + Lokdhun" }
    ],
    "Annual Plans": [
      { rs: "797", validity: "300", desc: "Unlimited Calls for first 60 days + 2GB/Day" }
    ],
    "Data Packs": [
      { rs: "151", validity: "28", desc: "40GB Work from home data pack + Zing" }
    ],
    "Talktime": [
      { rs: "107", validity: "35", desc: "200 Min Local/STD + 3GB Data" }
    ],
    "SMS": [
      { rs: "53", validity: "21", desc: "250 Local/STD SMS Pack" }
    ],
    "OTT": [
      { rs: "247", validity: "30", desc: "Eros Now Premium + 50GB Data" }
    ],
    "ISD": [
      { rs: "41", validity: "30", desc: "ISD Calling Pack for Gulf countries" }
    ],
    "Topup": [
      { rs: "100", validity: "Unlimited", desc: "₹81.75 Talktime Topup" },
      { rs: "500", validity: "Unlimited", desc: "₹420.73 Talktime Topup" }
    ]
  },
  "5": { // Jio
    "Truly Unlimited": [
      { rs: "299", validity: "28", desc: "Truly Unlimited Calls + 2GB/Day + True 5G Data + JioTV, JioCinema, JioCloud" },
      { rs: "666", validity: "84", desc: "Truly Unlimited Calls + 1.5GB/Day + True 5G Data + JioTV, JioCinema" },
      { rs: "749", validity: "90", desc: "Truly Unlimited Calls + 2GB/Day + True 5G Data + JioTV, JioCinema" }
    ],
    "Annual Plans": [
      { rs: "2999", validity: "365", desc: "Truly Unlimited Calls + 2.5GB/Day + True 5G Data + JioTV, JioCinema" }
    ],
    "Data Packs": [
      { rs: "61", validity: "Existing Pack", desc: "6GB High Speed Data Add-on" }
    ],
    "Talktime": [
      { rs: "155", validity: "28", desc: "Truly Unlimited Calls + 2GB Total Data + 300 SMS + Jio Apps" }
    ],
    "SMS": [
      { rs: "26", validity: "28", desc: "500 Local/STD SMS Pack" }
    ],
    "OTT": [
      { rs: "148", validity: "28", desc: "JioCinema Premium 1 Month + 10GB Data" }
    ],
    "ISD": [
      { rs: "501", validity: "28", desc: "International Roaming & ISD Ratecutter" }
    ],
    "Topup": [
      { rs: "100", validity: "Unlimited", desc: "₹81.75 Talktime Topup" },
      { rs: "500", validity: "Unlimited", desc: "₹420.73 Talktime Topup" }
    ]
  }
};

/**
 * Intelligent parser to extract clean benefits from raw plan descriptions.
 */
const parsePlanDetails = (rawPlan, operatorObj, circleObj) => {
  const amount = Number(rawPlan.amount || rawPlan.rs || rawPlan.price || 0);
  let validity = rawPlan.validity || rawPlan.Validity || rawPlan.val || "Existing Pack";
  const description = rawPlan.desc || rawPlan.description || rawPlan.detail || "";

  // Normalize validity string
  if (/^\d+$/.test(validity.trim())) {
    validity = `${validity.trim()} Days`;
  }

  const descLower = description.toLowerCase();

  // 1. Parse Data (GB/Day or Total GB)
  let data = rawPlan.data || rawPlan.Data || "N/A";
  if (data === "N/A" || !data) {
    const gbPerDayMatch = description.match(/(\d+(\.\d+)?\s*[GgMm][Bb]\s*\/\s*[Dd]ay)/);
    if (gbPerDayMatch) {
      data = gbPerDayMatch[0].toUpperCase();
    } else {
      const totalGbMatch = description.match(/(\d+(\.\d+)?\s*[GgMm][Bb])/);
      if (totalGbMatch) {
        data = `${totalGbMatch[0].toUpperCase()} Total`;
      }
    }
  }

  // 2. Parse OTT Benefits & Rich Cards
  let ottBenefits = "None";
  const ottList = [];

  if (descLower.includes("hotstar")) {
    ottBenefits = "Disney+ Hotstar";
    ottList.push({ name: "Disney+ Hotstar", description: "Live sports, movies, and exclusive Hotstar Specials." });
  }
  if (descLower.includes("prime")) {
    if (ottBenefits === "None") ottBenefits = "Prime Video";
    else ottBenefits += ", Prime Video";
    ottList.push({ name: "Prime Video", description: "Prime Video Mobile Edition for live streaming & movies." });
  }
  if (descLower.includes("sonyliv")) {
    if (ottBenefits === "None") ottBenefits = "SonyLIV";
    else ottBenefits += ", SonyLIV";
    ottList.push({ name: "SonyLIV", description: "Premium original web series, live sports, and TV shows." });
  }
  if (descLower.includes("zee5")) {
    if (ottBenefits === "None") ottBenefits = "ZEE5";
    else ottBenefits += ", ZEE5";
    ottList.push({ name: "ZEE5", description: "Blockbuster movies, TV shows, and original web series." });
  }
  if (descLower.includes("wynk")) {
    if (ottBenefits === "None") ottBenefits = "Wynk Music";
    else ottBenefits += ", Wynk Music";
    ottList.push({ name: "Wynk Music", description: "Unlimited music streaming, podcasts, and HelloTunes." });
  }
  if (descLower.includes("xstream")) {
    if (ottBenefits === "None") ottBenefits = "Airtel Xstream";
    else ottBenefits += ", Airtel Xstream";
    ottList.push({ name: "Airtel Xstream", description: "Access to 15+ OTTs, live TV channels, and movies." });
  }
  if (descLower.includes("vi movies") || descLower.includes("vi movies & tv")) {
    if (ottBenefits === "None") ottBenefits = "Vi Movies & TV";
    else ottBenefits += ", Vi Movies & TV";
    ottList.push({ name: "Vi Movies & TV", description: "Premium access to movies, live TV, and original content." });
  }
  if (descLower.includes("jiotv")) {
    if (ottBenefits === "None") ottBenefits = "JioTV";
    else ottBenefits += ", JioTV";
    ottList.push({ name: "JioTV", description: "Access 800+ live TV channels across multiple languages." });
  }
  if (descLower.includes("jiocinema")) {
    if (ottBenefits === "None") ottBenefits = "JioCinema";
    else ottBenefits += ", JioCinema";
    ottList.push({ name: "JioCinema", description: "Watch blockbuster movies, TV shows, and live sports." });
  }
  if (descLower.includes("jiocloud") || descLower.includes("aicloud")) {
    if (ottBenefits === "None") ottBenefits = "JioCloud";
    else ottBenefits += ", JioCloud";
    ottList.push({ name: "JioCloud", description: "Secure cloud storage for all your photos, videos, and files." });
  }
  if (descLower.includes("apollo")) {
    if (ottBenefits === "None") ottBenefits = "Apollo 24|7";
    else ottBenefits += ", Apollo 24|7";
    ottList.push({ name: "Apollo 24|7", description: "3 months of Apollo 24|7 Circle membership at no extra cost." });
  }

  // 3. Parse Calls
  let unlimitedCalls = "As per plan";
  if (descLower.includes("truly unlimited") || descLower.includes("unlimited calls") || descLower.includes("unlimited voice")) {
    unlimitedCalls = "Truly Unlimited";
  } else if (descLower.includes("unlimited")) {
    unlimitedCalls = "Unlimited";
  }

  // 4. Parse SMS
  let sms = "N/A";
  const smsMatch = description.match(/(\d+\s*[Ss][Mm][Ss](\/\s*[Dd]ay)?)/);
  if (smsMatch) {
    sms = smsMatch[0];
  } else if (descLower.includes("100 sms/day")) {
    sms = "100 SMS/Day";
  } else if (descLower.includes("300 sms")) {
    sms = "300 SMS";
  }

  // 5. Parse 5G & Meta
  const has5G = descLower.includes("5g") || descLower.includes("true 5g") || descLower.includes("unlimited 5g");
  const roaming = rawPlan.roaming || rawPlan.Roaming || "National Roaming Included";
  const updatedAt = rawPlan.updatedAt || rawPlan.last_updated || new Date().toISOString();
  const operatorName = operatorObj?.name || "Mobile";
  const circleName = circleObj?.name || "Delhi NCR";

  return {
    amount,
    validity,
    description,
    data,
    calls: unlimitedCalls,
    unlimitedCalls,
    sms,
    ottBenefits,
    ottList,
    has5G,
    roaming,
    updatedAt,
    operator: operatorName,
    circle: circleName
  };
};

/**
 * Fetches live recharge plans from MPlan API or falls back to premium local records.
 * Implements strict cache namespace separation (live vs fallback) and correct fallback retrieval order.
 * 
 * @param {object} operatorObj - { name, code }
 * @param {object} circleObj - { name, code }
 * @returns {object} - Standardized premium response structure.
 */
export const fetchMPlanPlans = async (operatorObj, circleObj) => {
  const opCodeStr = String(operatorObj.code).trim();
  const circleCodeStr = String(circleObj.code).trim();

  const liveCacheKey = `v1:mplan:live:${opCodeStr}:${circleCodeStr}`;
  const fallbackCacheKey = `v1:mplan:fallback:${opCodeStr}:${circleCodeStr}`;

  // 1. Check LIVE Redis Cache
  try {
    const cachedLive = await redisClient.get(liveCacheKey);
    if (cachedLive) {
      console.log(`[MPLAN CACHE HIT - LIVE] Op: ${opCodeStr} | Circle: ${circleCodeStr}`);
      const parsedLive = JSON.parse(cachedLive);
      console.log(`[MPLAN FINAL SOURCE] ${parsedLive.source || 'live-mplan'}`);
      return parsedLive;
    }
  } catch (err) {
    console.error("[MPlan Live Cache Error]:", err.message);
  }

  const apiKey = process.env.MPLAN_API_KEY;
  let rawRecords = null;
  let source = "live-mplan";
  let isFallbackActivated = false;
  let fallbackReason = "";

  // 2. ALWAYS attempt REAL LIVE MPlan API request FIRST
  if (apiKey && apiKey !== "mplan_demo_api_key_3675") {
    try {
      const maskedKey = apiKey.substring(0, 4) + "..." + apiKey.substring(apiKey.length - 4);
      const baseUrl = process.env.MPLAN_BASE_URL || "https://www.mplan.in";
      console.log(`[MPLAN LIVE REQUEST] Fetching live plans | Op: ${opCodeStr} | Circle: ${circleCodeStr} | URL: ${baseUrl}/apiv2/mobileplans?apikey=${maskedKey}&operator_code=${opCodeStr}&circle_code=${circleCodeStr}`);
      
      const response = await axios.get(`${baseUrl}/apiv2/mobileplans`, {
        params: {
          apikey: apiKey,
          operator_code: opCodeStr,
          circle_code: circleCodeStr
        },
        timeout: MPLAN_TIMEOUT,
        headers: { "User-Agent": "Dizipay-MPlan-Engine/2.0" }
      });

      const resKeys = response.data ? Object.keys(response.data) : [];
      console.log(`[MPLAN LIVE RESPONSE] Status: ${response.status} | Payload Keys: ${resKeys.join(", ")}`);

      if (response.data) {
        const sampleBody = typeof response.data === 'object' ? JSON.stringify(response.data).substring(0, 150) : String(response.data).substring(0, 150);
        console.log(`[MPLAN LIVE RESPONSE BODY SAMPLE] ${sampleBody}`);
      }

      // Flexible Response Parsing: check records, data, plans, or direct category objects
      let potentialRecords = null;
      if (response.data && response.data.records && typeof response.data.records === 'object' && Object.keys(response.data.records).length > 0) {
        potentialRecords = response.data.records;
      } else if (response.data && response.data.data && typeof response.data.data === 'object' && Object.keys(response.data.data).length > 0) {
        potentialRecords = response.data.data;
      } else if (response.data && response.data.plans && typeof response.data.plans === 'object' && Object.keys(response.data.plans).length > 0) {
        potentialRecords = response.data.plans;
      } else if (response.data && typeof response.data === 'object' && !response.data.status && !response.data.records && Object.keys(response.data).length > 0) {
        // Direct category object
        potentialRecords = response.data;
      }

      // Validation should verify: object exists, categories exist, usable plan arrays exist
      let hasUsablePlans = false;
      if (potentialRecords) {
        for (const cat in potentialRecords) {
          if (Array.isArray(potentialRecords[cat]) && potentialRecords[cat].length > 0) {
            hasUsablePlans = true;
            break;
          }
        }
      }

      if (hasUsablePlans) {
        rawRecords = potentialRecords;
        console.log(`[MPLAN LIVE SUCCESS] Successfully fetched ${Object.keys(rawRecords).length} categories for Op: ${opCodeStr}`);
      } else {
        isFallbackActivated = true;
        fallbackReason = `API returned empty, non-array, or unrecognized structure: ${JSON.stringify(response.data).substring(0, 100)}`;
      }
    } catch (apiErr) {
      isFallbackActivated = true;
      fallbackReason = `Live fetch failed (${apiErr.message || apiErr})`;
      console.error(`[MPLAN ERROR] ${fallbackReason}`);
    }
  } else {
    isFallbackActivated = true;
    fallbackReason = "API Key missing or demo key configured in environment";
  }

  // 3. ONLY IF live API fails: THEN check FALLBACK cache
  if (!rawRecords || isFallbackActivated) {
    console.log(`[MPLAN FALLBACK ACTIVATED] Reason: ${fallbackReason} | Checking fallback cache for Op: ${opCodeStr}`);
    source = "fallback-local";

    try {
      const cachedFallback = await redisClient.get(fallbackCacheKey);
      if (cachedFallback) {
        console.log(`[MPLAN CACHE HIT - FALLBACK] Op: ${opCodeStr} | Circle: ${circleCodeStr}`);
        const parsedFallback = JSON.parse(cachedFallback);
        console.log(`[MPLAN FINAL SOURCE] ${parsedFallback.source || source}`);
        return parsedFallback;
      }
    } catch (err) {
      console.error("[MPlan Fallback Cache Get Error]:", err.message);
    }

    // If FALLBACK cache missing: generate local fallback plans
    console.log(`[MPLAN FALLBACK GENERATION] Generating local premium fallback plans for Op: ${opCodeStr}`);
    rawRecords = FALLBACK_RECORDS[opCodeStr] || FALLBACK_RECORDS["5"]; // Default to Jio if unknown
  }

  // 4. Normalize & Categorize Records
  const categorized = {
    popular: [],
    unlimited: [],
    data: [],
    talktime: [],
    annual: [],
    sms: [],
    ott: [],
    isd: [],
    topup: []
  };

  const popularAmounts = new Set([197, 260, 299, 397, 479, 666, 719, 749]);

  // MPlan category mapping to UI tabs
  const categoryMap = {
    "Annual Plans": "annual",
    "Data Packs": "data",
    "Truly Unlimited": "unlimited",
    "Talktime": "talktime",
    "Topup": "topup",
    "Combo": "unlimited",
    "Smart Phone": "unlimited",
    "Ratecutter": "talktime",
    "SMS": "sms",
    "ISD": "isd",
    "OTT": "ott"
  };

  for (const rawCat in rawRecords) {
    const planList = rawRecords[rawCat];
    if (!Array.isArray(planList)) continue;

    const targetTab = categoryMap[rawCat] || "unlimited";

    planList.forEach((rawPlan) => {
      const cleanPlan = parsePlanDetails(rawPlan, operatorObj, circleObj);
      if (cleanPlan.amount <= 0) return;

      // Push to appropriate category
      if (targetTab === "annual") categorized.annual.push(cleanPlan);
      else if (targetTab === "data") categorized.data.push(cleanPlan);
      else if (targetTab === "talktime") categorized.talktime.push(cleanPlan);
      else if (targetTab === "sms") categorized.sms.push(cleanPlan);
      else if (targetTab === "ott") categorized.ott.push(cleanPlan);
      else if (targetTab === "isd") categorized.isd.push(cleanPlan);
      else if (targetTab === "topup") categorized.topup.push(cleanPlan);
      else categorized.unlimited.push(cleanPlan);

      // Smart Popular Plan Auto-Generation: if it matches popular amounts and isn't already in popular
      if (popularAmounts.has(cleanPlan.amount)) {
        if (!categorized.popular.some(p => p.amount === cleanPlan.amount)) {
          categorized.popular.push(cleanPlan);
        }
      }
    });
  }

  // If popular is still empty, pick top 3 from unlimited
  if (categorized.popular.length === 0 && categorized.unlimited.length > 0) {
    categorized.popular = categorized.unlimited.slice(0, 3);
  }

  // Sort each category by amount ascending
  Object.keys(categorized).forEach((key) => {
    categorized[key].sort((a, b) => a.amount - b.amount);
  });

  const finalResponse = {
    success: true,
    source,
    operator: operatorObj,
    circle: circleObj,
    plans: categorized
  };
  console.log(`[MPLAN FINAL SOURCE] ${source}`);

  // 5. Cache Normalized Response in appropriate Redis namespace
  try {
    if (source === "live-mplan") {
      await redisClient.set(liveCacheKey, JSON.stringify(finalResponse), 'EX', CACHE_TTL_LIVE);
    } else {
      await redisClient.set(fallbackCacheKey, JSON.stringify(finalResponse), 'EX', CACHE_TTL_FALLBACK);
    }
  } catch (err) {
    console.error("[MPlan Cache Set Error]:", err.message);
  }

  return finalResponse;
};

// DTH Fallback Records
const DTH_FALLBACK_RECORDS = {
  "10": { // TATA SKY
    "Monthly Plans": [
      { rs: "350", validity: "1 Month", desc: "Hindi Starter HD Pack - 75 SD + 15 HD Channels" },
      { rs: "450", validity: "1 Month", desc: "Hindi Premium Sports HD Pack - 90 SD + 25 HD Channels" }
    ],
    "3 Month Plans": [
      { rs: "999", validity: "3 Months", desc: "Hindi Starter 3M Pack - Value Saver Pack" }
    ],
    "Annual Plans": [
      { rs: "3800", validity: "12 Months", desc: "Super Value Annual Saver - Hindi Basic" }
    ]
  },
  "7": { // AIRTEL DTH
    "Monthly Plans": [
      { rs: "285", validity: "1 Month", desc: "Value Prime Hindi SD Pack - 65 Channels" },
      { rs: "410", validity: "1 Month", desc: "Value Sports HD Hindi Pack - 80 Channels" }
    ],
    "Annual Plans": [
      { rs: "3200", validity: "12 Months", desc: "Airtel Digital TV Annual Saver Hindi Pack" }
    ]
  },
  "8": { // DISH TV
    "Monthly Plans": [
      { rs: "290", validity: "1 Month", desc: "Dish Maxi Sports Hindi Pack - 70 Channels" },
      { rs: "380", validity: "1 Month", desc: "Super Family HD Hindi Pack - 85 Channels" }
    ],
    "Annual Plans": [
      { rs: "3400", validity: "12 Months", desc: "Dish TV Annual Saver Pack" }
    ]
  },
  "9": { // SUN DIRECT
    "Monthly Plans": [
      { rs: "210", validity: "1 Month", desc: "Sun Direct Joy Hindi Pack - 50 Channels" },
      { rs: "320", validity: "1 Month", desc: "Sun Direct HD Cinema + Sports Hindi Pack" }
    ],
    "Annual Plans": [
      { rs: "2500", validity: "12 Months", desc: "Sun Direct Annual Value Pack" }
    ]
  },
  "6": { // VIDEOCON D2H
    "Monthly Plans": [
      { rs: "275", validity: "1 Month", desc: "D2H Value Hindi Combo Pack - 60 Channels" },
      { rs: "390", validity: "1 Month", desc: "D2H Super HD Premium Sports Hindi Pack" }
    ],
    "Annual Plans": [
      { rs: "3100", validity: "12 Months", desc: "D2H Annual Value Saver Combo" }
    ]
  }
};

/**
 * Fetches live DTH plans from MPlan API or falls back to premium local records.
 */
export const fetchMPlanDthPlans = async (operatorObj) => {
  const opCodeStr = String(operatorObj.code).trim();
  const liveCacheKey = `v1:mplan:dth:live:${opCodeStr}`;
  const fallbackCacheKey = `v1:mplan:dth:fallback:${opCodeStr}`;

  // 1. Check LIVE Redis Cache
  try {
    const cachedLive = await redisClient.get(liveCacheKey);
    if (cachedLive) {
      console.log(`[MPLAN DTH CACHE HIT - LIVE] Op: ${opCodeStr}`);
      return JSON.parse(cachedLive);
    }
  } catch (err) {
    console.error("[MPlan DTH Live Cache Error]:", err.message);
  }

  const apiKey = process.env.MPLAN_API_KEY;
  let rawRecords = null;
  let source = "live-mplan-dth";
  let isFallbackActivated = false;
  let fallbackReason = "";

  // 2. ALWAYS attempt REAL LIVE MPlan API request FIRST
  if (apiKey && apiKey !== "mplan_demo_api_key_3675") {
    try {
      const baseUrl = process.env.MPLAN_BASE_URL || "https://www.mplan.in";
      console.log(`[MPLAN DTH LIVE REQUEST] Fetching live DTH plans | Op: ${opCodeStr}`);
      
      const response = await axios.get(`${baseUrl}/apiv2/dthplans`, {
        params: {
          apikey: apiKey,
          operator_code: opCodeStr
        },
        timeout: MPLAN_TIMEOUT,
        headers: { "User-Agent": "Dizipay-MPlan-Engine/2.0" }
      });

      console.log(`[MPLAN DTH LIVE RESPONSE] Status: ${response.status}`);

      if (response.data) {
        if (response.data.records) {
          rawRecords = response.data.records;
        } else if (response.data.data) {
          rawRecords = response.data.data;
        } else if (response.data.plans) {
          rawRecords = response.data.plans;
        } else if (typeof response.data === 'object' && !response.data.status && Object.keys(response.data).length > 0) {
          rawRecords = response.data;
        }
      }

      let hasUsablePlans = false;
      if (rawRecords) {
        for (const cat in rawRecords) {
          if (Array.isArray(rawRecords[cat]) && rawRecords[cat].length > 0) {
            hasUsablePlans = true;
            break;
          }
        }
      }

      if (!hasUsablePlans) {
        isFallbackActivated = true;
        fallbackReason = "API returned empty or unrecognized DTH plans structure";
      }
    } catch (apiErr) {
      isFallbackActivated = true;
      fallbackReason = `Live DTH plans fetch failed (${apiErr.message || apiErr})`;
      console.error(`[MPLAN DTH ERROR] ${fallbackReason}`);
    }
  } else {
    isFallbackActivated = true;
    fallbackReason = "API Key missing or demo key configured in environment";
  }

  // 3. ONLY IF live API fails: THEN check FALLBACK cache or fallback records
  if (!rawRecords || isFallbackActivated) {
    console.log(`[MPLAN DTH FALLBACK ACTIVATED] Reason: ${fallbackReason} | Checking fallback cache for Op: ${opCodeStr}`);
    source = "fallback-local-dth";

    try {
      const cachedFallback = await redisClient.get(fallbackCacheKey);
      if (cachedFallback) {
        return JSON.parse(cachedFallback);
      }
    } catch (err) {
      console.error("[MPlan DTH Fallback Cache Get Error]:", err.message);
    }

    rawRecords = DTH_FALLBACK_RECORDS[opCodeStr] || DTH_FALLBACK_RECORDS["10"]; // Default to Tata Sky
  }

  // 4. Normalize DTH plans
  const categorized = {};
  for (const rawCat in rawRecords) {
    const planList = rawRecords[rawCat];
    if (!Array.isArray(planList)) continue;

    categorized[rawCat] = planList.map(plan => {
      const amount = Number(plan.amount || plan.rs || plan.price || 0);
      const validity = plan.validity || plan.Validity || plan.val || "Monthly";
      const description = plan.desc || plan.description || plan.detail || "";
      return {
        amount,
        validity,
        description,
        operator: operatorObj.name
      };
    }).filter(p => p.amount > 0);
  }

  const finalResponse = {
    success: true,
    source,
    operator: operatorObj,
    plans: categorized
  };

  // 5. Cache response
  try {
    if (source === "live-mplan-dth") {
      await redisClient.set(liveCacheKey, JSON.stringify(finalResponse), 'EX', CACHE_TTL_LIVE);
    } else {
      await redisClient.set(fallbackCacheKey, JSON.stringify(finalResponse), 'EX', CACHE_TTL_FALLBACK);
    }
  } catch (err) {
    console.error("[MPlan DTH Cache Set Error]:", err.message);
  }

  return finalResponse;
};

/**
 * Validates DTH customer info via MPlan API
 */
export const validateDthCustomerInfo = async (operatorCode, subscriberId) => {
  const opCodeStr = String(operatorCode).trim();
  const subIdStr = String(subscriberId).trim();
  const cacheKey = `v1:mplan:dth:validate:${opCodeStr}:${subIdStr}`;

  // 1. Check Redis Cache
  try {
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      console.log(`[MPLAN DTH VALIDATE CACHE HIT] Op: ${opCodeStr} | SubId: ${subIdStr}`);
      return JSON.parse(cachedData);
    }
  } catch (err) {
    console.error("[DTH Validate Cache Error]:", err.message);
  }

  const apiKey = process.env.MPLAN_API_KEY;
  if (apiKey && apiKey !== "mplan_demo_api_key_3675") {
    try {
      const baseUrl = process.env.MPLAN_BASE_URL || "https://www.mplan.in";
      console.log(`[MPLAN DTH VALIDATE REQUEST] Op: ${opCodeStr} | SubId: ${subIdStr}`);
      
      const response = await axios.get(`${baseUrl}/apiv2/dthcustomerinfo.php`, {
        params: {
          apikey: apiKey,
          operator_code: opCodeStr,
          customer_id: subIdStr
        },
        timeout: MPLAN_TIMEOUT,
        headers: { "User-Agent": "Dizipay-MPlan-Engine/2.0" }
      });

      console.log(`[MPLAN DTH VALIDATE RESPONSE]`, response.data);

      const records = response.data && response.data.records ? response.data.records : response.data;
      
      if (records && (records.CustomerName || records.customername || records.Name || records.name)) {
        const customerName = records.CustomerName || records.customername || records.Name || records.name || "N/A";
        const balance = records.Balance || records.balance || records.BalanceAmount || "";
        const planName = records.Planname || records.planname || records.PlanName || records.Plan || "";
        const dueDate = records.NextRechargeDate || records.nextrechargedate || records.DueDate || "";

        const result = {
          success: true,
          customerName,
          planName,
          balance: balance.toString(),
          dueDate,
          source: "live-mplan-dth-validate"
        };

        try {
          await redisClient.set(cacheKey, JSON.stringify(result), 'EX', 300);
        } catch (err) {
          console.error("[DTH Validate Cache Set Error]:", err.message);
        }

        return result;
      }
    } catch (apiErr) {
      console.error(`[MPLAN DTH VALIDATION ERROR]`, apiErr.message);
    }
  }

  // Graceful fallback
  return {
    success: false,
    message: "Customer lookup currently unavailable. Manual entry is supported.",
    customerName: "",
    planName: "",
    balance: "",
    dueDate: "",
    source: "local-graceful-fallback"
  };
};

