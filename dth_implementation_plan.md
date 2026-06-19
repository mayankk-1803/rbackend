# DTH RECHARGE INTEGRATION — IMPLEMENTATION PLAN

This plan outlines the exact changes across all layers of the DiziPay/iRecharge ecosystem (Backend, Client User Web, and Mobile Application) to integrate DTH Recharge.

---

## 1. Backend Modifications

### [MODIFY] [mplanService.js](file:///d:/Dizipay/recharge-backend/server/src/services/mplan/mplanService.js)
1. **Local Fallback Records for DTH**:
   Add a static fallback record dictionary for the DTH operators under `FALLBACK_RECORDS` (Tata Play, Airtel DTH, Dish TV, Sun Direct, Videocon d2h).
   ```javascript
   const DTH_FALLBACK_RECORDS = {
     "10": { // Tata Sky
       "Monthly Packs": [{ rs: "350", validity: "30 Days", desc: "Super Family Hindi HD Pack" }],
       "Annual Packs": [{ rs: "3800", validity: "365 Days", desc: "Hindi Smart Saver Annual Pack" }]
     },
     "7": { // Airtel DTH
       "Monthly Packs": [{ rs: "285", validity: "30 Days", desc: "Airtel Value Prime Hindi Pack" }]
     }
     // ... Dish TV, Sun Direct, Videocon d2h fallbacks
   };
   ```
2. **Integrate DTH Plans Fetches**:
   Implement a `fetchMPlanDthPlans(operatorObj)` method that calls the MPlan DTH Plans API endpoint `/apiv2/dthplans` and normalizes the categories.
   * Endpoint: `https://www.mplan.in/apiv2/dthplans?apikey=[KEY]&operator_code=[OP_CODE]`
   * Cache Keys: `v1:mplan:dth:live:[OP_CODE]` and `v1:mplan:dth:fallback:[OP_CODE]`
3. **Integrate Customer Validation API**:
   Implement a `validateDthCustomerInfo(operatorCode, customerId)` method in `mplanService.js` that calls the MPlan DTH Customer Info API.
   * Endpoint: `https://www.mplan.in/apiv2/dthcustomerinfo.php?apikey=[KEY]&operator_code=[OP_CODE]&customer_id=[CUST_ID]`
   * Normalization: Map keys (`CustomerName`, `Balance`, `NextRechargeDate`, `Planname`) to a clean JSON response:
     ```json
     {
       "success": true,
       "customerName": "John Doe",
       "balance": 250.50,
       "planName": "Hindi Super Saver HD",
       "dueDate": "2026-07-15"
     }
     ```

### [MODIFY] [rechargeController.js](file:///d:/Dizipay/recharge-backend/server/src/controllers/rechargeController.js)
1. **Extend `getPlans` / Add `getDthPlans`**:
   Add a new controller handler to parse the operator code, call `fetchMPlanDthPlans`, and return the response.
2. **Add `validateDthCustomer`**:
   Add a controller method to take `operatorCode` and `subscriberId`, run validation via MPlan service, cache results for 5 minutes, and return details.
3. **Update Recharge Validation Guard**:
   Modify the main `recharge` and `payPostpaidBill` controller parameter checks. When the operator type/category is `"DTH"`, relax the standard 10-digit mobile validation regex (allow numeric string length 8 to 12) and check that the subscriber id is present.

### [MODIFY] [apiRoutes.js](file:///d:/Dizipay/recharge-backend/server/src/routes/apiRoutes.js)
1. **Register Endpoints**:
   Add routes for DTH plans and customer validation:
   * `GET /api/recharge/dth/plans` -> controller.getDthPlans
   * `POST /api/recharge/dth/validate` -> controller.validateDthCustomer

---

## 2. Database Data Seeding

No schema migrations are required. We will create a seeding script `server/src/scripts/seedDthOperators.js` containing:
```javascript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const dthOperators = [
  { name: "TATA SKY", codes: JSON.stringify({ code: "10", category: "DTH", circleRequired: false }) },
  { name: "AIRTEL DTH", codes: JSON.stringify({ code: "7", category: "DTH", circleRequired: false }) },
  { name: "DISH TV", codes: JSON.stringify({ code: "8", category: "DTH", circleRequired: false }) },
  { name: "SUN DIRECT", codes: JSON.stringify({ code: "9", category: "DTH", circleRequired: false }) },
  { name: "VIDEOCON D2H", codes: JSON.stringify({ code: "6", category: "DTH", circleRequired: false }) },
];

async function seed() {
  for (const op of dthOperators) {
    await prisma.operator.upsert({
      where: { name: op.name },
      update: { codes: op.codes },
      create: { name: op.name, codes: op.codes }
    });
  }
}
seed().then(() => prisma.$disconnect());
```

