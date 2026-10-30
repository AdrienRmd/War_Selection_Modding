ALTER TABLE `maps` ADD `test_status` text DEFAULT 'untested' NOT NULL;--> statement-breakpoint
ALTER TABLE `maps` ADD `test_updated_at` text;--> statement-breakpoint
ALTER TABLE `maps` ADD `test_set_by` text;--> statement-breakpoint
ALTER TABLE `maps` ADD `test_notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `maps` ADD `author_verified` integer DEFAULT 0 NOT NULL;