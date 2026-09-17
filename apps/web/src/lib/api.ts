import type {
	BallotResponse,
	Candidate,
	CreateIssueRequest,
	ElectionState,
	IssueResponse,
	IssueStatus,
	LoginResponse,
	ManagedUser,
	MeResponse,
	ResultsResponse,
	SubmitBallotResponse,
	UserImportRow,
} from "./types";

export class ApiError extends Error {
	status: number;
	payload: unknown;
	constructor(status: number, message: string, payload: unknown = null) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.payload = payload;
	}
}

export const API_BASE: string = (
	(import.meta.env.VITE_API_URL as string | undefined) ?? ""
).replace(/\/+$/, "");

function safeJson(text: string): unknown {
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return text;
	}
}

function messageFrom(data: unknown, fallback: string): string {
	if (typeof data === "object" && data !== null && "message" in data) {
		const m = (data as { message?: unknown }).message;
		if (typeof m === "string" && m.length > 0) return m;
	}
	if (typeof data === "string" && data.length > 0) return data;
	return fallback || "Request failed";
}

interface RequestOptions {
	method?: string;
	body?: unknown;
	signal?: AbortSignal;
	idempotencyKey?: string;
}

export async function apiFetch<T>(
	path: string,
	opts: RequestOptions = {},
): Promise<T> {
	const headers: Record<string, string> = {};
	let body: BodyInit | undefined;
	if (opts.body !== undefined) {
		headers["Content-Type"] = "application/json";
		body = JSON.stringify(opts.body);
	}
	if (opts.idempotencyKey) headers["X-Idempotency-Key"] = opts.idempotencyKey;
	const res = await fetch(`${API_BASE}${path}`, {
		method: opts.method ?? "GET",
		headers,
		body,
		credentials: "include",
		signal: opts.signal,
	});
	if (res.status === 204) return undefined as T;
	const text = await res.text();
	const data: unknown = text.length > 0 ? safeJson(text) : null;
	if (!res.ok)
		throw new ApiError(res.status, messageFrom(data, res.statusText), data);
	return data as T;
}

async function apiForm<T>(
	path: string,
	form: FormData,
	opts: { method?: string; signal?: AbortSignal } = {},
): Promise<T> {
	const res = await fetch(`${API_BASE}${path}`, {
		method: opts.method ?? "POST",
		body: form,
		credentials: "include",
		signal: opts.signal,
	});
	const text = await res.text();
	const data: unknown = text.length > 0 ? safeJson(text) : null;
	if (!res.ok)
		throw new ApiError(res.status, messageFrom(data, res.statusText), data);
	return data as T;
}

export const authApi = {
	me: (): Promise<MeResponse> => apiFetch<MeResponse>("/api/auth/me"),
	login: (voterId: string, password: string): Promise<LoginResponse> =>
		apiFetch<LoginResponse>("/api/auth/login", {
			method: "POST",
			body: { voterId, password },
		}),
	refresh: (): Promise<LoginResponse> =>
		apiFetch<LoginResponse>("/api/auth/refresh", { method: "POST" }),
	logout: (): Promise<{ loggedOut: boolean }> =>
		apiFetch<{ loggedOut: boolean }>("/api/auth/logout", { method: "POST" }),
};

export const ballotApi = {
	ballot: (signal?: AbortSignal): Promise<BallotResponse> =>
		apiFetch<BallotResponse>("/api/ballot", { signal }),
	submit: (
		selections: Record<string, string | number>,
		idempotencyKey: string,
	): Promise<SubmitBallotResponse> =>
		apiFetch<SubmitBallotResponse>("/api/ballot", {
			method: "POST",
			body: { selections, idempotencyKey },
			idempotencyKey,
		}),
	slip: (signal?: AbortSignal): Promise<SubmitBallotResponse> =>
		apiFetch<SubmitBallotResponse>("/api/ballot/slip", { signal }),
};

