CREATE TABLE `imported_summary_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_date` text NOT NULL,
	`total_income` real NOT NULL,
	`total_expense` real NOT NULL,
	`balance` real NOT NULL,
	`source_sheet` text NOT NULL DEFAULT '汇总计算记录',
	`extra_json` text NOT NULL DEFAULT '{}',
	`created_by_user_id` integer NOT NULL REFERENCES `users`(`id`),
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `imported_summary_snapshots_date_idx` ON `imported_summary_snapshots` (`snapshot_date`);
--> statement-breakpoint
CREATE TABLE `imported_weekly_closings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`period_label` text NOT NULL,
	`inferred_date` text,
	`amount` real NOT NULL,
	`description` text NOT NULL DEFAULT '',
	`sort_order` integer NOT NULL,
	`source_sheet` text NOT NULL DEFAULT '每周结账',
	`extra_json` text NOT NULL DEFAULT '{}',
	`created_by_user_id` integer NOT NULL REFERENCES `users`(`id`),
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `imported_weekly_closings_sort_idx` ON `imported_weekly_closings` (`sort_order`);
--> statement-breakpoint
CREATE TABLE `imported_order_summaries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` text NOT NULL,
	`excel_row` integer NOT NULL,
	`total_meals` integer,
	`used_meals` integer,
	`remaining_meals` integer,
	`row_json` text NOT NULL,
	`source_sheet` text NOT NULL DEFAULT '订餐汇总',
	`created_by_user_id` integer NOT NULL REFERENCES `users`(`id`),
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `imported_order_summaries_cid_idx` ON `imported_order_summaries` (`customer_id`);
