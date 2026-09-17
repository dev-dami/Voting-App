import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { getDb } from "../db/connection";
import { users } from "../db/schema";
import { type AuthUser, getCookieValue, verifyAccessToken } from "../lib/auth";

export type LiveEvent = "vote_cast" | "vote_update";

interface LiveClient {
	send(data: string): void;
}

const officials = new Set<LiveClient>();

export function broadcastToOfficials(event: LiveEvent, data: unknown): void {
	const payload = JSON.stringify({ event, data });
	for (const client of [...officials]) {
		try {
			client.send(payload);
		} catch {
			officials.delete(client);
		}
	}
}

export function liveClientCount(): number {
	return officials.size;
}

export async function authenticateLiveConnection(
	queryToken: string | undefined,
	cookieHeader: string | undefined,
): Promise<AuthUser | null> {
	const token = queryToken ?? getCookieValue(cookieHeader, "access_token");
	if (!token) return null;
	const claims = await verifyAccessToken(token);
	if (!claims || (claims.role !== "official" && claims.role !== "admin"))
		return null;
	const rows = await getDb()
		.select()
		.from(users)
		.where(eq(users.id, claims.id))
		.limit(1);
	const user = rows[0];
	if (!user || user.isSuspended) return null;
	return { id: user.id, voterId: user.voterId, role: user.role };
}

export const liveRoutes = new Elysia({ prefix: "/live" }).ws("/stream", {
	open(ws) {
		void (async (): Promise<void> => {
			try {
				const data = ws.data as {
					query?: Record<string, string | undefined>;
					headers?: Record<string, string | undefined>;
				};
				const user = await authenticateLiveConnection(
					data.query?.token,
					data.headers?.cookie,
				);
				if (!user) {
					ws.close(4401, "unauthorized");
					return;
				}
				officials.add(ws as unknown as LiveClient);
			} catch {
				try {
					ws.close(4401, "unauthorized");
				} catch {
					/* connection already closed */
				}
			}
		})();
	},
	close(ws) {
		officials.delete(ws as unknown as LiveClient);
	},
	message(ws, message) {
		if (message === "ping") ws.send("pong");
	},
});
