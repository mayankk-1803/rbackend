import api from '../api';

/**
 * Initiates prepaid operator auto-detection and initial plan loading.
 * @param {string} mobile
 * @param {AbortSignal} signal
 * @returns {Promise<object>}
 */
export const initPrepaidOperator = async (mobile, signal) => {
  const { data } = await api.post('/recharge/prepaid/init', { mobile }, { signal });
  return data;
};

/**
 * Detects operator via developer endpoint.
 * @param {string} mobile
 * @param {AbortSignal} signal
 * @returns {Promise<object>}
 */
export const detectOperatorDev = async (mobile, signal) => {
  const { data } = await api.get(`/v1/dev/operator/${mobile}`, { signal });
  return data;
};
