import prisma from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { 
  sendOtpSms, 
  normalizePhone, 
  checkVerificationLock, 
  incrementVerificationAttempts, 
  clearVerificationAttempts 
} from "../services/smsService.js";

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role },
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

    const token = generateToken(result);
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
    console.log("USER FOUND:", user ? "YES" : "NO", user?.id || "");

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    console.log("PASSWORD MATCH:", isMatch);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = generateToken(user);
    res.json({ success: true, message: "Login successful", token, user });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
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
    const hashedCode = await bcrypt.hash(code, 10);

    await prisma.oTP.create({ data: { phone: normalizedPhone, code: hashedCode, expiresAt } });
    const result = await sendOtpSms(normalizedPhone, code);

    if (!result.success) return res.status(429).json(result);
    return res.json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
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
    const otpRecord = await prisma.oTP.findFirst({ where: { phone: normalizedPhone }, orderBy: { createdAt: "desc" } });

    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    const isMatch = await bcrypt.compare(code, otpRecord.code);
    if (!isMatch) {
      await incrementVerificationAttempts(normalizedPhone);
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    await clearVerificationAttempts(normalizedPhone);
    await prisma.oTP.deleteMany({ where: { phone: normalizedPhone } });

    let user = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
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

    const token = generateToken(user);
    res.json({ success: true, message: "Verified successfully", data: { token, user, isNewUser } });
  } catch (error) {
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
