import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import axios from "axios";
import prisma from "../config/prisma.js";
import { Prisma } from "@prisma/client";

export const signup = async (req, res) => {
  try {
    const { name, email, password, phone, otpCode, referralCode: givenReferralCode } = req.body;
    
    // 1. Verify OTP
    const otp = await prisma.oTP.findFirst({
      where: { phone, code: otpCode },
      orderBy: { createdAt: "desc" }
    });

    if (!otp || otp.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    const hash = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      // 2. Create user (temp code for referral, will update later)
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hash,
          phone,
          isPhoneVerified: true,
          role: "user"
        }
      });

      // 3. Generate and Update Referral Code
      const myReferralCode = "REF" + user.id;
      await tx.user.update({
        where: { id: user.id },
        data: { referralCode: myReferralCode }
      });

      // 4. Create Wallet
      const wallet = await tx.wallet.create({
        data: { userId: user.id, balance: 0, cashbackBalance: 0 }
      });

      // 5. Handle Referral Logic
      if (givenReferralCode) {
        const referrer = await tx.user.findUnique({
          where: { referralCode: givenReferralCode }
        });

        if (referrer) {
          // Update New User Wallet (Cashback ₹5)
          await tx.wallet.update({
            where: { userId: user.id },
            data: { cashbackBalance: { increment: 5 } }
          });

          // Update Referrer Wallet (Cashback ₹10)
          await tx.wallet.update({
            where: { userId: referrer.id },
            data: { cashbackBalance: { increment: 10 } }
          });

          // Link referral
          await tx.user.update({
            where: { id: user.id },
            data: { referredBy: referrer.id }
          });
        }
      }

      return { user: { ...user, referralCode: myReferralCode }, wallet };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });

    const token = jwt.sign(
      { id: result.user.id, role: result.user.role },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: result.user
    });

  } catch (err) {
    console.error(`[Signup] Error: ${err.message}`);
    if (err.code === "P2002") {
      return res.status(400).json({ success: false, message: "Email or phone already exists" });
    }
    return res.status(500).json({ success: false, message: "Registration failed" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    // Role safety check for admin route if needed, but handled here for general login
    // If the request is specifically for admin login, check role:
    const isAdminLogin = req.headers['x-admin-request'] === 'true';
    if (isAdminLogin && user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not admin" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ success: false, message: "Login failed" });
  }
};

// Auth Helpers

export const sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: "Phone required" });

    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES) || 10;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    console.log(`[OTP] Generating for ${phone}: ${code}`);

    // Save to DB first so user can at least use it if SMS is delayed
    await prisma.oTP.create({ 
      data: { 
        phone: phone.toString(), 
        code: code.toString(), 
        expiresAt 
      } 
    });

    // Extract digits and ensure country code for WhatsApp (NxtByte)
    let nxtBytePhone = phone.replace(/\D/g, '');
    if (nxtBytePhone.length === 10) {
      nxtBytePhone = '91' + nxtBytePhone;
    }
    
    // Check for API credentials
    const apiKey = process.env.NXTBYTE_API_KEY;
    const baseUrl = process.env.NXTBYTE_BASE_URL;

    if (!apiKey || !baseUrl) {
      console.warn("[OTP] SMS Gateway credentials missing. Using mock mode.");
      return res.json({ 
        success: true, 
        message: "OTP generated (Mock Mode)", 
        code: process.env.NODE_ENV === 'development' ? code : undefined 
      });
    }

    const url = `${baseUrl}?api_key=${apiKey}&number=${nxtBytePhone}&msg=Your+OTP+is+${code}+for+Dizipay.`;
    
    console.log(`[OTP] Sending via NxtByte to ${nxtBytePhone}...`);
    
    try {
      const response = await axios.get(url, { timeout: 8000 });
      console.log("[OTP] Gateway Response:", response.data);
      
      // Handle NxtByte specific error patterns
      if (response.data && typeof response.data === 'string') {
        if (response.data.includes('400') || response.data.includes('error') || response.data.includes('Invalid')) {
          throw new Error(`Gateway Error: ${response.data}`);
        }
      }

      return res.json({ success: true, message: "OTP sent successfully" });
    } catch (apiErr) {
      console.error("[OTP] Gateway Failure:", apiErr.message);
      
      // In development, we can still succeed even if SMS fails
      if (process.env.NODE_ENV !== 'production') {
        return res.json({ 
          success: true, 
          message: "OTP generated (Gateway Error, proceed with mock)", 
          code: code 
        });
      }

      return res.status(500).json({ 
        success: false, 
        message: "SMS Gateway Error", 
        error: apiErr.message 
      });
    }

  } catch (error) {
    console.error("[OTP] Critical Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error while processing OTP", 
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { otpCode, referralCode: givenReferralCode, name, email, phone: phoneNumber } = req.body;

    if (!otpCode || !phoneNumber) {
      return res.status(400).json({ success: false, message: "Phone and OTP required" });
    }

    // 1. Verify NxtByte OTP
    const otp = await prisma.oTP.findFirst({
      where: { phone: phoneNumber, code: otpCode },
      orderBy: { createdAt: "desc" }
    });

    if (!otp || otp.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    // 2. Check DB
    let user = await prisma.user.findUnique({
      where: { phone: phoneNumber }
    });

    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await prisma.$transaction(async (tx) => {
        // Generate safe fallback values
        const fallbackEmail = email || `user_${Date.now()}@otp.com`;
        const fallbackPassword = await bcrypt.hash("nxtbyte_auth_user", 10);

        // Create User
        const newUser = await tx.user.create({
          data: {
            phone: phoneNumber,
            email: fallbackEmail,
            name: name || null,
            password: fallbackPassword,
            isPhoneVerified: true,
            role: "user"
          }
        });

        // Generate Referral Code
        const myReferralCode = "REF" + newUser.id;
        const updatedUser = await tx.user.update({
          where: { id: newUser.id },
          data: { referralCode: myReferralCode }
        });

        // Create Wallet
        await tx.wallet.create({
          data: { userId: newUser.id, balance: 0, cashbackBalance: 0 }
        });

        // 3. Referral Logic (Instant Reward + Link)
        if (givenReferralCode) {
          const referrer = await tx.user.findUnique({
            where: { referralCode: givenReferralCode }
          });

          if (referrer && referrer.id !== newUser.id) {
            // Link users
            await tx.user.update({
              where: { id: newUser.id },
              data: { referredBy: referrer.id }
            });

            // Provide a small instant reward (e.g., ₹5) to the Referrer
            await tx.wallet.update({
              where: { userId: referrer.id },
              data: { cashbackBalance: { increment: 5 } }
            });
            await tx.transaction.create({
              data: {
                userId: referrer.id,
                amount: 5,
                type: "REFERRAL",
                status: "SUCCESS",
                direction: "CREDIT"
              }
            });

            // Provide a small instant reward (e.g., ₹5) to the New User
            await tx.wallet.update({
              where: { userId: newUser.id },
              data: { cashbackBalance: { increment: 5 } }
            });
            await tx.transaction.create({
              data: {
                userId: newUser.id,
                amount: 5,
                type: "REFERRAL",
                status: "SUCCESS",
                direction: "CREDIT"
              }
            });
          }
        }

        return updatedUser;
      });
    }

    // 4. Generate JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role, id: user.id },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "7d" }
    );

    // 5. Return token and user
    return res.json({
      success: true,
      token,
      user,
      isNewUser
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    return res.status(500).json({ success: false, message: "Authentication failed", error: error.message });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { wallet: true }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