---

## 3. Client User Web (`client-user`) Modifications

### [MODIFY] [DTHRecharge.jsx](file:///d:/Dizipay/recharge-backend/client-user/src/pages/DTHRecharge.jsx)
Rebuild the placeholder into a dynamic multi-step component:
1. **Selector Screen**:
   * Dropdown selector loading active operators where `category === "DTH"` from `/api/recharge/operators`.
   * Input field for Subscriber ID.
2. **Fetch details & Plans section**:
   * Include a button to "Verify Details" that hits `/api/recharge/dth/validate` and renders customer details under a premium glassmorphic UI card.
   * Provide a "Browse Plans" button showing a modal of all plans returned from `/api/recharge/dth/plans`. Selecting a plan sets the payment amount.
3. **Execution**:
   * Connect to the payment confirmation modal `/api/recharge` using parameters `{ mobile: subscriberId, amount, operatorCode }` and redirect to the `/status` page once submitted.

---

## 4. Mobile Application (`recharge-mobile-app`) Modifications

### [MODIFY] [index.tsx](file:///d:/Dizipay/recharge-mobile-app/REHARGE-APP/app/app/(tabs)/index.tsx)
* Update DTH card routing config:
  ```diff
  -  { name: 'DTH', emoji: '📺', color: '#8B5CF6', bgColor: 'rgba(139, 92, 246, 0.1)', route: '/coming-soon', badgeText: 'COMING SOON' },
  +  { name: 'DTH', emoji: '📺', color: '#8B5CF6', bgColor: 'rgba(139, 92, 246, 0.1)', route: '/dth-recharge' },
  ```

### [MODIFY] [all-services.tsx](file:///d:/Dizipay/recharge-mobile-app/REHARGE-APP/app/app/all-services.tsx)
* Update DTH card routing:
  ```diff
  -  { name: 'DTH', emoji: '📺', color: colors.accentViolet, bgColor: colors.accentViolet + '15', route: '/coming-soon', badgeText: 'COMING SOON' },
  +  { name: 'DTH', emoji: '📺', color: colors.accentViolet, bgColor: colors.accentViolet + '15', route: '/dth-recharge' },
  ```

### [MODIFY] [dth-recharge.tsx](file:///d:/Dizipay/recharge-mobile-app/REHARGE-APP/app/app/dth-recharge.tsx)
1. **Adjust Picker values**:
   * Change labels and values to align with database codes:
     * Tata Sky -> value `"10"`
     * Airtel DTH -> value `"7"`
     * Dish TV -> value `"8"`
     * Sun Direct -> value `"9"`
     * Videocon d2h -> value `"6"`
2. **Incorporate API validation and plan retrieval**:
   * Add a "Fetch Customer Details" section triggering the `/api/recharge/dth/validate` endpoint.
   * Embed a plans modal dynamically loading categories for the selected operator.
3. **API submission**:
   * In `handlePayment`, replace the mock Alert logic with:
     ```typescript
     setIsProcessing(true);
     try {
       const res = await apiClient.post('/recharge', {
         mobile: subscriberId,
         amount: parseFloat(amount),
         operatorCode: provider // maps to code "10", "7", etc.
       });
       if (res.data.success) {
         router.push({
           pathname: '/transaction-detail',
           params: { txnId: res.data.transactionId }
         });
       } else {
         Alert.alert('Recharge Failed', res.data.message);
       }
     } catch (err) {
       Alert.alert('Error', 'Failed to connect to recharge gateway.');
     } finally {
       setIsProcessing(false);
     }
     ```

---

## 5. Verification Plan

### Automated Test Steps
1. Run DTH seed script:
   `node server/src/scripts/seedDthOperators.js`
2. Test plans retrieval endpoint via curl:
   `curl -X GET "http://localhost:5000/api/recharge/dth/plans?operatorCode=10"`
3. Test customer details validation endpoint:
   `curl -X POST "http://localhost:5000/api/recharge/dth/validate" -d "operatorCode=10&subscriberId=301245789"`

### Manual Verification
1. Open Admin Panel -> Check if DTH Operators show up in the operator routing logs.
2. Open Client Web -> Click "DTH Recharge" -> Input Subscriber ID -> Verify details are fetched -> Choose plan -> Pay -> Verify wallet balance is deducted and invoice displays correctly.
3. Open Mobile App -> Click DTH -> Run through the same sequence and verify success redirection.
