CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` integer NOT NULL,
	`diff_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_logs` (`entity`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_user_idx` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `cards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` integer NOT NULL,
	`card_code` text NOT NULL,
	`is_hospital` integer NOT NULL,
	`total_meals` integer NOT NULL,
	`used_meals` integer DEFAULT 0 NOT NULL,
	`remaining_meals` integer NOT NULL,
	`unit_price` real NOT NULL,
	`paid_amount` real NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`upgraded_from_id` integer,
	`collector_user_id` integer NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`purchased_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`upgraded_from_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`collector_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cards_member_idx` ON `cards` (`member_id`);--> statement-breakpoint
CREATE INDEX `cards_status_idx` ON `cards` (`status`);--> statement-breakpoint
CREATE TABLE `daily_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` integer NOT NULL,
	`card_id` integer,
	`order_date` text NOT NULL,
	`meal_type` text NOT NULL,
	`quantity` integer NOT NULL,
	`amount` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`fulfilled_at` integer,
	`fulfilled_by_user_id` integer,
	`delivered_at` integer,
	`delivered_by_user_id` integer,
	`cancelled_at` integer,
	`cancelled_by_user_id` integer,
	`cancel_reason` text DEFAULT '' NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fulfilled_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`delivered_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cancelled_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `orders_member_idx` ON `daily_orders` (`member_id`);--> statement-breakpoint
CREATE INDEX `orders_card_idx` ON `daily_orders` (`card_id`);--> statement-breakpoint
CREATE INDEX `orders_date_idx` ON `daily_orders` (`order_date`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `daily_orders` (`status`);--> statement-breakpoint
CREATE TABLE `export_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`kind` text NOT NULL,
	`params_json` text DEFAULT '{}' NOT NULL,
	`bytes` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `export_user_idx` ON `export_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `export_created_idx` ON `export_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `finance_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_date` text NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`category` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`ref_card_id` integer,
	`ref_order_id` integer,
	`source` text DEFAULT 'manual' NOT NULL,
	`voided` integer DEFAULT false NOT NULL,
	`collector_user_id` integer,
	`created_by_user_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	FOREIGN KEY (`ref_card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ref_order_id`) REFERENCES `daily_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`collector_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `finance_date_idx` ON `finance_entries` (`entry_date`);--> statement-breakpoint
CREATE INDEX `finance_type_idx` ON `finance_entries` (`type`);--> statement-breakpoint
CREATE INDEX `finance_category_idx` ON `finance_entries` (`category`);--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`key` text PRIMARY KEY NOT NULL,
	`response_json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uid` text NOT NULL,
	`name` text NOT NULL,
	`nickname` text DEFAULT '' NOT NULL,
	`phone` text NOT NULL,
	`wechat_id` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`dietary_notes` text DEFAULT '' NOT NULL,
	`is_hospital` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_uid_idx` ON `members` (`uid`);--> statement-breakpoint
CREATE INDEX `members_phone_idx` ON `members` (`phone`);--> statement-breakpoint
CREATE INDEX `members_wechat_idx` ON `members` (`wechat_id`);--> statement-breakpoint
CREATE INDEX `members_active_idx` ON `members` (`is_active`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`read_at` integer,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `notif_user_idx` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tomorrow_summaries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`target_date` text NOT NULL,
	`generated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`stale` integer DEFAULT false NOT NULL,
	`payload_json` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tomorrow_date_idx` ON `tomorrow_summaries` (`target_date`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`full_name` text NOT NULL,
	`role` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`token_version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_idx` ON `users` (`username`);