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
export const normalizeOperator = (opCode) => {
  return APIBOX_OPERATORS[String(opCode)] || null;
};

/**
 * Legacy compatibility (if needed)
 */
export const getProviderOperatorCode = (opCode) => {
  return APIBOX_OPERATORS[String(opCode)] ? String(opCode) : null;
};
