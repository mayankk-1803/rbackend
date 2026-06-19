# DTH RECHARGE INTEGRATION — GAP ANALYSIS

This document details the functional, database, API, and UI gaps identified across the DiziPay/iRecharge ecosystem (Backend, Client User Web, Admin Panel, and Mobile Application) that must be resolved to support DTH (Direct-to-Home) recharge integration.

---

## 1. API & Business Logic Gaps

| Area | Existing Mobile Support | Existing DTH Support | Identified Gap |
| :--- | :--- | :--- | :--- |
| **Operator Mapping** | Statically mapped inside `server/src/config/operators.js`. | Static keys exist (`6` to `10`) in `operators.js` but are missing database entries. | Seeding is required. The database `operator` table contains no rows for DTH operators. |
| **Recharge API** | Enforces mobile specific length and structure in controllers. | Core pipeline exists (`/Recharge2` on worker), but entrypoints are missing. | The frontend-facing recharge endpoints need to accept Subscriber IDs instead of 10-digit mobile formats. |
| **Plans API** | Live integration with `/apiv2/mobileplans` on MPlan. | Completely missing. No endpoint maps to `/apiv2/dthplans`. | Need backend routing, controller action, and MPlan service integration for DTH plans. |
| **Customer Validation** | Handled via authoritative EzyTM Sim HLR. | Completely missing. MPlan DTH Customer Info API is not integrated. | Need backend integration with MPlan `/apiv2/dthcustomerinfo.php` and controller hooks. |
| **Plans Fallback** | Hardcoded premium mobile plans fallback records in `mplanService.js`. | Completely missing. No local fallback plans configured for DTH operators. | Need static backup plans for Tata Play, Airtel DTH, Dish TV, Sun Direct, and Videocon d2h. |

---

## 2. Database & Seeding Gaps

No schema modifications or database migrations are required (since `operator`, `transaction`, `recharge`, and `commissionRule` models natively support DTH fields). However, there is a **critical data gap**:

### Missing Database Rows (`operator` table)
The `operator` table currently only contains Mobile operators (`JIO`, `AIRTEL`, `VI`, `BSNL`) and simulators. The following DTH operator rows are missing and must be seeded:
* **TATA SKY** (normalized database name: `TATA SKY`)
  * `codes` field: `{"code": "10", "category": "DTH", "circleRequired": false}`
* **AIRTEL DTH** (normalized database name: `AIRTEL DTH`)
  * `codes` field: `{"code": "7", "category": "DTH", "circleRequired": false}`
* **DISH TV** (normalized database name: `DISH TV`)
  * `codes` field: `{"code": "8", "category": "DTH", "circleRequired": false}`
* **SUN DIRECT** (normalized database name: `SUN DIRECT`)
  * `codes` field: `{"code": "9", "category": "DTH", "circleRequired": false}`
* **VIDEOCON D2H** (normalized database name: `VIDEOCON D2H`)
  * `codes` field: `{"code": "6", "category": "DTH", "circleRequired": false}`

---

## 3. Client User Web (`client-user`) Gaps

* **`DTHRecharge.jsx` is a Placeholder**:
  * Located at [DTHRecharge.jsx](file:///d:/Dizipay/recharge-backend/client-user/src/pages/DTHRecharge.jsx).
  * **Gap**: Renders a simple `<ComingSoon />` component.
  * **Requirement**: Must be rebuilt to match the high-fidelity UX of [MobilePrepaid.jsx](file:///d:/Dizipay/recharge-backend/client-user/src/pages/MobilePrepaid.jsx) (supporting operator selection, subscriber ID validation, live plans fetch from `/api/recharge/plans`, payment modal trigger, and response alerts).
* **Missing DTH Operator Configurations**:
  * **Gap**: The frontend lacks an operator asset/code map to handle icons/branding for DTH operators.
  * **Requirement**: Map DTH operator codes to their respective visual branding logos and descriptive titles in the frontend configs.

---

## 4. Mobile Application (`recharge-mobile-app`) Gaps

* **`index.tsx` Dashboard Redirection**:
  * Located at [index.tsx](file:///d:/Dizipay/recharge-mobile-app/REHARGE-APP/app/app/(tabs)/index.tsx#L28).
  * **Gap**: The DTH service tile points to `/coming-soon` and displays a `COMING SOON` badge.
  * **Requirement**: Update the route to `/dth-recharge` and remove the badge.
* **`all-services.tsx` Services Directory**:
  * Located at [all-services.tsx](file:///d:/Dizipay/recharge-mobile-app/REHARGE-APP/app/app/all-services.tsx#L40).
  * **Gap**: The DTH service tile points to `/coming-soon` and displays a `COMING SOON` badge.
  * **Requirement**: Update the route to `/dth-recharge` and remove the badge.
* **`dth-recharge.tsx` Form Submissions**:
  * Located at [dth-recharge.tsx](file:///d:/Dizipay/recharge-mobile-app/REHARGE-APP/app/app/dth-recharge.tsx#L130-L133).
  * **Gap**: The submission handler `handlePayment` triggers a mock `"Coming Soon"` Alert without calling any API.
  * **Requirement**: Connect the handler to the backend recharge flow (`apiClient.post('/recharge')`) and handle states like wallet deduction, status redirection, and live error dialogs.
* **Incorrect Picker Value Mapping**:
  * Located at [dth-recharge.tsx](file:///d:/Dizipay/recharge-mobile-app/REHARGE-APP/app/app/dth-recharge.tsx#L173-L177).
  * **Gap**: The selector sets picker values as generic strings (`Tata Play`, `Airtel`, `Dish TV`, `Sun Direct`, `Videocon`) instead of the exact provider keys (`10`, `7`, `8`, `9`, `6`) required by APIBOX.
  * **Requirement**: Adjust Picker options to use the standard APIBOX Operator ID string mapping for seamless transmission.

---

## 5. Admin Panel (`admin-web`) Gaps

* **Operator Configuration Panel**:
  * **Gap**: While the frontend dashboard is generic, there is no visualization or filter category separating DTH operators from Mobile operators.
  * **Requirement**: Ensure operators loaded inside `Operators.jsx` display their categories correctly (using the database JSON `codes.category` field).
