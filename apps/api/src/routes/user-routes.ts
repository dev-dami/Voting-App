import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { getDb } from "../db/connection";
import {
	auditLogs,
	candidates,
	type User,
	users,
	voteLogs,
} from "../db/schema";
import { hashPassword, requireRole } from "../lib/auth";
import { BadRequestError, ConflictError, NotFoundError } from "../lib/errors";
import { log } from "../lib/log";
import {
	defaultCategoryFor,
	type UserRole,
	type VoterCategory,
} from "../lib/roles";

const roleType = t.Union([
	t.Literal("student"),
	t.Literal("teaching_staff"),
	t.Literal("non_teaching_staff"),
	t.Literal("official"),
	t.Literal("admin"),
]);
const categoryType = t.Union([
	t.Literal("student"),
	t.Literal("teaching_staff"),
	t.Literal("non_teaching_staff"),
]);

function userPayload(user: User): {
	id: string;
	studentId: string;
	role: UserRole;
	voterCategory: VoterCategory | null;
	classOrDept: string;
	hasVoted: boolean;
	isSuspended: boolean;
	createdAt: string;
} {
	return {
		id: String(user.id),
		studentId: user.voterId,
		role: user.role,
		voterCategory: user.voterCategory,
		classOrDept: user.classOrDept,
		hasVoted: user.hasVoted,
		isSuspended: user.isSuspended,
		createdAt: user.createdAt.toISOString(),
	};
}

function parseId(raw: string): number {
	const id = Number(raw);
	if (!Number.isInteger(id)) throw new BadRequestError("invalid user id");
	return id;
}

async function findUserOrThrow(id: number): Promise<User> {
	const rows = await getDb()
		.select()
		.from(users)
		.where(eq(users.id, id))
		.limit(1);
	const user = rows[0];
	if (!user) throw new NotFoundError("user not found");
	return user;
}

