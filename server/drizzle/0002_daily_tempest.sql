PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`provider` text DEFAULT 'local' NOT NULL,
	`provider_id` text
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "email", "password_hash", "provider", "provider_id") SELECT "id", "email", "password_hash", "provider", "provider_id" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_provider_id_unique` ON `users` (`provider_id`);