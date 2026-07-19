-- Columns already applied by the failed partial run; continue from indexes/tables/FKs.

CREATE TABLE IF NOT EXISTS `guest_session_recovery_codes` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `guest_session_id` BIGINT UNSIGNED NOT NULL,
    `code_hash` CHAR(64) NOT NULL,
    `generated_by_user_id` BIGINT UNSIGNED NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `guest_session_recovery_codes_uuid_key`(`uuid`),
    UNIQUE INDEX `guest_session_recovery_codes_code_hash_key`(`code_hash`),
    INDEX `gs_recovery_session_idx`(`guest_session_id`, `revoked_at`, `used_at`),
    INDEX `gs_recovery_expires_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `receipt_access_tokens` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `guest_session_id` BIGINT UNSIGNED NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `receipt_access_tokens_uuid_key`(`uuid`),
    UNIQUE INDEX `receipt_access_tokens_token_hash_key`(`token_hash`),
    INDEX `receipt_access_session_idx`(`guest_session_id`, `expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `audit_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `action` VARCHAR(80) NOT NULL,
    `actor_user_id` BIGINT UNSIGNED NULL,
    `actor_guest_session_id` BIGINT UNSIGNED NULL,
    `entity_type` VARCHAR(80) NOT NULL,
    `entity_id` VARCHAR(80) NOT NULL,
    `previous_values` JSON NULL,
    `new_values` JSON NULL,
    `reason` TEXT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `audit_logs_uuid_key`(`uuid`),
    INDEX `audit_logs_entity_idx`(`entity_type`, `entity_id`, `created_at`),
    INDEX `audit_logs_actor_idx`(`actor_user_id`, `created_at`),
    INDEX `audit_logs_action_idx`(`action`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `guest_sessions_activity_idx` ON `guest_sessions`(`last_activity_at`, `closed_at`);
CREATE INDEX `guest_sessions_closed_by_idx` ON `guest_sessions`(`closed_by_user_id`);

CREATE UNIQUE INDEX `restaurant_tables_active_guest_session_id_key` ON `restaurant_tables`(`active_guest_session_id`);
CREATE UNIQUE INDEX `payments_idempotency_key_key` ON `payments`(`idempotency_key`);
CREATE INDEX `payments_voided_by_idx` ON `payments`(`voided_by_user_id`);

ALTER TABLE `guest_sessions`
    ADD CONSTRAINT `guest_sessions_closed_by_user_id_fkey`
    FOREIGN KEY (`closed_by_user_id`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `restaurant_tables`
    ADD CONSTRAINT `restaurant_tables_active_guest_session_id_fkey`
    FOREIGN KEY (`active_guest_session_id`) REFERENCES `guest_sessions`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `payments`
    ADD CONSTRAINT `payments_voided_by_user_id_fkey`
    FOREIGN KEY (`voided_by_user_id`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `guest_session_recovery_codes`
    ADD CONSTRAINT `gs_recovery_session_fkey`
    FOREIGN KEY (`guest_session_id`) REFERENCES `guest_sessions`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `guest_session_recovery_codes`
    ADD CONSTRAINT `gs_recovery_user_fkey`
    FOREIGN KEY (`generated_by_user_id`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `receipt_access_tokens`
    ADD CONSTRAINT `receipt_access_session_fkey`
    FOREIGN KEY (`guest_session_id`) REFERENCES `guest_sessions`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `audit_logs`
    ADD CONSTRAINT `audit_logs_actor_user_id_fkey`
    FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
