CREATE TABLE `retail_products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_by_user_id` integer NOT NULL REFERENCES `users`(`id`),
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `retail_products_active_idx` ON `retail_products` (`is_active`);--> statement-breakpoint
ALTER TABLE `finance_entries` ADD `retail_product_id` integer REFERENCES `retail_products`(`id`);--> statement-breakpoint
ALTER TABLE `finance_entries` ADD `quantity` integer;
