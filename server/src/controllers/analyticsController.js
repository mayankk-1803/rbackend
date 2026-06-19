import prisma from "../config/prisma.js";
import { encodeTxnId, decodeTxnId } from "../utils/referenceHelper.js";
import { convertToCSV } from "../utils/exportHelper.js";

/**
 * Helper to convert date to start of day
 */
const getStartOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * GET /api/admin/analytics/commissions
 * Retrieve commission KPIs, operator breakdown, and trend data.
 */
export const getCommissionAnalytics = async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = getStartOfDay(now);
    
    // Start of current week (Sunday as start)
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    
    // Start of current month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Overall KPIs (Read-only Aggregation)
    const [todayAgg, weekAgg, monthAgg, lifetimeAgg] = await Promise.all([
      // Today
      prisma.transaction.aggregate({
        where: { type: "RECHARGE", status: "SUCCESS", createdAt: { gte: startOfToday } },
        _sum: { commission: true, cashback: true, profit: true }
      }),
      // Week
      prisma.transaction.aggregate({
        where: { type: "RECHARGE", status: "SUCCESS", createdAt: { gte: startOfWeek } },
        _sum: { commission: true, cashback: true, profit: true }
      }),
      // Month
      prisma.transaction.aggregate({
        where: { type: "RECHARGE", status: "SUCCESS", createdAt: { gte: startOfMonth } },
        _sum: { commission: true, cashback: true, profit: true }
      }),
      // Lifetime / Total
      prisma.transaction.aggregate({
        where: { type: "RECHARGE", status: "SUCCESS" },
        _sum: { commission: true, cashback: true, profit: true }
      })
    ]);

    const kpis = {
      todayCommission: Number(todayAgg._sum.commission || 0),
      todayCashback: Number(todayAgg._sum.cashback || 0),
      todayProfit: Number(todayAgg._sum.profit || 0),
      
      weekCommission: Number(weekAgg._sum.commission || 0),
      weekCashback: Number(weekAgg._sum.cashback || 0),
      weekProfit: Number(weekAgg._sum.profit || 0),
      
      monthCommission: Number(monthAgg._sum.commission || 0),
      monthCashback: Number(monthAgg._sum.cashback || 0),
      monthProfit: Number(monthAgg._sum.profit || 0),
      
      lifetimeCommission: Number(lifetimeAgg._sum.commission || 0),
      lifetimeCashback: Number(lifetimeAgg._sum.cashback || 0),
      lifetimeProfit: Number(lifetimeAgg._sum.profit || 0)
    };

    // 2. Operator Breakdown (Group By)
    const operators = ["JIO", "AIRTEL", "VI", "BSNL", "VIDEOCON D2H", "AIRTEL DTH", "DISH TV", "SUN DIRECT", "TATA SKY", "TATA PLAY"];
    
    // Group transactions by operator to get totals
    const groupStats = await prisma.transaction.groupBy({
      by: ["operator"],
      where: { type: "RECHARGE", operator: { in: operators } },
      _sum: { amount: true, commission: true, cashback: true, profit: true },
      _count: { id: true }
    });

    // Group successful transactions by operator
    const successStats = await prisma.transaction.groupBy({
      by: ["operator"],
      where: { type: "RECHARGE", status: "SUCCESS", operator: { in: operators } },
      _count: { id: true }
    });

    const successMap = new Map(successStats.map(s => [s.operator, s._count.id]));

    const breakdown = operators.map(op => {
      const stats = groupStats.find(g => g.operator === op) || {
        _count: { id: 0 },
        _sum: { amount: 0, commission: 0, cashback: 0, profit: 0 }
      };
      
      const totalCount = stats._count.id;
      const successCount = successMap.get(op) || 0;
      const successRate = totalCount > 0 ? Number(((successCount / totalCount) * 100).toFixed(2)) : 100.00;

      return {
        operator: op,
        count: totalCount,
        amount: Number(stats._sum.amount || 0),
        commission: Number(stats._sum.commission || 0),
        cashback: Number(stats._sum.cashback || 0),
        profit: Number(stats._sum.profit || 0),
        successRate
      };
    });

    // 3. Trend Data
    // For performance, we run raw SQL to group by date efficiently using DB indexes
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const dailyTrends = await prisma.$queryRaw`
      SELECT 
        DATE_FORMAT(createdAt, '%Y-%m-%d') as date,
        SUM(commission) as commission,
        SUM(cashback) as cashback,
        SUM(profit) as profit
      FROM transaction
      WHERE type = 'RECHARGE' AND status = 'SUCCESS' AND createdAt >= ${thirtyDaysAgo}
      GROUP BY DATE_FORMAT(createdAt, '%Y-%m-%d')
      ORDER BY date ASC
    `;

    const formattedTrends = dailyTrends.map(t => ({
      date: t.date,
      commission: Number(t.commission || 0),
      cashback: Number(t.cashback || 0),
      profit: Number(t.profit || 0)
    }));

    return res.json({
      success: true,
      data: {
        kpis,
        breakdown,
        trends: formattedTrends
      }
    });
  } catch (error) {
    console.error("[Commission Analytics Error]:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/admin/analytics/operators
 * Retrieve operator performance monitoring counters.
 */
export const getOperatorPerformance = async (req, res) => {
  try {
    const mobileOps = ["JIO", "AIRTEL", "VI", "BSNL"];
    const dthOps = ["VIDEOCON D2H", "AIRTEL DTH", "DISH TV", "SUN DIRECT", "TATA SKY", "TATA PLAY"];

    const getOperatorStats = async (operatorList) => {
      const allStats = await prisma.transaction.groupBy({
        by: ["operator", "status"],
        where: { type: "RECHARGE", operator: { in: operatorList } },
        _count: { id: true }
      });

      const result = {};
      operatorList.forEach(op => {
        result[op] = { success: 0, failed: 0, refunded: 0, pending: 0, total: 0 };
      });

      allStats.forEach(item => {
        const op = item.operator;
        if (!result[op]) return;
        const count = item._count.id;
        result[op].total += count;
        
        if (item.status === "SUCCESS") result[op].success += count;
        else if (item.status === "FAILED") result[op].failed += count;
        else if (item.status === "REFUNDED") result[op].refunded += count;
        else result[op].pending += count; // PENDING, PROCESSING, PENDING_REVIEW
      });

      return Object.keys(result).map(op => {
        const stats = result[op];
        const successRate = stats.total > 0 ? Number(((stats.success / stats.total) * 100).toFixed(2)) : 100.00;
        
        let health = "HEALTHY";
        if (successRate < 85) health = "DEGRADED";
        else if (successRate < 95) health = "WARNING";

        return {
          operator: op,
          success: stats.success,
          failed: stats.failed,
          refunded: stats.refunded,
          pending: stats.pending,
          total: stats.total,
          successRate,
          health
        };
      });
    };

    const [mobile, dth] = await Promise.all([
      getOperatorStats(mobileOps),
      getOperatorStats(dthOps)
    ]);

    return res.json({
      success: true,
      data: {
        mobile,
        dth
      }
    });
  } catch (error) {
    console.error("[Operator Performance Error]:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/admin/analytics/financials
 * Retrieve executive financial reporting stats with filtering.
 */
export const getFinancialAnalytics = async (req, res) => {
  try {
    const { filter = "lifetime" } = req.query;
    const now = new Date();
    let startDate = null;

    if (filter === "today") {
      startDate = getStartOfDay(now);
    } else if (filter === "7days") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
    } else if (filter === "30days") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
    } else if (filter === "90days") {
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
    }

    const where = {};
    if (startDate) {
      where.createdAt = { gte: startDate };
    }

    // 1. Volumes and Profits (Using aggregates)
    const rechargeStats = await prisma.transaction.aggregate({
      where: { ...where, type: "RECHARGE", status: "SUCCESS" },
      _sum: { amount: true, commission: true, cashback: true, profit: true }
    });

    const refundStats = await prisma.transaction.aggregate({
      where: { ...where, OR: [{ type: "REFUND", status: "SUCCESS" }, { status: "REFUNDED" }] },
      _sum: { amount: true }
    });

    // 2. Platform Liabilities (Active wallet totals)
    const walletStats = await prisma.wallet.aggregate({
      _sum: { balance: true, cashbackBalance: true }
    });

    const liabilities = {
      userBalance: Number(walletStats._sum.balance || 0),
      cashbackBalance: Number(walletStats._sum.cashbackBalance || 0),
      totalLiabilities: Number(walletStats._sum.balance || 0) + Number(walletStats._sum.cashbackBalance || 0)
    };

    const financials = {
      rechargeVolume: Number(rechargeStats._sum.amount || 0),
      commissionPaid: Number(rechargeStats._sum.commission || 0),
      cashbackPaid: Number(rechargeStats._sum.cashback || 0),
      platformProfit: Number(rechargeStats._sum.profit || 0),
      refundVolume: Number(refundStats._sum.amount || 0),
      liabilities
    };

    return res.json({
      success: true,
      data: financials
    });
  } catch (error) {
    console.error("[Financial Analytics Error]:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/admin/analytics/search
 * Global Search endpoint (Ctrl + K) returning match limits.
 */
export const globalSearch = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || query.trim().length < 2) {
      return res.json({ success: true, data: { users: [], transactions: [], wallets: [], orders: [] } });
    }

    const searchStr = query.trim();

    // 1. Search Users
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: searchStr } },
          { email: { contains: searchStr } },
          { phone: { contains: searchStr } }
        ]
      },
      select: { id: true, name: true, email: true, phone: true, role: true },
      take: 8
    });

    // 2. Search Transactions (Supports Public Ref decode)
    const decodedId = decodeTxnId(searchStr);
    const txnWhere = {
      OR: [
        { mobile: { contains: searchStr } },
        { providerRef: { contains: searchStr } },
        { providerRefId: { contains: searchStr } },
        { providerTxnId: { contains: searchStr } }
      ]
    };
    if (!isNaN(decodedId)) {
      txnWhere.OR.push({ id: decodedId });
    }

    const transactions = await prisma.transaction.findMany({
      where: txnWhere,
      select: { id: true, mobile: true, operator: true, amount: true, status: true, type: true, createdAt: true },
      take: 8
    });

    const mappedTransactions = transactions.map(tx => ({
      ...tx,
      publicRef: encodeTxnId(tx.id)
    }));

    // 3. Search Wallets
    const wallets = await prisma.wallet.findMany({
      where: {
        user: {
          OR: [
            { name: { contains: searchStr } },
            { email: { contains: searchStr } },
            { phone: { contains: searchStr } }
          ]
        }
      },
      select: {
        id: true,
        balance: true,
        cashbackBalance: true,
        user: { select: { name: true, phone: true } }
      },
      take: 8
    });

    // 4. Search Orders
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { invoiceId: { contains: searchStr } },
          { gatewayRef: { contains: searchStr } },
          { user: { name: { contains: searchStr } } }
        ]
      },
      select: { id: true, invoiceId: true, totalAmount: true, status: true, paymentStatus: true, user: { select: { name: true } } },
      take: 8
    });

    return res.json({
      success: true,
      data: {
        users,
        transactions: mappedTransactions,
        wallets,
        orders
      }
    });
  } catch (error) {
    console.error("[Global Search Error]:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/admin/analytics/reports/generate
 * Generate Daily/Weekly/Monthly financial summary export.
 */
export const generateSummaryReport = async (req, res) => {
  try {
    const { type = "daily" } = req.query;
    const now = new Date();
    let startDate = getStartOfDay(now);

    if (type === "weekly") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (type === "monthly") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const txns = await prisma.transaction.findMany({
      where: { createdAt: { gte: startDate } },
      select: {
        id: true,
        amount: true,
        type: true,
        status: true,
        operator: true,
        commission: true,
        cashback: true,
        profit: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" }
    });

    const csvData = txns.map(t => ({
      "Transaction ID": t.id,
      "Reference ID": encodeTxnId(t.id),
      "Amount": Number(t.amount).toFixed(2),
      "Type": t.type,
      "Status": t.status,
      "Operator": t.operator || "N/A",
      "Commission": Number(t.commission || 0).toFixed(2),
      "Cashback": Number(t.cashback || 0).toFixed(2),
      "Platform Profit": Number(t.profit || 0).toFixed(2),
      "Date": t.createdAt.toISOString()
    }));

    const fields = ["Transaction ID", "Reference ID", "Amount", "Type", "Status", "Operator", "Commission", "Cashback", "Platform Profit", "Date"];
    const csv = convertToCSV(csvData, fields);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=${type}_summary_${Date.now()}.csv`);
    return res.send(csv);
  } catch (error) {
    console.error("[Summary Report Export Error]:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
