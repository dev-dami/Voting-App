// Run once, with the production environment and data volume mounted.
// Unlike db:seed, this never inserts demonstration candidates.
import { eq } from "drizzle-orm";
import { getDb } from "../src/db/connection";
import { users } from "../src/db/schema";
import { hashPassword } from "../src/lib/auth";
import { getOrCreateElection } from "../src/lib/election";
import { closeLogs } from "../src/lib/log";

try {
	const password = process.env.ADMIN_PASSWORD;
	if (!password || password.length < 20) throw new Error("ADMIN_PASSWORD must contain at least 20 characters");
	const voterId = process.env.ADMIN_VOTER_ID ?? "admin";
	const db = getDb();
	const existing = db.select().from(users).where(eq(users.voterId, voterId)).get();
	if (!existing) {
		await db.insert(users).values({ voterId, passwordHash: await hashPassword(password), role: "admin" });
	} else if (existing.role !== "admin") {
		throw new Error("Configured administrator ID already belongs to another role");
	}
	await getOrCreateElection(db);
} finally {
	await closeLogs();
}
