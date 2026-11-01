CREATE TABLE `replay_player_games` (
	`code` text NOT NULL,
	`season` text NOT NULL,
	`category` text NOT NULL,
	`player_name` text NOT NULL,
	`won` integer DEFAULT 0 NOT NULL,
	`mvp` integer DEFAULT 0 NOT NULL,
	`impact_pct` integer DEFAULT 0 NOT NULL,
	`mmr` integer,
	`kills` integer DEFAULT 0 NOT NULL,
	`units_lost` integer DEFAULT 0 NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`region` text,
	`bronze_nation` integer,
	`last_nation` integer,
	`last_age_research` integer,
	`medals` text DEFAULT '[]' NOT NULL,
	`units_by_age` text DEFAULT '[]' NOT NULL,
	`age_reach` text DEFAULT '[]' NOT NULL,
	`started_at` text NOT NULL,
	`duration_s` integer DEFAULT 0 NOT NULL,
	`team_size` integer DEFAULT 0 NOT NULL,
	`mode_key` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pk_replay_player_games` ON `replay_player_games` (`code`,`player_name`);--> statement-breakpoint
CREATE INDEX `idx_replay_player_games_name` ON `replay_player_games` (`player_name`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_replay_player_games_season` ON `replay_player_games` (`player_name`,`season`);