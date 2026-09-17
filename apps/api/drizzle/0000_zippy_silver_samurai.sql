CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_id` integer,
	`action` text NOT NULL,
	`entity` text,
	`entity_id` integer,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `candidates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`position` text NOT NULL,
	`image` text DEFAULT '/images/default-candidate.jpg' NOT NULL,
	`votes` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `elections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text DEFAULT 'General Election' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`start_time` integer,
	`end_time` integer
);
--> statement-breakpoint
CREATE TABLE `issues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`class_name` text NOT NULL,
	`problem` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `refresh_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `refresh_tokens_token_hash_unique` ON `refresh_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`voter_id` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'student' NOT NULL,
	`voter_category` text,
	`class_or_dept` text DEFAULT '' NOT NULL,
	`has_voted` integer DEFAULT false NOT NULL,
	`is_suspended` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_voter_id_unique` ON `users` (`voter_id`);--> statement-breakpoint
CREATE TABLE `vote_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`voter_id` integer NOT NULL,
	`candidate_id` integer NOT NULL,
	`position` text NOT NULL,
	`voter_category` text,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`voter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vote_logs_voter_position_unique` ON `vote_logs` (`voter_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `vote_logs_voter_idempotency_unique` ON `vote_logs` (`voter_id`,`idempotency_key`);