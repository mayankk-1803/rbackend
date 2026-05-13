-- CreateIndex
CREATE INDEX `coinTransaction_userId_createdAt_idx` ON `coinTransaction`(`userId`, `createdAt`);

-- CreateIndex
CREATE UNIQUE INDEX `coinTransaction_rechargeTxnId_type_key` ON `coinTransaction`(`rechargeTxnId`, `type`);
