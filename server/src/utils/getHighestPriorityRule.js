import { MODE_PRIORITY } from "../constants/modePriority.js";

/**
 * Returns the highest priority rule from a list of rules.
 * Mode priority: REAL (2) > GENERAL (1) > Unknown (0)
 * Deterministic tie-breaker:
 *   1. Higher ID / newer rule wins.
 *   2. Lexicographical comparison on mode string if IDs are equal or missing.
 * 
 * @param {Array} rules 
 * @returns {Object|null}
 */
export function getHighestPriorityRule(rules = []) {
  if (!rules || !rules.length) return null;

  return [...rules].sort((a, b) => {
    const priorityA = MODE_PRIORITY[a.mode] ?? 0;
    const priorityB = MODE_PRIORITY[b.mode] ?? 0;

    if (priorityB !== priorityA) {
      return priorityB - priorityA;
    }

    // Tie-breaker 1: id descending (newer rule first)
    if (a.id !== undefined && b.id !== undefined) {
      if (typeof a.id === 'number' && typeof b.id === 'number') {
        return b.id - a.id;
      }
      // Lexicographical comparison for non-numeric/string IDs
      if (a.id > b.id) return -1;
      if (a.id < b.id) return 1;
    }

    // Tie-breaker 2: mode string alphabetical (deterministic for unknown modes)
    if (a.mode && b.mode) {
      if (a.mode > b.mode) return -1;
      if (a.mode < b.mode) return 1;
    }

    return 0;
  })[0];
}
