import { Elysia } from "elysia";
import { getDb } from "../db/connection";
import { candidates, users } from "../db/schema";
import { canVoteRole, requireRole } from "../lib/auth";
import { getOrCreateElection } from "../lib/election";
import { positionResults, turnoutSummary } from "../lib/results";

export const resultRoutes = new Elysia({ prefix: "/results" })
	.use(requireRole("official", "admin"))
	.get("/", async () => {
		const db = getDb();
		const election = await getOrCreateElection(db);
		const candidateRows = await db.select().from(candidates);
		const positions = positionResults(
			candidateRows.map((c) => ({
				id: c.id,
				name: c.name,
				position: c.position,
				votes: c.votes,
			})),
		);
		const voterRows = await db.select().from(users);
		const eligible = voterRows.filter((u) => canVoteRole(u.role));
		const turnout = turnoutSummary(
			eligible.map((u) => ({
				voterCategory: u.voterCategory,
				role: u.role,
				hasVoted: u.hasVoted,
			})),
		);
		return {
			electionName: election.name,
			electionStatus: election.status,
			startTime: election.startTime ? election.startTime.toISOString() : null,
			endTime: election.endTime ? election.endTime.toISOString() : null,
			totalVoters: turnout.totalVoters,
			totalVotes: turnout.totalVotes,
			turnoutPercentage: turnout.turnoutPercentage,
			positions: positions.map((p) => ({
				position: p.position,
				totalVotes: p.totalVotes,
				candidates: p.candidates.map((c) => ({
					id: String(c.candidateId),
					name: c.name,
					position: p.position,
					votes: c.votes,
					percentage: c.percentage,
				})),
				winner: p.winner
					? {
							id: String(p.winner.candidateId),
							name: p.winner.name,
							position: p.position,
							votes: p.winner.votes,
							percentage: p.winner.percentage,
						}
					: null,
			})),
			turnoutByCategory: turnout.byCategory.map((s) => ({
				category: s.category,
				totalVoters: s.totalVoters,
				totalVotes: s.totalVotes,
				turnoutPercentage: s.turnoutPercentage,
			})),
		};
	});
