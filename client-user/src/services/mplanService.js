import api from '../api';

/**
 * Fetches recharge plans from the database/MPlan.
 * @param {object} params
 * @param {string} params.operatorCode
 * @param {string} params.operatorName
 * @param {string} params.circleName
 * @param {string} [params.circleCode]
 * @param {AbortSignal} signal
 * @returns {Promise<object>}
 */
export const fetchRechargePlans = async ({ operatorCode, operatorName, circleName, circleCode }, signal) => {
  const { data } = await api.get('/recharge/plans', {
    params: {
      operatorCode,
      operatorName,
      circleName,
      circleCode
    },
    signal
  });
  return data;
};

/**
 * Fetches recharge plans via dev/fallback endpoint.
 * @param {object} params
 * @param {string} params.operatorCode
 * @param {string} params.mobile
 * @param {string} params.circle
 * @param {AbortSignal} signal
 * @returns {Promise<object>}
 */
export const fetchRechargePlansDev = async ({ operatorCode, mobile, circle = 'Delhi' }, signal) => {
  const { data } = await api.get('/v1/dev/plans', {
    params: {
      operatorCode,
      mobile,
      circle
    },
    signal
  });
  return data;
};
