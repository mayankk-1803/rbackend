import express from "express";
import { auth } from "../middlewares/auth.js";
import { isAdmin } from "../middlewares/admin.js";

const router = express.Router();

// Apply auth and isAdmin to all endpoints
router.use(auth, isAdmin);

// GET API Settings
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "API settings loaded successfully",
    data: {
      role: req.user?.role || "ADMIN",
      email: req.user?.email || ""
    }
  });
});

// POST API Settings
router.post("/", (req, res) => {
  res.json({
    success: true,
    message: "API settings updated successfully"
  });
});

export default router;
