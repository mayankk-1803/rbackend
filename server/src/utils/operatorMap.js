/**
 * Indian Telecom Routing Prefix Map
 * A lightweight local utility to detect mobile operators based on 4-digit prefixes.
 * 
 * Supports: JIO, AIRTEL, VI, BSNL
 */

export const operatorMap = {
  // Reliance Jio
  "7000": "JIO", "7001": "JIO", "7002": "JIO", "7003": "JIO", "7004": "JIO",
  "7005": "JIO", "7006": "JIO", "7007": "JIO", "7008": "JIO", "7009": "JIO",
  "7010": "JIO", "7011": "JIO", "7012": "JIO", "7013": "JIO", "7014": "JIO",
  "7970": "JIO", "7971": "JIO", "7972": "JIO", "7973": "JIO", "7974": "JIO",
  "8770": "JIO", "8771": "JIO", "8772": "JIO", "8773": "JIO", "8774": "JIO",
  "8894": "JIO", "8895": "JIO", "8896": "JIO", "8897": "JIO", "8898": "JIO",
  "8899": "JIO", "9419": "JIO", "9420": "JIO", "9421": "JIO", "9422": "JIO",
  "9923": "JIO", "9924": "JIO", "9925": "JIO", "9926": "JIO", "9927": "JIO",
  // Airtel
  "9810": "AIRTEL", "9811": "AIRTEL", "9812": "AIRTEL", "9813": "AIRTEL", "9814": "AIRTEL",
  "9815": "AIRTEL", "9816": "AIRTEL", "9817": "AIRTEL", "9818": "AIRTEL", "9819": "AIRTEL",
  "9822": "AIRTEL", "9823": "AIRTEL", "9824": "AIRTEL", "9825": "AIRTEL", "9826": "AIRTEL",
  "9827": "AIRTEL", "9828": "AIRTEL", "9829": "AIRTEL", "9848": "AIRTEL", "9849": "AIRTEL",
  "9885": "AIRTEL", "9886": "AIRTEL", "9887": "AIRTEL", "9888": "AIRTEL", "9889": "AIRTEL",
  "9900": "AIRTEL", "9901": "AIRTEL", "9902": "AIRTEL", "9903": "AIRTEL", "9904": "AIRTEL",
  "9910": "AIRTEL", "9911": "AIRTEL", "9912": "AIRTEL", "9913": "AIRTEL", "9914": "AIRTEL",
  // Vodafone Idea (VI)
  "9820": "VI", "9821": "VI", "9830": "VI", "9831": "VI", "9832": "VI",
  "9833": "VI", "9834": "VI", "9835": "VI", "9836": "VI", "9837": "VI",
  "9838": "VI", "9839": "VI", "9890": "VI", "9891": "VI", "9892": "VI",
  "9893": "VI", "9894": "VI", "9895": "VI", "9896": "VI", "9897": "VI",
  "9898": "VI", "9899": "VI", "9920": "VI", "9921": "VI", "9922": "VI",
  "9930": "VI", "9931": "VI", "9932": "VI", "9933": "VI", "9934": "VI",
  // BSNL
  "9400": "BSNL", "9401": "BSNL", "9402": "BSNL", "9403": "BSNL", "9404": "BSNL",
  "9405": "BSNL", "9406": "BSNL", "9407": "BSNL", "9408": "BSNL", "9409": "BSNL",
  "9410": "BSNL", "9411": "BSNL", "9412": "BSNL", "9413": "BSNL", "9414": "BSNL",
  "9415": "BSNL", "9416": "BSNL", "9417": "BSNL", "9418": "BSNL", "9423": "BSNL",
  "9424": "BSNL", "9425": "BSNL", "9426": "BSNL", "9427": "BSNL", "9428": "BSNL"
};

export const fallback3DigitMap = {
  "700": "JIO",
  "981": "AIRTEL",
  "982": "VI",
  "940": "BSNL",
  "941": "BSNL",
  "942": "BSNL",
  "989": "VI",
  "991": "AIRTEL",
  "993": "VI",
  "983": "VI",
  "889": "JIO"
};
