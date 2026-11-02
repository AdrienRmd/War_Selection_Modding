CREATE TABLE `map_captures` (
	`id` text PRIMARY KEY NOT NULL,
	`map_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`content_type` text NOT NULL,
	`caption` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`moderated_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_map_captures_map_status` ON `map_captures` (`map_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_map_captures_owner_created` ON `map_captures` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_map_captures_status_created` ON `map_captures` (`status`,`created_at`);