/**
 * Centralized EzyTM to MPlan Compatibility Mapping & Normalization Layer
 */

/**
 * Aggressively normalizes any string value to ensure consistent mapping matching.
 * Removes leading/trailing spaces, converts to uppercase, replaces hyphens/ampersands/words with spaces,
 * and collapses multiple whitespace characters.
 */
export const normalizeMappingKey = (value) => {
  if (!value) return "";
  return String(value)
    .trim()
    .toUpperCase()
    .replace(/[-&]/g, ' ')
    .replace(/\s+/g, ' ');
};

export const EZYTM_TO_MPLAN_OPERATOR = {
  "AIRTEL": "2",
  "BHARTI AIRTEL": "2",
  "JIO": "5",
  "RELIANCE JIO": "5",
  "VI": "1",
  "VODAFONE": "1",
  "IDEA": "1",
  "VODAFONE IDEA": "1",
  "BSNL": "4",
  "BHARAT SANCHAR NIGAM": "4",
  "BSNL TOPUP": "4",
  "BSNL SPECIAL": "4",
  "MTNL": "3",
  "MAHANAGAR TELEPHONE NIGAM": "3"
};

export const EZYTM_TO_MPLAN_CIRCLE = {
  "ANDHRA PRADESH": "2",
  "AP": "2",
  "ANDHRA": "2",
  "TELANGANA": "2",
  "ANDHRA PRADESH TELANGANA": "2",
  "ASSAM": "3",
  "AS": "3",
  "BIHAR JHARKHAND": "4",
  "BIHAR": "4",
  "JHARKHAND": "4",
  "BR": "4",
  "DELHI NCR": "5",
  "DELHI": "5",
  "DL": "5",
  "NCR": "5",
  "GUJARAT": "6",
  "GJ": "6",
  "GUJRAT": "6",
  "HIMACHAL PRADESH": "7",
  "HP": "7",
  "HIMACHAL": "7",
  "HARYANA": "8",
  "HR": "8",
  "JAMMU KASHMIR": "9",
  "JK": "9",
  "JAMMU AND KASHMIR": "9",
  "J K": "9",
  "KERALA": "10",
  "KL": "10",
  "KERAL": "10",
  "KARNATAKA": "11",
  "KA": "11",
  "KARNATAK": "11",
  "KOLKATA": "12",
  "KO": "12",
  "CALCUTTA": "12",
  "MAHARASHTRA": "13",
  "MH": "13",
  "MAHARASHTRA GOA": "13",
  "MAHARASHTRA AND GOA": "13",
  "MADHYA PRADESH CHHATTISGARH": "14",
  "MADHYA PRADESH": "14",
  "CHHATTISGARH": "14",
  "MP": "14",
  "CG": "14",
  "MP CG": "14",
  "MUMBAI": "15",
  "MU": "15",
  "BOMBAY": "15",
  "NORTH EAST": "16",
  "NE": "16",
  "NORTHEAST": "16",
  "ORISSA": "17",
  "OR": "17",
  "ODISHA": "17",
  "PUNJAB": "18",
  "PB": "18",
  "PUNJAB CHANDIGARH": "18",
  "RAJASTHAN": "19",
  "RJ": "19",
  "RAJASTAN": "19",
  "TAMIL NADU": "20",
  "TN": "20",
  "TAMILNADU": "20",
  "UP EAST": "21",
  "UPE": "21",
  "UTTAR PRADESH EAST": "21",
  "UP WEST": "22",
  "UPW": "22",
  "UTTAR PRADESH WEST": "22",
  "UP WEST UTTARAKHAND": "22",
  "UP WEST AND UTTARANCHAL": "22",
  "UP WEST AND UTTARAKHAND": "22",
  "WEST BENGAL": "23",
  "WB": "23",
  "BENGAL": "23",
  "CHENNAI": "25",
  "CH": "25"
};

export const EZYTM_TO_CLEAN_OPERATOR_NAME = {
  "AIRTEL": "Airtel",
  "BHARTI AIRTEL": "Airtel",
  "JIO": "Jio",
  "RELIANCE JIO": "Jio",
  "VI": "Vi",
  "VODAFONE": "Vi",
  "IDEA": "Vi",
  "VODAFONE IDEA": "Vi",
  "BSNL": "Bsnl",
  "BHARAT SANCHAR NIGAM": "Bsnl",
  "BSNL TOPUP": "Bsnl",
  "BSNL SPECIAL": "Bsnl",
  "MTNL": "Mtnl",
  "MAHANAGAR TELEPHONE IGNAM": "Mtnl"
};

