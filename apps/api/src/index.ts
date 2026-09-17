import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { getDb } from "./db/connection";
import { runMigrations } from "./db/migrate";
import { getOrCreateElection } from "./lib/election";
import { AppError } from "./lib/errors";
import { childForRequest, closeLogs, flushLogs, log } from "./lib/log";
import { securityHeaders } from "./lib/security-headers";
import { authRoutes } from "./routes/auth-routes";
import { ballotRoutes } from "./routes/ballot-routes";
import { candidateRoutes } from "./routes/candidate-routes";
import { electionRoutes } from "./routes/election-routes";
import { issueRoutes } from "./routes/issue-routes";
import { resultRoutes } from "./routes/result-routes";
import { userRoutes } from "./routes/user-routes";
import { liveRoutes } from "./routes/ws";

export function createApp() {
	return new Elysia({ prefix: "/api" })
		.use(securityHeaders)
		.use(
			cors({
				origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
				credentials: true,
			}),
		)
		.onRequest(({ set }) => {
			set.headers["x-request-id"] = crypto.randomUUID();
		})
		.onAfterHandle(({ request, set }) => {
			const requestId = set.headers["x-request-id"];
			childForRequest(
				typeof requestId === "string" ? requestId : "unknown",
			).info("request completed", {
				method: request.method,
				path: new URL(request.url).pathname,
				status: set.status,
			});
		})
		.onError(({ error, set }) => {
			if (error instanceof AppError) {
				set.status = error.status;
				return { message: error.message, code: error.code };
			}
			const status = (error as { status?: unknown }).status;
			if (typeof status === "number" && status >= 400 && status < 500) {
				set.status = status;
				return { message: "invalid request", code: "validation_failed" };
			}
			log.error(
				"unhandled error",
				error instanceof Error ? error : new Error(String(error)),
			);
			set.status = 500;
			return { message: "internal server error", code: "internal" };
		})
		.get("/health", () => ({ ok: true }))
		.use(authRoutes)
		.use(ballotRoutes)
		.use(candidateRoutes)
		.use(electionRoutes)
		.use(issueRoutes)
		.use(resultRoutes)
		.use(userRoutes)
		.use(liveRoutes);
}

if (import.meta.main) {
	const port = Number(process.env.PORT ?? 3000);
	runMigrations();
	await getOrCreateElection(getDb());
	const app = createApp();
	app.listen(port);
	log.info("api listening", { port });
	const shutdown = async (): Promise<void> => {
		try {
			await flushLogs();
		} finally {
			await closeLogs();
		}
		process.exit(0);
	};
	process.on("SIGTERM", () => void shutdown());
	process.on("SIGINT", () => void shutdown());
}
