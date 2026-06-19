const CACHE_PREFIX = 'recharge_cache_';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Generates cache key for a mobile number, operator, and circle.
 * @param {string} mobile
 * @param {string} operatorCode
 * @param {string} circleCode
 * @returns {string}
 */
export const generateCacheKey = (mobile, operatorCode, circleCode) => {
  const op = (operatorCode || 'unknown').toUpperCase();
  const cir = (circleCode || 'unknown').toUpperCase();
  return `${CACHE_PREFIX}${mobile}_${op}_${cir}`;
};

/**
 * Finds and retrieves a cached plan entry for a mobile number.
 * @param {string} mobile
 * @returns {object|null}
 */
export const getCachedPlans = (mobile) => {
  if (!mobile) return null;
  try {
    const prefix = `${CACHE_PREFIX}${mobile}_`;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const entry = JSON.parse(raw);
        if (!entry || !entry.fetchedAt) continue;
        const age = Date.now() - entry.fetchedAt;
        if (age >= CACHE_TTL_MS) {
          localStorage.removeItem(key);
          return null;
        }
        return entry;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
};

/**
 * Sets a cached plan entry, clearing any old keys for the same mobile first.
 * @param {string} mobile
 * @param {object} payload
 * @param {string} payload.operatorCode
 * @param {string} payload.operatorName
 * @param {string} payload.circleCode
 * @param {string} payload.circleName
 * @param {object|array} payload.plans
 */
export const setCachedPlans = (mobile, { operatorCode, operatorName, circleCode, circleName, plans }) => {
  if (!mobile) return;
  try {
    // 1. Clear any existing cache keys for this mobile number (e.g. if operator/circle changed due to MNP/manual override)
    const prefix = `${CACHE_PREFIX}${mobile}_`;
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // 2. Write new cache key
    const key = generateCacheKey(mobile, operatorCode, circleCode);
    const entry = {
      mobile,
      operatorCode: (operatorCode || 'unknown').toUpperCase(),
      operatorName,
      circleCode: (circleCode || 'unknown').toUpperCase(),
      circleName,
      plans,
      fetchedAt: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch (e) {
    // Fail-safe if localStorage is full or disabled
  }
};

/**
 * Checks if a cache entry exists and is valid for a mobile number.
 * @param {string} mobile
 * @returns {boolean}
 */
export const isCacheValid = (mobile) => {
  return getCachedPlans(mobile) !== null;
};

/**
 * Clears all expired plan cache entries.
 */
export const clearExpiredPlans = () => {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const entry = JSON.parse(raw);
            if (entry && entry.fetchedAt) {
              const age = Date.now() - entry.fetchedAt;
              if (age >= CACHE_TTL_MS) {
                keysToRemove.push(key);
              }
            }
          }
        } catch (e) {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    // Fail-safe
  }
};