export const EZYTM_TO_CLEAN_CIRCLE_NAME = {
  "ANDHRA PRADESH": "Andhra Pradesh",
  "AP": "Andhra Pradesh",
  "ANDHRA": "Andhra Pradesh",
  "TELANGANA": "Andhra Pradesh",
  "ANDHRA PRADESH TELANGANA": "Andhra Pradesh",
  "ASSAM": "Assam",
  "AS": "Assam",
  "BIHAR JHARKHAND": "Bihar & Jharkhand",
  "BIHAR": "Bihar & Jharkhand",
  "JHARKHAND": "Bihar & Jharkhand",
  "BR": "Bihar & Jharkhand",
  "DELHI NCR": "Delhi",
  "DELHI": "Delhi",
  "DL": "Delhi",
  "NCR": "Delhi",
  "GUJARAT": "Gujarat",
  "GJ": "Gujarat",
  "GUJRAT": "Gujarat",
  "HIMACHAL PRADESH": "Himachal Pradesh",
  "HP": "Himachal Pradesh",
  "HIMACHAL": "Himachal Pradesh",
  "HARYANA": "Haryana",
  "HR": "Haryana",
  "JAMMU KASHMIR": "Jammu & Kashmir",
  "JK": "Jammu & Kashmir",
  "JAMMU AND KASHMIR": "Jammu & Kashmir",
  "J K": "Jammu & Kashmir",
  "KERALA": "Kerala",
  "KL": "Kerala",
  "KERAL": "Kerala",
  "KARNATAKA": "Karnataka",
  "KA": "Karnataka",
  "KARNATAK": "Karnataka",
  "KOLKATA": "Kolkata",
  "KO": "Kolkata",
  "CALCUTTA": "Kolkata",
  "MAHARASHTRA": "Maharashtra",
  "MH": "Maharashtra",
  "MAHARASHTRA GOA": "Maharashtra",
  "MAHARASHTRA AND GOA": "Maharashtra",
  "MADHYA PRADESH CHHATTISGARH": "Madhya Pradesh",
  "MADHYA PRADESH": "Madhya Pradesh",
  "CHHATTISGARH": "Madhya Pradesh",
  "MP": "Madhya Pradesh",
  "CG": "Madhya Pradesh",
  "MP CG": "Madhya Pradesh",
  "MUMBAI": "Mumbai",
  "MU": "Mumbai",
  "BOMBAY": "Mumbai",
  "NORTH EAST": "North East",
  "NE": "North East",
  "NORTHEAST": "North East",
  "ORISSA": "Orissa",
  "OR": "Orissa",
  "ODISHA": "Orissa",
  "PUNJAB": "Punjab",
  "PB": "Punjab",
  "PUNJAB CHANDIGARH": "Punjab",
  "RAJASTHAN": "Rajasthan",
  "RJ": "Rajasthan",
  "RAJASTAN": "Rajasthan",
  "TAMIL NADU": "Tamil Nadu",
  "TN": "Tamil Nadu",
  "TAMILNADU": "Tamil Nadu",
  "UP EAST": "UP East",
  "UPE": "UP East",
  "UTTAR PRADESH EAST": "UP East",
  "UP WEST": "UP West",
  "UPW": "UP West",
  "UTTAR PRADESH WEST": "UP West",
  "UP WEST UTTARAKHAND": "UP West",
  "UP WEST AND UTTARANCHAL": "UP West",
  "UP WEST AND UTTARAKHAND": "UP West",
  "WEST BENGAL": "West Bengal",
  "WB": "West Bengal",
  "BENGAL": "West Bengal",
  "CHENNAI": "Chennai",
  "CH": "Chennai"
};

/**
 * Normalizes operator and circle inputs from EzyTM and returns clean names and code mapping
 */
export const normalizeEzytmResponse = (operatorName, circleName) => {
  const normOp = normalizeMappingKey(operatorName);
  const normCircle = normalizeMappingKey(circleName);

  const cleanOperator = EZYTM_TO_CLEAN_OPERATOR_NAME[normOp] || "Jio";
  const cleanCircle = EZYTM_TO_CLEAN_CIRCLE_NAME[normCircle] || "Delhi NCR";

  const operatorCode = Number(EZYTM_TO_MPLAN_OPERATOR[normOp] || "5");
  const circleCode = Number(EZYTM_TO_MPLAN_CIRCLE[normCircle] || "5");

  return {
    operator: cleanOperator,
    operatorCode,
    circle: cleanCircle,
    circleCode
  };
};

/**
 * Maps and validates EzyTM operator and circle names to MPlan codes.
 * Implements strict unknown fallback protection.
 * 
 * @param {string} operatorName 
 * @param {string} circleName 
 * @returns {object} { success: true, operatorCode, circleCode } or { success: false, message }
 */
export const mapEzytmToMplan = (operatorName, circleName) => {
  const normOp = normalizeMappingKey(operatorName);
  const normCircle = normalizeMappingKey(circleName);

  const operatorCode = EZYTM_TO_MPLAN_OPERATOR[normOp];
  const circleCode = EZYTM_TO_MPLAN_CIRCLE[normCircle];

  if (!operatorCode || !circleCode) {
    console.error(`[MAPPING ERROR] Unknown operator/circle mapping | Raw Op: "${operatorName}" (Norm: "${normOp}") | Raw Circle: "${circleName}" (Norm: "${normCircle}")`);
    return {
      success: false,
      message: "Unable to detect network currently. Please retry in a few seconds."
    };
  }

  return {
    success: true,
    operatorCode,
    circleCode
  };
};
