/**
 * Production Circle Mapping Utility
 * Maps standard Indian telecom circles and aliases to provider circle codes.
 * 
 * Mappings:
 * Andhra Pradesh → 2
 * Assam → 3
 * Bihar Jharkhand → 4
 * Delhi NCR → 5
 * Gujarat → 6
 * Himachal Pradesh → 7
 * Haryana → 8
 * Jammu Kashmir → 9
 * Kerala → 10
 * Karnataka → 11
 * Kolkata → 12
 * Maharashtra → 13
 * Madhya Pradesh Chhattisgarh → 14
 * Mumbai → 15
 * North East → 16
 * Orissa → 17
 * Punjab → 18
 * Rajasthan → 19
 * Tamil Nadu → 20
 * UP East → 21
 * UP West → 22
 * West Bengal → 23
 * Chennai → 25
 */

const CIRCLE_MAP = {
  "2": { name: "Andhra Pradesh", code: 2, aliases: ["andhra pradesh", "ap", "andhra", "telangana", "andhra pradesh telangana"] },
  "3": { name: "Assam", code: 3, aliases: ["assam", "as"] },
  "4": { name: "Bihar Jharkhand", code: 4, aliases: ["bihar jharkhand", "bihar", "jharkhand", "br"] },
  "5": { name: "Delhi NCR", code: 5, aliases: ["delhi ncr", "delhi", "dl", "ncr"] },
  "6": { name: "Gujarat", code: 6, aliases: ["gujarat", "gj", "gujrat"] },
  "7": { name: "Himachal Pradesh", code: 7, aliases: ["himachal pradesh", "hp", "himachal"] },
  "8": { name: "Haryana", code: 8, aliases: ["haryana", "hr"] },
  "9": { name: "Jammu Kashmir", code: 9, aliases: ["jammu kashmir", "jk", "jammu & kashmir", "jammu and kashmir", "j&k"] },
  "10": { name: "Kerala", code: 10, aliases: ["kerala", "kl", "keral"] },
  "11": { name: "Karnataka", code: 11, aliases: ["karnataka", "ka", "karnatak"] },
  "12": { name: "Kolkata", code: 12, aliases: ["kolkata", "ko", "calcutta"] },
  "13": { name: "Maharashtra", code: 13, aliases: ["maharashtra", "mh", "maharashtra & goa", "maharashtra and goa"] },
  "14": { name: "Madhya Pradesh Chhattisgarh", code: 14, aliases: ["madhya pradesh chhattisgarh", "madhya pradesh", "chhattisgarh", "mp", "cg", "mp & cg"] },
  "15": { name: "Mumbai", code: 15, aliases: ["mumbai", "mu", "bombay"] },
  "16": { name: "North East", code: 16, aliases: ["north east", "ne", "northeast"] },
  "17": { name: "Orissa", code: 17, aliases: ["orissa", "or", "odisha"] },
  "18": { name: "Punjab", code: 18, aliases: ["punjab", "pb", "punjab & chandigarh"] },
  "19": { name: "Rajasthan", code: 19, aliases: ["rajasthan", "rj", "rajastan"] },
  "20": { name: "Tamil Nadu", code: 20, aliases: ["tamil nadu", "tn", "tamilnadu"] },
  "21": { name: "UP East", code: 21, aliases: ["up east", "upe", "uttar pradesh east"] },
  "22": { name: "UP West", code: 22, aliases: ["up west", "upw", "uttar pradesh west", "up west & uttarakhand"] },
  "23": { name: "West Bengal", code: 23, aliases: ["west bengal", "wb", "bengal"] },
  "25": { name: "Chennai", code: 25, aliases: ["chennai", "ch"] }
};

/**
 * Normalizes any circle input string or code to the standard circle object.
 * Supports case-insensitive matching and alias lookup.
 * 
 * @param {string|number} input - The circle name, alias, or code.
 * @returns {object} - { name, code } or fallback to Delhi NCR if unknown.
 */
export const normalizeCircle = (input) => {
  const defaultCircle = { name: "Delhi NCR", code: 5 };
  if (input === null || input === undefined) return defaultCircle;
  const strInput = String(input).trim().toLowerCase();

  // Check direct code match first
  if (CIRCLE_MAP[strInput]) {
    const c = CIRCLE_MAP[strInput];
    return { name: c.name, code: c.code };
  }

  // Check aliases
  for (const key in CIRCLE_MAP) {
    const c = CIRCLE_MAP[key];
    if (c.aliases.includes(strInput) || strInput.includes(c.name.toLowerCase())) {
      return { name: c.name, code: c.code };
    }
  }

  return defaultCircle;
};

/**
 * Reverse lookup to get circle name from provider code.
 * 
 * @param {number|string} code - The circle code.
 * @returns {string} - Circle name.
 */
export const getCircleName = (code) => {
  const normalized = normalizeCircle(code);
  return normalized.name;
};

/**
 * Get circle code from name or alias.
 * 
 * @param {string} name - Circle name or alias.
 * @returns {number} - Circle code.
 */
export const getCircleCode = (name) => {
  const normalized = normalizeCircle(name);
  return normalized.code;
};
