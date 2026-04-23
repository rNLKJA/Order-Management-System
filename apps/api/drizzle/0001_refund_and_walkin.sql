ALTER TABLE `cards` ADD `refund_amount` real;--> statement-breakpoint
ALTER TABLE `cards` ADD `refund_reason` text;--> statement-breakpoint
ALTER TABLE `cards` ADD `refunded_at` integer;--> statement-breakpoint
ALTER TABLE `cards` ADD `refunded_by_user_id` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `daily_orders` ADD `customer_name` text DEFAULT '' NOT NULL;