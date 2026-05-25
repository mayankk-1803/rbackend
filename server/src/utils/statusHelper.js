/**
 * Centralized utility to normalize transaction statuses across the platform.
 * Ensures consistency between DB, provider responses, and frontend.
 */
export const normalizeTransactionStatus = (status) => {
  if (!status) return 'pending';
  
  const s = status.toString().toLowerCase();
  
  if (['success', 'paid', 'captured', 'completed'].includes(s)) return 'success';
  if (['failed', 'failure', 'reversed', 'cancelled', 'rejected'].includes(s)) return 'failed';
  if (['refunded', 'refund'].includes(s)) return 'refunded';
  if (['processing', 'in_process'].includes(s)) return 'processing';
  if (['pending_review', 'review'].includes(s)) return 'pending_review';
  if (['pending', 'queued', 'initiated'].includes(s)) return 'pending';
  
  return 'pending';
};

/**
 * Normalizes transaction types.
 */
export const normalizeTransactionType = (type) => {
  if (!type) return 'RECHARGE';
  return type.toUpperCase();
};
