ALTER TABLE `daily_orders` ADD `is_gift` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_orders` ADD `proof_images_json` text DEFAULT '[]' NOT NULL;
