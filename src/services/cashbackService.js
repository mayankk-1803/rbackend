export const calculateCashback = (amount) => {
  if (amount >= 300) return 2.00;
  if (amount >= 100) return 1.00;
  return 0.00;
};
