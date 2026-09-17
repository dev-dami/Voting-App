export const POSITION_LIST = [
	"Head Boy",
	"Head Girl",
	"Sports Prefect",
	"Library Prefect",
	"Laboratory Prefect",
	"Time Keeper",
	"Dining-hall Prefect",
	"Labour Prefect",
	"Social Prefect",
	"Health Prefect",
	"Chapel Prefect",
	"Custom",
] as const;

export type Position = (typeof POSITION_LIST)[number];

// Legacy rows stored the "Libary Prefect" misspelling; normalize on read during migration.
export const LEGACY_POSITION_ALIASES: Record<string, Position> = {
	"Libary Prefect": "Library Prefect",
};

export function normalizePosition(value: string): string {
	return LEGACY_POSITION_ALIASES[value] ?? value;
}
