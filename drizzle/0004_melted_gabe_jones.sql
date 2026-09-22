CREATE TABLE `auth_attempts` (
	`attempt_key` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_auth_attempts_window` ON `auth_attempts` (`window_start`);