export * from "@yhs-voting/shared";

import type { ElectionStatus, Role, VoterCategory } from "@yhs-voting/shared";

// Web-local request/response shapes that mirror apps/api route payloads
// exactly. Shared DTOs are reused where they already match the API.

export interface ElectionState {
	name: string;
	status: ElectionStatus;
	startTime: string | null;
	endTime: string | null;
}

export interface Candidate {
	id: string;
	name: string;
	position: string;
	image: string;
	votes: number;
}

export interface ManagedUser {
	id: string;
	studentId: string;
	role: Role;
	voterCategory: VoterCategory | null;
	classOrDept: string;
	hasVoted: boolean;
	isSuspended: boolean;
	createdAt: string;
}

export interface UserImportRow {
	voterId: string;
	password: string;
	role?: string;
	voterCategory?: string;
	classOrDept?: string;
}

export interface LiveVoteCast {
	voterId: string;
	candidateName: string;
	position: string;
	createdAt: string;
}

export interface LiveVoteUpdate {
	candidateId: number;
	votes: number;
}
