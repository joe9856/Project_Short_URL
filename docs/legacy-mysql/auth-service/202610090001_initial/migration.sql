CREATE TABLE `users` (
  `id` VARCHAR(36) NOT NULL, `email` VARCHAR(254) NOT NULL, `name` VARCHAR(80) NOT NULL,
  `passwordHash` VARCHAR(255) NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `users_email_key` (`email`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `sessions` (
  `tokenHash` VARCHAR(64) NOT NULL, `userId` VARCHAR(36) NOT NULL, `expiresAt` DATETIME(3) NOT NULL,
  INDEX `sessions_expiresAt_idx` (`expiresAt`), PRIMARY KEY (`tokenHash`),
  CONSTRAINT `sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `rate_limits` (
  `id` VARCHAR(64) NOT NULL, `count` INTEGER NOT NULL DEFAULT 0, `expiresAt` DATETIME(3) NOT NULL,
  INDEX `rate_limits_expiresAt_idx` (`expiresAt`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
