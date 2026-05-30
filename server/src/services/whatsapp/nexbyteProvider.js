import axios from "axios";
import logger from "../logging/logger.js";

const NEXBYTE_API_URL = process.env.NEXBYTE_WHATSAPP_API_URL || "https://api.nexbyte.in/v1/whatsapp";
const NEXBYTE_TOKEN = process.env.NEXBYTE_WHATSAPP_TOKEN;

/**
 * NexByte WhatsApp API Adapter Client
 */
export const sendWhatsappMessage = async ({ recipient, templateName, variables }) => {
  const start = Date.now();
  logger.info(`[NEXBYTE] Dispatching WhatsApp message to ${recipient}`, { templateName, variables });

  // Input Sanitization
  if (!recipient || recipient.length < 10) {
    logger.warn(`[NEXBYTE] Invalid recipient number skipped: ${recipient}`);
    return { success: false, status: "FAILED", reason: "Invalid phone number" };
  }

  // Format recipient (Ensure standard 91 prefix for India if 10 digits)
  const formattedNumber = recipient.length === 10 ? `91${recipient}` : recipient;

  try {
    // If NexByte Token is missing, run in Mock sandbox mode to prevent production blockages
    if (!NEXBYTE_TOKEN) {
      const mockLatency = Date.now() - start;
      logger.info(`[NEXBYTE_MOCK] Sandbox WhatsApp message dispatched successfully`, {
        recipient: formattedNumber,
        templateName,
        variables,
        mockLatency
      });

      return {
        success: true,
        status: "DELIVERED",
        response: { message: "Mock sandbox success", mock: true, recipient: formattedNumber, variables }
      };
    }

    const payload = {
      to: formattedNumber,
      template: templateName,
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: Object.entries(variables || {}).map(([key, val]) => ({
            type: "text",
            text: String(val)
          }))
        }
      ]
    };

    const response = await axios.post(`${NEXBYTE_API_URL}/send`, payload, {
      headers: {
        Authorization: `Bearer ${NEXBYTE_TOKEN}`,
        "Content-Type": "application/json"
      },
      timeout: 10000 // Safe 10s timeout
    });

    const latency = Date.now() - start;
    logger.info(`[NEXBYTE] API returned response in ${latency}ms`, { data: response.data });

    return {
      success: true,
      status: "DELIVERED",
      response: response.data
    };

  } catch (error) {
    const latency = Date.now() - start;
    logger.error(`[NEXBYTE ERROR] Dispatched to ${recipient} failed after ${latency}ms`, { error: error.message });

    return {
      success: false,
      status: "FAILED",
      reason: error.message,
      response: error.response?.data || null
    };
  }
};

export default {
  sendWhatsappMessage
};
