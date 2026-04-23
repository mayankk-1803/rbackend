/**
 * Real API Simulation Engine
 * Simulates fintech provider behavior with latency and success/failure rates
 */
export const simulateProviderAPI = async (provider) => {
    console.log(`⚡ Simulating provider: ${provider.name}`);
    
    // Realistic random delay between 300ms and 1100ms
    await new Promise(res => setTimeout(res, Math.random() * 800 + 300));
    
    const random = Math.random() * 100;
    const successRate = provider.successRate || 90;
    
    if (random <= successRate) {
        return {
            status: "SUCCESS",
            operatorId: "OP" + Date.now()
        };
    } else {
        return {
            status: "FAILED",
            message: "Operator failed / Provider timeout"
        };
    }
};

// Maintain compatibility with previous implementation if needed
export const simulateRechargeAPI = simulateProviderAPI;
