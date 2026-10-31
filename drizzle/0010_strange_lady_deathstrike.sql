CREATE TABLE `replays` (
	`code` text PRIMARY KEY NOT NULL,
	`team_size` integer NOT NULL,
	`mvp_name` text,
	`mode_key` text NOT NULL,
	`owner_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`moderated_at` text,
	`note` text
);
--> statement-breakpoint
CREATE INDEX `idx_replays_status_created` ON `replays` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_replays_owner_created` ON `replays` (`owner_id`,`created_at`);