import prisma from "../config/prisma.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the API Manifest dynamically
 */
export const getApiManifest = async (req, res) => {
  try {
    // Robust path resolution regardless of process.cwd()
    const manifestPath = path.join(__dirname, '..', 'config', 'apiManifest.json');
    const manifestData = await fs.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestData);

    res.json({
      success: true,
      payload: manifest
    });
  } catch (err) {
    console.error("[Manifest Error]:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to load API manifest",
      payload: { endpoints: [] } // Fallback to prevent frontend crash
    });
  }
};

/**
 * Generate a new set of API credentials for a user
 */
export const generateKeys = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user already has keys (limit to 2 for enterprise)
    const existingKeys = await prisma.apiKey.count({ where: { userId } });
    if (existingKeys >= 2) {
      return res.status(400).json({ success: false, message: "Maximum API keys reached" });
    }

    const clientId = `dp_${crypto.randomBytes(8).toString('hex')}`;
    const apiKey = `ak_${crypto.randomBytes(16).toString('hex')}`;
    const apiSecret = `as_${crypto.randomBytes(32).toString('hex')}`;
    const webhookSecret = `wh_${crypto.randomBytes(16).toString('hex')}`;

    const newKey = await prisma.apiKey.create({
      data: {
        userId,
        clientId,
        apiKey,
        apiSecret,
        webhookSecret,
        isActive: true
      }
    });

    res.json({
      success: true,
      message: "API keys generated successfully",
      data: {
        clientId: newKey.clientId,
        apiKey: newKey.apiKey,
        apiSecret: newKey.apiSecret,
        webhookSecret: newKey.webhookSecret
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Rotate API Secret or Webhook Secret
 */
export const rotateSecret = async (req, res) => {
  try {
    const { clientId, type } = req.body; 
    const userId = req.user.id;

    const key = await prisma.apiKey.findFirst({
      where: { clientId, userId }
    });

    if (!key) return res.status(404).json({ success: false, message: "Key not found" });

    const newValue = type === 'apiSecret' 
      ? `as_${crypto.randomBytes(32).toString('hex')}`
      : `wh_${crypto.randomBytes(16).toString('hex')}`;

    const updatedKey = await prisma.apiKey.update({
      where: { id: key.id },
      data: { [type]: newValue }
    });

    res.json({
      success: true,
      message: `${type} rotated successfully`,
      data: { [type]: updatedKey[type] }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Toggle API Key Status
 */
export const toggleKeyStatus = async (req, res) => {
  try {
    const { clientId } = req.params;
    const userId = req.user.id;

    const key = await prisma.apiKey.findFirst({
      where: { clientId, userId }
    });

    if (!key) return res.status(404).json({ success: false, message: "Key not found" });

    const updatedKey = await prisma.apiKey.update({
      where: { id: key.id },
      data: { isActive: !key.isActive }
    });

    res.json({
      success: true,
      message: `Key ${updatedKey.isActive ? 'activated' : 'deactivated'}`,
      data: { isActive: updatedKey.isActive }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get API Keys for current user
 */
export const getKeys = async (req, res) => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { userId: req.user.id },
      select: {
        clientId: true,
        apiKey: true,
        apiSecret: true, // Included so the Tester can pre-fill
        webhookSecret: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true
      }
    });

    res.json({ success: true, data: keys });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get Developer Analytics
 */
export const getAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;

    const totalRequests = await prisma.apiLog.count({ where: { userId } });
    const successRate = await prisma.apiLog.count({ 
      where: { userId, statusCode: { lt: 400 } } 
    });
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activity = await prisma.apiLog.groupBy({
      by: ['createdAt'],
      where: { 
        userId,
        createdAt: { gte: sevenDaysAgo }
      },
      _count: { id: true },
      _avg: { latency: true }
    });

    res.json({
      success: true,
      data: {
        totalRequests,
        successRate: totalRequests > 0 ? (successRate / totalRequests) * 100 : 100,
        activity
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get Recent API Logs
 */
export const getLogs = async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const logs = await prisma.apiLog.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit)
    });

    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Verify Developer Access credentials
 */
export const verifyDevAccess = async (req, res) => {
  try {
    const { email, password } = req.body;
    const userId = Number(req.user.id);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    let isMatch = false;

    // 1. Check environment-configured developer credentials
    const envEmail = process.env.DEV_PORTAL_EMAIL || "developer@dizipay.in";
    const envHash = process.env.DEV_PORTAL_PASSWORD_HASH;

    if (email.toLowerCase() === envEmail.toLowerCase() && envHash) {
      isMatch = await bcrypt.compare(password, envHash);
    }

    // 2. Fallback to existing authenticated user's credentials
    if (!isMatch) {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });
      if (user && user.email && user.email.toLowerCase() === email.toLowerCase()) {
        isMatch = await bcrypt.compare(password, user.password);
      }
    }

    if (!isMatch) {
      return res.status(455).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Pick first active key if it exists, to associate with this developer session
    const matchedKey = await prisma.apiKey.findFirst({
      where: { userId, isActive: true }
    });

    const devToken = jwt.sign(
      {
        userId,
        clientId: matchedKey ? matchedKey.clientId : "dummy_client",
        apiKeyId: matchedKey ? matchedKey.id : null,
        sessionType: "DEVELOPER"
      },
      process.env.DEVELOPER_JWT_SECRET || process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "15m" }
    );

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 15 * 60 * 1000 // 15 mins
    };
    res.cookie("dizipay_developer_token", devToken, cookieOptions);

    res.json({
      success: true,
      message: "Developer access verified",
      devToken
    });
  } catch (err) {
    console.error("[DEV_VERIFY_ERR]", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Revoke Developer Access session
 */
export const revokeDevAccess = async (req, res) => {
  try {
    res.clearCookie("dizipay_developer_token");
    res.json({
      success: true,
      message: "Developer session cleared"
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
