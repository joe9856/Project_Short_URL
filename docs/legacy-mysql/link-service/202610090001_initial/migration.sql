CREATE TABLE `links` (
  `id` VARCHAR(36) NOT NULL, `userId` VARCHAR(36) NOT NULL, `originalUrl` TEXT NOT NULL,
  `code` VARCHAR(32) COLLATE utf8mb4_bin NOT NULL, `isActive` BOOLEAN NOT NULL DEFAULT true,
  `expiresAt` DATETIME(3) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `links_code_key` (`code`), INDEX `links_userId_createdAt_idx` (`userId`, `createdAt`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `rate_limits` (
  `id` VARCHAR(64) NOT NULL, `count` INTEGER NOT NULL DEFAULT 0, `expiresAt` DATETIME(3) NOT NULL,
  INDEX `rate_limits_expiresAt_idx` (`expiresAt`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
