import prisma from "../config/prisma.js";
import { normalizeTransactionStatus } from "../utils/statusHelper.js";
import { convertToCSV, downloadCSV } from "../utils/exportHelper.js";
import { getMetricsReport } from "../services/webhookMonitoringService.js";


/**
 * Fetch transaction history with advanced filtering and pagination.
 */
export const getTransactionHistory = async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    type,
    mobile,
    operator,
    startDate,
    endDate,
    search
  } = req.query;

  const skip = (page - 1) * limit;
  const userId = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN' ? undefined : req.user.id;

  const where = {
    userId,
    status: (status && status.toUpperCase() !== 'REFUNDED') ? status.toUpperCase() : undefined,
    type: type ? type.toUpperCase() : undefined,
    mobile: mobile ? { contains: mobile } : undefined,
    operator: operator ? { contains: operator } : undefined,
  };

  if (status?.toUpperCase() === 'REFUNDED') {
    where.refundStatus = 'refunded';
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  if (search) {
    where.OR = [
      { providerTxnId: { contains: search } },
      { providerRef: { contains: search } },
      { providerRefId: { contains: search } },
      { mobile: { contains: search } }
    ];
  }

  try {
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { name: true, phone: true }
          }
        }
      }),
      prisma.transaction.count({ where })
    ]);

    // Sanitize transactions to remove provider exposure
    const sanitizedTransactions = transactions.map(tx => {
      const { provider, providerTxnId, providerResponse, ...sanitized } = tx;
      return {
        ...sanitized,
        // Optional: Keep providerRef but rename if needed, user said hide vendor identifiers
        // providerRef is often shown on invoices, let's keep it but ensure it's not a vendor name
      };
    });

    res.json({
      success: true,
      data: sanitizedTransactions,
      pagination: {

        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Professional report summary for dashboard cards.
 */
export const getReportSummary = async (req, res) => {
  const userId = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN' ? undefined : req.user.id;
  
  try {
    const [success, failed, pending, refunded, volume] = await Promise.all([
      prisma.transaction.count({ where: { userId, status: 'SUCCESS' } }),
      prisma.transaction.count({ where: { userId, status: 'FAILED' } }),
      prisma.transaction.count({ where: { userId, status: { in: ['PENDING', 'PENDING_REVIEW', 'PROCESSING'] } } }),
      prisma.transaction.count({ where: { userId, refundStatus: 'refunded' } }),
      prisma.transaction.aggregate({
        where: { userId, status: 'SUCCESS' },
        _sum: { amount: true }
      })
    ]);

    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user.id }
    });

    res.json({
      success: true,
      data: {
        totalSuccess: success,
        totalFailed: failed,
        totalPending: pending,
        totalRefunded: refunded,
        totalVolume: volume._sum.amount || 0,
        closingBalance: wallet?.balance || 0,
        coinsEarned: wallet?.coinBalance || 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


/**
 * Fetch unified wallet ledger entries.
 */
export const getWalletLedger = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;
  const userId = req.user.id;

  try {
    const [entries, total] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where: { userId },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          transaction: {
            select: { status: true, type: true, mobile: true, operator: true }
          }
        }
      }),
      prisma.ledgerEntry.count({ where: { userId } })
    ]);

    res.json({
      success: true,
      data: entries,
      pagination: { total, page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Commission Analytics Report (Admin only).
 */
export const getCommissionReport = async (req, res) => {
  try {
    const stats = await prisma.transaction.groupBy({
      by: ['operator'],
      where: { status: 'SUCCESS', type: 'RECHARGE' },
      _sum: {
        amount: true,
        commission: true,
        profit: true
      },
      _count: {
        id: true
      }
    });

    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const exportTransactions = async (req, res) => {
  try {
    const userId = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN' ? undefined : req.user.id;
    const { type } = req.query;

    if (type === 'LEDGER') {
      const entries = await prisma.ledgerEntry.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5000
      });
      const fields = ['id', 'amount', 'balanceAfter', 'type', 'description', 'createdAt'];
      const csv = convertToCSV(entries, fields);
      return downloadCSV(res, `ledger_${Date.now()}.csv`, csv);
    }

    if (type === 'COMMISSION') {
      const stats = await prisma.transaction.groupBy({
        by: ['operator'],
        where: { status: 'SUCCESS', type: 'RECHARGE' },
        _sum: { amount: true, commission: true, profit: true },
        _count: { id: true }
      });
      const fields = ['operator', '_sum.amount', '_sum.commission', '_sum.profit', '_count.id'];
      const csv = convertToCSV(stats, fields);
      return downloadCSV(res, `commissions_${Date.now()}.csv`, csv);
    }

    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 2000 // Increased limit for streaming
    });

    // Sanitize for CSV
    const sanitizedTransactions = transactions.map(tx => {
      const { provider, providerTxnId, providerResponse, ...sanitized } = tx;
      return sanitized;
    });

    const fields = ['id', 'amount', 'status', 'type', 'mobile', 'operator', 'createdAt', 'providerRef', 'cashbackAmount'];

    const csv = convertToCSV(transactions, fields);
    downloadCSV(res, `transactions_${Date.now()}.csv`, csv);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Search Recharge specifically for support/audit.
 */
export const searchRecharge = async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ success: false, message: "Search query required" });

  try {
    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { mobile: { contains: query } },
          { providerRef: { contains: query } },
          { providerRefId: { contains: query } },
          { providerTxnId: { contains: query } },
          { id: isNaN(parseInt(query)) ? undefined : parseInt(query) }
        ].filter(Boolean)
      },
      include: { user: { select: { name: true, phone: true } } },
      take: 10
    });

    res.json({ success: true, data: transactions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Fetch webhook and reconciliation metrics.
 */
export const getWebhookMetrics = async (req, res) => {
  try {
    const metrics = await getMetricsReport();
    res.json({ success: true, data: metrics });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

