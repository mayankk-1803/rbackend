import express from "express";
import { 
  registerEmail, 
  loginEmail, 
  sendOtp, 
  verifyOtp, 
  forgotPassword, 
  getMe 
} from "../controllers/authController.js";
import { auth } from "../middlewares/auth.js";

const router = express.Router();

// Phone OTP Flow
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);

// Email Password Flow
router.post("/register-email", registerEmail);

// ADD THIS
router.post("/login", loginEmail);

// KEEP THIS FOR BACKWARD COMPATIBILITY
router.post("/login-email", loginEmail);

router.post("/forgot-password", forgotPassword);

// Profile
router.get("/me", auth, getMe);

export default router;