CREATE TABLE `click_events` (
  `id` VARCHAR(36) NOT NULL, `eventId` VARCHAR(36) NOT NULL, `linkId` VARCHAR(36) NOT NULL, `ownerId` VARCHAR(36) NOT NULL,
  `clickedAt` DATETIME(3) NOT NULL, `referrerHost` VARCHAR(253) NOT NULL, `deviceType` VARCHAR(16) NOT NULL,
  UNIQUE INDEX `click_events_eventId_key` (`eventId`), INDEX `click_events_linkId_clickedAt_idx` (`linkId`, `clickedAt`),
  INDEX `click_events_ownerId_clickedAt_idx` (`ownerId`, `clickedAt`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
