import { eq, inArray } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { getDb } from "../db/connection";
import { candidates, users } from "../db/schema";
import { authGuard, canVoteRole } from "../lib/auth";
import { castBallot, getRunningElection, getSlip } from "../lib/ballot";
import { BadRequestError, ForbiddenError } from "../lib/errors";
import { log } from "../lib/log";
import { ballotLimiter, consumeOrThrow } from "../lib/rate-limit";
import { broadcastToOfficials } from "./ws";

export const ballotRoutes = new Elysia()
	.use(authGuard)
	.get("/ballot", async ({ user }) => {
		const db = getDb();
		const election = await getRunningElection(db);
		const rows = await db
			.select()
			.from(users)
			.where(eq(users.id, user.id))
			.limit(1);
		const voter = rows[0];
		if (!voter) throw new ForbiddenError("voter not found");
		if (voter.isSuspended) throw new ForbiddenError("voter is suspended");
		if (!canVoteRole(voter.role)) throw new ForbiddenError("role cannot vote");
		const all = await db.select().from(candidates);
		const grouped: Record<
			string,
			{ id: string; name: string; position: string; image: string }[]
		> = {};
		for (const candidate of all) {
			const list = grouped[candidate.position] ?? [];
			list.push({
				id: String(candidate.id),
				name: candidate.name,
				position: candidate.position,
				image: candidate.image,
			});
			grouped[candidate.position] = list;
		}
		return {
			electionName: election.name,
			electionStatus: election.status,
			groupedCandidates: grouped,
		};
	})
	.post(
		"/ballot",
		async ({ user, body, headers }) => {
			consumeOrThrow(ballotLimiter, `ballot:${user.id}`);
			const headerKey = (headers as Record<string, string | undefined>)[
				"x-idempotency-key"
			];
			const idempotencyKey =
				headerKey ?? body.idempotencyKey ?? crypto.randomUUID();
			const selections: Record<string, number> = {};
			for (const [position, raw] of Object.entries(body.selections)) {
				const id = typeof raw === "number" ? raw : Number(raw);
				if (!Number.isInteger(id))
					throw new BadRequestError(`invalid candidate for ${position}`);
				selections[position] = id;
			}
			const slip = await castBallot(getDb(), {
				voterId: user.id,
				selections,
				idempotencyKey,
			});
			const ids = [...new Set(slip.map((s) => s.candidateId))];
			if (ids.length > 0) {
				const db = getDb();
				const updated = await db
					.select()
					.from(candidates)
					.where(inArray(candidates.id, ids));
				for (const entry of slip) {
					broadcastToOfficials("vote_cast", {
						voterId: user.voterId,
						candidateName: entry.candidateName,
						position: entry.position,
						createdAt: new Date().toISOString(),
					});
				}
				for (const candidate of updated) {
					broadcastToOfficials("vote_update", {
						candidateId: candidate.id,
						votes: candidate.votes,
					});
				}
			}
			log.info("ballot cast", {
				userId: user.id,
				positions: slip.map((s) => s.position),
			});
			return {
				votedPositions: slip.map((s) => ({
					position: s.position,
					candidateId: String(s.candidateId),
					candidateName: s.candidateName,
				})),
			};
		},
		{
			body: t.Object({
				selections: t.Record(t.String(), t.Union([t.Number(), t.String()])),
				idempotencyKey: t.Optional(t.String({ minLength: 1 })),
			}),
		},
	)
	.get("/ballot/slip", async ({ user }) => {
		const slip = await getSlip(getDb(), user.id);
		return {
			votedPositions: slip.map((s) => ({
				position: s.position,
				candidateId: String(s.candidateId),
				candidateName: s.candidateName,
			})),
		};
	});
