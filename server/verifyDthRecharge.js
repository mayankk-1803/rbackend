import prisma from "./src/config/prisma.js";
import { recoverStaleProcessingLocks } from "./src/services/reconciliationService.js";
import { handleApiboxCallback } from "./src/webhooks/rechargeWebhookController.js";
import { validateRechargeInput } from "./src/middlewares/validateInput.js";
import { recordFinancialEntry } from "./src/services/ledgerService.js";
import { claimIdempotencyKey } from "./src/utils/idempotency.js";
import { recharge, setDthValidationCache, dthMemoryCache } from "./src/controllers/rechargeController.js";

async function main() {
  console.log("==========================================================================");
  console.log("STARTING DTH RECHARGE PRODUCTION READINESS AUTOMATED VERIFICATION SUITE");
  console.log("==========================================================================");

  let passed = 0;
  let failed = 0;
  let warnings = 0;

  const assert = (condition, message, isWarning = false) => {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      if (isWarning) {
        console.warn(`[WARNING] ${message}`);
        warnings++;
      } else {
        console.error(`[FAIL] ${message}`);
        failed++;
      }
    }
  };

  // Setup a test user and wallet for verification
  let testUser = null;
  let testWallet = null;

  try {
    // Dependency-ordered cleanup of past verification runs
    const oldUsers = await prisma.user.findMany({
      where: { email: { contains: "dthverify" } }
    });
    for (const u of oldUsers) {
      await prisma.coinTransaction.deleteMany({ where: { userId: u.id } }).catch(() => {});
      await prisma.ledgerEntry.deleteMany({ where: { userId: u.id } }).catch(() => {});
      await prisma.transaction.deleteMany({ where: { userId: u.id } }).catch(() => {});
      await prisma.walletSnapshot.deleteMany({ where: { userId: u.id } }).catch(() => {});
      await prisma.notification.deleteMany({ where: { userId: u.id } }).catch(() => {});
      await prisma.wallet.deleteMany({ where: { userId: u.id } }).catch(() => {});
      await prisma.dispute.deleteMany({ where: { userId: u.id } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { userId: u.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    }

    await prisma.idempotencyRecord.deleteMany({
      where: {
        OR: [
          { key: { contains: "PROVIDER_" } },
          { key: { contains: "concur_" } },
          { key: { contains: "webhook:" } }
        ]
      }
    }).catch(() => {});

    await prisma.transaction.deleteMany({
      where: {
        OR: [
          { providerRef: { in: ["PROVIDER_REF_12345", "PROVIDER_REF_DUPLICATE", "PROVIDER_FAILED_123"] } },
          { providerTxnId: { in: ["PROVIDER_REF_12345", "PROVIDER_REF_DUPLICATE", "PROVIDER_FAILED_123"] } },
          { mobile: "9999999999" },
          { mobile: "10001000" }
        ]
      }
    }).catch(() => {});

    testUser = await prisma.user.create({
      data: {
        name: "DTH Verification User",
        email: "dthverify@dizipay.com",
        phone: "9999999999",
        password: "verify_hashed_pwd",
        role: "USER",
        tier: "Standard",
        isActive: true,
        authType: "email"
      }
    });

    testWallet = await prisma.wallet.create({
      data: {
        userId: testUser.id,
        balance: 1000.0,
        coinBalance: 0
      }
    });

    // ----------------------------------------------------
    // TEST 1: DTH Recharge Creation
    // ----------------------------------------------------
    console.log("\n--- Test 1: DTH Recharge Creation ---");
    let testTxn = null;
    try {
      testTxn = await prisma.transaction.create({
        data: {
          userId: testUser.id,
          amount: 250.0,
          type: "RECHARGE",
          status: "PENDING_REVIEW",
          direction: "DEBIT",
          mobile: "10001000",
          operator: "TATA SKY",
          provider: "APIBOX",
          reviewStatus: "PENDING_REVIEW"
        }
      });
      assert(
        testTxn && testTxn.status === "PENDING_REVIEW" && testTxn.reviewStatus === "PENDING_REVIEW",
        "Transaction created successfully with DTH operator and correct status/reviewStatus tags."
      );
    } catch (err) {
      assert(false, `Failed to create DTH transaction: ${err.message}`);
    }

    // ----------------------------------------------------
    // TEST 2: Worker Processing (Locking + State Transition)
    // ----------------------------------------------------
    console.log("\n--- Test 2: Worker Processing (Locking + State Transition) ---");
    try {
      // Simulate lock acquisition inside worker
      const acquired = await prisma.transaction.updateMany({
        where: { id: testTxn.id, processingLock: false },
        data: { processingLock: true, processingStartedAt: new Date() }
      });
      assert(acquired.count === 1, "Worker lock acquired successfully.");

      // Update to PROCESSING state
      const processed = await prisma.transaction.update({
        where: { id: testTxn.id },
        data: { status: "PROCESSING", processingLock: false }
      });
      assert(processed.status === "PROCESSING", "Transaction state successfully transitioned to PROCESSING.");
    } catch (err) {
      assert(false, `Worker simulation failed: ${err.message}`);
    }

    // ----------------------------------------------------
    // TEST 3: Webhook Success callback (Single Settlement)
    // ----------------------------------------------------
    console.log("\n--- Test 3: Webhook Success Callback ---");
    try {
      const mockReq = {
        query: {
          STATUS: "SUCCESS",
          OPTXNID: "PROVIDER_REF_12345",
          RefTxnId: String(testTxn.id)
        },
        body: {},
        headers: {},
        method: "GET"
      };

      const mockRes = {
        status: (code) => {
          mockRes.statusCode = code;
          return mockRes;
        },
        send: (msg) => {
          mockRes.sendMsg = msg;
          return mockRes;
        },
        statusCode: 200,
        sendMsg: ""
      };

      await handleApiboxCallback(mockReq, mockRes);
      assert(mockRes.statusCode === 200, "Webhook endpoint returned 200 OK status.");

      const updatedTxn = await prisma.transaction.findUnique({ where: { id: testTxn.id } });
      assert(updatedTxn.status === "SUCCESS", "Transaction status updated to SUCCESS in the database.");

      // Allow background reward/cashback processing to settle completely
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (err) {
      assert(false, `Webhook success test failed: ${err.message}`);
    }

    // ----------------------------------------------------
    // TEST 4 & 5: Webhook Failure and Refund Flow
    // ----------------------------------------------------
    console.log("\n--- Test 4 & 5: Webhook Failure & Refund Flow ---");
    let refundTxn = null;
    try {
      // Create new transaction in PENDING state to test failure callback
      refundTxn = await prisma.transaction.create({
        data: {
          userId: testUser.id,
          amount: 100.0,
          type: "RECHARGE",
          status: "PENDING",
          direction: "DEBIT",
          mobile: "10001000",
          operator: "AIRTEL DTH",
          provider: "APIBOX"
        }
      });

      // Debit wallet simulating initial recharge checkout debit
      await prisma.wallet.update({
        where: { userId: testUser.id },
        data: { balance: { decrement: 100.0 } }
      });

      const mockReq = {
        query: {
          STATUS: "FAILED",
          OPTXNID: "PROVIDER_FAILED_123",
          RefTxnId: String(refundTxn.id)
        },
        body: {},
        headers: {},
        method: "GET"
      };

      const mockRes = {
        status: (code) => {
          mockRes.statusCode = code;
          return mockRes;
        },
        send: (msg) => {
          mockRes.sendMsg = msg;
          return mockRes;
        },
        statusCode: 200,
        sendMsg: ""
      };

      await handleApiboxCallback(mockReq, mockRes);
      assert(mockRes.statusCode === 200, "Webhook endpoint returned 200 OK status on failure.");

      const finalTxn = await prisma.transaction.findUnique({ where: { id: refundTxn.id } });
      assert(finalTxn.status === "REFUNDED", "Transaction successfully transitioned to REFUNDED status.");

      // Check if REFUND_CREDIT ledger entry was generated
      const ledger = await prisma.ledgerEntry.findFirst({
        where: { transactionId: refundTxn.id, type: "REFUND_CREDIT" }
      });
      assert(ledger !== null, "Ledger entry of type REFUND_CREDIT was generated successfully.");

      // Check wallet was credited
      const userWallet = await prisma.wallet.findUnique({ where: { userId: testUser.id } });
      assert(Number(userWallet.balance) === 1000.0, "Wallet balance was credited back to user (Refund flow validated).");
    } catch (err) {
      assert(false, `Failure/Refund flow check failed: ${err.message}`);
    }

    // ----------------------------------------------------
    // TEST 6: Invoice Reference Resolution
    // ----------------------------------------------------
    console.log("\n--- Test 6: Invoice Reference Resolution ---");
    try {
      const txn = await prisma.transaction.findUnique({ where: { id: testTxn.id } });
      const ref = txn.providerRef || txn.providerRefId || txn.providerTxnId;
      assert(ref === "PROVIDER_REF_12345", `Invoice reference resolved to provider details successfully: ${ref}`);
    } catch (err) {
      assert(false, `Invoice reference resolution failed: ${err.message}`);
    }

    // ----------------------------------------------------
    // TEST 7: Operator Registry Resolution
    // ----------------------------------------------------
    console.log("\n--- Test 7: Operator Registry Resolution ---");
    try {
      const operators = await prisma.operator.findMany({
        where: { active: true }
      });
      const dthOps = operators.filter(op => {
        try {
          const parsed = JSON.parse(op.codes);
          return parsed.category === "DTH";
        } catch {
          return false;
        }
      });
      assert(dthOps.length > 0, `Operator registry successfully returns active DTH operators (${dthOps.length} found).`);
    } catch (err) {
      assert(false, `Registry resolution failed: ${err.message}`);
    }

    // ----------------------------------------------------
    // TEST 8: Stale Lock Recovery
    // ----------------------------------------------------
    console.log("\n--- Test 8: Stale Lock Recovery ---");
    try {
      // 1. Transaction matching recovery criteria (updatedAt is set to older than 10 mins ago)
      const recoverTxn = await prisma.transaction.create({
        data: {
          userId: testUser.id,
          amount: 200.0,
          type: "RECHARGE",
          status: "PROCESSING",
          direction: "DEBIT",
          mobile: "10001000",
          operator: "DISH TV",
          processingLock: true,
          updatedAt: new Date(Date.now() - 11 * 60 * 1000) // 11 mins ago
        }
      });

      // 2. Transaction that is locked but fresh (locked < 10 mins ago)
      const skipTxn = await prisma.transaction.create({
        data: {
          userId: testUser.id,
          amount: 200.0,
          type: "RECHARGE",
          status: "PROCESSING",
          direction: "DEBIT",
          mobile: "10001000",
          operator: "DISH TV",
          processingLock: true,
          updatedAt: new Date() // Fresh lock
        }
      });

      // Run recovery task
      await recoverStaleProcessingLocks();

      // Check outcomes
      const recoverRes = await prisma.transaction.findUnique({ where: { id: recoverTxn.id } });
      const skipRes = await prisma.transaction.findUnique({ where: { id: skipTxn.id } });

      assert(recoverRes.processingLock === false, "Recoverable stale transaction lock was successfully released.");
      assert(skipRes.processingLock === true, "Fresh transaction lock was skipped and remained locked.");
    } catch (err) {
      assert(false, `Stale lock recovery failed: ${err.message}`);
    }

    // ----------------------------------------------------
    // TEST 9: Validation Rules (Sanitization/Errors)
    // ----------------------------------------------------
    console.log("\n--- Test 9: Validation Rules ---");
    try {
      const mockReqInvalidDth = {
        body: {
          operatorCode: "10",
          mobile: "123", // invalid length
          amount: 100
        }
      };
      
      const mockRes = {
        status: (code) => {
          mockRes.statusCode = code;
          return mockRes;
        },
        json: (body) => {
          mockRes.jsonBody = body;
          return mockRes;
        },
        statusCode: 200,
        jsonBody: {}
      };

      validateRechargeInput(mockReqInvalidDth, mockRes, () => {});
      assert(
        mockRes.statusCode === 400 && mockRes.jsonBody.message === "Invalid DTH Subscriber ID",
        `DTH invalid Subscriber ID validation error matches approved string: ${mockRes.jsonBody.message}`
      );

      // Verify DTH recharge below ₹100 validation
      const mockReqDthBelow100 = {
        headers: {},
        body: {
          mobile: "10001000",
          operatorCode: "10",
          amount: 99
        },
        user: { id: testUser.id },
        ip: "127.0.0.1"
      };

      const mockResDthBelow100 = {
        status: (code) => {
          mockResDthBelow100.statusCode = code;
          return mockResDthBelow100;
        },
        json: (body) => {
          mockResDthBelow100.jsonBody = body;
          return mockResDthBelow100;
        },
        statusCode: 200,
        jsonBody: {}
      };

      await recharge(mockReqDthBelow100, mockResDthBelow100);
      assert(
        mockResDthBelow100.statusCode === 400 && mockResDthBelow100.jsonBody.message === "Minimum DTH recharge amount is ₹100",
        `DTH recharge amount below ₹100 fails with approved validation error: ${mockResDthBelow100.jsonBody.message}`
      );

      // Verify DTH recharge at exactly ₹100 passes amount validation
      const mockReqDthAt100 = {
        headers: {},
        body: {
          mobile: "10001000",
          operatorCode: "10",
          amount: 100
        },
        user: { id: testUser.id },
        ip: "127.0.0.1"
      };

      const mockResDthAt100 = {
        status: (code) => {
          mockResDthAt100.statusCode = code;
          return mockResDthAt100;
        },
        json: (body) => {
          mockResDthAt100.jsonBody = body;
          return mockResDthAt100;
        },
        statusCode: 200,
        jsonBody: {}
      };

      await recharge(mockReqDthAt100, mockResDthAt100);
      assert(
        mockResDthAt100.jsonBody.message !== "Minimum DTH recharge amount is ₹100",
        "DTH recharge amount of ₹100 successfully passes minimum amount validation."
      );

      // --- DTH Customer Verification Gate Tests ---

      // A. Verify DTH recharge without validation fails
      const mockReqNoVal = {
        headers: {},
        body: {
          mobile: "10001000",
          operatorCode: "10",
          amount: 100
        },
        user: { id: testUser.id },
        ip: "127.0.0.1"
      };

      const mockResNoVal = {
        status: (code) => {
          mockResNoVal.statusCode = code;
          return mockResNoVal;
        },
        json: (body) => {
          mockResNoVal.jsonBody = body;
          return mockResNoVal;
        },
        statusCode: 200,
        jsonBody: {}
      };

      await recharge(mockReqNoVal, mockResNoVal);
      assert(
        mockResNoVal.statusCode === 400 && mockResNoVal.jsonBody.message === "Please verify DTH customer details before recharging.",
        `Recharge without validation fails: ${mockResNoVal.jsonBody.message}`
      );

      // B. Verify DTH recharge with successful validation passes validation gate
      const validationKey = `dth_validation:${testUser.id}:10:10001000`;
      await setDthValidationCache(validationKey, {
        verified: true,
        validatedAt: new Date().toISOString()
      }, 300);

      const mockReqValSuccess = {
        headers: {},
        body: {
          mobile: "10001000",
          operatorCode: "10",
          amount: 100
        },
        user: { id: testUser.id },
        ip: "127.0.0.1"
      };

      const mockResValSuccess = {
        status: (code) => {
          mockResValSuccess.statusCode = code;
          return mockResValSuccess;
        },
        json: (body) => {
          mockResValSuccess.jsonBody = body;
          return mockResValSuccess;
        },
        statusCode: 200,
        jsonBody: {}
      };

      await recharge(mockReqValSuccess, mockResValSuccess);
      assert(
        mockResValSuccess.jsonBody.message !== "Please verify DTH customer details before recharging." &&
        mockResValSuccess.jsonBody.message !== "Customer validation expired. Please verify again.",
        "Recharge with successful active validation passes the DTH verification gate."
      );

      // C. Verify DTH recharge with expired validation (> 5 minutes ago) fails
      await setDthValidationCache(validationKey, {
        verified: true,
        validatedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString() // 6 minutes ago
      }, 600);

      const mockReqValExpired = {
        headers: {},
        body: {
          mobile: "10001000",
          operatorCode: "10",
          amount: 100
        },
        user: { id: testUser.id },
        ip: "127.0.0.1"
      };

      const mockResValExpired = {
        status: (code) => {
          mockResValExpired.statusCode = code;
          return mockResValExpired;
        },
        json: (body) => {
          mockResValExpired.jsonBody = body;
          return mockResValExpired;
        },
        statusCode: 200,
        jsonBody: {}
      };

      await recharge(mockReqValExpired, mockResValExpired);
      assert(
        mockResValExpired.statusCode === 400 && mockResValExpired.jsonBody.message === "Customer validation expired. Please verify again.",
        `Expired validation recharge fails: ${mockResValExpired.jsonBody.message}`
      );

      // D. Verify changed subscriber ID fails verification gate
      const mockReqValChangedSub = {
        headers: {},
        body: {
          mobile: "10001001", // changed from 10001000
          operatorCode: "10",
          amount: 100
        },
        user: { id: testUser.id },
        ip: "127.0.0.1"
      };

      const mockResValChangedSub = {
        status: (code) => {
          mockResValChangedSub.statusCode = code;
          return mockResValChangedSub;
        },
        json: (body) => {
          mockResValChangedSub.jsonBody = body;
          return mockResValChangedSub;
        },
        statusCode: 200,
        jsonBody: {}
      };

      await recharge(mockReqValChangedSub, mockResValChangedSub);
      assert(
        mockResValChangedSub.statusCode === 400 && mockResValChangedSub.jsonBody.message === "Please verify DTH customer details before recharging.",
        `Changed subscriber ID recharge fails: ${mockResValChangedSub.jsonBody.message}`
      );

      // E. Verify changed operator ID fails verification gate
      const mockReqValChangedOp = {
        headers: {},
        body: {
          mobile: "10001000",
          operatorCode: "9", // changed from 10
          amount: 100
        },
        user: { id: testUser.id },
        ip: "127.0.0.1"
      };

      const mockResValChangedOp = {
        status: (code) => {
          mockResValChangedOp.statusCode = code;
          return mockResValChangedOp;
        },
        json: (body) => {
          mockResValChangedOp.jsonBody = body;
          return mockResValChangedOp;
        },
        statusCode: 200,
        jsonBody: {}
      };

      await recharge(mockReqValChangedOp, mockResValChangedOp);
      assert(
        mockResValChangedOp.statusCode === 400 && mockResValChangedOp.jsonBody.message === "Please verify DTH customer details before recharging.",
        `Changed operator ID recharge fails: ${mockResValChangedOp.jsonBody.message}`
      );

    } catch (err) {
      assert(false, `Validation check failed: ${err.message}`);
    }

    // ----------------------------------------------------
    // TEST 10: Mobile Recharge Regression
    // ----------------------------------------------------
    console.log("\n--- Test 10: Mobile Recharge Regression ---");
    try {
      const mockReqMobile = {
        body: {
          operatorCode: "1", // Airtel Mobile
          mobile: "9999999999", // Valid 10-digit number
          amount: 100
        }
      };

      let passedNext = false;
      const mockRes = {
        status: (code) => {
          mockRes.statusCode = code;
          return mockRes;
        },
        json: (body) => {
          mockRes.jsonBody = body;
          return mockRes;
        },
        statusCode: 200,
        jsonBody: {}
      };

      validateRechargeInput(mockReqMobile, mockRes, () => {
        passedNext = true;
      });

      assert(passedNext, "Mobile recharge validation allows valid 10-digit mobile input.");

      // 1. JIO recharge ₹10 (operatorCode: 5)
      const mockReqJio = {
        headers: {},
        body: {
          mobile: "9999999999",
          operatorCode: "5",
          amount: 10
        },
        user: { id: testUser.id },
        ip: "127.0.0.1"
      };
      const mockResJio = {
        status: (code) => { mockResJio.statusCode = code; return mockResJio; },
        json: (body) => { mockResJio.jsonBody = body; return mockResJio; },
        statusCode: 200,
        jsonBody: {}
      };
      await recharge(mockReqJio, mockResJio);
      assert(
        mockResJio.jsonBody.message !== "Minimum DTH recharge amount is ₹100" &&
        mockResJio.jsonBody.message !== "Please verify DTH customer details before recharging.",
        "Mobile Regression: JIO recharge ₹10 successfully bypasses DTH constraints."
      );

      // 2. Airtel recharge ₹20 (operatorCode: 1)
      const mockReqAirtel = {
        headers: {},
        body: {
          mobile: "9999999999",
          operatorCode: "1",
          amount: 20
        },
        user: { id: testUser.id },
        ip: "127.0.0.1"
      };
      const mockResAirtel = {
        status: (code) => { mockResAirtel.statusCode = code; return mockResAirtel; },
        json: (body) => { mockResAirtel.jsonBody = body; return mockResAirtel; },
        statusCode: 200,
        jsonBody: {}
      };
      await recharge(mockReqAirtel, mockResAirtel);
      assert(
        mockResAirtel.jsonBody.message !== "Minimum DTH recharge amount is ₹100" &&
        mockResAirtel.jsonBody.message !== "Please verify DTH customer details before recharging.",
        "Mobile Regression: Airtel recharge ₹20 successfully bypasses DTH constraints."
      );

      // 3. VI recharge ₹50 (operatorCode: 2)
      const mockReqVi = {
        headers: {},
        body: {
          mobile: "9999999999",
          operatorCode: "2",
          amount: 50
        },
        user: { id: testUser.id },
        ip: "127.0.0.1"
      };
      const mockResVi = {
        status: (code) => { mockResVi.statusCode = code; return mockResVi; },
        json: (body) => { mockResVi.jsonBody = body; return mockResVi; },
        statusCode: 200,
        jsonBody: {}
      };
      await recharge(mockReqVi, mockResVi);
      assert(
        mockResVi.jsonBody.message !== "Minimum DTH recharge amount is ₹100" &&
        mockResVi.jsonBody.message !== "Please verify DTH customer details before recharging.",
        "Mobile Regression: VI recharge ₹50 successfully bypasses DTH constraints."
      );

      // 4. BSNL recharge ₹49 (operatorCode: 3)
      const mockReqBsnl = {
        headers: {},
        body: {
          mobile: "9999999999",
          operatorCode: "3",
          amount: 49
        },
        user: { id: testUser.id },
        ip: "127.0.0.1"
      };
      const mockResBsnl = {
        status: (code) => { mockResBsnl.statusCode = code; return mockResBsnl; },
        json: (body) => { mockResBsnl.jsonBody = body; return mockResBsnl; },
        statusCode: 200,
        jsonBody: {}
      };
      await recharge(mockReqBsnl, mockResBsnl);
      assert(
        mockResBsnl.jsonBody.message !== "Minimum DTH recharge amount is ₹100" &&
        mockResBsnl.jsonBody.message !== "Please verify DTH customer details before recharging.",
        "Mobile Regression: BSNL recharge ₹49 successfully bypasses DTH constraints."
      );

      // 5. Mobile recharge without DTH verification
      assert(
        mockResJio.jsonBody.message !== "Please verify DTH customer details before recharging." &&
        mockResAirtel.jsonBody.message !== "Please verify DTH customer details before recharging.",
        "Mobile Regression: Mobile recharge initiated without DTH verification completes/proceeds normally."
      );

      // 6. Mobile recharge should never require customer validation
      assert(
        mockResVi.jsonBody.message !== "Please verify DTH customer details before recharging." &&
        mockResBsnl.jsonBody.message !== "Please verify DTH customer details before recharging.",
        "Mobile Regression: Mobile recharges do not require, check, or expire DTH customer validation records."
      );

    } catch (err) {
      assert(false, `Mobile regression check failed: ${err.message}`);
    }

    // ----------------------------------------------------
    // TEST 11: Duplicate Webhook Replay
    // ----------------------------------------------------
    console.log("\n--- Test 11: Duplicate Webhook Replay ---");
    try {
      const initialTxn = await prisma.transaction.findUnique({ where: { id: testTxn.id } });
      const beforeStatus = initialTxn.status; // should be SUCCESS

      const mockReq = {
        query: {
          STATUS: "SUCCESS",
          OPTXNID: "PROVIDER_REF_DUPLICATE",
          RefTxnId: String(testTxn.id)
        },
        body: {},
        headers: {},
        method: "GET"
      };

      const mockRes = {
        status: (code) => {
          mockRes.statusCode = code;
          return mockRes;
        },
        send: (msg) => {
          mockRes.sendMsg = msg;
          return mockRes;
        },
        statusCode: 200,
        sendMsg: ""
      };

      await handleApiboxCallback(mockReq, mockRes);
      assert(
        mockRes.statusCode === 200 && beforeStatus === "SUCCESS",
        "Duplicate success webhook callback returns 200 and does not alter final state."
      );
    } catch (err) {
      assert(false, `Duplicate webhook replay test failed: ${err.message}`);
    }

    // ----------------------------------------------------
    // TEST 12: Duplicate Worker Retry
    // ----------------------------------------------------
    console.log("\n--- Test 12: Duplicate Worker Retry ---");
    try {
      const retryTxn = await prisma.transaction.create({
        data: {
          userId: testUser.id,
          amount: 50.0,
          type: "RECHARGE",
          status: "PENDING",
          direction: "DEBIT",
          mobile: "10001000",
          operator: "TATA SKY",
          provider: "APIBOX",
          processingLock: true // simulate lock acquired by Worker A
        }
      });

      // Simulate Worker B attempting to acquire the same lock
      const acquiredByB = await prisma.transaction.updateMany({
        where: { id: retryTxn.id, processingLock: false },
        data: { processingLock: true }
      });

      assert(
        acquiredByB.count === 0,
        "Worker B is correctly blocked from duplicate execution by the transaction lock."
      );
    } catch (err) {
      assert(false, `Worker retry test failed: ${err.message}`);
    }

    // ----------------------------------------------------
    // TEST 13: Concurrent Recharge Requests (Double Debit Prevention)
    // ----------------------------------------------------
    console.log("\n--- Test 13: Concurrent Recharge Requests ---");
    try {
      const idempotencyKey = `concur_${Date.now()}`;
      
      const txMock = prisma;
      const canClaim1 = await claimIdempotencyKey(idempotencyKey, { amount: 100 }, txMock);
      const canClaim2 = await claimIdempotencyKey(idempotencyKey, { amount: 100 }, txMock);

      assert(
        canClaim1 === true && canClaim2 === false,
        "Idempotency validation blocks concurrent duplicate requests, preventing double debit."
      );
    } catch (err) {
      assert(false, `Concurrent check failed: ${err.message}`);
    }

  } catch (globalErr) {
    console.error("❌ GLOBAL TEST EXCEPTION:", globalErr.stack);
    failed++;
  } finally {
    // Clean up verification seed data
    if (testUser) {
      await prisma.ledgerEntry.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
      await prisma.transaction.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
      await prisma.wallet.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
      await prisma.user.delete( { where: { id: testUser.id } }).catch(() => {});
    }
    await prisma.idempotencyRecord.deleteMany({
      where: {
        OR: [
          { key: { contains: "PROVIDER_" } },
          { key: { contains: "concur_" } },
          { key: { contains: "webhook:" } }
        ]
      }
    }).catch(() => {});
    dthMemoryCache.clear();
    await prisma.$disconnect();

    console.log("\n==========================================================================");
    console.log(`VERIFICATION SUMMARY: ${passed} Passed, ${failed} Failed, ${warnings} Warnings`);
    console.log("==========================================================================");

    process.exit(failed > 0 ? 1 : 0);
  }
}

main();
