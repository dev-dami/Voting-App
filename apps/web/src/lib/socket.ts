import type { LiveVoteCast, LiveVoteUpdate } from "./types";

export type LiveEvent = "vote_cast" | "vote_update";

interface LiveHandlers {
	onVoteCast?: (data: LiveVoteCast) => void;
	onVoteUpdate?: (data: LiveVoteUpdate) => void;
	onOpen?: () => void;
	onClose?: () => void;
}

let socket: WebSocket | null = null;
let pingTimer: number | null = null;

function streamUrl(): string {
	const base = (
		(import.meta.env.VITE_API_URL as string | undefined) ?? ""
	).replace(/\/+$/, "");
	const url = new URL(
		"/api/live/stream",
		base.length > 0 ? base : window.location.origin,
	);
	url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
	return url.toString();
}

function isRecord(data: unknown): data is Record<string, unknown> {
	return typeof data === "object" && data !== null;
}

function isLiveVoteCast(data: unknown): data is LiveVoteCast {
	return (
		isRecord(data) &&
		typeof data.voterId === "string" &&
		typeof data.candidateName === "string" &&
		typeof data.position === "string" &&
		typeof data.createdAt === "string"
	);
}

function isLiveVoteUpdate(data: unknown): data is LiveVoteUpdate {
	return (
		isRecord(data) &&
		typeof data.candidateId === "number" &&
		typeof data.votes === "number"
	);
}

// Native WebSocket to the Elysia live endpoint. Cookie session authenticates
// the handshake; the server closes with 4401 when the role is not
// official/admin. Call only from role-gated routes after auth resolves.
export function connectLiveSocket(handlers: LiveHandlers): () => void {
	disconnectLiveSocket();
	const ws = new WebSocket(streamUrl());
	socket = ws;
	pingTimer = window.setInterval(() => {
		if (ws.readyState === WebSocket.OPEN) ws.send("ping");
	}, 30_000);
	ws.addEventListener("open", () => handlers.onOpen?.());
	ws.addEventListener("close", () => handlers.onClose?.());
	ws.addEventListener("message", (event: MessageEvent) => {
		if (typeof event.data !== "string" || event.data === "pong") return;
		try {
			const parsed = JSON.parse(event.data) as {
				event?: unknown;
				data?: unknown;
			};
			if (parsed.event === "vote_cast" && isLiveVoteCast(parsed.data)) {
				handlers.onVoteCast?.(parsed.data);
			} else if (
				parsed.event === "vote_update" &&
				isLiveVoteUpdate(parsed.data)
			) {
				handlers.onVoteUpdate?.(parsed.data);
			}
		} catch {
			/* ignore malformed frames */
		}
	});
	return disconnectLiveSocket;
}

export function disconnectLiveSocket(): void {
	if (pingTimer !== null) {
		window.clearInterval(pingTimer);
		pingTimer = null;
	}
	if (socket !== null) {
		try {
			socket.close();
		} catch {
			/* already closed */
		}
		socket = null;
	}
}
