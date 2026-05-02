import { redisClient } from "../config/redis.js";

const CACHE_TTL = 3600; // 1 hour as requested

const operatorLogos = {
  JIO: "/logos/jio.png",
  AIRTEL: "/logos/airtel.png",
  VI: "/logos/vi.png",
  BSNL: "/logos/bsnl.png"
};

const prefixFallback = {
  JIO: ["700", "701", "702", "703", "704", "705", "706"],
  AIRTEL: ["981", "982", "983", "984", "985"],
  VI: ["988", "989", "990"],
  BSNL: ["940", "941", "942"]
};

export const detectOperator = async (mobile) => {
  console.log(`[Operator] Detecting for: ${mobile}`);

  // 1. Validate mobile (10 digits)
  if (!mobile || mobile.length !== 10 || !/^\d+$/.test(mobile)) {
    console.log(`[Operator] Invalid mobile: ${mobile}`);
    return { success: false, message: "Invalid mobile number" };
  }

  // 2. Check Redis cache
  const cacheKey = `operator:${mobile}`;
  const cachedData = await redisClient.get(cacheKey);

  if (cachedData) {
    console.log(`[Operator] Cache hit for: ${mobile}`);
    return JSON.parse(cachedData);
  }

  console.log(`[Operator] Cache miss for: ${mobile}`);

  let result = null;

  // 3. Call external API (Simulated)
  try {
    // GET https://api.mockprovider.com/operator?mobile=xxxxx
    // We simulate the response here
    const isApiUp = Math.random() > 0.2; // 80% success rate for simulation
    
    if (isApiUp) {
      const providers = ["JIO", "AIRTEL", "VI", "BSNL"];
      const circles = ["Delhi", "Mumbai", "Karnataka", "Maharashtra", "Gujarat"];
      
      const randomProvider = providers[Math.floor(Math.random() * providers.length)];
      const randomCircle = circles[Math.floor(Math.random() * circles.length)];

      console.log(`[Operator] API response for ${mobile}: ${randomProvider}`);
      result = { 
        operator: randomProvider, 
        circle: randomCircle, 
        logo: operatorLogos[randomProvider],
        source: "api" 
      };
    } else {
      throw new Error("External API Unavailable");
    }
  } catch (error) {
    // 4. Fallback to prefix mapping
    console.log(`[Operator] API failed for ${mobile}, using fallback prefix mapping`);
    
    const prefix3 = mobile.substring(0, 3);
    let matchedOperator = "UNKNOWN";

    for (const [op, prefixes] of Object.entries(prefixFallback)) {
      if (prefixes.includes(prefix3)) {
        matchedOperator = op;
        break;
      }
    }

    result = { 
      operator: matchedOperator, 
      circle: "Unknown", 
      logo: operatorLogos[matchedOperator] || null,
      source: "fallback" 
    };
  }

  // 5. Cache result (TTL: 1 hour)
  if (result.operator !== "UNKNOWN") {
    await redisClient.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
  }

  return result;
};
