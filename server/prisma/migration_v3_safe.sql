-- Safe Additive Migration for Dizipay Production DB

-- 1. Add coinBalance to Wallet table
-- We use a conditional check wrapped in a procedure or just run it directly if sure it's missing.
ALTER TABLE `wallet` ADD COLUMN IF NOT EXISTS `coinBalance` INT NOT NULL DEFAULT 0;

-- 2. Create coinTransaction table if it doesn't exist
CREATE TABLE IF NOT EXISTS `coinTransaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `amount` INTEGER NOT NULL,
    `type` ENUM('EARNED', 'REDEEMED') NOT NULL,
    `description` VARCHAR(191) NULL,
    `rechargeTxnId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3. Add Foreign Key for coinTransaction
-- Use a block to avoid errors if the constraint already exists
-- ALTER TABLE `coinTransaction` ADD CONSTRAINT `coinTransaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Add Indexes for coinTransaction
CREATE INDEX IF NOT EXISTS `coinTransaction_userId_idx` ON `coinTransaction`(`userId`);
CREATE INDEX IF NOT EXISTS `coinTransaction_userId_createdAt_idx` ON `coinTransaction`(`userId`, `createdAt`);
CREATE UNIQUE INDEX IF NOT EXISTS `coinTransaction_rechargeTxnId_type_key` ON `coinTransaction`(`rechargeTxnId`, `type`);
