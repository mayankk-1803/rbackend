/**
 * APIBOX Postpaid Operator Codes
 */
const POSTPAID_MAP = {
  "AIRTEL": "1",
  "VI": "2",
  "JIO": "5",
  "BSNL": "4"
};

/**
 * Maps frontend operator name to APIBOX operator code
 */
export const mapOperator = (name) => {
  const normalized = name.toUpperCase().trim();
  return POSTPAID_MAP[normalized] || name; // Fallback to name if no mapping found
};
