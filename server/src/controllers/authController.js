import prisma from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { 
  sendOtp as sendNxtbyteOtp, 
  normalizePhone, 
  verifyOtpProtection, 
  incrementAttempts, 
  clearAttempts 
} from "../services/otp/nxtbyteOtpService.js";

const generateToken = (user, tokenType = "USER_PANEL") => {
  return jwt.sign(
    { 
      id: user.id, 
      role: user.role,
      tokenType 
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
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return res.json({ success: true, message: "If account exists, reset link sent" });

    // Implementation for real email link goes here
    res.json({ success: true, message: "Reset instructions sent to your email" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
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
