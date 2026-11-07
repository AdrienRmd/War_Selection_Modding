CREATE TABLE `creator_items` (
	`id` text PRIMARY KEY NOT NULL,
	`creator_id` text NOT NULL,
	`kind` text NOT NULL,
	`item_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_creator_items_creator` ON `creator_items` (`creator_id`,`kind`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_creator_items_unique` ON `creator_items` (`creator_id`,`kind`,`item_id`);--> statement-breakpoint
CREATE TABLE `creator_links` (
	`id` text PRIMARY KEY NOT NULL,
	`creator_id` text NOT NULL,
	`platform` text NOT NULL,
	`url` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_creator_links_creator` ON `creator_links` (`creator_id`,`position`);--> statement-breakpoint
ALTER TABLE `creators` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `creators` ADD `bio` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `creators` ADD `status` text DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE `creators` ADD `moderated_at` text;--> statement-breakpoint
ALTER TABLE `creators` ADD `note` text;--> statement-breakpoint
ALTER TABLE `creators` ADD `updated_at` text;--> statement-breakpoint
CREATE INDEX `idx_creators_status_position` ON `creators` (`status`,`position`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_creators_user_status` ON `creators` (`user_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_creators_name_nocase` ON `creators` ("name" COLLATE NOCASE) WHERE status != 'withdrawn';