CREATE TABLE `featured_maps` (
	`id` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`file_key` text,
	`file_name` text DEFAULT '' NOT NULL,
	`file_size` integer DEFAULT 0 NOT NULL,
	`sha256` text DEFAULT '' NOT NULL,
	`cover_key` text,
	`cover_type` text
);
