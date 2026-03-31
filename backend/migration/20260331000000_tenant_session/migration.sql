-- Recreate session table: replace project_id/workspace_id/directory/share/summary/revert
-- with tenant_id/user_id for multi-tenant isolation
CREATE TABLE `session_new` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL DEFAULT 'default',
	`user_id` text NOT NULL DEFAULT 'default',
	`parent_id` text,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`version` text NOT NULL,
	`permission` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	`time_compacting` integer,
	`time_archived` integer
);
--> statement-breakpoint
INSERT INTO `session_new` (`id`, `tenant_id`, `user_id`, `parent_id`, `slug`, `title`, `version`, `permission`, `time_created`, `time_updated`, `time_compacting`, `time_archived`)
SELECT `id`, 'default', 'default', `parent_id`, `slug`, `title`, `version`, `permission`, `time_created`, `time_updated`, `time_compacting`, `time_archived`
FROM `session`;
--> statement-breakpoint
DROP TABLE `session`;
--> statement-breakpoint
ALTER TABLE `session_new` RENAME TO `session`;
--> statement-breakpoint
CREATE INDEX `session_tenant_user_idx` ON `session` (`tenant_id`, `user_id`);
--> statement-breakpoint
CREATE INDEX `session_tenant_idx` ON `session` (`tenant_id`);
--> statement-breakpoint
CREATE INDEX `session_parent_idx` ON `session` (`parent_id`);
--> statement-breakpoint
DROP TABLE IF EXISTS `permission`;
--> statement-breakpoint
DROP TABLE IF EXISTS `session_share`;
--> statement-breakpoint
DROP TABLE IF EXISTS `project`;
