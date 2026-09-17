export type Role =
	| "student"
	| "teaching_staff"
	| "non_teaching_staff"
	| "official"
	| "admin";

export type VoterCategory = "student" | "teaching_staff" | "non_teaching_staff";

export const VOTER_CATEGORIES: readonly VoterCategory[] = [
	"student",
	"teaching_staff",
	"non_teaching_staff",
];

export function canVote(role: Role): boolean {
	return (
		role === "student" ||
		role === "teaching_staff" ||
		role === "non_teaching_staff"
	);
}
