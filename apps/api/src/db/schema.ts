import {
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	voterId: text("voter_id").notNull().unique(),
	passwordHash: text("password_hash").notNull(),
	role: text("role", {
		enum: [
			"student",
			"teaching_staff",
			"non_teaching_staff",
			"official",
			"admin",
		],
	})
		.notNull()
		.default("student"),
	voterCategory: text("voter_category", {
		enum: ["student", "teaching_staff", "non_teaching_staff"],
	}),
	classOrDept: text("class_or_dept").notNull().default(""),
	hasVoted: integer("has_voted", { mode: "boolean" }).notNull().default(false),
	isSuspended: integer("is_suspended", { mode: "boolean" })
		.notNull()
		.default(false),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export const candidates = sqliteTable("candidates", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	position: text("position").notNull(),
	image: text("image").notNull().default("/images/default-candidate.jpg"),
	votes: integer("votes").notNull().default(0),
});

export const elections = sqliteTable("elections", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull().default("General Election"),
	status: text("status", { enum: ["pending", "running", "ended"] })
		.notNull()
		.default("pending"),
	startTime: integer("start_time", { mode: "timestamp_ms" }),
	endTime: integer("end_time", { mode: "timestamp_ms" }),
});

export const voteLogs = sqliteTable(
	"vote_logs",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		voterId: integer("voter_id")
			.notNull()
			.references(() => users.id),
		candidateId: integer("candidate_id")
			.notNull()
			.references(() => candidates.id),
		position: text("position").notNull(),
		voterCategory: text("voter_category", {
			enum: ["student", "teaching_staff", "non_teaching_staff"],
		}),
		idempotencyKey: text("idempotency_key").notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(t) => [
		uniqueIndex("vote_logs_voter_position_unique").on(t.voterId, t.position),
		uniqueIndex("vote_logs_voter_idempotency_unique").on(
			t.voterId,
			t.idempotencyKey,
			t.position,
		),
	],
);

export const issues = sqliteTable("issues", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	className: text("class_name").notNull(),
	problem: text("problem").notNull(),
	status: text("status", { enum: ["pending", "in-progress", "resolved"] })
		.notNull()
		.default("pending"),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export const auditLogs = sqliteTable("audit_logs", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	actorId: integer("actor_id").references(() => users.id),
	action: text("action").notNull(),
	entity: text("entity"),
	entityId: integer("entity_id"),
	metadata: text("metadata"),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export const refreshTokens = sqliteTable("refresh_tokens", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	userId: integer("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	tokenHash: text("token_hash").notNull().unique(),
	expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
	revoked: integer("revoked", { mode: "boolean" }).notNull().default(false),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Candidate = typeof candidates.$inferSelect;
export type NewCandidate = typeof candidates.$inferInsert;
export type Election = typeof elections.$inferSelect;
export type NewElection = typeof elections.$inferInsert;
export type VoteLog = typeof voteLogs.$inferSelect;
export type NewVoteLog = typeof voteLogs.$inferInsert;
export type Issue = typeof issues.$inferSelect;
export type NewIssue = typeof issues.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
