import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Logger } from "zario";
import { ConsoleTransport, FileTransport, zario } from "zario";

const isProd = process.env.NODE_ENV === "production";
const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const logFile = process.env.LOG_DIR
	? join(process.env.LOG_DIR, "app.log")
	: join(apiRoot, "logs", "app.log");
mkdirSync(dirname(logFile), { recursive: true });

type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

function configuredLevel(): LogLevel {
	const raw = process.env.LOG_LEVEL;
	if (
		raw === "debug" ||
		raw === "info" ||
		raw === "warn" ||
		raw === "error" ||
		raw === "fatal"
	) {
		return raw;
	}
	return isProd ? "info" : "debug";
}

export const log: Logger = zario({
	level: configuredLevel(),
	json: isProd,
	timestamp: true,
	prefix: "[api]",
	redact: {
		paths: [
			"password",
			"password_hash",
			"secret",
			"token",
			"access_token",
			"refresh_token",
			"authorization",
			"cookie",
			"set-cookie",
		],
	},
	transports: [
		new ConsoleTransport({ colorize: !isProd }),
		new FileTransport({
			path: logFile,
			maxSize: 10 * 1024 * 1024,
			maxFiles: 5,
			compression: "gzip",
		}),
	],
});

export function childForRequest(
	requestId: string,
	extra?: Record<string, unknown>,
): Logger {
	return log.child({ requestId, ...extra });
}

export async function flushLogs(): Promise<void> {
	await log.flush();
}

export async function closeLogs(): Promise<void> {
	await log.close();
}
