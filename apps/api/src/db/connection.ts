import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

export type Db = BunSQLiteDatabase<typeof schema>;

let instance: Db | null = null;

export function getDb(databaseUrl?: string): Db {
	if (instance) return instance;
	const raw = databaseUrl ?? process.env.DATABASE_URL ?? "./data/voting.db";
	if (raw === ":memory:") {
		const sqlite = new Database(":memory:");
		sqlite.exec("PRAGMA foreign_keys = ON;");
		instance = drizzle(sqlite, { schema });
		return instance;
	}
	const file = isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
	mkdirSync(dirname(file), { recursive: true });
	const sqlite = new Database(file, { create: true });
	sqlite.exec("PRAGMA journal_mode = WAL;");
	sqlite.exec("PRAGMA foreign_keys = ON;");
	instance = drizzle(sqlite, { schema });
	return instance;
}
