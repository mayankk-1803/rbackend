export const isValidIndianMobile = (mobile) => {
  if (!mobile) return false;
  
  // Convert to string to safely use string methods
  const mobileStr = String(mobile).trim();
  
  // Must be exactly 10 digits starting with 6, 7, 8, or 9
  const patternRegex = /^[6-9]\d{9}$/;
  if (!patternRegex.test(mobileStr)) {
    return false;
  }
  
  // Reject repetitive numbers (e.g. 9999999999)
  const repetitiveRegex = /^(\d)\1{9}$/;
  if (repetitiveRegex.test(mobileStr)) {
    return false;
  }
  
  return true;
};
