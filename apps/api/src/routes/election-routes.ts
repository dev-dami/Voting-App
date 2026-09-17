import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { getDb } from "../db/connection";
import {
	auditLogs,
	candidates,
	elections,
	users,
	voteLogs,
} from "../db/schema";
import { type AuthUser, requireRole } from "../lib/auth";
import { getOrCreateElection, toElectionPayload } from "../lib/election";
import { BadRequestError } from "../lib/errors";
import { log } from "../lib/log";

export const electionRoutes = new Elysia({ prefix: "/election" })
	.get("/status", async () =>
		toElectionPayload(await getOrCreateElection(getDb())),
	)
	.use(requireRole("official", "admin"))
	.post(
		"/start",
		async ({ body, user }) => {
			const endTime = new Date(body.endTime);
			if (Number.isNaN(endTime.getTime()))
				throw new BadRequestError("valid endTime is required");
			if (endTime.getTime() <= Date.now())
				throw new BadRequestError("end time must be in the future");
			const db = getDb();
			const election = await getOrCreateElection(db);
			const now = new Date();
			await db
				.update(elections)
				.set({
					status: "running",
					startTime: now,
					endTime,
					...(body.name ? { name: body.name } : {}),
				})
				.where(eq(elections.id, election.id));
			await db.insert(auditLogs).values({
				actorId: (user as AuthUser).id,
				action: "election.start",
				entity: "elections",
				entityId: election.id,
			});
			log.info("election started", { endTime: endTime.toISOString() });
			return toElectionPayload(await getOrCreateElection(db));
		},
		{
			body: t.Object({
				endTime: t.String({ minLength: 1 }),
				name: t.Optional(t.String({ minLength: 1 })),
			}),
		},
	)
	.post("/end", async ({ user }) => {
		const db = getDb();
		const election = await getOrCreateElection(db);
		await db
			.update(elections)
			.set({ status: "ended" })
			.where(eq(elections.id, election.id));
		await db.insert(auditLogs).values({
			actorId: (user as AuthUser).id,
			action: "election.end",
			entity: "elections",
			entityId: election.id,
		});
		log.info("election ended", {});
		return toElectionPayload(await getOrCreateElection(db));
	})
	.use(requireRole("admin"))
	.post("/reset", async ({ user }) => {
		const db = getDb();
		const election = await getOrCreateElection(db);
		await db.update(candidates).set({ votes: 0 });
		await db.update(users).set({ hasVoted: false });
		await db.delete(voteLogs);
		await db
			.update(elections)
			.set({ status: "pending", startTime: null, endTime: null })
			.where(eq(elections.id, election.id));
		await db.insert(auditLogs).values({
			actorId: (user as AuthUser).id,
			action: "election.reset",
			entity: "elections",
			entityId: election.id,
		});
		log.info("election reset", {});
		return toElectionPayload(await getOrCreateElection(db));
	});
