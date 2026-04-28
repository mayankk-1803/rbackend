import  prisma  from "../config/prisma.js";
import { callProviderApi } from "./providerService.js";

export const compareProviders = async ({ mobile, amount, operator, providers, testMode = true }) => {

  // 1. Input Validation
  if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
    throw new Error("Invalid Indian mobile number");
  }

  const numericAmount = Number(amount);
  if (!numericAmount || isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error("Invalid amount");
  }

  if (!operator || typeof operator !== "string") {
    throw new Error("Valid operator is required");
  }

  if (!Array.isArray(providers) || providers.length === 0) {
    throw new Error("Non-empty providers array is required");
  }

  // Remove duplicates
  const uniqueProviders = [...new Set(providers)];

  // 2. Fetch providers in one query
  const dbProviders = await prisma.provider.findMany({
    where: {
      code: { in: uniqueProviders }
    }
  });

  const providerMap = new Map(dbProviders.map(p => [p.code, p]));

  // 3. Helper: timeout wrapper
  const withTimeout = (promise, ms = 5000) =>
    Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Provider timeout")), ms)
      )
    ]);

  // 4. Process providers
  const results = await Promise.all(
    uniqueProviders.map(async (code) => {
      const provider = providerMap.get(code);

      if (!provider) {
        return {
          provider: code,
          name: "Unknown",
          status: "FAILED",
          message: "Provider not found",
          responseTime: 0
        };
      }

      if (!provider.isActive || provider.isBlacklisted) {
        return {
          provider: code,
          name: provider.name,
          status: "FAILED",
          message: provider.isBlacklisted
            ? "Provider blacklisted"
            : "Provider inactive",
          responseTime: 0
        };
      }

      const startTime = Date.now();

      try {
        let response;

        if (testMode) {
          await new Promise(r => setTimeout(r, Math.random() * 800 + 200));

          if (Math.random() * 100 > (provider.successRate || 95)) {
            throw new Error("Mock API failure");
          }

          response = { message: "Mock success" };
        } else {
          response = await withTimeout(
            callProviderApi(provider, { mobile, amount: numericAmount, operator }),
            5000
          );
        }

        return {
          provider: code,
          name: provider.name,
          status: "SUCCESS",
          message: response.message || "OK",
          responseTime: Date.now() - startTime
        };

      } catch (err) {
        return {
          provider: code,
          name: provider.name,
          status: "FAILED",
          message: err.message,
          responseTime: Date.now() - startTime
        };
      }
    })
  );

  return {
    timestamp: new Date(),
    results
  };
};