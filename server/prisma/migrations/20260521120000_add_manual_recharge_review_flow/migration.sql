-- Manual review recharge flow.
-- Additive columns preserve existing transactions and wallet/ledger data.

ALTER TABLE `transaction`
  MODIFY COLUMN `status` ENUM('PENDING_REVIEW', 'PROCESSING', 'PENDING', 'SUCCESS', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `processingStartedAt` DATETIME(3) NULL,
  ADD COLUMN `processedAt` DATETIME(3) NULL,
  ADD COLUMN `rechargeProcessing` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `adminRetriedBy` INTEGER NULL,
  ADD COLUMN `reviewStatus` VARCHAR(191) NULL;

CREATE INDEX `transaction_rechargeProcessing_idx` ON `transaction`(`rechargeProcessing`);
