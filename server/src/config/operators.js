/**
 * LIVE APIBOX OPERATOR LIST
 * Use ONLY these exact mappings from the live panel
 */
export const APIBOX_OPERATORS = {
  "1": "AIRTEL",
  "2": "VI",
  "3": "BSNL Topup",
  "4": "BSNL Special",
  "5": "JIO",
  "6": "VIDEOCON D2H",
  "7": "AIRTEL DTH",
  "8": "DISH TV",
  "9": "SUN DIRECT",
  "10": "TATA SKY",
  "400": "Jio Pos Lite"
};

/**
 * Normalizes operator input to name
 */
export const normalizeOperator = (input) => {
  if (!input) return null;
  const strInput = String(input).trim().toUpperCase();
  
  // 1. If input is a code matching key (e.g. "5"), return the mapped name (e.g. "JIO")
  if (APIBOX_OPERATORS[strInput]) {
    return APIBOX_OPERATORS[strInput];
  }
  
  // 2. If input is already a valid operator name value, return it
  const match = Object.values(APIBOX_OPERATORS).find(
    (val) => val.toUpperCase() === strInput
  );
  if (match) return match;
  
  return null;
};

/**
 * Maps normalized operator name or code to provider code
 */
export const getProviderOperatorCode = (input) => {
  if (!input) return null;
  const strInput = String(input).trim().toUpperCase();
  
  // 1. If it's already a valid key/code, return it
  if (APIBOX_OPERATORS[strInput]) {
    return strInput;
  }
  
  // 2. Otherwise find the key matching the operator name
  const entry = Object.entries(APIBOX_OPERATORS).find(
    ([key, val]) => val.toUpperCase() === strInput
  );
  return entry ? entry[0] : null;
};
