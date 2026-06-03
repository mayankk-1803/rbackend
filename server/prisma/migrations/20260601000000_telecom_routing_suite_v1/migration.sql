-- CreateTable
CREATE TABLE `ServiceSection` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `serviceType` VARCHAR(191) NOT NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `createdBy` INTEGER NULL,
    `updatedBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ServiceSection_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OperatorProviderMapping` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `operatorId` INTEGER NOT NULL,
    `providerId` INTEGER NOT NULL,
    `providerOperatorCode` VARCHAR(191) NOT NULL,
    `providerCircleCode` VARCHAR(191) NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OperatorProviderMapping_operatorId_idx`(`operatorId`),
    INDEX `OperatorProviderMapping_providerId_idx`(`providerId`),
    UNIQUE INDEX `OperatorProviderMapping_operatorId_providerId_key`(`operatorId`, `providerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProviderHealthMetrics` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `providerId` INTEGER NOT NULL,
    `latency` DOUBLE NOT NULL DEFAULT 0.0,
    `successRate` DOUBLE NOT NULL DEFAULT 100.0,
    `failureRate` DOUBLE NOT NULL DEFAULT 0.0,
    `timeoutCount` INTEGER NOT NULL DEFAULT 0,
    `healthScore` DOUBLE NOT NULL DEFAULT 100.0,
    `lastCheckedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ProviderHealthMetrics_providerId_key`(`providerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RoutingRuleVersion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `routingRuleId` INTEGER NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `configSnapshot` JSON NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `createdBy` INTEGER NOT NULL,
    `approvedBy` INTEGER NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RoutingRuleVersion_routingRuleId_version_idx`(`routingRuleId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RoutingTrafficCounter` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `providerId` INTEGER NOT NULL,
    `ruleId` INTEGER NULL,
    `transactionCount` INTEGER NOT NULL DEFAULT 0,
    `successCount` INTEGER NOT NULL DEFAULT 0,
    `failureCount` INTEGER NOT NULL DEFAULT 0,
    `lastResetAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RoutingTrafficCounter_providerId_idx`(`providerId`),
    INDEX `RoutingTrafficCounter_ruleId_idx`(`ruleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RoutingAuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` INTEGER NOT NULL,
    `oldValue` JSON NULL,
    `newValue` JSON NULL,
    `userId` INTEGER NULL,
    `userRole` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProviderCost` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `providerId` INTEGER NOT NULL,
    `costPerTxn` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `costPerAmountSlab` JSON NULL,
    `priorityWeight` INTEGER NOT NULL DEFAULT 1,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProviderCost_providerId_key`(`providerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `RoutingRule`
  MODIFY COLUMN `name` VARCHAR(191) NULL,
  MODIFY COLUMN `ruleType` VARCHAR(191) NULL,
  MODIFY COLUMN `targetValue` VARCHAR(191) NULL,
  MODIFY COLUMN `providerCode` VARCHAR(191) NULL,
  ADD COLUMN `sectionId` INTEGER NULL,
  ADD COLUMN `operatorId` INTEGER NULL,
  ADD COLUMN `circleId` INTEGER NULL,
  ADD COLUMN `providerId` INTEGER NULL,
  ADD COLUMN `weight` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `routeType` VARCHAR(191) NULL,
  ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN `failureThreshold` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `latencyThreshold` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `amountFrom` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN `amountTo` DECIMAL(10, 2) NOT NULL DEFAULT 99999.00,
  ADD COLUMN `serviceType` VARCHAR(191) NULL,
  ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `deletedAt` DATETIME(3) NULL,
  ADD COLUMN `deletedBy` INTEGER NULL;

-- CreateIndex
CREATE INDEX `RoutingRule_sectionId_idx` ON `RoutingRule`(`sectionId`);
CREATE INDEX `RoutingRule_operatorId_idx` ON `RoutingRule`(`operatorId`);
CREATE INDEX `RoutingRule_providerId_idx` ON `RoutingRule`(`providerId`);

-- AddForeignKey
ALTER TABLE `OperatorProviderMapping` ADD CONSTRAINT `OperatorProviderMapping_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `Operator`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `OperatorProviderMapping` ADD CONSTRAINT `OperatorProviderMapping_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `Provider`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProviderHealthMetrics` ADD CONSTRAINT `ProviderHealthMetrics_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `Provider`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoutingRuleVersion` ADD CONSTRAINT `RoutingRuleVersion_routingRuleId_fkey` FOREIGN KEY (`routingRuleId`) REFERENCES `RoutingRule`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoutingTrafficCounter` ADD CONSTRAINT `RoutingTrafficCounter_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `Provider`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `RoutingTrafficCounter` ADD CONSTRAINT `RoutingTrafficCounter_ruleId_fkey` FOREIGN KEY (`ruleId`) REFERENCES `RoutingRule`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProviderCost` ADD CONSTRAINT `ProviderCost_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `Provider`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoutingRule` ADD CONSTRAINT `RoutingRule_sectionId_fkey` FOREIGN KEY (`sectionId`) REFERENCES `ServiceSection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `RoutingRule` ADD CONSTRAINT `RoutingRule_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `Operator`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `RoutingRule` ADD CONSTRAINT `RoutingRule_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `Provider`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
