DROP INDEX `vote_logs_voter_idempotency_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `vote_logs_voter_idempotency_unique` ON `vote_logs` (`voter_id`,`idempotency_key`,`position`);
