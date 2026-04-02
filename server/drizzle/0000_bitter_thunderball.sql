CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`issuer` text NOT NULL,
	`secret` text NOT NULL,
	`algorithm` text NOT NULL,
	`digits` integer NOT NULL,
	`period` integer NOT NULL
);
