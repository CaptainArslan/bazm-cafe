-- CreateTable
CREATE TABLE `cafe_settings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `tax_rate_percent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `service_charge_percent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed singleton row (tax and service charge start at 0)
INSERT INTO `cafe_settings` (`id`, `tax_rate_percent`, `service_charge_percent`, `updated_at`, `created_at`)
VALUES (1, 0, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));
