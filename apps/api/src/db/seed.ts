import { eq } from "drizzle-orm";
import { hashPassword } from "../lib/auth";
import { closeLogs, log } from "../lib/log";
import { getDb } from "./connection";
import { candidates, elections, users } from "./schema";

const DEMO_GROUPS: { position: string; names: [string, string] }[] = [
	{ position: "Head Boy", names: ["Adaeze Okafor", "Tunde Bakare"] },
	{ position: "Head Girl", names: ["Ngozi Eze", "Fatima Bello"] },
	{ position: "Sports Prefect", names: ["Emeka Obi", "Sarah Musa"] },
];

async function main(): Promise<void> {
	const db = getDb();
	const adminVoterId = process.env.ADMIN_VOTER_ID ?? "admin";
	const adminPassword = process.env.ADMIN_PASSWORD ?? "admin12345";
	const adminRows = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.voterId, adminVoterId))
		.limit(1);
	if (!adminRows[0]) {
		await db.insert(users).values({
			voterId: adminVoterId,
			passwordHash: await hashPassword(adminPassword),
			role: "admin",
		});
		log.info("admin seeded", { voterId: adminVoterId });
	}
	const electionRows = await db
		.select({ id: elections.id })
		.from(elections)
		.limit(1);
	if (!electionRows[0]) {
		await db.insert(elections).values({});
		log.info("election row seeded", {});
	}
	const candidateRows = await db
		.select({ id: candidates.id })
		.from(candidates)
		.limit(1);
	if (!candidateRows[0]) {
		for (const group of DEMO_GROUPS) {
			for (const name of group.names) {
				await db.insert(candidates).values({ name, position: group.position });
			}
		}
		log.info("demo candidates seeded", { positions: DEMO_GROUPS.length });
	}
	log.info("seed complete", {});
}

if (import.meta.main) {
	try {
		await main();
	} catch (err) {
		log.error(
			"seed failed",
			err instanceof Error ? err : new Error(String(err)),
		);
		process.exitCode = 1;
	} finally {
		await closeLogs();
	}
}
