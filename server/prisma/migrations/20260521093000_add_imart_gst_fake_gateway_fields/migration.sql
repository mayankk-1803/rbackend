-- Add iMart-only GST and simulated gateway metadata.
-- These fields are additive and do not alter recharge, wallet, NexGate, or ledger tables.
ALTER TABLE `Order`
  ADD COLUMN `subtotalAmount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN `gstAmount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN `gstRate` DECIMAL(5, 2) NOT NULL DEFAULT 18.00,
  ADD COLUMN `gatewayRef` VARCHAR(191) NULL,
  ADD COLUMN `paymentMethod` VARCHAR(191) NULL,
  ADD COLUMN `invoiceId` VARCHAR(191) NULL,
  ADD COLUMN `paidAt` DATETIME(3) NULL;

CREATE UNIQUE INDEX `Order_invoiceId_key` ON `Order`(`invoiceId`);
CREATE INDEX `Order_paymentStatus_idx` ON `Order`(`paymentStatus`);
