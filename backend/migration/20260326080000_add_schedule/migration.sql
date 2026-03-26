CREATE TABLE `schedule` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '',
	`cron` text NOT NULL,
	`command` text NOT NULL,
	`enabled` integer NOT NULL DEFAULT true,
	`last_run` integer,
	`next_run` integer,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL
);
