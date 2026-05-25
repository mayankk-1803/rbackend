import { normalizeResponse } from "./mapper.js";
import { apiboxRequest } from "./client.js";
import prisma from "../../../config/prisma.js";
import { getBalance } from "./balance.js";

const APIBOX_CALLBACK_URL = "https://irecharge.in/api/webhook/apibox";

/**
 * Executes recharge via Apibox API
 */
export const executeRecharge = async (payload) => {
  const { mobile, amount, operator, txnId } = payload;

  // 1. Fetch provider details & balance before recharge
  let providerId = "N/A";
  let balanceBefore = 0;
  let balanceP2ABefore = 0;
  try {
    const providerRecord = await prisma.provider.findUnique({ where: { code: "APIBOX" } });
    if (providerRecord) {
      providerId = providerRecord.id;
    }
  } catch (dbErr) {
    console.error("[APIBOX P2A DEBUG] Failed to fetch provider details:", dbErr.message);
  }

  try {
    const balBeforeRes = await getBalance(false);
    if (balBeforeRes && balBeforeRes.success) {
      balanceBefore = balBeforeRes.balance;
    }
  } catch (balErr) {
    console.error("[APIBOX P2A DEBUG] Failed to fetch buyer balance before:", balErr.message);
  }

  try {
    const balP2ABeforeRes = await getBalance(true);
    if (balP2ABeforeRes && balP2ABeforeRes.success) {
      balanceP2ABefore = balP2ABeforeRes.balance;
    }
  } catch (balErr) {
    console.error("[APIBOX P2A DEBUG] Failed to fetch buyer P2A balance before:", balErr.message);
  }

  try {
    const params = {
      MobileNo: mobile,
      Amount: amount,
      OpId: operator,
      RefTxnId: txnId.toString(),
      P2A: "true"
    };

    console.log(`[APIBOX RECHARGE] Txn: ${txnId} | Mobile: ${mobile}`);
    console.log("[APIBOX_REQUEST]\nEndpoint: /Recharge2");
    console.log("[APIBOX_REQUEST]", {
      providerUrl: "/Recharge2",
      payload: params,
      callbackUrl: APIBOX_CALLBACK_URL,
      txnId,
      operator
    });
    console.log("[APIBOX_PANEL_REQUIREMENTS] Verify APIBOX panel has callback delivery enabled for this API key/operator, callback URL registered as https://irecharge.in/api/webhook/apibox, and production IP whitelist/proxy rules allow callbacks.");

    const responseData = await apiboxRequest("/Recharge2", params, false);
    console.log("[APIBOX_RESPONSE]", {
      statusCode: responseData?.__httpStatus || "logged_by_client",
      providerResponse: responseData,
      providerTxnId: responseData?.OPTXNID || responseData?.OPTxnId || responseData?.OPtxnId || responseData?.TXNID || null
    });

    // Fetch balance after recharge
    let balanceAfter = 0;
    let balanceP2AAfter = 0;
    try {
      const balAfterRes = await getBalance(false);
      if (balAfterRes && balAfterRes.success) {
        balanceAfter = balAfterRes.balance;
      }
    } catch (balErr) {
      console.error("[APIBOX P2A DEBUG] Failed to fetch buyer balance after:", balErr.message);
    }

    try {
      const balP2AAfterRes = await getBalance(true);
      if (balP2AAfterRes && balP2AAfterRes.success) {
        balanceP2AAfter = balP2AAfterRes.balance;
      }
    } catch (balErr) {
      console.error("[APIBOX P2A DEBUG] Failed to fetch buyer P2A balance after:", balErr.message);
    }

    // Automatic Wallet Detection Logic
    let detectedWalletUsed = "Undetected / No Change";
    const buyerDecreased = balanceBefore - balanceAfter > 0.01;
    const p2aDecreased = balanceP2ABefore - balanceP2AAfter > 0.01;

    if (buyerDecreased && p2aDecreased) {
      detectedWalletUsed = "Hybrid deduction detected";
    } else if (p2aDecreased) {
      detectedWalletUsed = "P2A Wallet";
    } else if (buyerDecreased) {
      detectedWalletUsed = "normal Buyer Wallet";
    }

    const p2aEnabled = params.P2A === "true";
    const walletRoutingMode = p2aEnabled ? "P2A" : "DEFAULT";

    // Output formatted operational logs without API URLs, tokens, or provider payloads.
    console.log(`
========== APIBOX P2A DEBUG ==========
Provider: APIBOX
Provider ID: ${providerId}
P2A Enabled: ${p2aEnabled}
Wallet Routing Mode: ${walletRoutingMode}
Buyer Wallet Before: ${balanceBefore}
Buyer Wallet After: ${balanceAfter}
Buyer P2A Wallet Before: ${balanceP2ABefore}
Buyer P2A Wallet After: ${balanceP2AAfter}
Recharge Amount: ${amount}
Detected Wallet Used: ${detectedWalletUsed}
======================================
    `);

    // Automatic detection statement logging
    if (detectedWalletUsed === "normal Buyer Wallet") {
      console.log("[P2A DETECTION] Recharge used NORMAL Buyer Wallet");
    } else if (detectedWalletUsed === "P2A Wallet") {
      console.log("[P2A DETECTION] Recharge used P2A Wallet");
    } else if (detectedWalletUsed === "Hybrid deduction detected") {
      console.log("[P2A DETECTION] Hybrid deduction detected");
    } else {
      console.log("[P2A DETECTION] No wallet deduction detected or transaction failed");
    }

    return normalizeResponse(responseData);

  } catch (error) {
    console.error(`[APIBOX RECHARGE ERROR] Txn ${txnId}:`, error.message);
    
    // Check if it's a network/timeout error - mark as PENDING to be safe
    const isNetworkError = !error.status || error.code === 'ECONNABORTED' || error.status >= 500;
    
    return {
      success: isNetworkError,
      status: isNetworkError ? "PENDING" : "FAILED",
      message: error.message || "Apibox connection failed",
      raw: error.raw || null
    };
  }
};
