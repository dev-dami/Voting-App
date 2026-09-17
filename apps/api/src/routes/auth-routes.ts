import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { getDb } from "../db/connection";
import { users } from "../db/schema";
import {
	ACCESS_COOKIE,
	ACCESS_TTL_S,
	authGuard,
	getCookieValue,
	issueRefreshToken,
	REFRESH_COOKIE,
	revokeRefreshToken,
	rotateRefreshToken,
	signAccessToken,
	type UserRole,
	verifyPassword,
} from "../lib/auth";
import { BadRequestError, UnauthorizedError } from "../lib/errors";
import { childForRequest } from "../lib/log";
import { clientIp, consumeOrThrow, loginLimiter } from "../lib/rate-limit";

const REFRESH_TTL_S = 7 * 24 * 60 * 60;

function cookieOptions(maxAge: number): {
	httpOnly: boolean;
	secure: boolean;
	sameSite: "lax";
	path: string;
	maxAge: number;
} {
	return {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge,
	};
}

function userPayload(user: {
	id: number;
	voterId: string;
	role: UserRole;
	hasVoted: boolean;
}): { id: string; studentId: string; role: UserRole; hasVoted: boolean } {
	return {
		id: String(user.id),
		studentId: user.voterId,
		role: user.role,
		hasVoted: user.hasVoted,
	};
}

export const authRoutes = new Elysia({ prefix: "/auth" })
	.post(
		"/login",
		async ({ body, cookie, headers, set }) => {
			consumeOrThrow(
				loginLimiter,
				clientIp(headers as Record<string, string | undefined>),
			);
			const loginId = body.voterId ?? body.studentId;
			if (!loginId)
				throw new BadRequestError("voter id and password are required");
			const db = getDb();
			const rows = await db
				.select()
				.from(users)
				.where(eq(users.voterId, loginId))
				.limit(1);
			const user = rows[0];
			if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
				set.status = 401;
				throw new UnauthorizedError("invalid credentials");
			}
			const accessToken = await signAccessToken({
				id: user.id,
				role: user.role,
			});
			const refreshToken = await issueRefreshToken(db, user.id);
			cookie[ACCESS_COOKIE]?.set({
				...cookieOptions(ACCESS_TTL_S),
				value: accessToken,
			});
			cookie[REFRESH_COOKIE]?.set({
				...cookieOptions(REFRESH_TTL_S),
				value: refreshToken,
			});
			childForRequest(String(set.headers["x-request-id"] ?? "")).info("login", {
				userId: user.id,
				role: user.role,
			});
			return { user: userPayload(user) };
		},
		{
			body: t.Object({
				voterId: t.Optional(t.String({ minLength: 1 })),
				studentId: t.Optional(t.String({ minLength: 1 })),
				password: t.String({ minLength: 1 }),
			}),
		},
	)
	.post("/refresh", async ({ cookie, headers, set }) => {
		const presented = getCookieValue(
			(headers as Record<string, string | undefined>).cookie,
			REFRESH_COOKIE,
		);
		if (!presented) {
			set.status = 401;
			throw new UnauthorizedError("refresh token required");
		}
		const rotated = await rotateRefreshToken(getDb(), presented);
		if (!rotated) {
			set.status = 401;
			throw new UnauthorizedError("invalid or expired refresh token");
		}
		cookie[ACCESS_COOKIE]?.set({
			...cookieOptions(ACCESS_TTL_S),
			value: rotated.accessToken,
		});
		cookie[REFRESH_COOKIE]?.set({
			...cookieOptions(REFRESH_TTL_S),
			value: rotated.refreshToken,
		});
		return {
			user: userPayload({ ...rotated.user, hasVoted: rotated.hasVoted }),
		};
	})
	.post("/logout", async ({ cookie, headers }) => {
		const presented = getCookieValue(
			(headers as Record<string, string | undefined>).cookie,
			REFRESH_COOKIE,
		);
		if (presented) await revokeRefreshToken(getDb(), presented);
		cookie[ACCESS_COOKIE]?.remove();
		cookie[REFRESH_COOKIE]?.remove();
		return { loggedOut: true };
	})
	.use(authGuard)
	.get("/me", async ({ user }) => {
		const rows = await getDb()
			.select()
			.from(users)
			.where(eq(users.id, user.id))
			.limit(1);
		const full = rows[0];
		if (!full) throw new UnauthorizedError("voter not found");
		return { user: userPayload(full) };
	});
