CREATE TABLE `access_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`user_email` text NOT NULL,
	`action` text NOT NULL,
	`entry_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `access_log_created_at_idx` ON `access_log` (`created_at`);
