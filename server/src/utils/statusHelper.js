/**
 * Centralized utility to normalize transaction statuses across the platform.
 * Ensures consistency between DB, provider responses, and frontend.
 */
export const normalizeTransactionStatus = (status) => {
  if (!status) return 'pending';
  
  const s = status.toString().toLowerCase();
  
  if (['success', 'paid', 'captured', 'completed'].includes(s)) return 'success';
  if (['failed', 'failure', 'reversed', 'cancelled', 'rejected'].includes(s)) return 'failed';
  if (['pending', 'processing', 'queued', 'initiated'].includes(s)) return 'pending';
  
  return 'pending';
};

/**
 * Normalizes transaction types.
 */
export const normalizeTransactionType = (type) => {
  if (!type) return 'RECHARGE';
  return type.toUpperCase();
};
