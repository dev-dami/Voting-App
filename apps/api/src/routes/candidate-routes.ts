import { mkdirSync, rmSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { getDb } from "../db/connection";
import { candidates, voteLogs } from "../db/schema";
import { requireRole } from "../lib/auth";
import {
	BadRequestError,
	ConflictError,
	NotFoundError,
	PayloadTooLargeError,
} from "../lib/errors";
import { log } from "../lib/log";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const DEFAULT_IMAGE = "/images/default-candidate.jpg";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const uploadDir = join(apiRoot, "uploads", "candidates");
mkdirSync(uploadDir, { recursive: true });

function candidatePayload(c: {
	id: number;
	name: string;
	position: string;
	image: string;
	votes: number;
}): {
	id: string;
	name: string;
	position: string;
	image: string;
	votes: number;
} {
	return {
		id: String(c.id),
		name: c.name,
		position: c.position,
		image: c.image,
		votes: c.votes,
	};
}

async function saveCandidateImage(image: unknown): Promise<string> {
	if (!(image instanceof File))
		throw new BadRequestError("image must be an uploaded file");
	if (image.size > MAX_IMAGE_BYTES) {
		throw new PayloadTooLargeError("image must be 5MB or smaller");
	}
	const ext = extname(image.name).toLowerCase();
	if (!ALLOWED_EXTENSIONS.has(ext)) {
		throw new BadRequestError("image must be png, jpg, jpeg, webp, or gif");
	}
	const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
	await Bun.write(join(uploadDir, filename), image);
	return `/uploads/candidates/${filename}`;
}

function removeStoredImage(image: string): void {
	if (!image.startsWith("/uploads/candidates/")) return;
	const file = resolve(uploadDir, image.slice("/uploads/candidates/".length));
	if (!file.startsWith(resolve(uploadDir))) return;
	try {
		rmSync(file, { force: true });
	} catch (err) {
		log.warn("failed to remove candidate image", { image, error: String(err) });
	}
}

function parseId(raw: string): number {
	const id = Number(raw);
	if (!Number.isInteger(id)) throw new BadRequestError("invalid candidate id");
	return id;
}

export const candidateRoutes = new Elysia({ prefix: "/candidates" })
	.use(requireRole("official", "admin"))
	.get("/", async () => {
		const rows = await getDb().select().from(candidates);
		return { candidates: rows.map(candidatePayload) };
	})
	.post(
		"/",
		async ({ body, set }) => {
			const name = body.name.trim();
			const position = body.position.trim();
			if (!name || !position)
				throw new BadRequestError("name and position are required");
			const image = body.image
				? await saveCandidateImage(body.image)
				: DEFAULT_IMAGE;
			const inserted = await getDb()
				.insert(candidates)
				.values({ name, position, image })
				.returning();
			const created = inserted[0];
			if (!created) throw new Error("failed to create candidate");
			log.info("candidate created", { candidateId: created.id, position });
			set.status = 201;
			return candidatePayload(created);
		},
		{
			body: t.Object({
				name: t.String({ minLength: 1 }),
				position: t.String({ minLength: 1 }),
				image: t.Optional(t.File()),
			}),
		},
	)
	.patch(
		"/:id",
		async ({ params, body }) => {
			const db = getDb();
			const rows = await db
				.select()
				.from(candidates)
				.where(eq(candidates.id, parseId(params.id)))
				.limit(1);
			const existing = rows[0];
			if (!existing) throw new NotFoundError("candidate not found");
			const patch: { name?: string; position?: string; image?: string } = {};
			if (body.name !== undefined) {
				if (!body.name.trim())
					throw new BadRequestError("name cannot be empty");
				patch.name = body.name.trim();
			}
			if (body.position !== undefined) {
				if (!body.position.trim())
					throw new BadRequestError("position cannot be empty");
				patch.position = body.position.trim();
			}
			if (body.image !== undefined) {
				patch.image = await saveCandidateImage(body.image);
				removeStoredImage(existing.image);
			}
			if (Object.keys(patch).length === 0)
				throw new BadRequestError("nothing to update");
			const updated = await db
				.update(candidates)
				.set(patch)
				.where(eq(candidates.id, existing.id))
				.returning();
			const row = updated[0];
			if (!row) throw new Error("failed to update candidate");
			return candidatePayload(row);
		},
		{
			body: t.Object({
				name: t.Optional(t.String()),
				position: t.Optional(t.String()),
				image: t.Optional(t.File()),
			}),
		},
	)
	.delete("/:id", async ({ params }) => {
		const db = getDb();
		const rows = await db
			.select()
			.from(candidates)
			.where(eq(candidates.id, parseId(params.id)))
			.limit(1);
		const existing = rows[0];
		if (!existing) throw new NotFoundError("candidate not found");
		const refs = await db
			.select({ id: voteLogs.id })
			.from(voteLogs)
			.where(eq(voteLogs.candidateId, existing.id))
			.limit(1);
		if (refs[0]) {
			throw new ConflictError(
				"candidate has recorded votes and cannot be deleted",
			);
		}
		await db.delete(candidates).where(eq(candidates.id, existing.id));
		removeStoredImage(existing.image);
		log.info("candidate deleted", { candidateId: existing.id });
		return { deleted: true };
	});
