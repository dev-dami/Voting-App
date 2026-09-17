import { desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { getDb } from "../db/connection";
import { type Issue, issues } from "../db/schema";
import { requireRole } from "../lib/auth";
import { BadRequestError, NotFoundError } from "../lib/errors";
import { log } from "../lib/log";
import { clientIp, consumeOrThrow, issueLimiter } from "../lib/rate-limit";

const ISSUE_STATUSES = ["pending", "in-progress", "resolved"] as const;
type IssueStatus = (typeof ISSUE_STATUSES)[number];

function issuePayload(issue: Issue): {
	id: string;
	name: string;
	className: string;
	problem: string;
	status: IssueStatus;
	createdAt: string;
} {
	return {
		id: String(issue.id),
		name: issue.name,
		className: issue.className,
		problem: issue.problem,
		status: issue.status,
		createdAt: issue.createdAt.toISOString(),
	};
}

export const issueRoutes = new Elysia({ prefix: "/issues" })
	.post(
		"/",
		async ({ body, headers, set }) => {
			consumeOrThrow(
				issueLimiter,
				clientIp(headers as Record<string, string | undefined>),
			);
			if (!body.name.trim() || !body.className.trim() || !body.problem.trim()) {
				throw new BadRequestError("name, className, and problem are required");
			}
			const inserted = await getDb()
				.insert(issues)
				.values({
					name: body.name.trim(),
					className: body.className.trim(),
					problem: body.problem.trim(),
				})
				.returning();
			const created = inserted[0];
			if (!created) throw new Error("failed to submit issue");
			log.info("issue submitted", { issueId: created.id });
			set.status = 201;
			return issuePayload(created);
		},
		{
			body: t.Object({
				name: t.String({ minLength: 1 }),
				className: t.String({ minLength: 1 }),
				problem: t.String({ minLength: 1 }),
			}),
		},
	)
	.use(requireRole("official", "admin"))
	.get("/", async ({ query }) => {
		const db = getDb();
		const rows =
			query.status && ISSUE_STATUSES.includes(query.status as IssueStatus)
				? await db
						.select()
						.from(issues)
						.where(eq(issues.status, query.status as IssueStatus))
						.orderBy(desc(issues.createdAt))
				: await db.select().from(issues).orderBy(desc(issues.createdAt));
		return { issues: rows.map(issuePayload) };
	})
	.use(requireRole("admin"))
	.patch(
		"/:id/status",
		async ({ params, body }) => {
			const id = Number(params.id);
			if (!Number.isInteger(id)) throw new BadRequestError("invalid issue id");
			const db = getDb();
			const updated = await db
				.update(issues)
				.set({ status: body.status })
				.where(eq(issues.id, id))
				.returning();
			const row = updated[0];
			if (!row) throw new NotFoundError("issue not found");
			log.info("issue status updated", { issueId: row.id, status: row.status });
			return issuePayload(row);
		},
		{
			body: t.Object({
				status: t.Union([
					t.Literal("pending"),
					t.Literal("in-progress"),
					t.Literal("resolved"),
				]),
			}),
		},
	);
