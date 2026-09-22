CREATE TABLE `maps` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`author` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`description` text NOT NULL,
	`game_version` text NOT NULL,
	`players` integer NOT NULL,
	`category` text NOT NULL,
	`mods` text NOT NULL,
	`map_code` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`file_name` text NOT NULL,
	`file_key` text NOT NULL,
	`file_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`cover_key` text,
	`cover_type` text,
	`created_at` text NOT NULL,
	`reviewed_at` text,
	`feedback` text DEFAULT '' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`review_token` text
);
--> statement-breakpoint
CREATE INDEX `idx_maps_status_created` ON `maps` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_maps_owner_created` ON `maps` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`map_id` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`action` text NOT NULL,
	`feedback` text NOT NULL,
	`checklist` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_reviews_map` ON `reviews` (`map_id`,`created_at`);