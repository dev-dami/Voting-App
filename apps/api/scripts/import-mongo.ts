// One-shot import from the legacy Express/Mongo app into SQLite. Run once at cutover:
//   MONGO_URI=mongodb://localhost:27017/voting-app DATABASE_URL=../../data/voting.db bun run scripts/import-mongo.ts
// (DATABASE_URL is resolved from apps/api cwd; point it at the real db file.)
// WHY: legacy data lives in Mongo (see repo-root models/*.js); the new API reads SQLite.
// Password hashes are bcrypt and verify as-is under Bun.password.verify.
import mongoose from "mongoose";
import { getDb } from "../db/connection";
import {
	auditLogs,
	candidates,
	elections,
	issues,
	users,
	voteLogs,
} from "../db/schema";
import { closeLogs, log } from "../lib/log";

// Legacy "Libary Prefect" typo predates packages/shared LEGACY_POSITION_ALIASES.
const LEGACY_POSITION_FIX: Record<string, string> = {
	"Libary Prefect": "Library Prefect",
};

interface LegacyStudent {
	_id: mongoose.Types.ObjectId;
	studentId: string;
	password: string;
	role?: string;
	hasVoted?: boolean;
	isSuspended?: boolean;
	createdAt?: Date;
}

interface LegacyCandidate {
	_id: mongoose.Types.ObjectId;
	name: string;
	position: string;
	votes?: number;
	image?: string;
}

interface LegacyVoteLog {
	_id: mongoose.Types.ObjectId;
	studentId?: mongoose.Types.ObjectId;
	candidateId?: mongoose.Types.ObjectId;
	position: string;
	createdAt?: Date;
}

interface LegacyElection {
	name?: string;
	status?: string;
	startTime?: Date | null;
	endTime?: Date | null;
}

interface LegacyIssue {
	name: string;
	className: string;
	problem: string;
	status?: string;
	createdAt?: Date;
}

const studentSchema = new mongoose.Schema(
	{
		studentId: String,
		password: String,
		role: String,
		hasVoted: Boolean,
		isSuspended: Boolean,
	},
	{ collection: "students", timestamps: true },
);
const candidateSchema = new mongoose.Schema(
	{ name: String, position: String, votes: Number, image: String },
	{ collection: "candidates" },
);
const voteLogSchema = new mongoose.Schema(
	{
		studentId: mongoose.Schema.Types.ObjectId,
		candidateId: mongoose.Schema.Types.ObjectId,
		position: String,
	},
	{ collection: "votelogs", timestamps: true },
);
const electionSchema = new mongoose.Schema(
	{ name: String, status: String, startTime: Date, endTime: Date },
	{ collection: "elections" },
);
const issueSchema = new mongoose.Schema(
	{ name: String, className: String, problem: String, status: String },
	{ collection: "issues", timestamps: true },
);

function toRole(
	raw: string | undefined,
): "student" | "teaching_staff" | "official" | "admin" {
	if (raw === "teacher") return "teaching_staff";
	return "student";
}

async function main(): Promise<void> {
	const mongoUri = process.env.MONGO_URI ?? process.env.MONGODB_URI;
	if (!mongoUri) throw new Error("MONGO_URI (or MONGODB_URI) is not set");
	await mongoose.connect(mongoUri);

	const Student = mongoose.model<LegacyStudent>("ImportStudent", studentSchema);
	const Candidate = mongoose.model<LegacyCandidate>(
		"ImportCandidate",
		candidateSchema,
	);
	const VoteLog = mongoose.model<LegacyVoteLog>("ImportVoteLog", voteLogSchema);
	const Election = mongoose.model<LegacyElection>(
		"ImportElection",
		electionSchema,
	);
	const Issue = mongoose.model<LegacyIssue>("ImportIssue", issueSchema);

	const [students, candDocs, logs, electionDocs, issueDocs] = await Promise.all(
		[
			Student.find().lean(),
			Candidate.find().lean(),
			VoteLog.find().lean(),
			Election.find().lean(),
			Issue.find().lean(),
		],
	);

	const db = getDb();
	const userIdByMongo = new Map<string, number>();
	const candidateIdByMongo = new Map<string, number>();

	await db.transaction(async (tx) => {
		for (const s of students) {
			const role = toRole(s.role);
			const inserted = await tx
				.insert(users)
				.values({
					voterId: s.studentId,
					passwordHash: s.password,
					role,
					voterCategory: role === "student" ? "student" : "teaching_staff",
					classOrDept: "",
					hasVoted: s.hasVoted ?? false,
					isSuspended: s.isSuspended ?? false,
					createdAt: s.createdAt ?? new Date(),
				})
				.returning({ id: users.id });
			const row = inserted[0];
			if (row) userIdByMongo.set(String(s._id), row.id);
		}
		for (const c of candDocs) {
			const inserted = await tx
				.insert(candidates)
				.values({
					name: c.name,
					position: LEGACY_POSITION_FIX[c.position] ?? c.position,
					image: c.image ?? "/images/default-candidate.jpg",
					votes: c.votes ?? 0,
				})
				.returning({ id: candidates.id });
			const row = inserted[0];
			if (row) candidateIdByMongo.set(String(c._id), row.id);
		}
		const election = electionDocs[0];
		if (election) {
			await tx.insert(elections).values({
				name: election.name ?? "General Election",
				status:
					election.status === "running" || election.status === "ended"
						? election.status
						: "pending",
				startTime: election.startTime ?? null,
				endTime: election.endTime ?? null,
			});
		}
		for (const issue of issueDocs) {
			await tx.insert(issues).values({
				name: issue.name,
				className: issue.className,
				problem: issue.problem,
				status:
					issue.status === "in-progress" || issue.status === "resolved"
						? issue.status
						: "pending",
				createdAt: issue.createdAt ?? new Date(),
			});
		}
		let skippedVotes = 0;
		for (const v of logs) {
			const voterId = v.studentId
				? userIdByMongo.get(String(v.studentId))
				: undefined;
			const candidateId = v.candidateId
				? candidateIdByMongo.get(String(v.candidateId))
				: undefined;
			if (!voterId || !candidateId) {
				skippedVotes += 1;
				continue;
			}
			const voter = students.find((s) => String(s._id) === String(v.studentId));
			await tx.insert(voteLogs).values({
				voterId,
				candidateId,
				position: v.position,
				voterCategory:
					toRole(voter?.role) === "student" ? "student" : "teaching_staff",
				idempotencyKey: `legacy:${String(v._id)}`,
				createdAt: v.createdAt ?? new Date(),
			});
		}
		await tx.insert(auditLogs).values({
			action: "import.mongo",
			entity: "database",
			metadata: JSON.stringify({
				students: students.length,
				candidates: candDocs.length,
				voteLogs: logs.length - skippedVotes,
				skippedVotes,
				issues: issueDocs.length,
			}),
		});
		log.info("mongo import complete", {
			students: students.length,
			candidates: candDocs.length,
			voteLogs: logs.length,
			issues: issueDocs.length,
		});
	});

	await mongoose.disconnect();
	await closeLogs();
}

await main();