export const candidateApi = {
	list: (signal?: AbortSignal): Promise<{ candidates: Candidate[] }> =>
		apiFetch<{ candidates: Candidate[] }>("/api/candidates", { signal }),
	create: (input: {
		name: string;
		position: string;
		image?: File;
	}): Promise<Candidate> => {
		const form = new FormData();
		form.set("name", input.name);
		form.set("position", input.position);
		if (input.image) form.set("image", input.image);
		return apiForm<Candidate>("/api/candidates", form, { method: "POST" });
	},
	update: (
		id: string,
		input: { name?: string; position?: string; image?: File },
	): Promise<Candidate> => {
		const form = new FormData();
		if (input.name !== undefined) form.set("name", input.name);
		if (input.position !== undefined) form.set("position", input.position);
		if (input.image) form.set("image", input.image);
		return apiForm<Candidate>(`/api/candidates/${id}`, form, {
			method: "PATCH",
		});
	},
	remove: (id: string): Promise<{ deleted: boolean }> =>
		apiFetch<{ deleted: boolean }>(`/api/candidates/${id}`, {
			method: "DELETE",
		}),
};

export const electionApi = {
	status: (signal?: AbortSignal): Promise<ElectionState> =>
		apiFetch<ElectionState>("/api/election/status", { signal }),
	start: (endTime: string, name?: string): Promise<ElectionState> =>
		apiFetch<ElectionState>("/api/election/start", {
			method: "POST",
			body: name ? { endTime, name } : { endTime },
		}),
	end: (): Promise<ElectionState> =>
		apiFetch<ElectionState>("/api/election/end", { method: "POST" }),
	reset: (): Promise<ElectionState> =>
		apiFetch<ElectionState>("/api/election/reset", { method: "POST" }),
};

export const issueApi = {
	submit: (input: CreateIssueRequest): Promise<IssueResponse> =>
		apiFetch<IssueResponse>("/api/issues", { method: "POST", body: input }),
	list: (
		status?: IssueStatus,
		signal?: AbortSignal,
	): Promise<{ issues: IssueResponse[] }> =>
		apiFetch<{ issues: IssueResponse[] }>(
			status ? `/api/issues?status=${status}` : "/api/issues",
			{ signal },
		),
	setStatus: (id: string, status: IssueStatus): Promise<IssueResponse> =>
		apiFetch<IssueResponse>(`/api/issues/${id}/status`, {
			method: "PATCH",
			body: { status },
		}),
};

export const resultsApi = {
	get: (signal?: AbortSignal): Promise<ResultsResponse> =>
		apiFetch<ResultsResponse>("/api/results", { signal }),
};

export const userApi = {
	list: (signal?: AbortSignal): Promise<{ users: ManagedUser[] }> =>
		apiFetch<{ users: ManagedUser[] }>("/api/users", { signal }),
	create: (row: UserImportRow): Promise<ManagedUser> =>
		apiFetch<ManagedUser>("/api/users", { method: "POST", body: row }),
	importUsers: (
		users: UserImportRow[],
	): Promise<{ created: number; skipped: number }> =>
		apiFetch<{ created: number; skipped: number }>("/api/users/import", {
			method: "POST",
			body: { users },
		}),
	remove: (id: string): Promise<{ deleted: boolean }> =>
		apiFetch<{ deleted: boolean }>(`/api/users/${id}`, { method: "DELETE" }),
	suspend: (id: string): Promise<ManagedUser> =>
		apiFetch<ManagedUser>(`/api/users/${id}/suspend`, { method: "POST" }),
	enable: (id: string): Promise<ManagedUser> =>
		apiFetch<ManagedUser>(`/api/users/${id}/enable`, { method: "POST" }),
	resetPassword: (
		id: string,
		password: string,
	): Promise<{ updated: boolean }> =>
		apiFetch<{ updated: boolean }>(`/api/users/${id}/reset-password`, {
			method: "POST",
			body: { password },
		}),
	resetVotes: (id: string): Promise<ManagedUser> =>
		apiFetch<ManagedUser>(`/api/users/${id}/reset-votes`, { method: "POST" }),
};
