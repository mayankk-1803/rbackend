# Client User Portal UI/UX Rebuild Audit

Audit date: 2026-05-30

## Scope Guardrail

This rebuild must remain UI-only. The following files are logic-critical and should not be changed unless explicitly required for presentation wiring:

- `src/api/index.js`
- `src/api/routes.js`
- `src/services/socket.js`
- `src/context/WalletContext.jsx`
- `src/context/ThemeContext.jsx`
- `src/components/InactivityManager.jsx`
- route guards and auth/session handling in `src/App.jsx`

## Route Inventory

Routes are declared in `src/App.jsx` and protected through `PrivateRoute` / `PublicRoute`.

- `/` -> `HomePage`
- `/login` -> `Login`
- `/register` -> `Register`
- `/forgot-password` -> `ForgotPassword`
- `/dashboard` -> `Home`
- `/history` -> `History`
- `/reports/transactions` -> `TransactionHistory`
- `/reports/ledger` -> `WalletLedger`
- `/recharge` -> `Recharge`
- `/recharge/mobile-prepaid` -> `MobilePrepaid`
- `/recharge/mobile-postpaid` -> `MobilePostpaid`
- `/recharge/dth` -> `DTHRecharge`
- `/recharge/electricity` -> `ElectricityRecharge`
- `/recharge/water` -> `WaterRecharge`
- `/recharge/gas` -> `GasRecharge`
- `/recharge/broadband` -> `BroadbandRecharge`
- `/recharge/loan` -> `LoanRecharge`
- `/status` -> `Status`
- `/profile` -> `Profile`
- `/profile/security` -> `Security`
- `/profile/support` -> `Support`
- `/earned-coins` -> `EarnedCoins`
- `/payment-success` -> `PaymentSuccess`
- `/imart` -> `Catalog`
- `/imart/wishlist` -> `Wishlist`
- `/imart/product/:slug` -> `ProductDetails`

## Component Inventory

- Navigation: `Navbar`, `BottomNav`, `ThemeSelector`
- Session/runtime: `InactivityManager`, `ErrorBoundary`
- Auth/recharge UI: `OTPInput`, `OperatorLogo`, `OperatorInputAdornment`, `PaymentModal`, `RechargePaymentModal`, `RewardPopup`
- Reports: `components/reports/InvoiceModal`, `components/reports/DisputeModal`
- Utility placeholder: `ComingSoon`

## API Dependency Map

Authentication:

- `Login`: `/auth/send-otp`, `/auth/verify-otp`, `/auth/login-email`
- `Register`: `/auth/send-otp`, `/auth/verify-otp`, `/auth/register-email`
- `ForgotPassword`: `/auth/forgot-password`, `/auth/reset-password`
- `Security`: `/user/change-password`

Wallet and dashboard:

- `WalletContext`: `/user/wallet`
- `Dashboard`: `/wallet`, `/user/transactions?limit=10`
- `Home`: `/user/transactions`, `/payment/create-order`
- `EarnedCoins`: `/user/wallet/coins-history`, `/user/wallet/redeem-coins`
- `PaymentSuccess`: `/payment/status/:id`

Recharge:

- `MobilePrepaid`: `/recharge/prepaid/init`, `/recharge/plans`, `/recharge`
- `MobilePostpaid`: `/recharge/postpaid/init`, `/recharge/pay-postpaid-bill`
- `MobileRecharge`: `/v1/dev/operator/:number`, `/v1/dev/plans`, `/v1/dev/recharge`
- `History` and reports refresh: `/recharge/:txnId/refresh-status`
- `Status`: `/recharge/status/:id`

Marketplace:

- `Catalog`: `/imart/products`, `/imart/categories`, `/imart/wishlist`
- `ProductDetails`: `/imart/products/:slug`, `/imart/wishlist`
- `Wishlist`: `/imart/wishlist`, `/imart/orders`, `/imart/checkout`

Reports:

- `TransactionHistory`: `/reports/transactions`, `/reports/summary`, `/reports/export`
- `WalletLedger`: `/reports/wallet-ledger`
- `DisputeModal`: `/disputes`

Profile:

- `Profile`: `/user/update-profile`

## State and Storage

- Auth token: `sessionStorage.dizipay_user_token`
- User data: `sessionStorage.dizipay_user_data`
- Developer auth cache/session keys are cleared by auth interceptor, logout, and inactivity flow.
- Last activity and logout sync: `localStorage.dizipay_last_activity`, `localStorage.dizipay_logout_sync`
- Theme preference: `localStorage.theme`
- Wallet state comes from `WalletContext` and must remain the source of truth for wallet, cashback, and coin balances.

## Socket Events

Socket singleton: `src/services/socket.js`

Observed events:

- `wallet_updated`
- `earned_coins_awarded`
- `cashback_issued`
- `recharge_success`
- `recharge_failed`
- `recharge_queued`
- `recharge_processing`
- `recharge_update`
- `recharge_status`
- `refund_completed`
- `transaction_updated`
- `payment_processing`

## Rebuild Approach

- Preserve all API calls, payloads, route paths, auth guards, storage keys, socket events, and context behavior.
- Rebuild visual language through layout shell, navigation components, shared CSS tokens, global component classes, and page JSX where needed.
- Use existing dependencies: React, Tailwind, Framer Motion, Lucide, Recharts, GSAP.
- Validate with `npm run build` after UI changes.
