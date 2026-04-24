import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import mongoose from "mongoose";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";

export const signup = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { name, email, password, referralCode: givenReferralCode } = req.body;
    console.log(`[Signup] Starting registration for: ${email}`);
    
    const referralCode = crypto.randomBytes(4).toString("hex").toUpperCase();
    
    let initialWalletBalance = 0;

    // 1. Hash password
    const hash = await bcrypt.hash(password, 10);

    // 2. Create user inside transaction
    const [user] = await User.create([{
      name,
      email,
      password: hash,
      referralCode,
      referredBy: null,
    }], { session });

    console.log(`[Signup] User created: ${user._id}`);

    // 3. Handle Referral Logic
    if (givenReferralCode) {
      const referrer = await User.findOne({ referralCode: givenReferralCode }).session(session);
      
      if (referrer) {
        console.log(`[Signup] Valid referral found: ${givenReferralCode} (Referrer: ${referrer._id})`);
        
        // Update new user's referredBy
        user.referredBy = referrer._id;
        await user.save({ session });

        // Update Referrer Wallet atomically
        await Wallet.findOneAndUpdate(
          { userId: referrer._id },
          { $inc: { balance: 100 } },
          { upsert: true, session, new: true }
        );
        
        // Update Referrer Earnings
        await User.findByIdAndUpdate(
          referrer._id,
          { $inc: { referralEarnings: 100 } },
          { session }
        );

        // New user bonus
        initialWalletBalance = 50;
      }
    }

    // 4. Create Wallet for new user using findOneAndUpdate + upsert
    const wallet = await Wallet.findOneAndUpdate(
      { userId: user._id },
      { $set: { balance: initialWalletBalance } },
      { upsert: true, session, new: true }
    );

    console.log(`[Signup] Wallet created/updated for user: ${user._id}, balance: ${wallet.balance}`);

    // 5. Commit Transaction
    await session.commitTransaction();
    console.log(`[Signup] Transaction committed for user: ${user._id}`);

    // 6. Generate JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "7d" }
    );

    console.log(`[Signup] Registration successful, sending response for: ${user._id}`);

    // 7. Success Response
    return res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role 
      }
    });

  } catch (err) {
    // Abort Transaction on error
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("[Signup Error] Transaction aborted:", err);
    
    return res.status(500).json({ 
      success: false, 
      message: "Registration failed" 
    });
  } finally {
    session.endSession();
  }
};

export const login = async (req, res) => {
  try {
    console.log("[Auth] Login attempt body:", req.body);
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    // 2. Normal Login Flow (Handles both users and admins from DB)
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ success: false, message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ success: false, message: "Invalid credentials" });

    console.log(`[Auth] ${user.role} Login: ${email}`);

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "7d" }
    );

    res.json({ 
      success: true, 
      message: `${user.role === 'admin' ? 'Admin' : 'User'} login successful`, 
      data: { 
        token,
        user: {
          id: user._id,
          email: user.email,
          role: user.role
        }
      } 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};