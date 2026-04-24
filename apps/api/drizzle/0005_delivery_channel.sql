ALTER TABLE `daily_orders` ADD `delivery_channel` text DEFAULT 'self' NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_orders` ADD `courier_ref` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `orders_delivery_channel_idx` ON `daily_orders` (`delivery_channel`);
