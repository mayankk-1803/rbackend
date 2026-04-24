export const COMMISSION_CONFIG = {
    default: 0.005, // 0.5% max baseline

    operators: {
        JIO: 0.004,
        AIRTEL: 0.003,
        VI: 0.003,
        BSNL: 0.002
    },

    slabs: [
        { min: 0, max: 100, rate: 0.002 },
        { min: 101, max: 500, rate: 0.003 },
        { min: 501, max: 1000, rate: 0.004 },
        { min: 1001, max: Infinity, rate: 0.005 }
    ],

    maxCap: 0.01 // never exceed 1%
};
