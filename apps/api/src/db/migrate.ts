import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { closeLogs, log } from "../lib/log";
import * as schema from "./schema";

function migrationsFolder(): string {
	const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
	return join(apiRoot, "drizzle");
}

export function runMigrations(databaseUrl?: string): string {
	const raw = databaseUrl ?? process.env.DATABASE_URL ?? "./data/voting.db";
	if (raw === ":memory:") throw new Error("migrations require a file database");
	const file = isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
	mkdirSync(dirname(file), { recursive: true });
	const sqlite = new Database(file, { create: true });
	sqlite.exec("PRAGMA journal_mode = WAL;");
	sqlite.exec("PRAGMA foreign_keys = ON;");
	try {
		migrate(drizzle(sqlite, { schema }), {
			migrationsFolder: migrationsFolder(),
		});
	} finally {
		sqlite.close();
	}
	log.info("migrations applied", { database: file });
	return file;
}

async function main(): Promise<void> {
	runMigrations();
}

if (import.meta.main) {
	try {
		await main();
	} catch (err) {
		log.error(
			"migration failed",
			err instanceof Error ? err : new Error(String(err)),
		);
		process.exitCode = 1;
	} finally {
		await closeLogs();
	}
}
