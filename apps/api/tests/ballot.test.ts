import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import type { Db } from "../src/db/connection";
import * as schema from "../src/db/schema";
import { candidates, elections, users, voteLogs } from "../src/db/schema";
import { castBallot } from "../src/lib/ballot";
import {
	ConflictError,
	ElectionNotRunningError,
	ForbiddenError,
} from "../src/lib/errors";
import { percentageFor, positionResults } from "../src/lib/results";

const DRIZZLE_DIR = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"drizzle",
);
// Applies every generated migration in filename order (see meta/_journal.json).
const MIGRATION_SQL = readdirSync(DRIZZLE_DIR)
	.filter((name) => name.endsWith(".sql"))
	.sort()
	.map((name) => readFileSync(join(DRIZZLE_DIR, name), "utf8"))
	.join("\n");

function createTestDb(): Db {
	const sqlite = new Database(":memory:");
	sqlite.exec("PRAGMA foreign_keys = ON;");
	for (const statement of MIGRATION_SQL.split("--> statement-breakpoint")) {
		if (statement.trim().length > 0) sqlite.exec(statement);
	}
	return drizzle(sqlite, { schema });
}

async function seedRunningElection(
	db: Db,
	status: "pending" | "running" | "ended",
): Promise<void> {
	await db.insert(elections).values({
		name: "General Election",
		status,
		startTime: new Date(),
		endTime: new Date(Date.now() + 3_600_000),
	});
}

async function seedVoter(
	db: Db,
	voterId: string,
	overrides?: Partial<typeof users.$inferInsert>,
): Promise<number> {
	const rows = await db
		.insert(users)
		.values({
			voterId,
			passwordHash: "not-a-real-hash",
			role: "student",
			voterCategory: "student",
			classOrDept: "JSS1",
			...overrides,
		})
		.returning({ id: users.id });
	const row = rows[0];
	if (!row) throw new Error("failed to seed voter");
	return row.id;
}

async function seedPosition(
	db: Db,
	position: string,
	names: string[],
): Promise<number[]> {
	const ids: number[] = [];
	for (const name of names) {
		const rows = await db
			.insert(candidates)
			.values({ name, position })
			.returning({ id: candidates.id });
		const row = rows[0];
		if (!row) throw new Error("failed to seed candidate");
		ids.push(row.id);
	}
	return ids;
}

async function candidateVotes(db: Db, id: number): Promise<number> {
	const rows = await db
		.select({ votes: candidates.votes })
		.from(candidates)
		.where(eq(candidates.id, id));
	return rows[0]?.votes ?? -1;
}

async function voteLogCount(db: Db): Promise<number> {
	const rows = await db.select({ id: voteLogs.id }).from(voteLogs);
	return rows.length;
}

