DROP INDEX IF EXISTS `tags_name_unique`;--> statement-breakpoint
ALTER TABLE `tags` ADD `normalized_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `tags` SET `normalized_name` = lower(`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_normalized_name_unique` ON `tags` (`normalized_name`);
