// One-off: sync seeded admin password with ADMIN_PASSWORD from .env.
import { eq } from "drizzle-orm";
import { hashPassword } from "../src/lib/auth";
import { getDb } from "../src/db/connection";
import { users } from "../src/db/schema";

const voterId = process.env.ADMIN_VOTER_ID ?? "admin";
const password = process.env.ADMIN_PASSWORD;
if (!password) throw new Error("ADMIN_PASSWORD is not set");
const db = getDb();
await db
	.update(users)
	.set({ passwordHash: await hashPassword(password) })
	.where(eq(users.voterId, voterId));
console.log(`admin password synced for ${voterId}`);
process.exit(0);
