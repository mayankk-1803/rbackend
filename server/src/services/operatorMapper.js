/**
 * Production Operator Mapping Utility
 * Maps standard operator names and aliases to provider operator codes.
 * 
 * Mappings:
 * Vi → 1
 * Airtel → 2
 * MTNL → 3
 * BSNL → 4
 * Jio → 5
 */

const OPERATOR_MAP = {
  "1": { name: "Vi", code: 1, aliases: ["vi", "vodafone", "idea", "vodafone idea", "vi prepaid", "vi postpaid"] },
  "2": { name: "Airtel", code: 2, aliases: ["airtel", "bharti airtel", "airtel prepaid", "airtel postpaid"] },
  "3": { name: "MTNL", code: 3, aliases: ["mtnl", "mahanagar telephone nigam", "mtnl delhi", "mtnl mumbai"] },
  "4": { name: "BSNL", code: 4, aliases: ["bsnl", "bharat sanchar nigam", "bsnl topup", "bsnl special", "bsnl valid", "bsnl prepaid", "bsnl postpaid"] },
  "5": { name: "Jio", code: 5, aliases: ["jio", "reliance jio", "jio prepaid", "jio postpaid", "jio pos lite"] }
};

/**
 * Normalizes any operator input string or code to the standard operator object.
 * Supports case-insensitive matching and alias lookup.
 * 
 * @param {string|number} input - The operator name, alias, or code.
 * @returns {object|null} - { name, code } or null if unknown.
 */
export const normalizeOperator = (input) => {
  if (input === null || input === undefined) return null;
  const strInput = String(input).trim().toLowerCase();

  // Check direct code match first
  if (OPERATOR_MAP[strInput]) {
    const op = OPERATOR_MAP[strInput];
    return { name: op.name, code: op.code };
  }

  // Check aliases
  for (const key in OPERATOR_MAP) {
    const op = OPERATOR_MAP[key];
    if (op.aliases.includes(strInput) || strInput.includes(op.name.toLowerCase())) {
      return { name: op.name, code: op.code };
    }
  }

  return null;
};

/**
 * Reverse lookup to get operator name from provider code.
 * 
 * @param {number|string} code - The operator code.
 * @returns {string} - Operator name or "Unknown".
 */
export const getOperatorName = (code) => {
  const normalized = normalizeOperator(code);
  return normalized ? normalized.name : "Unknown";
};

/**
 * Get operator code from name or alias.
 * 
 * @param {string} name - Operator name or alias.
 * @returns {number|null} - Operator code or null.
 */
export const getOperatorCode = (name) => {
  const normalized = normalizeOperator(name);
  return normalized ? normalized.code : null;
};
