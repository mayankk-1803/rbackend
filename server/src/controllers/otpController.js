import prisma from "../config/prisma.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { 
  sendOtp as sendNxtbyteOtp, 
  normalizePhone, 
  verifyOtpProtection, 
  incrementAttempts, 
  clearAttempts 
} from "../services/otp/nxtbyteOtpService.js";

export const sendOTP = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: "Phone required" });

    const normalizedPhone = normalizePhone(phone);

    // 1. Delete previous OTPs for this phone to prevent bloat
    await prisma.oTP.deleteMany({ where: { phone: normalizedPhone } });

    // 2. Generate 6 digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryMin = parseInt(process.env.OTP_EXPIRY_MINUTES) || 5;
    const expiresAt = new Date(Date.now() + expiryMin * 60 * 1000);

    console.log(`[OTP][SEND_REQUEST] → Requesting NxtByte OTP for ${normalizedPhone}`);

    // 3. Call NxtByte Service FIRST (Transactional Flow)
    // We only save the OTP to DB if the provider accepts the request
    const result = await sendNxtbyteOtp(normalizedPhone, code);

    if (!result.success) {
      console.warn(`[OTP][SEND_FAILED] → ${normalizedPhone} | Reason: ${result.message}`);
      return res.status(result.type === 'COOLDOWN' || result.type === 'LOCKED' || result.type === 'RATE_LIMIT' ? 429 : 500).json(result);
    }

    // 4. Persistence - Save hashed OTP to DB only after provider success
    const hashedCode = await bcrypt.hash(code, 10);
    await prisma.oTP.create({
      data: { phone: normalizedPhone, code: hashedCode, expiresAt }
    });

    console.log(`[OTP][SEND_SUCCESS] → OTP saved to DB for ${normalizedPhone}`);
    res.json({ success: true, message: "OTP sent successfully" });
  } catch (err) {
    console.error("[OTP][SEND_FAILED] OTP Send Error:", err);
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
};

export const verifyOTP = async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ success: false, message: "Phone and code required" });

    const normalizedPhone = normalizePhone(phone);

    // 1. Check for lock
    const lockStatus = await verifyOtpProtection(normalizedPhone);
    if (lockStatus.locked) {
      console.warn(`[OTP][VERIFY_FAILED] → Account temporarily locked for ${normalizedPhone}`);
      return res.status(429).json({ success: false, message: "Too many failed attempts. Please try again later." });
    }

    // 2. Get latest OTP from DB
    const otpRecord = await prisma.oTP.findFirst({
      where: { phone: normalizedPhone },
      orderBy: { createdAt: "desc" }
    });

    // 3. Validate Expiry BEFORE bcrypt comparison
    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      console.warn(`[OTP][VERIFY_FAILED] → Invalid or expired OTP for ${normalizedPhone}`);
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    // 4. Secure comparison
    const isMatch = await bcrypt.compare(code, otpRecord.code);
    
    if (!isMatch) {
      // Increment failed attempts ONLY after failed comparison
      const result = await incrementAttempts(normalizedPhone);
      const remaining = (parseInt(process.env.OTP_MAX_ATTEMPTS) || 5) - result.attempts;
      
      console.warn(`[OTP][VERIFY_FAILED] → Incorrect OTP code for ${normalizedPhone}`);

      if (result.locked) {
        return res.status(429).json({ success: false, message: "Too many failed attempts. Please try again later." });
      }

      return res.status(400).json({ 
        success: false, 
        message: `Invalid OTP. ${remaining} attempts remaining.` 
      });
    }

    // 5. SUCCESS - Clear attempts and delete OTP
    await clearAttempts(normalizedPhone);
    await prisma.oTP.deleteMany({ where: { phone: normalizedPhone } });
    console.log(`[OTP][VERIFY_SUCCESS] SUCCESS → ${normalizedPhone.substring(0, 2)}******${normalizedPhone.slice(-4)}`);

    // 6. User logic
    let user = await prisma.user.findUnique({ where: { phone: normalizedPhone } });

    if (!user) {
      user = await prisma.$transaction(async (tx) => {
        const fallbackEmail = `user_${Date.now()}@otp.com`;
        const fallbackPassword = await bcrypt.hash("dummy_otp_password", 10);
        
        const newUser = await tx.user.create({
          data: {
            phone: normalizedPhone,
            email: fallbackEmail,
            password: fallbackPassword,
            isPhoneVerified: true,
            role: "user"
          }
        });

        const myReferralCode = "REF" + newUser.id;
        await tx.user.update({
          where: { id: newUser.id },
          data: { referralCode: myReferralCode }
        });

        await tx.wallet.create({
          data: { userId: newUser.id, balance: 0, cashbackBalance: 0 }
        });

        return tx.user.findUnique({ where: { id: newUser.id } });
      });
    }

    console.log(`[AUTH][OTP_VERIFY_SUCCESS] → Code matched for ${normalizedPhone}`);

    console.log("[AUTH][JWT_STAGE] Generating token...");
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "7d" }
    );

    if (!token) {
      console.error("[AUTH][JWT_FAILED] → Token generation returned null.");
      return res.status(500).json({ success: false, message: "Token generation failed" });
    }

    console.log(`[AUTH][JWT_GENERATED] → Token created for user ${user.id}`);

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    };

    console.log("[AUTH][COOKIE_SET] → Setting dizipay_token cookie...");
    res.cookie("dizipay_token", token, cookieOptions);

    const authResponse = {
      success: true,
      message: "OTP verified",
      token,
      user: { 
        id: user.id, 
        phone: user.phone,
        role: user.role,
        name: user.name,
        email: user.email
      },
      data: {
        token,
        user: { 
          id: user.id, 
          phone: user.phone,
          role: user.role,
          name: user.name,
          email: user.email
        }
      }
    };

    console.log(`[AUTH][LOGIN_RESPONSE_SENT] → Sending response to ${normalizedPhone}`);
    res.json(authResponse);
  } catch (err) {
    console.error("[OTP][VERIFY_FAILED] Fatal error:", err);
    res.status(500).json({ success: false, message: "Verification failed" });
  }
};
