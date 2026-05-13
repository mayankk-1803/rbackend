import prisma from "../config/prisma.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { 
  sendOtpSms, 
  normalizePhone, 
  checkVerificationLock, 
  incrementVerificationAttempts, 
  clearVerificationAttempts 
} from "../services/smsService.js";

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

    // 3. Hash OTP before storage
    const hashedCode = await bcrypt.hash(code, 10);

    await prisma.oTP.create({
      data: { phone: normalizedPhone, code: hashedCode, expiresAt }
    });

    // 4. Send via Service (Handles cooldown and gateway)
    const result = await sendOtpSms(normalizedPhone, code);

    if (!result.success) {
      return res.status(result.type === 'COOLDOWN' || result.type === 'LOCKED' ? 429 : 500).json(result);
    }

    res.json({ success: true, message: "OTP sent successfully" });
  } catch (err) {
    console.error("OTP Send Error:", err);
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
};

export const verifyOTP = async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ success: false, message: "Phone and code required" });

    const normalizedPhone = normalizePhone(phone);

    // 1. Check for lock
    const lockStatus = await checkVerificationLock(normalizedPhone);
    if (lockStatus.locked) {
      return res.status(429).json({ success: false, message: "Too many failed attempts. Please try again later." });
    }

    // 2. Get latest OTP from DB
    const otpRecord = await prisma.oTP.findFirst({
      where: { phone: normalizedPhone },
      orderBy: { createdAt: "desc" }
    });

    // 3. Validate Expiry BEFORE bcrypt comparison
    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    // 4. Secure comparison
    const isMatch = await bcrypt.compare(code, otpRecord.code);
    
    if (!isMatch) {
      // Increment failed attempts ONLY after failed comparison
      const result = await incrementVerificationAttempts(normalizedPhone);
      const remaining = (parseInt(process.env.OTP_MAX_ATTEMPTS) || 5) - result.attempts;
      
      if (result.locked) {
        return res.status(429).json({ success: false, message: "Too many failed attempts. Please try again later." });
      }

      return res.status(400).json({ 
        success: false, 
        message: `Invalid OTP. ${remaining} attempts remaining.` 
      });
    }

    // 5. SUCCESS - Clear attempts and delete OTP
    await clearVerificationAttempts(normalizedPhone);
    await prisma.oTP.deleteMany({ where: { phone: normalizedPhone } });
    console.log(`[OTP_VERIFY] SUCCESS → ${normalizedPhone.substring(0, 2)}******${normalizedPhone.slice(-4)}`);

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

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "OTP verified",
      token,
      user: { id: user.id, phone: user.phone }
    });
  } catch (err) {
    console.error("OTP Verify Error:", err);
    res.status(500).json({ success: false, message: "Verification failed" });
  }
};
