export const calculateCommission = (amount, operator) => {
  let rate = 1;
  const op = operator ? operator.toLowerCase() : "";

  if (op === "jio") rate = 1.5;
  else if (op === "airtel") rate = 1.2;

  return Number(((amount * rate) / 100).toFixed(2));
};