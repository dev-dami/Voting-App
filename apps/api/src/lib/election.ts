import type { Db } from "../db/connection";
import { type Election, elections } from "../db/schema";

export interface ElectionPayload {
	name: string;
	status: "pending" | "running" | "ended";
	startTime: string | null;
	endTime: string | null;
}

export function toElectionPayload(election: Election): ElectionPayload {
	return {
		name: election.name,
		status: election.status,
		startTime: election.startTime ? election.startTime.toISOString() : null,
		endTime: election.endTime ? election.endTime.toISOString() : null,
	};
}

export async function getOrCreateElection(db: Db): Promise<Election> {
	const rows = await db.select().from(elections).limit(1);
	const existing = rows[0];
	if (existing) return existing;
	const inserted = await db.insert(elections).values({}).returning();
	const created = inserted[0];
	if (!created) throw new Error("failed to initialize election row");
	return created;
}
