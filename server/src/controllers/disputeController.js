import prisma from "../config/prisma.js";
import AppError from "../utils/AppError.js";
import { logAction, AUDIT_ACTIONS } from "../services/auditService.js";

/**
 * Raise a new dispute for a transaction.
 */
export const raiseDispute = async (req, res) => {
  const { transactionId, type, reason } = req.body;
  const userId = req.user.id;

  try {
    const txn = await prisma.transaction.findUnique({
      where: { id: parseInt(transactionId) }
    });

    if (!txn || txn.userId !== userId) {
      throw new AppError("Transaction not found or access denied", 404);
    }

    const existing = await prisma.dispute.findFirst({
      where: { transactionId: txn.id, status: { in: ['OPEN', 'UNDER_REVIEW', 'PROVIDER_ESCALATED'] } }
    });

    if (existing) {
      throw new AppError("A dispute is already active for this transaction", 400);
    }

    const dispute = await prisma.dispute.create({
      data: {
        userId,
        transactionId: txn.id,
        type: type || 'TRANSACTION_ISSUE',
        description: reason,
        status: 'OPEN'
      }
    });

    res.status(201).json({ success: true, data: dispute });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};


/**
 * Update dispute status (Admin only).
 */
export const resolveDispute = async (req, res) => {
  const { id } = req.params;
  const { status, remarks } = req.body;
  const adminId = req.user.id;

  try {
    const dispute = await prisma.dispute.findUnique({
      where: { id: parseInt(id) },
      include: { transaction: true }
    });

    if (!dispute) throw new AppError("Dispute not found", 404);

    const updatedDispute = await prisma.dispute.update({
      where: { id: dispute.id },
      data: {
        status,
        remarks,
        adminId,
        updatedAt: new Date()
      }
    });

    await logAction({
      action: AUDIT_ACTIONS.DISPUTE_RESOLVE,
      adminId,
      entity: "DISPUTE",
      entityId: dispute.id,
      details: { status, remarks },
      req
    });

    res.json({ success: true, data: updatedDispute });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * Fetch disputes for the current user.
 */
export const getMyDisputes = async (req, res) => {
  try {
    const disputes = await prisma.dispute.findMany({
      where: { userId: req.user.id },
      include: {
        transaction: {
          select: { mobile: true, operator: true, amount: true, createdAt: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: disputes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
/**
 * Fetch all disputes for administration.
 */
export const getAllDisputes = async (req, res) => {
  try {
    const disputes = await prisma.dispute.findMany({
      include: {
        user: { select: { name: true, phone: true, email: true } },
        transaction: { select: { mobile: true, operator: true, amount: true, status: true, providerRef: true, providerRefId: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: disputes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Create a new dispute (used by POST /api/disputes)
 */
export const createDispute = async (req, res) => {
  try {
    const { transactionId, type, reason } = req.body;
    const userId = req.user.id;

    if (!transactionId) {
      return res.status(400).json({ success: false, message: "Transaction ID is required" });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: "Please provide a reason for the dispute" });
    }

    const txn = await prisma.transaction.findUnique({
      where: { id: parseInt(transactionId) }
    });

    if (!txn || txn.userId !== userId) {
      return res.status(404).json({ success: false, message: "Transaction not found or access denied" });
    }

    // Recharge existence validation
    const rechargeExists = await prisma.recharge.findUnique({
      where: { transactionId: txn.id }
    });
    if (!rechargeExists) {
      return res.status(400).json({ success: false, message: "Only recharge transactions can be disputed" });
    }

    // Duplicate dispute prevention
    const existing = await prisma.dispute.findFirst({
      where: { 
        transactionId: txn.id, 
        status: { in: ['OPEN', 'UNDER_REVIEW', 'PROVIDER_ESCALATED'] } 
      }
    });

    if (existing) {
      return res.status(400).json({ success: false, message: "A dispute is already active for this transaction" });
    }

    await prisma.dispute.create({
      data: {
        userId,
        transactionId: txn.id,
        type: type || 'TRANSACTION_ISSUE',
        description: reason.trim(),
        status: 'OPEN'
      }
    });

    return res.status(201).json({
      success: true,
      message: "Dispute submitted successfully"
    });
  } catch (err) {
    console.error("[Dispute Controller Error]:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
