export interface CandidateVoteRow {
	id: number;
	name: string;
	position: string;
	votes: number;
}

export interface ResultCandidateEntry {
	candidateId: number;
	name: string;
	votes: number;
	percentage: number;
}

export interface PositionResultEntry {
	position: string;
	totalVotes: number;
	candidates: ResultCandidateEntry[];
	winner: ResultCandidateEntry | null;
}

export function percentageFor(votes: number, total: number): number {
	if (total <= 0) return 0;
	return Math.round((votes / total) * 1000) / 10;
}

export function positionResults(
	rows: CandidateVoteRow[],
): PositionResultEntry[] {
	const byPosition = new Map<string, CandidateVoteRow[]>();
	for (const row of rows) {
		const list = byPosition.get(row.position);
		if (list) list.push(row);
		else byPosition.set(row.position, [row]);
	}
	const results: PositionResultEntry[] = [];
	for (const [position, list] of byPosition) {
		const totalVotes = list.reduce((sum, c) => sum + c.votes, 0);
		const ordered = [...list].sort((a, b) => b.votes - a.votes);
		const entries: ResultCandidateEntry[] = ordered.map((c) => ({
			candidateId: c.id,
			name: c.name,
			votes: c.votes,
			percentage: percentageFor(c.votes, totalVotes),
		}));
		const top = entries[0];
		const winner =
			top &&
			top.votes > 0 &&
			entries.filter((e) => e.votes === top.votes).length === 1
				? top
				: null;
		results.push({ position, totalVotes, candidates: entries, winner });
	}
	results.sort((a, b) => a.position.localeCompare(b.position));
	return results;
}

export interface VoterTurnoutRow {
	voterCategory: string | null;
	role: string;
	hasVoted: boolean;
}

export interface TurnoutSegmentEntry {
	category: string;
	totalVoters: number;
	totalVotes: number;
	turnoutPercentage: number;
}

export interface TurnoutSummary {
	totalVoters: number;
	totalVotes: number;
	turnoutPercentage: number;
	byCategory: TurnoutSegmentEntry[];
}

export function turnoutSummary(rows: VoterTurnoutRow[]): TurnoutSummary {
	const byCategory = new Map<
		string,
		{ totalVoters: number; totalVotes: number }
	>();
	let totalVoters = 0;
	let totalVotes = 0;
	for (const row of rows) {
		const category = row.voterCategory ?? row.role;
		const segment = byCategory.get(category) ?? {
			totalVoters: 0,
			totalVotes: 0,
		};
		segment.totalVoters += 1;
		if (row.hasVoted) segment.totalVotes += 1;
		byCategory.set(category, segment);
		totalVoters += 1;
		if (row.hasVoted) totalVotes += 1;
	}
	const byCategoryList: TurnoutSegmentEntry[] = [...byCategory.entries()]
		.map(([category, s]) => ({
			category,
			totalVoters: s.totalVoters,
			totalVotes: s.totalVotes,
			turnoutPercentage: percentageFor(s.totalVotes, s.totalVoters),
		}))
		.sort((a, b) => a.category.localeCompare(b.category));
	return {
		totalVoters,
		totalVotes,
		turnoutPercentage: percentageFor(totalVotes, totalVoters),
		byCategory: byCategoryList,
	};
}
