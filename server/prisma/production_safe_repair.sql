-- PRODUCTION SAFE RECOVERY SQL
-- Target Database: fintech
-- Description: Fixes casing, adds missing columns/tables if they somehow disappeared, and ensures indexes.

-- 1. Ensure wallet.coinBalance exists
-- ALTER TABLE `wallet` ADD COLUMN IF NOT EXISTS `coinBalance` INT NOT NULL DEFAULT 0;
-- (MySQL 8.0.29+ support ADD COLUMN IF NOT EXISTS, otherwise we do it manually)
SET @dbname = 'fintech';
SET @tablename = 'wallet';
SET @columnname = 'coinBalance';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE wallet ADD COLUMN coinBalance INT NOT NULL DEFAULT 0'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Handle coinTransaction table casing and existence
-- If it exists as 'cointransaction', rename it to 'coinTransaction'
SET @targetTable = 'coinTransaction';
SET @existingTable = (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'fintech' AND TABLE_NAME = 'cointransaction' LIMIT 1);
SET @renameStmt = (SELECT IF(@existingTable IS NOT NULL, 'RENAME TABLE cointransaction TO coinTransaction', 'SELECT 1'));
PREPARE rstmt FROM @renameStmt;
EXECUTE rstmt;
DEALLOCATE PREPARE rstmt;

-- 3. Create table if missing
CREATE TABLE IF NOT EXISTS `coinTransaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `amount` INTEGER NOT NULL,
    `type` ENUM('EARNED', 'REDEEMED') NOT NULL,
    `description` VARCHAR(191) NULL,
    `rechargeTxnId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    CONSTRAINT `coinTransaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4. Ensure Indexes exist
-- Unique index
SET @indexExists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = 'fintech' AND TABLE_NAME = 'coinTransaction' AND INDEX_NAME = 'coinTransaction_rechargeTxnId_type_key');
SET @idxStmt = (SELECT IF(@indexExists = 0, 'CREATE UNIQUE INDEX coinTransaction_rechargeTxnId_type_key ON coinTransaction(rechargeTxnId, type)', 'SELECT 1'));
PREPARE idx1 FROM @idxStmt;
EXECUTE idx1;
DEALLOCATE PREPARE idx1;

-- User index
SET @indexExists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = 'fintech' AND TABLE_NAME = 'coinTransaction' AND INDEX_NAME = 'coinTransaction_userId_idx');
SET @idxStmt = (SELECT IF(@indexExists = 0, 'CREATE INDEX coinTransaction_userId_idx ON coinTransaction(userId)', 'SELECT 1'));
PREPARE idx2 FROM @idxStmt;
EXECUTE idx2;
DEALLOCATE PREPARE idx2;

-- Composite index
SET @indexExists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = 'fintech' AND TABLE_NAME = 'coinTransaction' AND INDEX_NAME = 'coinTransaction_userId_createdAt_idx');
SET @idxStmt = (SELECT IF(@indexExists = 0, 'CREATE INDEX coinTransaction_userId_createdAt_idx ON coinTransaction(userId, createdAt)', 'SELECT 1'));
PREPARE idx3 FROM @idxStmt;
EXECUTE idx3;
DEALLOCATE PREPARE idx3;
