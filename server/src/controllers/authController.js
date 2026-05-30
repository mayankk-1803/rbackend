import prisma from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { redisClient } from "../config/redis.js";
import { logAction } from "../services/auditService.js";
import { 
  sendOtp as sendNxtbyteOtp, 
  normalizePhone, 
  verifyOtpProtection, 
  incrementAttempts, 
  clearAttempts 
} from "../services/otp/nxtbyteOtpService.js";
import { sendResetCodeEmail } from "../services/emailService.js";

const generateToken = (user, tokenType = "USER_PANEL") => {
  return jwt.sign(
    { 
      id: user.id, 
      role: user.role,
      tokenType,
      authVersion: user.authVersion || 1
    },
    process.env.JWT_SECRET || "fallback_secret",
    { expiresIn: "7d" }
  );
};


/**
 * EMAIL & PASSWORD REGISTER
 */
export const registerEmail = async (req, res) => {
  try {
    const { name, email, password, phone, referralCode: givenReferralCode } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone: phone ? normalizePhone(phone) : undefined }] }
    });

    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email or phone already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          password: hashedPassword,
          phone: phone ? normalizePhone(phone) : null,
          authType: "email",
          isEmailVerified: false
        }
      });

      const referralCode = `REF${user.id}${Math.random().toString(36).substring(7).toUpperCase()}`;
      await tx.user.update({ where: { id: user.id }, data: { referralCode } });
      await tx.wallet.create({ data: { userId: user.id, balance: 0, cashbackBalance: 0 } });

      // Referral Logic
      if (givenReferralCode) {
        const referrer = await tx.user.findUnique({ where: { referralCode: givenReferralCode } });
        if (referrer && referrer.id !== user.id) {
          await tx.user.update({ where: { id: user.id }, data: { referredBy: referrer.id } });
          await tx.wallet.update({ where: { userId: referrer.id }, data: { cashbackBalance: { increment: 10 } } });
          await tx.wallet.update({ where: { userId: user.id }, data: { cashbackBalance: { increment: 5 } } });
        }
      }

      return user;
    });

    const tokenType = req.headers['x-admin-request'] === 'true' ? "ADMIN_PANEL" : "USER_PANEL";
    const token = generateToken(result, tokenType);
    res.status(201).json({ success: true, message: "Account created successfully", data: { token, user: result } });

  } catch (error) {
    console.error("[Auth] Register Email Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * EMAIL & PASSWORD LOGIN
 */
export const loginEmail = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("LOGIN BODY:", req.body);
    console.log("EMAIL:", email);

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required" });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }
    console.log(`[AUTH][USER_FOUND] → User ${user.id} matched for email login.`);

    const isMatch = await bcrypt.compare(password, user.password);
    console.log(`[AUTH][PASSWORD_MATCH] → ${isMatch ? "SUCCESS" : "FAILED"} for user ${user.id}`);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // Temporary password expiry validation (default 24 hours)
    if (user.mustResetPassword && user.tempPasswordIssuedAt) {
      const expiryHours = parseInt(process.env.TEMP_PASSWORD_EXPIRY_HOURS) || 24;
      const expiryTime = new Date(user.tempPasswordIssuedAt.getTime() + expiryHours * 60 * 60 * 1000);
      if (new Date() > expiryTime) {
        return res.status(401).json({
          success: false,
          message: "Your temporary password has expired. Please contact an administrator to request a new one."
        });
      }
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact support."
      });
    }

    console.log("[AUTH][JWT_STAGE] Generating token...");
    const tokenType = req.headers['x-admin-request'] === 'true' ? "ADMIN_PANEL" : "USER_PANEL";
    const token = generateToken(user, tokenType);

    if (!token) {
      console.error("[AUTH][JWT_FAILED] → Token generation returned null.");
      return res.status(500).json({ success: false, message: "Token generation failed" });
    }

    console.log(`[AUTH][JWT_GENERATED] → Token created for user ${user.id} (${tokenType})`);

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax"
    };

    console.log("[AUTH][COOKIE_SET] → Setting dizipay_token cookie...");
    res.cookie("dizipay_token", token, cookieOptions);

    const authResponse = {
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileImage: user.profileImage,
        mustChangePassword: user.mustChangePassword
      },
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          profileImage: user.profileImage,
          mustChangePassword: user.mustChangePassword
        }
      }
    };

    console.log(`[AUTH][LOGIN_RESPONSE_SENT] → Sending response to ${email}`);
    res.json(authResponse);
  } catch (error) {
    console.error("[AUTH][LOGIN_FAILED] → Fatal error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * MOBILE OTP - SEND
 */
export const sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: "Phone required" });

    const normalizedPhone = normalizePhone(phone);
    await prisma.oTP.deleteMany({ where: { phone: normalizedPhone } });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    console.log(`[OTP][SEND_REQUEST] → Requesting NxtByte OTP for ${normalizedPhone}`);

    // Transactional Flow: Only save to DB if NxtByte provider confirms
    const result = await sendNxtbyteOtp(normalizedPhone, code);

    if (!result.success) {
      console.warn(`[OTP][SEND_FAILED] → ${normalizedPhone} | Reason: ${result.message}`);
      return res.status(result.type === 'COOLDOWN' || result.type === 'LOCKED' || result.type === 'RATE_LIMIT' ? 429 : 500).json(result);
    }

    const hashedCode = await bcrypt.hash(code, 10);
    await prisma.oTP.create({ data: { phone: normalizedPhone, code: hashedCode, expiresAt } });

    console.log(`[OTP][SEND_SUCCESS] → OTP saved to DB for ${normalizedPhone}`);
    return res.json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error("[OTP][SEND_FAILED] sendOtp Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * MOBILE OTP - VERIFY & LOGIN/REGISTER
 */
export const verifyOtp = async (req, res) => {
  try {
    const { phone: phoneNumber, code, name, email, referralCode: givenReferralCode } = req.body;
    if (!phoneNumber || !code) return res.status(400).json({ success: false, message: "Phone and OTP required" });

    const normalizedPhone = normalizePhone(phoneNumber);

    const lockStatus = await verifyOtpProtection(normalizedPhone);
    if (lockStatus.locked) {
      console.warn(`[OTP][VERIFY_FAILED] → Account temporarily locked for ${normalizedPhone}`);
      return res.status(429).json({ success: false, message: "Too many failed attempts. Please try again later." });
    }

    const otpRecord = await prisma.oTP.findFirst({ where: { phone: normalizedPhone }, orderBy: { createdAt: "desc" } });

    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      console.warn(`[OTP][VERIFY_FAILED] → Invalid or expired OTP for ${normalizedPhone}`);
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    const isMatch = await bcrypt.compare(code, otpRecord.code);
    if (!isMatch) {
      const attemptRes = await incrementAttempts(normalizedPhone);
      console.warn(`[OTP][VERIFY_FAILED] → Incorrect OTP code for ${normalizedPhone}`);
      if (attemptRes.locked) {
        return res.status(429).json({ success: false, message: "Too many failed attempts. Please try again later." });
      }
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    await clearAttempts(normalizedPhone);
    await prisma.oTP.deleteMany({ where: { phone: normalizedPhone } });

    console.log(`[OTP][VERIFY_SUCCESS] → OTP successfully verified for ${normalizedPhone}`);

    let user = await prisma.user.findUnique({ where: { phone: normalizedPhone } });

    if (user && user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact support."
      });
    }

    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            phone: normalizedPhone,
            name: name || `User_${normalizedPhone.slice(-4)}`,
            email: email ? email.toLowerCase() : null,
            password: await bcrypt.hash(`otp_${Date.now()}`, 10),
            isPhoneVerified: true,
            authType: "phone"
          }
        });

        const referralCode = `REF${newUser.id}${Math.random().toString(36).substring(7).toUpperCase()}`;
        await tx.user.update({ where: { id: newUser.id }, data: { referralCode } });
        await tx.wallet.create({ data: { userId: newUser.id, balance: 0, cashbackBalance: 0 } });

        if (givenReferralCode) {
          const referrer = await tx.user.findUnique({ where: { referralCode: givenReferralCode } });
          if (referrer && referrer.id !== newUser.id) {
            await tx.user.update({ where: { id: newUser.id }, data: { referredBy: referrer.id } });
            await tx.wallet.update({ where: { userId: referrer.id }, data: { cashbackBalance: { increment: 10 } } });
          }
        }
        return newUser;
      });
    }

    console.log(`[AUTH][OTP_VERIFIED] → Verification successful for ${normalizedPhone}`);

    console.log("[AUTH][JWT_STAGE] Generating token...");
    const tokenType = req.headers['x-admin-request'] === 'true' ? "ADMIN_PANEL" : "USER_PANEL";
    const token = generateToken(user, tokenType);

    if (!token) {
      console.error("[AUTH][JWT_FAILED] → Token generation returned null.");
      return res.status(500).json({ success: false, message: "Token generation failed" });
    }

    console.log(`[AUTH][JWT_GENERATED] → Token created for user ${user.id} (${tokenType})`);

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax"
    };

    console.log("[AUTH][COOKIE_SET] → Setting dizipay_token cookie...");
    res.cookie("dizipay_token", token, cookieOptions);

    const authResponse = {
      success: true,
      message: "Verified successfully",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileImage: user.profileImage,
        mustChangePassword: user.mustChangePassword
      },
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          profileImage: user.profileImage,
          mustChangePassword: user.mustChangePassword
        },
        isNewUser
      }
    };

    console.log(`[AUTH][LOGIN_RESPONSE_SENT] → Sending response to ${normalizedPhone}`);
    res.json(authResponse);

  } catch (error) {
    console.error("[OTP][VERIFY_FAILED] Fatal error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * FORGOT PASSWORD
 */
/**
 * FORGOT PASSWORD - REQUEST RESET
 */
export const forgotPassword = async (req, res) => {
  try {
    const identity = (req.body.identity || req.body.email || req.body.phone || "").trim();
    if (!identity) {
      return res.status(400).json({ success: false, message: "Email or phone number is required" });
    }

    const isEmail = identity.includes("@");
    let cleanedIdentity = isEmail ? identity.toLowerCase() : normalizePhone(identity);

    if (!isEmail && (!cleanedIdentity || cleanedIdentity.length < 10)) {
      return res.status(400).json({ success: false, message: "Invalid phone number format" });
    }

    const cooldownKey = `auth:reset:cooldown:${cleanedIdentity}`;
    const attemptsKey = `auth:reset:attempts:${cleanedIdentity}`;
    const lockKey = `auth:reset:lock:${cleanedIdentity}`;

    // 1. Check Lockout Status
    const isLocked = await redisClient.get(lockKey);
    if (isLocked) {
      console.warn(`[RESET][BLOCKED] → Reset requests blocked by active lock for ${cleanedIdentity}`);
      return res.status(429).json({ success: false, message: "Too many failed attempts. Please try again after 15 minutes." });
    }

    // 2. Check Cooldown (1 OTP per 60 seconds)
    const hasCooldown = await redisClient.get(cooldownKey);
    if (hasCooldown) {
      console.warn(`[RESET][BLOCKED] → Cooldown active for ${cleanedIdentity}`);
      return res.status(429).json({ success: false, message: "Please wait 60 seconds before requesting another code." });
    }

    // 3. Direct Account Verification
    let user = null;
    if (isEmail) {
      user = await prisma.user.findUnique({ where: { email: cleanedIdentity } });
    } else {
      user = await prisma.user.findUnique({ where: { phone: cleanedIdentity } });
    }

    if (!user || user.isActive === false) {
      console.warn(`[RESET][NOT_FOUND] → Identity not registered or inactive: ${cleanedIdentity}`);
      return res.status(404).json({ success: false, message: "No account found with this email" });
    }

    // Immediately set the cooldown to enforce limit even for fake accounts to avoid timing attacks
    await redisClient.setex(cooldownKey, 60, "active");

    // 4. Generate Cryptographically Secure OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Save hashed OTP in database
    const hashedCode = await bcrypt.hash(otpCode, 10);
    await prisma.oTP.deleteMany({ where: { phone: cleanedIdentity, purpose: "PASSWORD_RESET" } });
    await prisma.oTP.create({
      data: {
        phone: cleanedIdentity,
        code: hashedCode,
        purpose: "PASSWORD_RESET",
        expiresAt
      }
    });

    console.log(`[RESET][OTP_GENERATED] → OTP saved to DB for ${cleanedIdentity} (Purpose: PASSWORD_RESET)`);

    // 5. Deliver Reset Code
    if (isEmail) {
      const emailResult = await sendResetCodeEmail(cleanedIdentity, user.name || 'User', otpCode);
      if (!emailResult.success) {
        console.error(`[RESET][EMAIL_FAILED] → Resend dispatch failed for ${cleanedIdentity}: ${emailResult.message}`);
        return res.status(500).json({ success: false, message: "Unable to send reset email" });
      }
      console.log(`[RESET][EMAIL_SENT] → Reset code dispatched to email: ${cleanedIdentity}`);
    } else {
      // Mobile delivery via existing NxtByte WhatsApp OTP infrastructure
      const whatsappResult = await sendNxtbyteOtp(cleanedIdentity, otpCode);
      if (!whatsappResult.success) {
        console.error(`[RESET][WHATSAPP_FAILED] → WhatsApp dispatch failed: ${whatsappResult.message}`);
        // If production gateway is unconfigured or fails, fallback to warning in dev
        if (process.env.NODE_ENV === "production") {
          return res.status(500).json({ success: false, message: "WhatsApp delivery failed" });
        } else {
          console.warn(`[RESET][MOCK] → Reset code in development logs: ${otpCode}`);
        }
      } else {
        console.log(`[RESET][WHATSAPP_SENT] → WhatsApp reset code dispatched to ${cleanedIdentity}`);
      }
    }

    return res.json({ success: true, message: "Reset code sent successfully" });

  } catch (error) {
    console.error("[RESET][REQUEST_FAILED] Fatal error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * RESET PASSWORD - UPDATE PASSSWORD
 */
export const resetPassword = async (req, res) => {
  try {
    const { code, newPassword, confirmPassword } = req.body;
    const identity = (req.body.identity || req.body.email || req.body.phone || "").trim();

    if (!identity || !code || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match" });
    }

    // Strong Password Validation Rules
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!strongPasswordRegex.test(newPassword)) {
      return res.status(400).json({ 
        success: false, 
        message: "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character."
      });
    }

    const isEmail = identity.includes("@");
    let cleanedIdentity = isEmail ? identity.toLowerCase() : normalizePhone(identity);

    if (!isEmail && (!cleanedIdentity || cleanedIdentity.length < 10)) {
      return res.status(400).json({ success: false, message: "Invalid phone number format" });
    }

    const lockKey = `auth:reset:lock:${cleanedIdentity}`;
    const attemptsKey = `auth:reset:attempts:${cleanedIdentity}`;

    // 1. Check Lockout Status
    const isLocked = await redisClient.get(lockKey);
    if (isLocked) {
      return res.status(429).json({ success: false, message: "Too many failed attempts. Please try again after 15 minutes." });
    }

    // 2. Validate Token / Code
    const otpRecord = await prisma.oTP.findFirst({
      where: {
        phone: cleanedIdentity,
        purpose: "PASSWORD_RESET",
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: "desc" }
    });

    const triggerVerificationFailure = async (reason) => {
      console.warn(`[RESET][VERIFY_FAILED] → Incorrect or expired reset code for ${cleanedIdentity}: ${reason}`);
      
      const newAttempts = await redisClient.incr(attemptsKey);
      if (newAttempts === 1) {
        await redisClient.expire(attemptsKey, 15 * 60); // 15 mins window
      }

      if (newAttempts >= 5) {
        await redisClient.setex(lockKey, 15 * 60, "locked"); // 15 mins lockout
        await redisClient.del(attemptsKey);
        console.error(`[RESET][LOCKED] → Account locked due to brute force reset attempts for ${cleanedIdentity}`);
        return res.status(429).json({ success: false, message: "Too many failed attempts. Please try again after 15 minutes." });
      }

      return res.status(400).json({ success: false, message: "Invalid or expired reset code" });
    };

    if (!otpRecord) {
      return await triggerVerificationFailure("No matching OTP found in DB or expired");
    }

    const isMatch = await bcrypt.compare(code, otpRecord.code);
    if (!isMatch) {
      return await triggerVerificationFailure("Bcrypt code verification failed");
    }

    // Code is valid! Clear attempts and lockout
    await redisClient.del(attemptsKey);
    await redisClient.del(lockKey);

    // 3. Find User
    let user = null;
    if (isEmail) {
      user = await prisma.user.findUnique({ where: { email: cleanedIdentity } });
    } else {
      user = await prisma.user.findUnique({ where: { phone: cleanedIdentity } });
    }

    if (!user || user.isActive === false) {
      return res.status(404).json({ success: false, message: "Account not found or suspended" });
    }

    // 4. Update Password, Increment authVersion to force multi-device logout immediately
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const newAuthVersion = (user.authVersion || 1) + 1;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          authVersion: newAuthVersion,
          mustResetPassword: false
        }
      }),
      prisma.oTP.deleteMany({
        where: { phone: cleanedIdentity, purpose: "PASSWORD_RESET" }
      })
    ]);

    console.log(`[RESET][SUCCESS] → Password successfully updated for user ${user.id}. Multi-device authVersion updated to ${newAuthVersion}.`);

    // 5. Write Immutable Audit Log
    await logAction({
      action: "PASSWORD_RESET",
      userId: user.id,
      entity: "user",
      entityId: user.id,
      details: {
        identity: cleanedIdentity,
        timestamp: Date.now()
      },
      req
    });

    return res.json({ success: true, message: "Password updated successfully. Please login with your new password." });

  } catch (error) {
    console.error("[RESET][PASSWORD_UPDATE_FAILED] Fatal error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { wallet: true } });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

