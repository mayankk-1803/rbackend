import { COMMISSION_CONFIG } from "../config/commissionConfig.js";

/**
 * Calculates commission/cashback based on operator and amount slabs.
 * Uses the minimum of operator rate and slab rate for safety.
 */
export const calculateCommission = (amount, operator) => {
    if (!amount || amount <= 0) return 0;

    const op = operator ? operator.toUpperCase() : null;
    const operatorRate = COMMISSION_CONFIG.operators[op] || COMMISSION_CONFIG.default;

    // Find applicable slab
    const slab = COMMISSION_CONFIG.slabs.find(s => amount >= s.min && amount <= s.max);
    const slabRate = slab ? slab.rate : COMMISSION_CONFIG.default;

    // Logic: Use MIN(operatorRate, slabRate) as per requirements
    let rate = Math.min(operatorRate, slabRate);

    // Apply safety max cap
    if (rate > COMMISSION_CONFIG.maxCap) {
        rate = COMMISSION_CONFIG.maxCap;
    }

    let commission = amount * rate;

    // Avoid micro cashback (e.g., less than ₹0.5)
    if (commission < 0.5) {
        commission = 0;
    }

    // Safety limit check again on final value
    const maxAllowed = amount * COMMISSION_CONFIG.maxCap;
    if (commission > maxAllowed) {
        commission = maxAllowed;
    }

    return Number(commission.toFixed(2));
};
