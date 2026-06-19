/**
 * Reference ID obfuscation helper for transaction IDs.
 * Serializes integer IDs to 'IRE-TXN-XXXXXXXX' using Base36 encoding.
 * Deserializes them back to integers, supporting legacy integer IDs.
 */

/**
 * Encodes a database integer ID into a public reference string.
 * @param {number|string} id - The database transaction ID.
 * @returns {string|null} The formatted reference ID or null.
 */
export const encodeTxnId = (id) => {
  if (id === undefined || id === null) return null;
  const numId = Number(id);
  if (isNaN(numId) || !Number.isInteger(numId) || numId < 0) {
    return null;
  }
  return `IRE-TXN-${numId.toString(36).toUpperCase().padStart(8, '0')}`;
};

/**
 * Decodes a public reference string back to a database integer ID.
 * @param {string|number} publicRef - The public reference ID or raw integer ID.
 * @returns {number} The decoded transaction ID (or NaN if invalid).
 */
export const decodeTxnId = (publicRef) => {
  if (publicRef === undefined || publicRef === null) return NaN;
  const strVal = String(publicRef).trim();
  
  if (strVal.startsWith("IRE-TXN-")) {
    const code = strVal.replace("IRE-TXN-", "");
    const parsed = parseInt(code, 36);
    return isNaN(parsed) ? NaN : parsed;
  }
  
  // Fallback for legacy raw numeric transaction IDs
  const parsed = parseInt(strVal, 10);
  return isNaN(parsed) ? NaN : parsed;
};
