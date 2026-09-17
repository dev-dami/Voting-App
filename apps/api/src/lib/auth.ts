import { eq } from "drizzle-orm";
import type { Elysia } from "elysia";
import { type Db, getDb } from "../db/connection";
import { refreshTokens, users } from "../db/schema";
import { ForbiddenError, UnauthorizedError } from "./errors";
import {
	canVoteRole,
	defaultCategoryFor,
	type UserRole,
	type VoterCategory,
} from "./roles";

export type { UserRole, VoterCategory };
export { canVoteRole, defaultCategoryFor };

export interface AuthUser {
	id: number;
	voterId: string;
	role: UserRole;
}

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";
export const ACCESS_TTL_S = 15 * 60;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function getJwtSecret(): string {
	const secret = process.env.JWT_SECRET;
	if (!secret) throw new Error("JWT_SECRET is not set");
	return secret;
}

export async function hashPassword(password: string): Promise<string> {
	return Bun.password.hash(password);
}

export async function verifyPassword(
	password: string,
	hash: string,
): Promise<boolean> {
	return Bun.password.verify(password, hash);
}

function base64UrlEncode(data: Uint8Array): string {
	return Buffer.from(data).toString("base64url");
}

function base64UrlDecode(value: string): string {
	return Buffer.from(value, "base64url").toString();
}

async function hmacKey(): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(getJwtSecret()),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);
}

export async function signAccessToken(
	user: Pick<AuthUser, "id" | "role">,
): Promise<string> {
	const header = base64UrlEncode(
		new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })),
	);
	const now = Math.floor(Date.now() / 1000);
	const payload = base64UrlEncode(
		new TextEncoder().encode(
			JSON.stringify({
				sub: user.id,
				role: user.role,
				iat: now,
				exp: now + ACCESS_TTL_S,
			}),
		),
	);
	const data = `${header}.${payload}`;
	const signature = new Uint8Array(
		await crypto.subtle.sign(
			"HMAC",
			await hmacKey(),
			new TextEncoder().encode(data),
		),
	);
	return `${data}.${base64UrlEncode(signature)}`;
}

interface AccessClaims {
	sub?: unknown;
	role?: unknown;
	exp?: unknown;
}

export async function verifyAccessToken(
	token: string,
): Promise<Pick<AuthUser, "id" | "role"> | null> {
	try {
		const parts = token.split(".");
		const header = parts[0];
		const payload = parts[1];
		const signature = parts[2];
		if (!header || !payload || !signature) return null;
		const valid = await crypto.subtle.verify(
			"HMAC",
			await hmacKey(),
			Uint8Array.from(Buffer.from(signature, "base64url")),
			new TextEncoder().encode(`${header}.${payload}`),
		);
		if (!valid) return null;
		const claims = JSON.parse(base64UrlDecode(payload)) as AccessClaims;
		if (typeof claims.sub !== "number" || typeof claims.exp !== "number")
			return null;
		if (claims.exp * 1000 < Date.now()) return null;
		const role = claims.role;
		if (
			role !== "student" &&
			role !== "teaching_staff" &&
			role !== "non_teaching_staff" &&
			role !== "official" &&
			role !== "admin"
		) {
			return null;
		}
		return { id: claims.sub, role };
	} catch {
		return null;
	}
}

export function hashToken(token: string): string {
	return new Bun.CryptoHasher("sha256").update(token).digest("hex");
}

export async function issueRefreshToken(
	db: Db,
	userId: number,
): Promise<string> {
	const token = `${crypto.randomUUID()}.${crypto.randomUUID()}`;
	await db.insert(refreshTokens).values({
		userId,
		tokenHash: hashToken(token),
		expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
		revoked: false,
	});
	return token;
}

export interface RefreshRotation {
	user: AuthUser;
	hasVoted: boolean;
	accessToken: string;
	refreshToken: string;
}

export async function rotateRefreshToken(
	db: Db,
	presented: string,
): Promise<RefreshRotation | null> {
	const rows = await db
		.select()
		.from(refreshTokens)
		.where(eq(refreshTokens.tokenHash, hashToken(presented)))
		.limit(1);
	const row = rows[0];
	if (!row || row.revoked || row.expiresAt.getTime() < Date.now()) return null;
	await db
		.update(refreshTokens)
		.set({ revoked: true })
		.where(eq(refreshTokens.id, row.id));
	const userRows = await db
		.select()
		.from(users)
		.where(eq(users.id, row.userId))
		.limit(1);
	const user = userRows[0];
	if (!user || user.isSuspended) return null;
	const authUser: AuthUser = {
		id: user.id,
		voterId: user.voterId,
		role: user.role,
	};
	const accessToken = await signAccessToken(authUser);
	const refreshToken = await issueRefreshToken(db, user.id);
	return { user: authUser, hasVoted: user.hasVoted, accessToken, refreshToken };
}

export async function revokeRefreshToken(
	db: Db,
	presented: string,
): Promise<void> {
	await db
		.update(refreshTokens)
		.set({ revoked: true })
		.where(eq(refreshTokens.tokenHash, hashToken(presented)));
}

export function getCookieValue(
	cookieHeader: string | null | undefined,
	name: string,
): string | null {
	if (!cookieHeader) return null;
	for (const part of cookieHeader.split(";")) {
		const idx = part.indexOf("=");
		if (idx < 0) continue;
		if (part.slice(0, idx).trim() === name)
			return decodeURIComponent(part.slice(idx + 1).trim());
	}
	return null;
}

export async function authenticateRequest(
	headers: Record<string, string | undefined>,
): Promise<AuthUser | null> {
	let token = getCookieValue(headers.cookie, ACCESS_COOKIE);
	if (!token) {
		const authorization = headers.authorization;
		if (authorization?.startsWith("Bearer ")) token = authorization.slice(7);
	}
	if (!token) return null;
	const claims = await verifyAccessToken(token);
	if (!claims) return null;
	const rows = await getDb()
		.select()
		.from(users)
		.where(eq(users.id, claims.id))
		.limit(1);
	const user = rows[0];
	if (!user) return null;
	return { id: user.id, voterId: user.voterId, role: user.role };
}

export const authGuard = (app: Elysia) =>
	app.derive(async ({ headers }): Promise<{ user: AuthUser }> => {
		const user = await authenticateRequest(
			headers as Record<string, string | undefined>,
		);
		if (!user) throw new UnauthorizedError();
		return { user };
	});

export function requireRole(...roles: UserRole[]) {
	return (app: Elysia) =>
		app.use(authGuard).onBeforeHandle(({ user, set }) => {
			if (!roles.includes(user.role)) {
				set.status = 403;
				throw new ForbiddenError("insufficient privileges");
			}
		});
}
