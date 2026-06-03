# Payment Subsystem Audit Report (Before Fix)

This report documents the state of the payment subsystem before applying any code fixes.

---

## 1. Subsystem Code Analysis

### 1.1 `server/src/controllers/paymentController.js`
- **Role**: Entry point for payment APIs.
- **Current Flow**:
  - The `createOrder` endpoint receives the payload (`amount`, `upiId`, `intent`), validates user login, retrieves the idempotency key, and calls `createPaymentOrder`.
  - It does not contain any provider-specific routing or gateway resolution logic.
- **Failure Points**: If `createPaymentOrder` throws an error, the controller catches it, logs a critical error, and returns a 500 response. This message is then intercepted and sanitized to a generic "Payment Failed".

### 1.2 `server/src/services/paymentService.js`
- **Role**: Coordinates payment order creation, duplicate check, and DB persistence.
- **Current Flow**:
  - Creates a new record in the `payment` table with `status: PENDING`.
  - Hardcodes the call to `createNexgateOrder` from `nexgateService.js`.
- **Failure Points**: 
  - If the gateway fails, it sets the payment record `status: FAILED` and `errorMessage` to the exception message.
  - It completely lacks dynamic gateway resolution or local configuration validation.

### 1.3 `server/src/services/providers/nexgateService.js`
- **Role**: Communicates with the NexGate API server at `https://nexgate.in/api/v1`.
- **Current Flow**:
  - Sends a POST payload to `/create_order.php` containing only basic customer details and transaction amount.
  - Relies on headers `x-client-username` and `x-client-apikey` pointing to values loaded directly from `.env`.
- **Failure Points**:
  - If NexGate API returns a failure status (such as `"No Active Merchant Integration Found"`), it throws an error.
  - Masked logging is minimal, and there is no tracking of merchant integration status.

### 1.4 `server/src/utils/seedProviders.js`
- **Role**: Database seeding utility for the `provider` table.
- **Current Flow**:
  - Performs a hard `deleteMany({})` operation on startup to clear the table, followed by a `createMany()` call seeding only recharge providers (`APIBOX`, `MPLAN`, `EZYTM`).
- **Failure Points**: Automatically wipes out any payment gateways added to the database.

---

## 2. Summary of Pipeline Gaps

1. **Hardcoded Payment Provider**: Backend directly calls Nexgate service without dynamically resolving it from the `provider` table.
2. **Missing Payment Gateway in Database**: `seedProviders.js` deletes and does not seed payment gateway configuration.
3. **No Validation Guard**: System makes external API calls even if API keys or base URLs are missing or invalid locally.
4. **Poor Log Traceability**: Credentials are not properly masked, and external integration failures are not labeled.
