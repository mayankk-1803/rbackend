/**
 * Centralized transaction state guard to govern state finality and transition rules.
 */

export const isFinalizedStatus = (status) => {
  if (!status) return false;
  const s = status.toUpperCase();
  return ["SUCCESS", "FAILED", "REFUNDED"].includes(s);
};

export const isValidStatusTransition = (currentStatus, nextStatus) => {
  if (!currentStatus || !nextStatus) return false;
  const cur = currentStatus.toUpperCase();
  const next = nextStatus.toUpperCase();

  if (cur === next) return true; // Transition to same state is a no-op

  const allowedTransitions = {
    PENDING: ["PROCESSING", "SUCCESS", "FAILED"],
    PENDING_REVIEW: ["PROCESSING", "SUCCESS", "FAILED"],
    PROCESSING: ["SUCCESS", "FAILED"],
    FAILED: ["REFUNDED"]
  };

  const allowed = allowedTransitions[cur];
  return allowed ? allowed.includes(next) : false;
};
