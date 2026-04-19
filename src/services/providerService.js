export const primaryRecharge = async ({ mobile }) => {
  console.log("Calling PRIMARY provider API...");

  // FAIL CASES
  if (mobile === "8888888888" || mobile === "7777777777") {
    throw new Error("Primary API failed");
  }

  return {
    provider: "PRIMARY",
    providerTxnId: "P_" + Date.now()
  };
};

export const backupRecharge = async ({ mobile }) => {
  console.log("Calling BACKUP provider API...");

  // FULL FAIL CASE
  if (mobile === "7777777777") {
    throw new Error("Backup API failed");
  }

  return {
    provider: "BACKUP",
    providerTxnId: "B_" + Date.now()
  };
};