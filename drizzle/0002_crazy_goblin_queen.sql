CREATE TABLE `community_mods` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text,
	`origin` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`feedback` text DEFAULT '' NOT NULL,
	`file_key` text,
	`file_name` text DEFAULT '' NOT NULL,
	`file_size` integer DEFAULT 0 NOT NULL,
	`sha256` text DEFAULT '' NOT NULL,
	`review_token` text
);
--> statement-breakpoint
CREATE INDEX `idx_mods_owner_status` ON `community_mods` (`owner_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_mods_status_created` ON `community_mods` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `mod_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`mod_id` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`action` text NOT NULL,
	`feedback` text NOT NULL,
	`checklist` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`mod_id`) REFERENCES `community_mods`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_mod_reviews_mod` ON `mod_reviews` (`mod_id`,`created_at`);