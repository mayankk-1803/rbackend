import prisma from "../config/prisma.js";
import AppError from "../utils/AppError.js";

/**
 * Generates an immutable snapshot for an invoice if it doesn't exist.
 */
export const getInvoice = async (req, res) => {
  const { transactionId } = req.params;
  const userId = req.user.id;

  try {
    const txn = await prisma.transaction.findUnique({
      where: { id: parseInt(transactionId) },
      include: {
        user: { select: { name: true, phone: true, email: true } }
      }
    });

    if (!txn) throw new AppError("Transaction not found", 404);
    
    // Security: Only owner or admin can view
    if (txn.userId !== userId && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      throw new AppError("Access denied", 403);
    }

    // If snapshot doesn't exist, create it (immutable record of that moment)
    if (!txn.invoiceSnapshot) {
      const snapshot = {
        invoiceNumber: `INV-${txn.id}-${Date.now()}`,
        billedTo: txn.user.name || txn.user.phone,
        billedAt: txn.createdAt,
        amount: txn.amount,
        status: txn.status,
        mobile: txn.mobile,
        operator: txn.operator,
        providerRef: txn.providerRef || txn.providerTxnId,
        branding: "DiziPay Vault",
        logo: "https://dizipay.in/logo.png"
      };

      await prisma.transaction.update({
        where: { id: txn.id },
        data: { invoiceSnapshot: snapshot }
      });

      return res.json({ success: true, data: snapshot });
    }

    res.json({ success: true, data: txn.invoiceSnapshot });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};
