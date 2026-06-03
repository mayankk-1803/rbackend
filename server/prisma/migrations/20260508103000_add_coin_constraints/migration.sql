-- CreateTable
CREATE TABLE `coinTransaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `amount` INTEGER NOT NULL,
    `type` ENUM('EARNED', 'REDEEMED') NOT NULL,
    `description` VARCHAR(191) NULL,
    `rechargeTxnId` INTEGER NULL,
    `sourceTransactionId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `metadata` JSON NULL,
    `financialSequenceId` VARCHAR(191) NULL,

    UNIQUE INDEX `coinTransaction_financialSequenceId_key`(`financialSequenceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `coinTransaction` ADD CONSTRAINT `coinTransaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `coinTransaction` ADD CONSTRAINT `coinTransaction_rechargeTxnId_fkey` FOREIGN KEY (`rechargeTxnId`) REFERENCES `Transaction`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX `coinTransaction_userId_createdAt_idx` ON `coinTransaction`(`userId`, `createdAt`);

-- CreateIndex
CREATE UNIQUE INDEX `coinTransaction_rechargeTxnId_type_key` ON `coinTransaction`(`rechargeTxnId`, `type`);
