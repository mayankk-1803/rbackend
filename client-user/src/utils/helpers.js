export const formatAmount = (val) => (Number(val) || 0).toFixed(2);
export const safeSlice = (val, s = 0, e = 10) => typeof val === "string" ? val.slice(s, e) : "-";
export const safeValue = (val, fallback = "-") => val ?? fallback;
export const safeArray = (arr) => Array.isArray(arr) ? arr : [];
