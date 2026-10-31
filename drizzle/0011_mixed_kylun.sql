CREATE TABLE `player_stats` (
	`season` text NOT NULL,
	`category` text NOT NULL,
	`player_name` text NOT NULL,
	`games` integer DEFAULT 0 NOT NULL,
	`wins` integer DEFAULT 0 NOT NULL,
	`mvps` integer DEFAULT 0 NOT NULL,
	`kills` integer DEFAULT 0 NOT NULL,
	`losses` integer DEFAULT 0 NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`last_played` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pk_player_stats` ON `player_stats` (`season`,`category`,`player_name`);--> statement-breakpoint
CREATE TABLE `replay_results` (
	`code` text PRIMARY KEY NOT NULL,
	`season` text NOT NULL,
	`category` text NOT NULL,
	`started_at` text NOT NULL,
	`duration_s` integer NOT NULL,
	`mode_key` text NOT NULL,
	`team_size` integer NOT NULL,
	`region` text,
	`map_code` text,
	`data` text NOT NULL,
	`updated_at` text NOT NULL,
	`aggregated_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_replay_results_season` ON `replay_results` (`season`);