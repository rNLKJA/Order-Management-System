ALTER TABLE `members` ADD `is_walkin` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `members_walkin_idx` ON `members` (`is_walkin`);