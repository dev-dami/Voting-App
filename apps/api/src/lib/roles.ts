export type UserRole =
	| "student"
	| "teaching_staff"
	| "non_teaching_staff"
	| "official"
	| "admin";

export type VoterCategory = "student" | "teaching_staff" | "non_teaching_staff";

const VOTING_ROLES: readonly UserRole[] = [
	"student",
	"teaching_staff",
	"non_teaching_staff",
];

export function canVoteRole(role: UserRole): boolean {
	return VOTING_ROLES.includes(role);
}

export function defaultCategoryFor(role: UserRole): VoterCategory | null {
	return canVoteRole(role) ? (role as VoterCategory) : null;
}
