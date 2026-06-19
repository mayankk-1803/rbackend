import prisma from "../config/prisma.js";

/**
 * Returns filtered and paginated ledger entries from admin_ledger.
 */
export const getAdminLedgerEntries = async ({
  page = 1,
  limit = 20,
  filter = "all", // today, week, month, custom, all
  startDate = null,
  endDate = null,
  type = null
}) => {
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.max(1, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const where = {};

  // Apply transaction type filter if specified
  if (type) {
    where.type = type;
  }

  // Calculate Date Filters
  const now = new Date();
  let start = null;
  let end = null;

  if (filter === "today") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (filter === "week") {
    // Current week or last 7 days. Let's do last 7 days.
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    end = new Date();
  } else if (filter === "month") {
    // Current month or last 30 days. Let's do last 30 days.
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    end = new Date();
  } else if (filter === "custom") {
    if (startDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
    }
    if (endDate) {
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    }
  }

  if (start || end) {
    where.createdAt = {};
    if (start) {
      where.createdAt.gte = start;
    }
    if (end) {
      where.createdAt.lte = end;
    }
  }

  const [items, total] = await Promise.all([
    prisma.adminLedger.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limitNum
    }),
    prisma.adminLedger.count({ where })
  ]);

  return {
    items,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum)
    }
  };
};
