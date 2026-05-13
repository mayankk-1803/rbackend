import axios from "axios";

/**
 * Fetches current wallet balance from Apibox
 */
export const getBalance = async () => {
  const API_URL = process.env.APIBOX_BASE_URL || "https://Apibox.co.in/Api/Service";
  const API_TOKEN = process.env.APIBOX_TOKEN;

  try {
    const params = {
      ApiToken: API_TOKEN
    };

    const response = await axios.get(`${API_URL}/GetBalance`, {
      params,
      timeout: 10000
    });

    if (response.data && response.data.STATUS === 1) {
      return {
        success: true,
        balance: Number(response.data.BALANCE || 0),
        raw: response.data
      };
    }

    return {
      success: false,
      message: response.data?.MESSAGE || "Failed to fetch balance",
      raw: response.data
    };
  } catch (error) {
    console.error(`[APIBOX BALANCE ERROR]:`, error.message);
    return { success: false, message: error.message };
  }
};
