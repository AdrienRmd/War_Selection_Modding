ALTER TABLE `replays` ADD `source` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_replays_source_created` ON `replays` (`source`,`created_at`);