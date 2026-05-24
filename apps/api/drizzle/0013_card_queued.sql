ALTER TABLE `cards` ADD `queued_after_card_id` integer REFERENCES `cards`(`id`);--> statement-breakpoint
CREATE INDEX `cards_queued_after_idx` ON `cards` (`queued_after_card_id`);
