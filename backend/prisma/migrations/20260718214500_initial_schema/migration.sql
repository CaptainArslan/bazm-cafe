-- Production-ready squashed initial schema for BAZM Café V1.
-- Fresh environments: apply with `npx prisma migrate deploy`.
-- Includes auth, customers, guest sessions, tables, catalog, orders, payments, and stock.

-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(30) NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('ADMIN', 'STAFF') NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `email_verified_at` DATETIME(3) NULL,
    `password_changed_at` DATETIME(3) NULL,
    `last_login_at` DATETIME(3) NULL,
    `failed_login_attempts` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `locked_until` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `users_uuid_key`(`uuid`),
    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_role_is_active_idx`(`role`, `is_active`),
    INDEX `users_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `auth_session_id` BIGINT UNSIGNED NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `last_used_at` DATETIME(3) NULL,
    `revoked_at` DATETIME(3) NULL,
    `replaced_by_id` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `refresh_tokens_token_hash_key`(`token_hash`),
    INDEX `refresh_tokens_auth_session_id_revoked_at_expires_at_idx`(`auth_session_id`, `revoked_at`, `expires_at`),
    INDEX `refresh_tokens_replaced_by_id_idx`(`replaced_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auth_sessions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `device_id_hash` CHAR(64) NOT NULL,
    `device_name` VARCHAR(150) NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,
    `last_used_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `auth_sessions_uuid_key`(`uuid`),
    INDEX `auth_sessions_user_id_revoked_at_idx`(`user_id`, `revoked_at`),
    INDEX `auth_sessions_expires_at_idx`(`expires_at`),
    UNIQUE INDEX `auth_sessions_user_id_device_id_hash_key`(`user_id`, `device_id_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_tokens` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `requested_ip` VARCHAR(45) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `password_reset_tokens_token_hash_key`(`token_hash`),
    INDEX `password_reset_tokens_user_id_expires_at_used_at_idx`(`user_id`, `expires_at`, `used_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(30) NULL,
    `created_by_user_id` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `customers_uuid_key`(`uuid`),
    INDEX `customers_phone_idx`(`phone`),
    INDEX `customers_name_idx`(`name`),
    INDEX `customers_created_by_user_id_idx`(`created_by_user_id`),
    INDEX `customers_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `guest_sessions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `order_type` ENUM('DINE_IN', 'TAKEAWAY') NOT NULL,
    `restaurant_table_id` BIGINT UNSIGNED NULL,
    `customer_id` BIGINT UNSIGNED NULL,
    `last_activity_at` DATETIME(3) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `closed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `guest_sessions_uuid_key`(`uuid`),
    UNIQUE INDEX `guest_sessions_token_hash_key`(`token_hash`),
    INDEX `guest_sessions_restaurant_table_id_closed_at_idx`(`restaurant_table_id`, `closed_at`),
    INDEX `guest_sessions_customer_id_idx`(`customer_id`),
    INDEX `guest_sessions_expires_at_closed_at_idx`(`expires_at`, `closed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `restaurant_tables` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `table_number` VARCHAR(30) NOT NULL,
    `name` VARCHAR(100) NULL,
    `capacity` INTEGER UNSIGNED NOT NULL DEFAULT 1,
    `operational_status` ENUM('AVAILABLE', 'OUT_OF_SERVICE') NOT NULL DEFAULT 'AVAILABLE',
    `qr_token_hash` CHAR(64) NOT NULL,
    `qr_version` INTEGER UNSIGNED NOT NULL DEFAULT 1,
    `qr_image_path` VARCHAR(500) NULL,
    `qr_generated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `qr_regenerated_at` DATETIME(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `restaurant_tables_uuid_key`(`uuid`),
    UNIQUE INDEX `restaurant_tables_table_number_key`(`table_number`),
    UNIQUE INDEX `restaurant_tables_qr_token_hash_key`(`qr_token_hash`),
    INDEX `restaurant_tables_is_active_deleted_at_idx`(`is_active`, `deleted_at`),
    INDEX `restaurant_tables_operational_status_deleted_at_idx`(`operational_status`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `image_path` VARCHAR(500) NULL,
    `display_order` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_visible` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `categories_uuid_key`(`uuid`),
    UNIQUE INDEX `categories_slug_key`(`slug`),
    INDEX `categories_is_visible_display_order_idx`(`is_visible`, `display_order`),
    INDEX `categories_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `category_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(170) NOT NULL,
    `description` TEXT NULL,
    `image_path` VARCHAR(500) NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `preparation_minutes` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `stock_quantity` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `reserved_quantity` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `low_stock_threshold` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `track_stock` BOOLEAN NOT NULL DEFAULT true,
    `is_available` BOOLEAN NOT NULL DEFAULT true,
    `display_order` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `products_uuid_key`(`uuid`),
    UNIQUE INDEX `products_slug_key`(`slug`),
    INDEX `products_category_id_is_available_display_order_idx`(`category_id`, `is_available`, `display_order`),
    INDEX `products_is_available_track_stock_idx`(`is_available`, `track_stock`),
    INDEX `products_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `order_number` VARCHAR(30) NOT NULL,
    `bill_number` VARCHAR(30) NOT NULL,
    `guest_session_id` BIGINT UNSIGNED NOT NULL,
    `restaurant_table_id` BIGINT UNSIGNED NULL,
    `customer_id` BIGINT UNSIGNED NULL,
    `customer_type` ENUM('DINE_IN', 'TAKEAWAY') NOT NULL,
    `customer_name` VARCHAR(100) NULL,
    `customer_phone` VARCHAR(30) NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `payment_status` ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED') NOT NULL DEFAULT 'UNPAID',
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `tax_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `service_charge_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `discount_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(12, 2) NOT NULL,
    `customer_notes` TEXT NULL,
    `rejection_reason` TEXT NULL,
    `cancellation_reason` TEXT NULL,
    `receipt_image_path` VARCHAR(500) NULL,
    `estimated_ready_at` DATETIME(3) NULL,
    `accepted_at` DATETIME(3) NULL,
    `preparing_at` DATETIME(3) NULL,
    `ready_at` DATETIME(3) NULL,
    `served_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `rejected_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `orders_uuid_key`(`uuid`),
    UNIQUE INDEX `orders_order_number_key`(`order_number`),
    UNIQUE INDEX `orders_bill_number_key`(`bill_number`),
    INDEX `orders_guest_session_id_idx`(`guest_session_id`),
    INDEX `orders_customer_id_idx`(`customer_id`),
    INDEX `orders_status_created_at_idx`(`status`, `created_at`),
    INDEX `orders_payment_status_created_at_idx`(`payment_status`, `created_at`),
    INDEX `orders_restaurant_table_id_status_idx`(`restaurant_table_id`, `status`),
    INDEX `orders_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT UNSIGNED NOT NULL,
    `product_id` BIGINT UNSIGNED NULL,
    `product_name` VARCHAR(150) NOT NULL,
    `product_price` DECIMAL(12, 2) NOT NULL,
    `quantity` INTEGER UNSIGNED NOT NULL,
    `line_subtotal` DECIMAL(12, 2) NOT NULL,
    `customer_notes` TEXT NULL,
    `estimated_minutes` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `order_items_order_id_idx`(`order_id`),
    INDEX `order_items_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `payment_number` VARCHAR(30) NOT NULL,
    `order_id` BIGINT UNSIGNED NOT NULL,
    `received_by_user_id` BIGINT UNSIGNED NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `method` ENUM('CASH', 'CARD', 'EASYPAISA', 'JAZZCASH', 'BANK_TRANSFER', 'OTHER') NOT NULL,
    `status` ENUM('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `reference` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `paid_at` DATETIME(3) NULL,
    `refunded_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payments_uuid_key`(`uuid`),
    UNIQUE INDEX `payments_payment_number_key`(`payment_number`),
    INDEX `payments_order_id_status_idx`(`order_id`, `status`),
    INDEX `payments_received_by_user_id_idx`(`received_by_user_id`),
    INDEX `payments_status_paid_at_idx`(`status`, `paid_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_status_histories` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT UNSIGNED NOT NULL,
    `changed_by_user_id` BIGINT UNSIGNED NULL,
    `from_status` ENUM('PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'REJECTED', 'CANCELLED') NULL,
    `to_status` ENUM('PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'REJECTED', 'CANCELLED') NOT NULL,
    `reason` TEXT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `order_status_histories_order_id_created_at_idx`(`order_id`, `created_at`),
    INDEX `order_status_histories_changed_by_user_id_idx`(`changed_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_movements` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `order_id` BIGINT UNSIGNED NULL,
    `order_item_id` BIGINT UNSIGNED NULL,
    `created_by_user_id` BIGINT UNSIGNED NULL,
    `type` ENUM('STOCK_ADDED', 'STOCK_REMOVED', 'RESERVED', 'RESERVATION_RELEASED', 'CONSUMED', 'MANUAL_ADJUSTMENT') NOT NULL,
    `quantity` INTEGER NOT NULL,
    `stock_before` INTEGER UNSIGNED NOT NULL,
    `stock_after` INTEGER UNSIGNED NOT NULL,
    `reserved_before` INTEGER UNSIGNED NOT NULL,
    `reserved_after` INTEGER UNSIGNED NOT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `stock_movements_product_id_created_at_idx`(`product_id`, `created_at`),
    INDEX `stock_movements_order_id_idx`(`order_id`),
    INDEX `stock_movements_order_item_id_idx`(`order_item_id`),
    INDEX `stock_movements_created_by_user_id_idx`(`created_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_auth_session_id_fkey` FOREIGN KEY (`auth_session_id`) REFERENCES `auth_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_replaced_by_id_fkey` FOREIGN KEY (`replaced_by_id`) REFERENCES `refresh_tokens`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `guest_sessions` ADD CONSTRAINT `guest_sessions_restaurant_table_id_fkey` FOREIGN KEY (`restaurant_table_id`) REFERENCES `restaurant_tables`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `guest_sessions` ADD CONSTRAINT `guest_sessions_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_guest_session_id_fkey` FOREIGN KEY (`guest_session_id`) REFERENCES `guest_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_restaurant_table_id_fkey` FOREIGN KEY (`restaurant_table_id`) REFERENCES `restaurant_tables`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_received_by_user_id_fkey` FOREIGN KEY (`received_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_status_histories` ADD CONSTRAINT `order_status_histories_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_status_histories` ADD CONSTRAINT `order_status_histories_changed_by_user_id_fkey` FOREIGN KEY (`changed_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_order_item_id_fkey` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
