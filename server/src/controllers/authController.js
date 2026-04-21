import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";

export const signup = async (req, res) => {
  try {
    const { email, password, referralCode: givenReferralCode } = req.body;
    const referralCode = crypto.randomBytes(4).toString("hex").toUpperCase();
    
    let referredBy = null;
    if (givenReferralCode) {
      const referrer = await User.findOne({ referralCode: givenReferralCode });
      if (referrer) {
        referredBy = referrer._id;
        await User.findByIdAndUpdate(referrer._id, {
          $inc: { referralEarnings: 10 }
        });
      }
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      password: hash,
      referralCode,
      referredBy
    });

    res.json({
      success: true,
      message: "Signup successful",
      data: { id: user._id, email: user.email, referralCode: user.referralCode }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(400).json({ success: false, message: "Invalid credentials" });

    const ok = await bcrypt.compare(req.body.password, user.password);
    if (!ok) return res.status(400).json({ success: false, message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "7d" }
    );

    res.json({ success: true, message: "Login successful", data: { token } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};