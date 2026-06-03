import express from "express";
import app from "../src/app.js";

// We will find the middleware in app._router.stack and run a test simulation on it
const middleware = app._router.stack.find(layer => {
  return layer.handle && layer.handle.toString().includes("cleanClientMessage");
})?.handle;

if (!middleware) {
  console.error("Could not find the JSON sanitization middleware in Express app stack!");
  process.exit(1);
}

console.log("=== SIMULATING MIDDLEWARE FOR NON-COMMISSION API PATH ===");
const mockReqNonComm = {
  path: "/api/payment/charge"
};
const mockResNonComm = {
  json: (body) => {
    console.log("Output for non-commission API path:", JSON.stringify(body, null, 2));
  }
};
const mockNextNonComm = () => {};

// Simulate middleware execution
middleware(mockReqNonComm, mockResNonComm, mockNextNonComm);

// Trigger res.json to see if message gets sanitized
mockResNonComm.json({
  success: false,
  message: "Access Denied: Sub-Admins have read-only access to Commission settings."
});


console.log("\n=== SIMULATING MIDDLEWARE FOR COMMISSION API PATH ===");
const mockReqComm = {
  path: "/api/admin/commission/slabs/1/assign-users"
};
const mockResComm = {
  json: (body) => {
    console.log("Output for commission API path:", JSON.stringify(body, null, 2));
  }
};
const mockNextComm = () => {};

// Simulate middleware execution
middleware(mockReqComm, mockResComm, mockNextComm);

// Trigger res.json to see if message is left intact
mockResComm.json({
  success: false,
  message: "Access Denied: Sub-Admins have read-only access to Commission settings."
});

process.exit(0);
