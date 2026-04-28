import prisma from "../config/prisma.js";

export const sendOTP = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: "Phone required" });

    // Generate 6 digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await prisma.oTP.create({
      data: { phone, code, expiresAt }
    });

    console.log(`[OTP] Sent ${code} to ${phone}`); // Mock SMS
    res.json({ success: true, message: "OTP sent successfully" });
  } catch (err) {
    console.error("OTP Send Error:", err);
    res.status(500).json({ success: false, message: "Failed to send OTP", error: err.message });
  }
};

export const verifyOTP = async (req, res) => {
  try {
    const { phone, code } = req.body;
    const otp = await prisma.oTP.findFirst({
      where: { phone, code },
      orderBy: { createdAt: "desc" }
    });

    if (!otp || otp.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    res.json({ success: true, message: "OTP verified" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Verification failed" });
  }
};
