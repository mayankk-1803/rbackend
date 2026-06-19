export const COIN_CONVERSION_FACTOR = 100;

/**
 * Converts cashback balance (rupees) to reward coins.
 * @param {number|string} cashbackAmount 
 * @returns {number}
 */
export const convertCashbackToCoins = (cashbackAmount) => {
  const amount = Number(cashbackAmount || 0);
  return Math.round(amount * COIN_CONVERSION_FACTOR);
};

/**
 * Formats a coins amount as a readable string.
 * @param {number} coins 
 * @returns {string}
 */
export const formatCoins = (coins) => {
  const coinCount = Math.round(Number(coins || 0));
  return `${coinCount} Coins`;
};

/**
 * Resolves the coins reward balance from the user's wallet.
 * Uses only wallet.cashbackBalance.
 * @param {object} wallet 
 * @returns {number}
 */
export const getRewardCoinBalance = (wallet) => {
  if (!wallet) return 0;
  return convertCashbackToCoins(wallet.cashbackBalance);
};

/**
 * Gets coins from a transaction.
 * @param {object} transaction
 * @returns {number}
 */
export const getCoinsFromTransaction = (transaction) => {
  if (!transaction) return 0;
  return convertCashbackToCoins(transaction.cashback || transaction.cashbackEarned || 0);
};

