export const OPERATORS = {
  AIRTEL: "AIRTEL",
  VI: "VI",
  BSNL_TOPUP: "BSNL TOPUP",
  BSNL_SPECIAL: "BSNL SPECIAL",
  JIO: "JIO",
  VIDEOCON_D2H: "VIDEOCON D2H",
  AIRTEL_DTH: "AIRTEL DTH",
  DISH_TV: "DISH TV",
  SUN_DIRECT: "SUN DIRECT",
  TATA_SKY: "TATA SKY",
  UNKNOWN: "UNKNOWN"
};

export const operatorMeta = {
  [OPERATORS.AIRTEL]: { label: "Airtel", code: "1", color: "bg-red-50 text-red-600 border-red-100" },
  [OPERATORS.VI]: { label: "Vi", code: "2", color: "bg-rose-50 text-rose-600 border-rose-100" },
  [OPERATORS.BSNL_TOPUP]: { label: "BSNL Topup", code: "3", color: "bg-orange-50 text-orange-600 border-orange-100" },
  [OPERATORS.BSNL_SPECIAL]: { label: "BSNL Special", code: "4", color: "bg-orange-50 text-orange-600 border-orange-100" },
  [OPERATORS.JIO]: { label: "Jio", code: "5", color: "bg-blue-50 text-blue-600 border-blue-100" },
  [OPERATORS.VIDEOCON_D2H]: { label: "Videocon D2H", code: "6", color: "bg-amber-50 text-amber-600 border-amber-100" },
  [OPERATORS.AIRTEL_DTH]: { label: "Airtel DTH", code: "7", color: "bg-red-50 text-red-600 border-red-100" },
  [OPERATORS.DISH_TV]: { label: "Dish TV", code: "8", color: "bg-slate-50 text-slate-600 border-slate-100" },
  [OPERATORS.SUN_DIRECT]: { label: "Sun Direct", code: "9", color: "bg-orange-50 text-orange-600 border-orange-100" },
  [OPERATORS.TATA_SKY]: { label: "Tata Sky", code: "10", color: "bg-pink-50 text-pink-600 border-pink-100" },
  [OPERATORS.UNKNOWN]: { label: "Unknown", code: "0", color: "bg-slate-50 text-slate-400 border-slate-100" }
};
