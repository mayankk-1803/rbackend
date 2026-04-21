import Provider from "../models/Provider.js";
import { callProviderApi } from "./providerService.js";

/**
 * Compares multiple providers by calling them in parallel and benchmarking their responses.
 * If testMode is true, it uses mock responses and doesn't affect any real balances or logs.
 */
export const compareProviders = async ({ mobile, amount, operator, providers, testMode = true }) => {
    console.log(`[COMPARE] Benchmarking providers: ${providers.join(", ")} (Test Mode: ${testMode})`);

    const data = { mobile, amount, operator };

    const results = await Promise.all(
        providers.map(async (code) => {
            const provider = await Provider.findOne({ code });
            
            if (!provider) {
                return {
                    provider: code,
                    status: "ERROR",
                    message: "Provider not found",
                    responseTime: 0
                };
            }

            if (provider.isBlacklisted) {
                return {
                    provider: code,
                    status: "BLACKLISTED",
                    message: "Provider is currently blacklisted",
                    responseTime: 0
                };
            }

            const startTime = Date.now();
            try {
                let response;
                if (testMode) {
                    // Simulate API call for testing
                    await new Promise(resolve => setTimeout(resolve, Math.random() * 800 + 200));
                    
                    // Mock success/failure based on provider's success rate
                    const isSuccess = Math.random() * 100 <= provider.successRate;
                    
                    if (!isSuccess) {
                        throw new Error("Mock API Failure");
                    }

                    response = {
                        success: true,
                        message: "Mock Recharge Successful",
                        provider: code
                    };
                } else {
                    // Real call via provider service
                    response = await callProviderApi(provider, data);
                }

                const duration = Date.now() - startTime;
                return {
                    provider: code,
                    name: provider.name,
                    status: "SUCCESS",
                    message: response.message || "OK",
                    responseTime: duration
                };
            } catch (err) {
                const duration = Date.now() - startTime;
                return {
                    provider: code,
                    name: provider.name,
                    status: "FAILED",
                    message: err.message,
                    responseTime: duration
                };
            }
        })
    );

    return {
        timestamp: new Date(),
        results: results.filter(r => r !== null)
    };
};
