import type { Position } from "./positions.js";
import type { Role, VoterCategory } from "./roles.js";

export type ElectionStatus = "pending" | "running" | "ended";

export interface LoginRequest {
	voterId?: string;
	studentId?: string;
	password: string;
}

export interface AuthUser {
	id: string;
	studentId: string;
	role: Role;
	hasVoted: boolean;
}

export interface LoginResponse {
	user: AuthUser;
}

export interface MeResponse {
	user: AuthUser;
}

export interface BallotCandidate {
	id: string;
	name: string;
	position: Position;
	image: string;
}

export interface BallotResponse {
	electionName: string;
	electionStatus: ElectionStatus;
	groupedCandidates: Record<string, BallotCandidate[]>;
}

export interface SubmitBallotRequest {
	selections: Record<string, number | string>;
	idempotencyKey?: string;
}

export interface SubmitBallotResponse {
	votedPositions: VotedPosition[];
}

export interface ResultCandidate {
	id: string;
	name: string;
	position: string;
	votes: number;
	percentage: number;
}

export interface PositionResult {
	position: string;
	totalVotes: number;
	candidates: ResultCandidate[];
	winner: ResultCandidate | null;
}

export interface TurnoutByCategory {
	category: VoterCategory;
	totalVoters: number;
	totalVotes: number;
	turnoutPercentage: number;
}

export interface ResultsResponse {
	electionName: string;
	electionStatus: ElectionStatus;
	startTime: string | null;
	endTime: string | null;
	totalVoters: number;
	totalVotes: number;
	turnoutPercentage: number;
	positions: PositionResult[];
	turnoutByCategory: TurnoutByCategory[];
}

export type IssueStatus = "pending" | "in-progress" | "resolved";

export interface CreateIssueRequest {
	name: string;
	className: string;
	problem: string;
}

export interface IssueResponse {
	id: string;
	name: string;
	className: string;
	problem: string;
	status: IssueStatus;
	createdAt: string;
}

export interface VotedPosition {
	position: string;
	candidateId: string;
	candidateName?: string;
}

export interface UserResponse {
	id: string;
	studentId: string;
	role: Role;
	voterCategory: VoterCategory | null;
	classOrDept: string;
	hasVoted: boolean;
	isSuspended: boolean;
	createdAt: string;
}

export interface CreateUserRequest {
	voterId?: string;
	studentId?: string;
	password: string;
	role?: Role;
	voterCategory?: VoterCategory;
	classOrDept?: string;
}

export interface ImportUsersResponse {
	created: number;
	skipped: number;
}

export interface CandidateResponse {
	id: string;
	name: string;
	position: string;
	image: string;
	votes: number;
}

export interface ElectionStatusResponse {
	name: string;
	status: ElectionStatus;
	startTime: string | null;
	endTime: string | null;
}

export interface ApiError {
	message: string;
	code?: string;
}
