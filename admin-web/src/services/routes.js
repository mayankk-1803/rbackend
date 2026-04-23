export const API_ROUTES = {
  AUTH: {
    LOGIN: "/auth/login",
  },
  USER: {
    DASHBOARD: "/user/dashboard",
    TRANSACTIONS: "/user/transactions",
    WALLET: "/user/wallet",
  },
  RECHARGE: {
    CREATE: "/recharge",
    STATUS: (id) => `/api/status/${id}`,
  },
  ADMIN: {
    DASHBOARD: "/admin/dashboard",
    PROVIDERS: "/admin/providers",
    COMPARE: "/admin/compare-recharge",
  },
};
