export const API_ROUTES = {
  AUTH: {
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
    FIREBASE_LOGIN: "/auth/firebase-login",
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
  PAYMENT: {
    VERIFY_STATUS: (id) => `/payment/status/${id}`,
  },
};
