CREATE TABLE `replay_feedback` (
	`code` text NOT NULL,
	`user_id` text NOT NULL,
	`vote` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pk_replay_feedback` ON `replay_feedback` (`code`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_replay_feedback_user` ON `replay_feedback` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_replay_feedback_code` ON `replay_feedback` (`code`);