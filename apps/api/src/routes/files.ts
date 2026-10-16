// Static serving for candidate photos. Uploads live in apps/api/uploads;
// the fallback portrait ships with the API so it works in any deployment.
import { mkdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Elysia } from "elysia";

export const DEFAULT_IMAGE = "/images/default-candidate.jpg";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const uploadDir = join(apiRoot, "uploads", "candidates");
const publicDir = join(apiRoot, "public");
mkdirSync(uploadDir, { recursive: true });

async function serveFile(
	file: ReturnType<typeof Bun.file>,
	cache = "public, max-age=31536000, immutable",
): Promise<Response> {
	if (!(await file.exists())) {
		return new Response("not found", { status: 404 });
	}
	return new Response(file, {
		headers: { "Cache-Control": cache },
	});
}

function safeUploadPath(name: string): string | null {
	const resolved = resolve(uploadDir, name);
	if (!resolved.startsWith(resolve(uploadDir))) return null;
	return resolved;
}

export const fileRoutes = new Elysia()
	.get("/uploads/candidates/:file", async ({ params }) => {
		const path = safeUploadPath(params.file);
		if (!path) return new Response("not found", { status: 404 });
		return await serveFile(Bun.file(path));
	})
	.get("/images/:file", async ({ params }) => {
		// Only the default candidate portrait is exposed.
		if (params.file !== "default-candidate.jpg") {
			return new Response("not found", { status: 404 });
		}
		return await serveFile(Bun.file(join(publicDir, "images", params.file)));
	});

export function isCandidateImageName(name: string): boolean {
	return ALLOWED_IMAGE_EXTENSIONS.has(extname(name).toLowerCase());
}

const ALLOWED_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
