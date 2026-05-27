import axios from 'axios';
import { redisClient } from '../../config/redis.js';

/**
 * Normalizes phone numbers to 91XXXXXXXXXX format.
 * Accepts: 9999441737, 919999441737, +919999441737 -> converts to 919999441737
 * Strips spaces, dashes, brackets, and special characters.
 */
export const normalizePhone = (phone) => {
  if (!phone) return null;
  let cleaned = phone.toString().replace(/\D/g, '');
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
};

/**
 * Masks phone number for secure, sanitized logging.
 */
export const maskPhone = (phone) => {
  if (!phone) return 'unknown';
  const normalized = normalizePhone(phone);
  if (!normalized) return 'unknown';
  return `${normalized.substring(0, 2)}******${normalized.slice(-4)}`;
};

/**
 * Sends a 6-digit OTP via NxtByte WhatsApp Gateway.
 * Enforces Redis cooldown (60s) and 15-minute sliding window limits (max 5).
 */
export const sendOtp = async (phone, otpCode) => {
  const normalizedPhone = normalizePhone(phone);
  const maskedPhone = maskPhone(normalizedPhone);

  console.log(`[OTP][SEND_REQUEST] → Initiating WhatsApp OTP delivery for ${maskedPhone}`);

  if (!normalizedPhone || normalizedPhone.length < 10) {
    console.error(`[OTP][SEND_FAILED] → Invalid phone number format for ${maskedPhone}`);
    return { success: false, message: "Invalid phone number format" };
  }

  if (!otpCode || otpCode.length !== 6) {
    console.error(`[OTP][SEND_FAILED] → Invalid OTP code length for ${maskedPhone}`);
    return { success: false, message: "Invalid OTP code generated" };
  }

  const cooldownKey = `auth:otp:cooldown:${normalizedPhone}`;
  const lockKey = `auth:otp:lock:${normalizedPhone}`;
  const windowKey = `auth:otp:window15m:${normalizedPhone}`;

  const cooldownSec = parseInt(process.env.OTP_COOLDOWN_SECONDS) || 60;
  const windowMin = parseInt(process.env.OTP_WINDOW_MINUTES) || 15;
  const maxPerWindow = parseInt(process.env.OTP_MAX_PER_WINDOW) || 5;

  try {
    // 1. Check Verification Lock (Brute force lock)
    const isLocked = await redisClient.get(lockKey);
    if (isLocked) {
      console.warn(`[OTP][SEND_FAILED] → Account temporarily locked for ${maskedPhone}`);
      return { success: false, message: "Too many failed attempts. Please try again later.", type: 'LOCKED' };
    }

    // 2. Check Resend Cooldown (60s)
    const hasCooldown = await redisClient.get(cooldownKey);
    if (hasCooldown) {
      console.warn(`[OTP][SEND_FAILED] → Resend cooldown active for ${maskedPhone}`);
      return { success: false, message: "Please wait before requesting another OTP", type: 'COOLDOWN' };
    }

    // 3. Check 15-minute Window Limit (Max 5)
    const windowCount = await redisClient.get(windowKey) || 0;
    if (parseInt(windowCount) >= maxPerWindow) {
      console.warn(`[OTP][SEND_FAILED] → Rate limit exceeded in 15m window for ${maskedPhone}`);
      return { success: false, message: "Too many OTP requests. Please try again after 15 minutes.", type: 'RATE_LIMIT' };
    }

    const baseUrl = (process.env.NXTBYTE_BASE_URL || "https://nxtbyte.in/api/send-text").trim();
    const rawApiKey = process.env.NXTBYTE_API_KEY;
    const apiKey = rawApiKey?.trim();
    const footer = (process.env.OTP_BRAND_NAME || "iRecharge").trim();
    const number = normalizedPhone.trim();
    const timeout = 15000; // 15 seconds timeout per Step 4

    if (!apiKey) {
      if (process.env.NODE_ENV === 'production') {
        console.error('[OTP][SEND_FAILED] CRITICAL: NXTBYTE_API_KEY configuration missing!');
        return { success: false, message: "OTP gateway configuration missing" };
      } else {
        console.warn(`[OTP][SEND_SUCCESS] → Mock Mode delivery for ${maskedPhone}`);
        return { success: true, message: "OTP sent successfully (Mock Mode)", mock: true };
      }
    }

    // Runtime validation for env corruption (Step 2)
    console.log("[OTP][ENV_DEBUG] API Key Diagnostics:", {
      keyLength: apiKey.length,
      firstChar: apiKey.charCodeAt(0),
      lastChar: apiKey.charCodeAt(apiKey.length - 1)
    });

    const message = `Your ${footer} OTP is ${otpCode}. Do not share this code with anyone.`.trim();

    // Construct URL EXACTLY like the browser test without params object (Step 3)
    const url = 
      `${baseUrl}` +
      `?api_key=${encodeURIComponent(apiKey)}` +
      `&number=${encodeURIComponent(number)}` +
      `&msg=${encodeURIComponent(message)}` +
      `&footer=${encodeURIComponent(footer)}`;

    // Masked raw URL debugging (Step 5)
    const maskedApiKey = `${apiKey.substring(0, 6)}******${apiKey.slice(-5)}`;
    const maskedUrl = 
      `${baseUrl}` +
      `?api_key=${maskedApiKey}` +
      `&number=${encodeURIComponent(number)}` +
      `&msg=${encodeURIComponent(message)}` +
      `&footer=${encodeURIComponent(footer)}`;
    
    console.log(`[OTP][RAW_URL] → ${maskedUrl}`);

    // Safe Axios call with exponential backoff retry (Step 7)
    const executeRequest = async (attempt = 0) => {
      const startTime = Date.now();
      try {
        console.log(`[OTP][TRACE] → Dispatching NxtByte API request for ${maskedPhone} (Attempt ${attempt + 1})`);
        
        // Plain GET request without any custom headers or params object (Step 3 & 4)
        const response = await axios.get(url, { timeout });
        const latency = Date.now() - startTime;

        // Backend success detection using strict status check (Step 6)
        if (response.data?.status === true) {
          console.log(`[OTP][SEND_SUCCESS] → NxtByte WhatsApp OTP delivered to ${maskedPhone} in ${latency}ms`);
          return true;
        } else {
          const errorMsg = response.data?.message || JSON.stringify(response.data) || 'Unknown NxtByte gateway error';
          console.error(`[OTP][GATEWAY_ERROR] → NxtByte responded with failure for ${maskedPhone} | Msg: ${errorMsg}`);
          throw new Error(`Gateway Error: ${errorMsg}`);
        }
      } catch (err) {
        const isTimeout = err.code === 'ECONNABORTED';
        const status = err.response?.status;

        // Do not retry on 4xx client errors (e.g. invalid API key, bad request)
        if (status >= 400 && status < 500) {
          console.error(`[OTP][SEND_FAILED] → NxtByte Client Error (${status}) for ${maskedPhone}: ${err.message}`);
          throw err;
        }

        // Exponential backoff for 5xx server errors or network timeouts (max 2 retries)
        if (attempt < 2 && (isTimeout || !status || status >= 500)) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(`[OTP][RETRYING] → NxtByte request failed for ${maskedPhone}. Retrying in ${delay}ms... Reason: ${err.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return await executeRequest(attempt + 1);
        }

        console.error(`[OTP][SEND_FAILED] → NxtByte delivery failed after ${attempt} retries for ${maskedPhone}: ${err.message}`);
        throw err;
      }
    };

    await executeRequest();

    // Update Redis protections upon successful delivery
    await redisClient.setex(cooldownKey, cooldownSec, 'active');

    const newWindowCount = await redisClient.incr(windowKey);
    if (newWindowCount === 1) {
      await redisClient.expire(windowKey, windowMin * 60);
    }

    return { success: true, message: "OTP sent successfully" };
  } catch (error) {
    console.error(`[OTP][SEND_FAILED] → Fatal error sending OTP to ${maskedPhone}: ${error.message}`);
    return { success: false, message: "Failed to send OTP" };
  }
};

/**
 * Verifies account lock status to prevent brute force verification attempts.
 */
export const verifyOtpProtection = async (phone) => {
  try {
    const normalizedPhone = normalizePhone(phone);
    const lockKey = `auth:otp:lock:${normalizedPhone}`;
    const attemptsKey = `auth:otp:attempts:${normalizedPhone}`;

    const isLocked = await redisClient.get(lockKey);
    if (isLocked) {
      console.warn(`[OTP][VERIFY_FAILED] → Verification blocked by active lock for ${maskPhone(normalizedPhone)}`);
      return { locked: true };
    }

    const attempts = await redisClient.get(attemptsKey) || 0;
    return { locked: false, attempts: parseInt(attempts) };
  } catch (err) {
    console.error('[OTP][REDIS_ERROR] → Error checking verification lock:', err.message);
    return { locked: false, attempts: 0 };
  }
};

/**
 * Increments failed verification attempts and locks account if threshold exceeded.
 */
export const incrementAttempts = async (phone) => {
  const normalizedPhone = normalizePhone(phone);
  const maskedPhone = maskPhone(normalizedPhone);
  const attemptsKey = `auth:otp:attempts:${normalizedPhone}`;
  const lockKey = `auth:otp:lock:${normalizedPhone}`;
  
  const maxAttempts = parseInt(process.env.OTP_MAX_ATTEMPTS) || 5;
  const lockSec = (parseInt(process.env.OTP_LOCK_MINUTES) || 15) * 60;
  const otpExpirySec = (parseInt(process.env.OTP_EXPIRY_MINUTES) || 5) * 60;

  try {
    const newAttempts = await redisClient.incr(attemptsKey);
    
    if (newAttempts === 1) {
      await redisClient.expire(attemptsKey, otpExpirySec);
    }

    console.warn(`[OTP][VERIFY_FAILED] → Failed OTP attempt ${newAttempts}/${maxAttempts} for ${maskedPhone}`);

    if (newAttempts >= maxAttempts) {
      await redisClient.setex(lockKey, lockSec, 'locked');
      await redisClient.del(attemptsKey);
      console.error(`[OTP][VERIFY_FAILED] → Account locked due to brute force attempts for ${maskedPhone}`);
      return { locked: true, attempts: newAttempts };
    }

    return { locked: false, attempts: newAttempts };
  } catch (err) {
    console.error('[OTP][REDIS_ERROR] → Error incrementing verification attempts:', err.message);
    return { locked: false, attempts: 1 };
  }
};

/**
 * Clears verification attempts and locks upon successful OTP verification.
 */
export const clearAttempts = async (phone) => {
  const normalizedPhone = normalizePhone(phone);
  const maskedPhone = maskPhone(normalizedPhone);
  try {
    await redisClient.del(`auth:otp:attempts:${normalizedPhone}`);
    await redisClient.del(`auth:otp:lock:${normalizedPhone}`);
    console.log(`[OTP][VERIFY_SUCCESS] → Verification successful. Cleared attempts and locks for ${maskedPhone}`);
  } catch (err) {
    console.error('[OTP][REDIS_ERROR] → Error clearing verification attempts:', err.message);
  }
};

/**
 * Sends a temporary login password via WhatsApp using NxtByte Gateway.
 */
export const sendTempPasswordWhatsApp = async (phone, name, tempPassword) => {
  const normalizedPhone = normalizePhone(phone);
  const maskedPhone = maskPhone(normalizedPhone);

  console.log(`[TEMP_PASSWORD][SEND_REQUEST] → Initiating WhatsApp delivery for ${maskedPhone}`);

  if (!normalizedPhone || normalizedPhone.length < 10) {
    console.error(`[TEMP_PASSWORD][SEND_FAILED] → Invalid phone number format for ${maskedPhone}`);
    return { success: false, message: "Invalid phone number format" };
  }

  const baseUrl = (process.env.NXTBYTE_BASE_URL || "https://nxtbyte.in/api/send-text").trim();
  const rawApiKey = process.env.NXTBYTE_API_KEY;
  const apiKey = rawApiKey?.trim();
  const number = normalizedPhone.trim();
  const timeout = 15000; // 15 seconds timeout

  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[TEMP_PASSWORD][SEND_FAILED] CRITICAL: NXTBYTE_API_KEY configuration missing!');
      return { success: false, message: "WhatsApp gateway configuration missing" };
    } else {
      console.warn(`[TEMP_PASSWORD][SEND_SUCCESS] → Mock Mode delivery for ${maskedPhone}. Password is: ${tempPassword}`);
      return { success: true, message: "Temporary password sent successfully (Mock Mode)", mock: true };
    }
  }

  const message = `DIZIPAY Temporary Login Password

Hello ${name || 'User'},

Your temporary login password is:

${tempPassword}

Please login and immediately change your password from Account Settings.

* DIZIPAY Security Team`.trim();

  // Construct URL EXACTLY like the browser test without params object
  const url = 
    `${baseUrl}` +
    `?api_key=${encodeURIComponent(apiKey)}` +
    `&number=${encodeURIComponent(number)}` +
    `&msg=${encodeURIComponent(message)}`;

  const maskedApiKey = `${apiKey.substring(0, 6)}******${apiKey.slice(-5)}`;
  const maskedUrl = 
    `${baseUrl}` +
    `?api_key=${maskedApiKey}` +
    `&number=${encodeURIComponent(number)}` +
    `&msg=${encodeURIComponent(message)}`;
  
  console.log(`[TEMP_PASSWORD][RAW_URL] → ${maskedUrl}`);

  // Safe Axios call with exponential backoff retry (max 2 retries)
  const executeRequest = async (attempt = 0) => {
    const startTime = Date.now();
    try {
      console.log(`[TEMP_PASSWORD][TRACE] → Dispatching NxtByte API request for ${maskedPhone} (Attempt ${attempt + 1})`);
      
      const response = await axios.get(url, { timeout });
      const latency = Date.now() - startTime;

      if (response.data?.status === true) {
        console.log(`[TEMP_PASSWORD][SEND_SUCCESS] → NxtByte WhatsApp delivered to ${maskedPhone} in ${latency}ms`);
        return true;
      } else {
        const errorMsg = response.data?.message || JSON.stringify(response.data) || 'Unknown NxtByte gateway error';
        console.error(`[TEMP_PASSWORD][GATEWAY_ERROR] → NxtByte responded with failure for ${maskedPhone} | Msg: ${errorMsg}`);
        throw new Error(`Gateway Error: ${errorMsg}`);
      }
    } catch (err) {
      const isTimeout = err.code === 'ECONNABORTED';
      const status = err.response?.status;

      if (status >= 400 && status < 500) {
        console.error(`[TEMP_PASSWORD][SEND_FAILED] → NxtByte Client Error (${status}) for ${maskedPhone}: ${err.message}`);
        throw err;
      }

      if (attempt < 2 && (isTimeout || !status || status >= 500)) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`[TEMP_PASSWORD][RETRYING] → NxtByte request failed for ${maskedPhone}. Retrying in ${delay}ms... Reason: ${err.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return await executeRequest(attempt + 1);
      }

      console.error(`[TEMP_PASSWORD][SEND_FAILED] → NxtByte delivery failed after ${attempt} retries for ${maskedPhone}: ${err.message}`);
      throw err;
    }
  };

  await executeRequest();
  return { success: true, message: "Temporary password sent successfully" };
};

// Export aliases for seamless backward compatibility during refactoring
export const sendOtpSms = sendOtp;
export const checkVerificationLock = verifyOtpProtection;
export const incrementVerificationAttempts = incrementAttempts;
export const clearVerificationAttempts = clearAttempts;