export const userRoutes = new Elysia({ prefix: "/users" })
	.use(requireRole("admin"))
	.get("/", async () => {
		const rows = await getDb().select().from(users);
		return { users: rows.map(userPayload) };
	})
	.post(
		"/",
		async ({ body, set }) => {
			const voterId = (body.voterId ?? body.studentId)?.trim();
			if (!voterId) throw new BadRequestError("voter id is required");
			if (body.password.length < 6)
				throw new BadRequestError("password must be at least 6 characters");
			const db = getDb();
			const existing = await db
				.select({ id: users.id })
				.from(users)
				.where(eq(users.voterId, voterId))
				.limit(1);
			if (existing[0]) throw new ConflictError("voter already exists");
			const role = (body.role ?? "student") as UserRole;
			const inserted = await db
				.insert(users)
				.values({
					voterId,
					passwordHash: await hashPassword(body.password),
					role,
					voterCategory: body.voterCategory ?? defaultCategoryFor(role),
					classOrDept: body.classOrDept?.trim() ?? "",
				})
				.returning();
			const created = inserted[0];
			if (!created) throw new Error("failed to create user");
			log.info("user created", { userId: created.id, role });
			set.status = 201;
			return userPayload(created);
		},
		{
			body: t.Object({
				voterId: t.Optional(t.String({ minLength: 1 })),
				studentId: t.Optional(t.String({ minLength: 1 })),
				password: t.String({ minLength: 1 }),
				role: t.Optional(roleType),
				voterCategory: t.Optional(categoryType),
				classOrDept: t.Optional(t.String()),
			}),
		},
	)
	.post(
		"/import",
		async ({ body }) => {
			const db = getDb();
			let created = 0;
			let skipped = 0;
			for (const row of body.users) {
				const voterId = (row.voterId ?? row.studentId)?.trim();
				if (!voterId || row.password.length < 6) {
					skipped += 1;
					continue;
				}
				const existing = await db
					.select({ id: users.id })
					.from(users)
					.where(eq(users.voterId, voterId))
					.limit(1);
				if (existing[0]) {
					skipped += 1;
					continue;
				}
				const role = (row.role ?? "student") as UserRole;
				await db.insert(users).values({
					voterId,
					passwordHash: await hashPassword(row.password),
					role,
					voterCategory: row.voterCategory ?? defaultCategoryFor(role),
					classOrDept: row.classOrDept?.trim() ?? "",
				});
				created += 1;
			}
			log.info("users imported", { created, skipped });
			return { created, skipped };
		},
		{
			body: t.Object({
				users: t.Array(
					t.Object({
						voterId: t.Optional(t.String({ minLength: 1 })),
						studentId: t.Optional(t.String({ minLength: 1 })),
						password: t.String({ minLength: 1 }),
						role: t.Optional(roleType),
						voterCategory: t.Optional(categoryType),
						classOrDept: t.Optional(t.String()),
					}),
				),
			}),
		},
	)
	.delete("/:id", async ({ params }) => {
		const user = await findUserOrThrow(parseId(params.id));
		const refs = await getDb()
			.select({ id: voteLogs.id })
			.from(voteLogs)
			.where(eq(voteLogs.voterId, user.id))
			.limit(1);
		if (refs[0])
			throw new ConflictError("user has recorded votes; reset votes first");
		await getDb().delete(users).where(eq(users.id, user.id));
		log.info("user deleted", { userId: user.id });
		return { deleted: true };
	})
	.post("/:id/suspend", async ({ params }) => {
		const user = await findUserOrThrow(parseId(params.id));
		const updated = await getDb()
			.update(users)
			.set({ isSuspended: true })
			.where(eq(users.id, user.id))
			.returning();
		const row = updated[0];
		if (!row) throw new Error("failed to suspend user");
		log.info("user suspended", { userId: row.id });
		return userPayload(row);
	})
	.post("/:id/enable", async ({ params }) => {
		const user = await findUserOrThrow(parseId(params.id));
		const updated = await getDb()
			.update(users)
			.set({ isSuspended: false })
			.where(eq(users.id, user.id))
			.returning();
		const row = updated[0];
		if (!row) throw new Error("failed to enable user");
		log.info("user enabled", { userId: row.id });
		return userPayload(row);
	})
	.post(
		"/:id/reset-password",
		async ({ params, body }) => {
			const user = await findUserOrThrow(parseId(params.id));
			if (body.password.length < 6) {
				throw new BadRequestError("password must be at least 6 characters");
			}
			await getDb()
				.update(users)
				.set({ passwordHash: await hashPassword(body.password) })
				.where(eq(users.id, user.id));
			log.info("password reset", { userId: user.id });
			return { updated: true };
		},
		{ body: t.Object({ password: t.String({ minLength: 1 }) }) },
	)
	.post("/:id/reset-votes", async ({ params }) => {
		const user = await findUserOrThrow(parseId(params.id));
		const db = getDb();
		const logs = await db
			.select()
			.from(voteLogs)
			.where(eq(voteLogs.voterId, user.id));
		await db.transaction(async (tx) => {
			for (const entry of logs) {
				const rows = await tx
					.select()
					.from(candidates)
					.where(eq(candidates.id, entry.candidateId))
					.limit(1);
				const candidate = rows[0];
				if (candidate) {
					await tx
						.update(candidates)
						.set({ votes: Math.max(0, candidate.votes - 1) })
						.where(eq(candidates.id, candidate.id));
				}
			}
			await tx.delete(voteLogs).where(eq(voteLogs.voterId, user.id));
			await tx
				.update(users)
				.set({ hasVoted: false })
				.where(eq(users.id, user.id));
			await tx.insert(auditLogs).values({
				action: "user.votes_reset",
				entity: "users",
				entityId: user.id,
			});
		});
		const refreshed = await findUserOrThrow(user.id);
		log.info("user votes reset", { userId: user.id, cleared: logs.length });
		return userPayload(refreshed);
	});
