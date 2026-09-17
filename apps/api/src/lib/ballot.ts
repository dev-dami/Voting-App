import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../db/connection";
import {
	auditLogs,
	candidates,
	type Election,
	elections,
	users,
	voteLogs,
} from "../db/schema";
import {
	BadRequestError,
	ConflictError,
	ElectionNotRunningError,
	ForbiddenError,
	NotFoundError,
} from "./errors";
import { canVoteRole } from "./roles";

export interface SlipEntry {
	position: string;
	candidateId: number;
	candidateName: string;
}

export interface CastBallotInput {
	voterId: number;
	selections: Record<string, number>;
	idempotencyKey: string;
}

export async function getRunningElection(db: Db): Promise<Election> {
	const rows = await db.select().from(elections).limit(1);
	const election = rows[0];
	if (election?.status !== "running") throw new ElectionNotRunningError();
	return election;
}

export function isUniqueViolation(err: unknown): boolean {
	if (typeof err !== "object" || err === null) return false;
	const code = (err as { code?: unknown }).code;
	const message = (err as { message?: unknown }).message;
	if (typeof message === "string" && /unique constraint failed/i.test(message))
		return true;
	return (
		typeof code === "string" &&
		code.includes("SQLITE_CONSTRAINT") &&
		typeof message === "string" &&
		/unique/i.test(message)
	);
}

async function slipForVoter(db: Db, voterId: number): Promise<SlipEntry[]> {
	const rows = await db
		.select({
			position: voteLogs.position,
			candidateId: voteLogs.candidateId,
			candidateName: candidates.name,
		})
		.from(voteLogs)
		.innerJoin(candidates, eq(voteLogs.candidateId, candidates.id))
		.where(eq(voteLogs.voterId, voterId));
	return rows.map((r) => ({
		position: r.position,
		candidateId: r.candidateId,
		candidateName: r.candidateName,
	}));
}

export async function getSlip(db: Db, voterId: number): Promise<SlipEntry[]> {
	const rows = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.id, voterId))
		.limit(1);
	if (!rows[0]) throw new NotFoundError("voter not found");
	return slipForVoter(db, voterId);
}

export async function castBallot(
	db: Db,
	input: CastBallotInput,
): Promise<SlipEntry[]> {
	await getRunningElection(db);
	const userRows = await db
		.select()
		.from(users)
		.where(eq(users.id, input.voterId))
		.limit(1);
	const user = userRows[0];
	if (!user) throw new NotFoundError("voter not found");
	if (user.isSuspended) throw new ForbiddenError("voter is suspended");
	if (!canVoteRole(user.role)) throw new ForbiddenError("role cannot vote");

	const replay = await db
		.select({ id: voteLogs.id })
		.from(voteLogs)
		.where(
			and(
				eq(voteLogs.voterId, user.id),
				eq(voteLogs.idempotencyKey, input.idempotencyKey),
			),
		)
		.limit(1);
	if (replay[0]) return slipForVoter(db, user.id);

	const positionRows = await db
		.selectDistinct({ position: candidates.position })
		.from(candidates);
	const positions = positionRows.map((r) => r.position);
	if (positions.length === 0)
		throw new ConflictError("no candidates configured");
	for (const position of positions) {
		if (input.selections[position] === undefined) {
			throw new BadRequestError(`select a candidate for ${position}`);
		}
	}

	const candidateRows = await db.select().from(candidates);
	const byId = new Map(candidateRows.map((c) => [c.id, c]));
	for (const [position, candidateId] of Object.entries(input.selections)) {
		const candidate = byId.get(candidateId);
		if (!candidate) throw new BadRequestError("invalid candidate selected");
		if (candidate.position !== position) {
			throw new BadRequestError(`candidate does not contest ${position}`);
		}
	}
	try {
		// bun:sqlite's session is synchronous: an async callback would let the
		// native transaction commit at the first await and leak later writes.
		db.transaction((tx) => {
			for (const [position, candidateId] of Object.entries(input.selections)) {
				tx.insert(voteLogs)
					.values({
						voterId: user.id,
						candidateId,
						position,
						voterCategory: user.voterCategory,
						idempotencyKey: input.idempotencyKey,
					})
					.run();
				tx.update(candidates)
					.set({ votes: sql`${candidates.votes} + 1` })
					.where(eq(candidates.id, candidateId))
					.run();
			}
			const voted = tx
				.select({ position: voteLogs.position })
				.from(voteLogs)
				.where(eq(voteLogs.voterId, user.id))
				.all();
			const votedPositions = new Set(voted.map((v) => v.position));
			if (positions.every((p) => votedPositions.has(p))) {
				tx.update(users)
					.set({ hasVoted: true })
					.where(eq(users.id, user.id))
					.run();
			}
			tx.insert(auditLogs)
				.values({
					actorId: user.id,
					action: "ballot.cast",
					entity: "vote_logs",
					metadata: JSON.stringify({
						positions: Object.keys(input.selections),
					}),
				})
				.run();
		});
	} catch (err) {
		if (err instanceof ElectionNotRunningError) throw err;
		if (isUniqueViolation(err)) {
			throw new ConflictError(
				"duplicate vote: this position was already voted for",
			);
		}
		throw err;
	}

	return slipForVoter(db, user.id);
}
