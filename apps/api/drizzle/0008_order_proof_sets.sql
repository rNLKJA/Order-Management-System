CREATE TABLE `order_proof_sets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`proof_images_json` text NOT NULL,
	`created_by_user_id` integer NOT NULL REFERENCES `users`(`id`),
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);--> statement-breakpoint
ALTER TABLE `daily_orders` ADD `proof_set_id` integer REFERENCES `order_proof_sets`(`id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `daily_orders_proof_set_idx` ON `daily_orders` (`proof_set_id`);
