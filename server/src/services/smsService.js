import axios from 'axios';
import { redisClient } from '../config/redis.js';

/**
 * Normalizes phone numbers to 91XXXXXXXXXX format.
 */
export const normalizePhone = (phone) => {
  if (!phone) return null;
  let normalized = phone.toString().replace(/\D/g, '');
  if (normalized.length === 10) {
    normalized = '91' + normalized;
  }
  return normalized;
};

/**
 * Masks phone number for secure logging.
 */
const maskPhone = (phone) => {
  if (!phone) return 'unknown';
  const normalized = normalizePhone(phone);
  return `${normalized.substring(0, 2)}******${normalized.slice(-4)}`;
};

/**
 * Sends OTP via VirtualByte SMS Gateway.
 */
export const sendOtpSms = async (phone, otpCode) => {
  const normalizedPhone = normalizePhone(phone);
  const maskedPhone = maskPhone(normalizedPhone);
  
  const apiUrl = process.env.SMS_API_URL;
  const apiKey = process.env.SMS_API_KEY;
  const templateId = process.env.SMS_TEMPLATE_ID;
  const senderId = process.env.SMS_SENDER_ID || "DIZIPY";
  const timeout = parseInt(process.env.SMS_TIMEOUT) || 15000; // Increased to 15s
  const cooldownSec = parseInt(process.env.OTP_COOLDOWN_SECONDS) || 60;

  const cooldownKey = `auth:otp:cooldown:${normalizedPhone}`;
  const lockKey = `auth:otp:lock:${normalizedPhone}`;

  // 0. Input Validation
  if (!normalizedPhone || normalizedPhone.length < 10) {
    console.error(`[SMS][INVALID_PHONE] → ${phone}`);
    return { success: false, message: "Invalid phone number format" };
  }

  if (!otpCode || otpCode.length < 4) {
    console.error(`[SMS][INVALID_OTP] → ${maskedPhone}`);
    return { success: false, message: "Invalid OTP code generated" };
  }

  try {
    // 1. Check for Verification Lock
    const isLocked = await redisClient.get(lockKey);
    if (isLocked) {
      console.log(`[SMS][LOCKED] → ${maskedPhone}`);
      return { success: false, message: "Too many failed attempts. Please try again later.", type: 'LOCKED' };
    }

    // 2. Check for Resend Cooldown
    const hasCooldown = await redisClient.get(cooldownKey);
    if (hasCooldown) {
      console.log(`[SMS][COOLDOWN] → ${maskedPhone}`);
      return { success: false, message: "Please wait before requesting another OTP", type: 'COOLDOWN' };
    }

    // 3. Check for Hourly Limit (Max 5 per hour)
    const hourlyKey = `auth:otp:hourly:${normalizedPhone}`;
    const hourlyCount = await redisClient.get(hourlyKey) || 0;
    if (parseInt(hourlyCount) >= 5) {
      console.log(`[SMS][RATE_LIMIT] → ${maskedPhone} (Hourly limit exceeded)`);
      return { success: false, message: "Too many OTP requests. Please try again after an hour.", type: 'RATE_LIMIT' };
    }

    // 4. Validate Config
    if (!apiUrl || !apiKey) {
      if (process.env.NODE_ENV === 'production') {
        console.error('[SMS][CONFIG_ERROR] CRITICAL: SMS_API_KEY or SMS_API_URL missing!');
        return { success: false, message: "SMS gateway configuration missing" };
      } else {
        console.warn(`[SMS][MOCK] → ${otpCode} to ${maskedPhone}`);
        return { success: true, message: "OTP generated (Mock Mode)", mock: true };
      }
    }

    // 5. Prepare Message
    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES) || 5;
    const message = `DIZIPAY OTP: ${otpCode}. Valid for ${expiryMinutes} minutes. Do not share this OTP with anyone.`;

    const sendRequest = async (retryCount = 0) => {
      const startTime = Date.now();
      try {
        console.log(`[SMS][SEND_START] → ${maskedPhone} (Attempt ${retryCount + 1})`);
        
        const params = {
          api_key: apiKey,
          number: normalizedPhone,
          msg: message,
          sender: senderId
        };

        // Add DLT Template ID if provided
        if (templateId) {
          params.template_id = templateId;
        }

        const response = await axios.get(apiUrl, {
          params,
          timeout
        });
        
        const latency = Date.now() - startTime;
        const resData = response.data;
        const resStr = typeof resData === 'string' ? resData.toLowerCase() : JSON.stringify(resData).toLowerCase();
        
        const isSuccess = resStr.includes('success') || resStr.includes('sent') || resData.status === true || resData.status === 'true';

        if (!isSuccess) {
          const errorMsg = resData.message || resStr || 'Unknown gateway error';
          console.error(`[SMS][GATEWAY_ERROR] → ${maskedPhone} | Code: ${response.status} | Msg: ${errorMsg}`);
          throw new Error(`Gateway Error: ${errorMsg}`);
        }

        console.log(`[SMS][SUCCESS] → ${maskedPhone} (${latency}ms)`);
        return true;
      } catch (err) {
        const isTimeout = err.code === 'ECONNABORTED';
        const status = err.response?.status;
        
        // Stop retrying on client errors (400, 401, 403)
        if (status >= 400 && status < 500) {
          console.error(`[SMS][BAD_REQUEST] → ${maskedPhone} | Status: ${status} | Error: ${err.message}`);
          throw err;
        }

        // Exponential Backoff for retries (max 2 retries)
        if (retryCount < 2 && (isTimeout || !status || status >= 500)) {
          const delay = Math.pow(2, retryCount) * 1000;
          console.warn(`[SMS][RETRYING] → ${maskedPhone} | Delay: ${delay}ms | Reason: ${err.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return await sendRequest(retryCount + 1);
        }

        if (isTimeout) {
          console.error(`[SMS][TIMEOUT] → ${maskedPhone} after ${retryCount} retries`);
        } else {
          console.error(`[SMS][FAILED] → ${maskedPhone} | Error: ${err.message}`);
        }
        throw err;
      }
    };

    // 6. Execute Delivery
    await sendRequest();

    // 7. Update Cooldown and Hourly Limit in Redis
    await redisClient.setex(cooldownKey, cooldownSec, 'active');
    
    const newHourly = await redisClient.incr(hourlyKey);
    if (newHourly === 1) {
      await redisClient.expire(hourlyKey, 3600); // 1 hour TTL
    }

    return { success: true, message: "OTP sent successfully" };

  } catch (error) {
    console.error(`[SMS][FATAL_ERROR] → ${maskedPhone} | Reason: ${error.message}`);
    return { success: false, message: error.message || "Failed to send OTP" };
  }
};

/**
 * Handles verification attempt limiting and locking.
 */
export const checkVerificationLock = async (phone) => {
  try {
    const normalizedPhone = normalizePhone(phone);
    const lockKey = `auth:otp:lock:${normalizedPhone}`;
    const attemptsKey = `auth:otp:attempts:${normalizedPhone}`;

    const isLocked = await redisClient.get(lockKey);
    if (isLocked) return { locked: true };

    const attempts = await redisClient.get(attemptsKey) || 0;
    return { locked: false, attempts: parseInt(attempts) };
  } catch (err) {
    console.error('[SMS] Redis Error during lock check:', err.message);
    return { locked: false, attempts: 0 };
  }
};


export const incrementVerificationAttempts = async (phone) => {
  const normalizedPhone = normalizePhone(phone);
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

    if (newAttempts >= maxAttempts) {
      await redisClient.setex(lockKey, lockSec, 'locked');
      await redisClient.del(attemptsKey);
      console.log(`[SMS] LOCKED → ${maskPhone(normalizedPhone)}`);
      return { locked: true };
    }

    return { locked: false, attempts: newAttempts };
  } catch (err) {
    console.error('[SMS] Redis Error during attempt increment:', err.message);
    return { locked: false }; // Fallback to allow verification
  }
};

export const clearVerificationAttempts = async (phone) => {
  const normalizedPhone = normalizePhone(phone);
  try {
    await redisClient.del(`auth:otp:attempts:${normalizedPhone}`);
    await redisClient.del(`auth:otp:lock:${normalizedPhone}`);
  } catch (err) {
    console.error('[SMS] Redis Error during attempt clear:', err.message);
  }
};
