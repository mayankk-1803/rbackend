import prisma from "../config/prisma.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { logAudit } from "../utils/auditLogger.js";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the API Manifest dynamically
 */
export const getApiManifest = async (req, res) => {
  try {
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
      payload: { endpoints: [] }
    });
  }
};

/**
 * Generate a new set of API credentials for a user (LEGACY)
 */
export const generateKeys = async (req, res) => {
  try {
    const userId = req.user.id;

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
 * Rotate API Secret or Webhook Secret (LEGACY)
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
 * Toggle API Key Status (LEGACY)
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
 * Get API Keys for current user (LEGACY)
 */
export const getKeys = async (req, res) => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { userId: req.user.id },
      select: {
        clientId: true,
        apiKey: true,
        apiSecret: true,
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
 * Get Developer Analytics (LEGACY)
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
 * Get Developer Analytics for Admin (GLOBAL)
 */
export const getAdminDeveloperAnalytics = async (req, res) => {
  try {
    const totalRequests = await prisma.apiLog.count();
    const successRate = await prisma.apiLog.count({ 
      where: { statusCode: { lt: 400 } } 
    });
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activity = await prisma.apiLog.groupBy({
      by: ['createdAt'],
      where: { 
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
 * Get Recent API Logs (LEGACY)
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

    const envEmail = process.env.DEV_PORTAL_EMAIL || "developer@dizipay.in";
    const envHash = process.env.DEV_PORTAL_PASSWORD_HASH;

    if (email.toLowerCase() === envEmail.toLowerCase() && envHash) {
      isMatch = await bcrypt.compare(password, envHash);
    }

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
      maxAge: 15 * 60 * 1000
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

// =========================================================================
// NEW APIACCESS & FINTECH DEVELOPER PORTAL METHODS
// =========================================================================

/**
 * GET ApiAccess details for dashboard
 */
export const getApiAccess = async (req, res) => {
  try {
    const access = await prisma.apiAccess.findFirst({
      where: { userId: req.user.id }
    });
    
    res.json({ success: true, data: access });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Generate new ApiAccess keypair
 */
export const generateApiAccess = async (req, res) => {
  try {
    const userId = req.user.id;
    const existing = await prisma.apiAccess.findFirst({ where: { userId } });
    if (existing) {
      return res.status(400).json({ success: false, message: "API credentials already exist. Use rotation to generate a new secret." });
    }

    const apiKey = `ak_live_${crypto.randomBytes(16).toString('hex')}`;
    const apiSecret = `sec_live_${crypto.randomBytes(32).toString('hex')}`;
    const salt = await bcrypt.genSalt(10);
    const apiSecretHash = await bcrypt.hash(apiSecret, salt);

    const newAccess = await prisma.apiAccess.create({
      data: {
        userId,
        apiKey,
        apiSecretHash,
        isActive: req.user.role === "API_USER" || req.user.role === "ADMIN" || req.user.role === "SUPER_ADMIN" ? true : false,
        environment: "PRODUCTION"
      }
    });

    await logAudit({
      action: "API_ACCESS_KEYS_GENERATED",
      userId,
      entity: "ApiAccess",
      entityId: 0,
      details: { apiKey }
    });

    res.json({
      success: true,
      message: "API Access credentials generated",
      data: {
        id: newAccess.id,
        apiKey: newAccess.apiKey,
        apiSecret: apiSecret,
        webhookUrl: newAccess.webhookUrl,
        isActive: newAccess.isActive,
        environment: newAccess.environment
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Rotate ApiAccess apiSecret
 */
export const rotateApiAccessSecret = async (req, res) => {
  try {
    const userId = req.user.id;
    const access = await prisma.apiAccess.findFirst({ where: { userId } });
    if (!access) return res.status(404).json({ success: false, message: "API credentials not found" });

    const newSecret = `sec_live_${crypto.randomBytes(32).toString('hex')}`;
    const salt = await bcrypt.genSalt(10);
    const apiSecretHash = await bcrypt.hash(newSecret, salt);

    await prisma.apiAccess.update({
      where: { id: access.id },
      data: { apiSecretHash }
    });

    await logAudit({
      action: "API_ACCESS_SECRET_ROTATED",
      userId,
      entity: "ApiAccess",
      entityId: 0
    });

    res.json({
      success: true,
      message: "Secret rotated successfully",
      apiSecret: newSecret
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Update Webhook Settings
 */
export const updateWebhookSettings = async (req, res) => {
  try {
    const { webhookUrl } = req.body;
    const userId = req.user.id;

    const access = await prisma.apiAccess.findFirst({ where: { userId } });
    if (!access) return res.status(404).json({ success: false, message: "API credentials not found" });

    const updated = await prisma.apiAccess.update({
      where: { id: access.id },
      data: { webhookUrl }
    });

    await logAudit({
      action: "WEBHOOK_URL_UPDATED",
      userId,
      entity: "ApiAccess",
      entityId: 0,
      details: { webhookUrl }
    });

    res.json({ success: true, message: "Webhook settings updated", data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Toggle ApiAccess active state
 */
export const toggleApiAccess = async (req, res) => {
  try {
    const userId = req.user.id;
    const access = await prisma.apiAccess.findFirst({ where: { userId } });
    if (!access) return res.status(404).json({ success: false, message: "API credentials not found" });

    const updated = await prisma.apiAccess.update({
      where: { id: access.id },
      data: { isActive: !access.isActive }
    });

    await logAudit({
      action: "API_ACCESS_TOGGLED",
      userId,
      entity: "ApiAccess",
      entityId: 0,
      details: { isActive: updated.isActive }
    });

    res.json({ success: true, message: `API Access status toggled to ${updated.isActive ? 'Active' : 'Inactive'}`, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Toggle Sandbox Environment Mode
 */
export const updateEnvironment = async (req, res) => {
  try {
    const { environment } = req.body;
    if (!["PRODUCTION", "SANDBOX"].includes(environment)) {
      return res.status(400).json({ success: false, message: "Invalid environment" });
    }

    const userId = req.user.id;
    const access = await prisma.apiAccess.findFirst({ where: { userId } });
    if (!access) return res.status(404).json({ success: false, message: "API credentials not found" });

    const updated = await prisma.apiAccess.update({
      where: { id: access.id },
      data: { environment }
    });

    await logAudit({
      action: "ENVIRONMENT_TOGGLED",
      userId,
      entity: "ApiAccess",
      entityId: 0,
      details: { environment }
    });

    res.json({ success: true, message: `Environment switched to ${environment}`, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get Webhook Delivery logs
 */
export const getWebhookEvents = async (req, res) => {
  try {
    const userId = req.user.id;
    const access = await prisma.apiAccess.findFirst({ where: { userId } });
    if (!access) return res.json({ success: true, data: [] });

    const events = await prisma.webhookEvent.findMany({
      where: { apiAccessId: access.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json({ success: true, data: events });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Replay Webhook Event
 */
export const replayWebhookEvent = async (req, res) => {
  try {
    const { eventId } = req.body;
    const event = await prisma.webhookEvent.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });

    const access = await prisma.apiAccess.findUnique({ where: { id: event.apiAccessId } });
    if (!access || !access.webhookUrl) return res.status(400).json({ success: false, message: "No active webhook URL registered" });

    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { retryCount: { increment: 1 } }
    });

    axios.post(access.webhookUrl, event.payload, {
      headers: {
        "Content-Type": "application/json",
        "x-webhook-signature": "sandbox_signature_replay"
      }
    }).then(response => {
      prisma.webhookEvent.update({
        where: { id: event.id },
        data: { deliveryStatus: "SUCCESS", responseCode: response.status }
      }).catch(() => {});
    }).catch(err => {
      prisma.webhookEvent.update({
        where: { id: event.id },
        data: { deliveryStatus: "FAILED", responseCode: err.response?.status || 500 }
      }).catch(() => {});
    });

    res.json({ success: true, message: "Webhook replay event queued" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

import eventBus from "../config/eventBus.js";

/**
 * Submit Upgrade Request to API Partner
 */
export const requestApiAccess = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Serializable/transactional check for existing pending or approved requests
    const existingRequest = await prisma.apiAccessRequest.findFirst({
      where: { 
        userId,
        status: { in: ["PENDING", "APPROVED"] }
      }
    });

    if (existingRequest) {
      return res.status(400).json({ 
        success: false, 
        message: "An active or pending API Access request already exists" 
      });
    }

    const { reason, businessName } = req.body;

    const sanitizeText = (value, max = 500) =>
      typeof value === "string"
        ? value
            .replace(/<[^>]*>?/gm, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, max)
        : null;

    const normalizedReason = sanitizeText(reason, 500);
    const normalizedBusinessName = sanitizeText(businessName, 120);

    if (!normalizedReason || normalizedReason.length < 10) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid API access reason."
      });
    }

    const finalReason = normalizedBusinessName
      ? `[Business: ${normalizedBusinessName}] ${normalizedReason}`.slice(0, 500)
      : normalizedReason;

    const newRequest = await prisma.apiAccessRequest.create({
      data: {
        userId,
        status: "PENDING",
        reason: finalReason
      }
    });

    await logAudit({
      action: "API_ACCESS_UPGRADE_REQUESTED",
      userId,
      entity: "ApiAccessRequest",
      entityId: Number(newRequest.id) || 0
    });

    // Emit event bus notification for Socket.io update propagation
    eventBus.emit("api_access_updated", {
      userId,
      status: "PENDING"
    });

    res.json({ 
      success: true, 
      message: "API upgrade request submitted to admin for approval" 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Check Upgrade Request Status
 */
export const getRequestStatus = async (req, res) => {
  try {
    const request = await prisma.apiAccessRequest.findFirst({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get API Telemetry Usage Statistics
 */
export const getApiAccessUsage = async (req, res) => {
  try {
    const userId = req.user.id;
    const access = await prisma.apiAccess.findFirst({ where: { userId } });
    if (!access) return res.json({ success: true, data: [] });

    const usages = await prisma.apiUsage.findMany({
      where: { apiAccessId: access.id },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json({ success: true, data: usages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
