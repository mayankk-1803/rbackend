export const API_ROUTES = {
  AUTH: {
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
  },
  USER: {
    DASHBOARD: "/user/dashboard",
    TRANSACTIONS: "/user/transactions",
    WALLET: "/user/wallet",
    TOP_UP: "/wallet/top-up",
  },
  RECHARGE: {
    CREATE: "/recharge",
    STATUS: (id) => `/recharge/status/${id}`,
  },
};
