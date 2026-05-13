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
  const timeout = parseInt(process.env.SMS_TIMEOUT) || 8000;
  const cooldownSec = parseInt(process.env.OTP_COOLDOWN_SECONDS) || 60;
  const lockMinutes = parseInt(process.env.OTP_LOCK_MINUTES) || 15;

  const cooldownKey = `auth:otp:cooldown:${normalizedPhone}`;
  const lockKey = `auth:otp:lock:${normalizedPhone}`;

  try {
    // 1. Check for Verification Lock
    const isLocked = await redisClient.get(lockKey);
    if (isLocked) {
      console.log(`[SMS] LOCKED → ${maskedPhone}`);
      return { success: false, message: "Too many failed attempts. Please try again later.", type: 'LOCKED' };
    }

    // 2. Check for Resend Cooldown
    const hasCooldown = await redisClient.get(cooldownKey);
    if (hasCooldown) {
      console.log(`[SMS] COOLDOWN → ${maskedPhone}`);
      return { success: false, message: "Please wait before requesting another OTP", type: 'COOLDOWN' };
    }

    // 3. Validate Config
    if (!apiUrl || !apiKey) {
      if (process.env.NODE_ENV === 'production') {
        console.error('CRITICAL: SMS_API_KEY or SMS_API_URL missing in production!');
        return { success: false, message: "SMS gateway configuration missing" };
      } else {
        console.warn(`[SMS] Mock Mode: ${otpCode} to ${maskedPhone}`);
        return { success: true, message: "OTP generated (Mock Mode)", mock: true };
      }
    }

    // 4. Prepare Message
    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES) || 5;
    const message = `DIZIPAY OTP: ${otpCode}.\nValid for ${expiryMinutes} minutes.\nDo not share this OTP with anyone.`;

    const sendRequest = async (retryCount = 0) => {
      const startTime = Date.now();
      try {
        const response = await axios.get(apiUrl, {
          params: {
            api_key: apiKey,
            number: normalizedPhone,
            msg: message
          },
          timeout
        });
        const latency = Date.now() - startTime;
        
        // Validate Response
        const resData = response.data;
        const resStr = typeof resData === 'string' ? resData.toLowerCase() : JSON.stringify(resData).toLowerCase();
        
        // Handle "status=true" or plain text success strings
        const isSuccess = resStr.includes('success') || resStr.includes('sent') || resData.status === true || resData.status === 'true';

        if (!isSuccess && (resStr.includes('error') || resStr.includes('invalid') || resData.status === false)) {
          throw new Error(`Gateway Error: ${resStr}`);
        }

        console.log(`[SMS] SUCCESS → ${maskedPhone} (${latency}ms)`);
        return true;
      } catch (err) {
        if (retryCount === 0 && (err.code === 'ECONNABORTED' || err.response?.status >= 500)) {
          console.warn(`[SMS] RETRYING → ${maskedPhone} due to ${err.message}`);
          return await sendRequest(1);
        }
        throw err;
      }
    };

    // 5. Execute Delivery
    await sendRequest();

    // 6. Set Cooldown in Redis
    await redisClient.setex(cooldownKey, cooldownSec, 'active');

    return { success: true, message: "OTP sent successfully" };

  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.error(`[SMS] TIMEOUT → ${maskedPhone}`);
    } else {
      console.error(`[SMS] FAILED → ${error.message}`);
    }

    // Fallback in non-production
    if (process.env.NODE_ENV !== 'production') {
      return { success: true, message: "OTP generated (Gateway Error, mocked)", mock: true };
    }

    return { success: false, message: "Failed to send OTP" };
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