describe("ballot", () => {
	test("rejects a double vote via the per-position unique guard", async () => {
		const db = createTestDb();
		await seedRunningElection(db, "running");
		const voterId = await seedVoter(db, "STU001");
		const [first, second] = await seedPosition(db, "Head Boy", ["A", "B"]);
		if (first === undefined || second === undefined)
			throw new Error("seed failed");

		const slip = await castBallot(db, {
			voterId,
			selections: { "Head Boy": first },
			idempotencyKey: "key-1",
		});
		expect(slip).toHaveLength(1);
		expect(await candidateVotes(db, first)).toBe(1);

		let caught: unknown = null;
		try {
			await castBallot(db, {
				voterId,
				selections: { "Head Boy": second },
				idempotencyKey: "key-2",
			});
		} catch (err) {
			caught = err;
		}
		expect(caught).toBeInstanceOf(ConflictError);
		expect((caught as ConflictError).status).toBe(409);
		expect(await candidateVotes(db, first)).toBe(1);
		expect(await candidateVotes(db, second)).toBe(0);
	});

	test("replays an identical idempotency key without double counting", async () => {
		const db = createTestDb();
		await seedRunningElection(db, "running");
		const voterId = await seedVoter(db, "STU001");
		const [first] = await seedPosition(db, "Head Boy", ["A", "B"]);
		if (first === undefined) throw new Error("seed failed");

		const firstSlip = await castBallot(db, {
			voterId,
			selections: { "Head Boy": first },
			idempotencyKey: "same-key",
		});
		const replaySlip = await castBallot(db, {
			voterId,
			selections: { "Head Boy": first },
			idempotencyKey: "same-key",
		});
		expect(replaySlip).toEqual(firstSlip);
		expect(await candidateVotes(db, first)).toBe(1);
	});

	test("records every position from one submission sharing an idempotency key", async () => {
		const db = createTestDb();
		await seedRunningElection(db, "running");
		const voterId = await seedVoter(db, "STU004");
		const [, boy] = await seedPosition(db, "Head Boy", ["A", "B"]);
		const [girl] = await seedPosition(db, "Head Girl", ["C", "D"]);
		if (boy === undefined || girl === undefined) throw new Error("seed failed");

		const slip = await castBallot(db, {
			voterId,
			selections: { "Head Boy": boy, "Head Girl": girl },
			idempotencyKey: "shared-key",
		});
		expect(slip.map((s) => s.position).sort()).toEqual([
			"Head Boy",
			"Head Girl",
		]);
		expect(await voteLogCount(db)).toBe(2);
		expect(await candidateVotes(db, boy)).toBe(1);
		expect(await candidateVotes(db, girl)).toBe(1);

		// A rejected follow-up must not leave a half-written ballot behind.
		let caught: unknown = null;
		try {
			await castBallot(db, {
				voterId,
				selections: { "Head Boy": boy, "Head Girl": girl },
				idempotencyKey: "other-key",
			});
		} catch (err) {
			caught = err;
		}
		expect(caught).toBeInstanceOf(ConflictError);
		expect(await voteLogCount(db)).toBe(2);
		expect(await candidateVotes(db, boy)).toBe(1);
		expect(await candidateVotes(db, girl)).toBe(1);
	});

	test("blocks suspended voters", async () => {
		const db = createTestDb();
		await seedRunningElection(db, "running");
		const voterId = await seedVoter(db, "STU002", { isSuspended: true });
		const [first] = await seedPosition(db, "Head Boy", ["A", "B"]);
		if (first === undefined) throw new Error("seed failed");

		let caught: unknown = null;
		try {
			await castBallot(db, {
				voterId,
				selections: { "Head Boy": first },
				idempotencyKey: "k",
			});
		} catch (err) {
			caught = err;
		}
		expect(caught).toBeInstanceOf(ForbiddenError);
		expect((caught as ForbiddenError).status).toBe(403);
	});

	test("rejects votes when the election has ended", async () => {
		const db = createTestDb();
		await seedRunningElection(db, "ended");
		const voterId = await seedVoter(db, "STU003");
		const [first] = await seedPosition(db, "Head Boy", ["A", "B"]);
		if (first === undefined) throw new Error("seed failed");

		let caught: unknown = null;
		try {
			await castBallot(db, {
				voterId,
				selections: { "Head Boy": first },
				idempotencyKey: "k",
			});
		} catch (err) {
			caught = err;
		}
		expect(caught).toBeInstanceOf(ElectionNotRunningError);
	});
});

describe("results math", () => {
	test("computes per-position vote percentages", () => {
		const results = positionResults([
			{ id: 1, name: "A", position: "Head Boy", votes: 3 },
			{ id: 2, name: "B", position: "Head Boy", votes: 1 },
			{ id: 3, name: "C", position: "Head Girl", votes: 0 },
			{ id: 4, name: "D", position: "Head Girl", votes: 0 },
		]);
		const headBoy = results.find((r) => r.position === "Head Boy");
		const headGirl = results.find((r) => r.position === "Head Girl");
		expect(headBoy?.totalVotes).toBe(4);
		expect(headBoy?.candidates.map((c) => c.percentage)).toEqual([75, 25]);
		expect(headBoy?.winner?.name).toBe("A");
		expect(headGirl?.totalVotes).toBe(0);
		expect(headGirl?.candidates.map((c) => c.percentage)).toEqual([0, 0]);
		expect(headGirl?.winner).toBeNull();
		expect(percentageFor(1, 0)).toBe(0);
		expect(percentageFor(1, 3)).toBe(33.3);
	});
});
