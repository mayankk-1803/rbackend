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
    STATUS: (id) => `/status/${id}`,
  },
  ADMIN: {
    DASHBOARD: "/87564/admin/dashboard",
    PROVIDERS: "/87564/admin/providers",
    COMPARE: "/87564/admin/compare-recharge",
  },
};
