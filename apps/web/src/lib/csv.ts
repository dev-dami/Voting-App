import type { UserImportRow } from "./types";

export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = "";
	let quoted = false;
	for (let i = 0; i < text.length; i += 1) {
		const ch = text[i];
		if (quoted) {
			if (ch === '"') {
				if (text[i + 1] === '"') {
					cell += '"';
					i += 1;
				} else {
					quoted = false;
				}
			} else {
				cell += ch;
			}
		} else if (ch === '"') {
			quoted = true;
		} else if (ch === ",") {
			row.push(cell.trim());
			cell = "";
		} else if (ch === "\n") {
			row.push(cell.trim());
			if (row.some((c) => c.length > 0)) rows.push(row);
			row = [];
			cell = "";
		} else if (ch !== "\r") {
			cell += ch;
		}
	}
	row.push(cell.trim());
	if (row.some((c) => c.length > 0)) rows.push(row);
	return rows;
}

export function toCsv(rows: (string | number)[][]): string {
	return `${rows
		.map((r) =>
			r
				.map((c) => {
					const s = String(c);
					return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
				})
				.join(","),
		)
		.join("\n")}\n`;
}

const ROLES = new Set([
	"student",
	"teaching_staff",
	"non_teaching_staff",
	"official",
	"admin",
]);

const CATEGORIES = new Set(["student", "teaching_staff", "non_teaching_staff"]);

function pick(cells: string[], header: string[], names: string[]): string {
	for (const name of names) {
		const i = header.indexOf(name);
		if (i >= 0) return cells[i] ?? "";
	}
	return "";
}

export function userRowsFromCsv(text: string): {
	rows: UserImportRow[];
	errors: string[];
} {
	const grid = parseCsv(text);
	const rows: UserImportRow[] = [];
	const errors: string[] = [];
	if (grid.length === 0) return { rows, errors: ["CSV is empty"] };
	const header = grid[0].map((h) => h.toLowerCase().replace(/\s+/g, ""));
	const hasId =
		header.includes("voterid") ||
		header.includes("loginid") ||
		header.includes("studentid");
	if (!hasId || !header.includes("password")) {
		return {
			rows,
			errors: [
				"Missing columns: need voterId,password plus optional role,voterCategory,classOrDept",
			],
		};
	}
	for (let i = 1; i < grid.length; i += 1) {
		const voterId = pick(grid[i], header, ["voterid", "loginid", "studentid"]);
		const password = pick(grid[i], header, ["password"]);
		if (!voterId || !password) {
			errors.push(`Row ${i + 1}: voterId and password are required`);
			continue;
		}
		const role = pick(grid[i], header, ["role"]) || "student";
		if (!ROLES.has(role)) {
			errors.push(`Row ${i + 1}: unknown role "${role}"`);
			continue;
		}
		const voterCategory = pick(grid[i], header, [
			"votercategory",
			"category",
			"segment",
		]);
		if (voterCategory && !CATEGORIES.has(voterCategory)) {
			errors.push(`Row ${i + 1}: unknown voterCategory "${voterCategory}"`);
			continue;
		}
		const classOrDept = pick(grid[i], header, [
			"classordept",
			"class",
			"department",
			"dept",
		]);
		rows.push({
			voterId,
			password,
			role,
			...(voterCategory ? { voterCategory } : {}),
			...(classOrDept ? { classOrDept } : {}),
		});
	}
	return { rows, errors };
}
