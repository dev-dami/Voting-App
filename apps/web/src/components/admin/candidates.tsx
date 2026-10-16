import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { POSITION_LIST } from "@yhs-voting/shared";
import { ImagePlus, LoaderCircle, Pencil, Plus } from "lucide-react";
import type { DragEvent, FormEvent, ReactElement, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { ApiError, candidateApi } from "../../lib/api";
import type { Candidate } from "../../lib/types";
import { Button } from "../../ui/button";
import { ConfirmAction, DialogShell } from "../../ui/dialog";
import {
	Card,
	EmptyState,
	SectionTitle,
	Skeleton,
} from "../../ui/display";
import { Field, SelectInput, TextInput } from "../../ui/inputs";
import { notify } from "../../ui/toast";

const POSITIONS = POSITION_LIST.map((p) => ({ value: p, label: p }));
const ACCEPTED = "image/jpeg,image/png,image/webp,image/gif";
const MAX_BYTES = 5 * 1024 * 1024;

function fail(action: string): (e: unknown) => void {
	return (e: unknown) => {
		notify.error(
			`${action} failed`,
			e instanceof ApiError ? e.message : undefined,
		);
	};
}

function pickImage(file: File | undefined | null): File | null {
	if (!file) return null;
	if (file.size > MAX_BYTES) {
		notify.error("Photo too large", "Please keep it under 5MB.");
		return null;
	}
	return file;
}

function firstFile(ev: DragEvent): File | null {
	ev.preventDefault();
	return pickImage(ev.dataTransfer.files?.[0]);
}

// Photo tile shown on each candidate card and in the editor. Click (or drag
// and drop) a file onto it; any choice is surfaced through onFile.
export function PhotoTile({
	current,
	preview,
	pending,
	onChange,
	className = "aspect-[3/4]",
	rounded = "rounded-t-2xl",
	children,
}: {
	current?: string | null;
	preview?: string | null;
	pending?: boolean;
	onChange: (file: File | null) => void;
	className?: string;
	rounded?: string;
	children?: ReactNode;
}): ReactElement {
	const inputRef = useRef<HTMLInputElement>(null);
	const [over, setOver] = useState(false);

	function onDrop(e: DragEvent<HTMLDivElement>): void {
		const file = firstFile(e);
		setOver(false);
		if (file) onChange(file);
	}

	return (
		<div className="group/photo relative">
			<div
				role="button"
				tabIndex={0}
				aria-label="Set candidate photo"
				onClick={() => inputRef.current?.click()}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						inputRef.current?.click();
					}
				}}
				onDragOver={(e) => {
					e.preventDefault();
					setOver(true);
				}}
				onDragLeave={() => setOver(false)}
				onDrop={onDrop}
				className={`relative block w-full cursor-pointer overflow-hidden bg-brand-50 outline-none ${rounded} ${className} ${
					over ? "ring-2 ring-brand-600" : ""
				} group-focus-within/photo:ring-2 group-focus-within/photo:ring-brand-600`}
			>
				{preview || current ? (
					<img
						src={preview ?? current ?? ""}
						alt=""
						className={`h-full w-full object-cover transition-opacity duration-200 ${
							over ? "opacity-70" : ""
						}`}
					/>
				) : (
					<span className="font-crest flex h-full w-full items-center justify-center text-2xl text-brand-300">
						<ImagePlus className="h-7 w-7" aria-hidden="true" />
					</span>
				)}
				<span className="absolute inset-0 flex items-center justify-center gap-1.5 bg-zinc-900/50 px-3 text-[11px] font-medium tracking-wide text-white opacity-0 transition-opacity duration-200 group-hover/photo:opacity-100">
					<ImagePlus className="h-4 w-4 shrink-0" aria-hidden="true" />
					{current || preview ? "Change photo" : "Set photo"}
				</span>
				{pending && (
					<span className="absolute inset-0 flex items-center justify-center bg-white/50">
						<LoaderCircle
							className="h-5 w-5 animate-spin text-brand-700"
							aria-hidden="true"
						/>
					</span>
				)}
			</div>
			<label className="sr-only">
				Candidate photo
				<input
					ref={inputRef}
					type="file"
					accept={ACCEPTED}
					className="sr-only"
					onChange={(e) => {
						const file = pickImage(e.target.files?.[0]);
						if (file) onChange(file);
						e.target.value = "";
					}}
				/>
			</label>
			{children}
		</div>
	);
}

export function Candidates(): ReactElement {
	const queryClient = useQueryClient();
	const invalidate = (): void => {
		void queryClient.invalidateQueries({ queryKey: ["admin-candidates"] });
	};
	const listQuery = useQuery({
		queryKey: ["admin-candidates"],
		queryFn: ({ signal }) => candidateApi.list(signal),
	});

	const [dialog, setDialog] = useState<
		{ mode: "add" } | { mode: "edit"; candidate: Candidate } | null
	>(null);
	const [name, setName] = useState("");
	const [position, setPosition] = useState<string>(
		POSITION_LIST[0] ?? "Head Boy",
	);
	const [image, setImage] = useState<File | null>(null);

	// Local object URL preview for the photo picked inside the dialog.
	const [preview, setPreview] = useState<string | null>(null);
	useEffect(() => {
		if (!image) {
			setPreview(null);
			return;
		}
		const url = URL.createObjectURL(image);
		setPreview(url);
		return () => URL.revokeObjectURL(url);
	}, [image]);

	function openAdd(): void {
		setName("");
		setPosition(POSITION_LIST[0] ?? "Head Boy");
		setImage(null);
		setDialog({ mode: "add" });
	}

	function openEdit(c: Candidate): void {
		setName(c.name);
		setPosition(c.position);
		setImage(null);
		setDialog({ mode: "edit", candidate: c });
	}

	const saveMut = useMutation({
		mutationFn: () => {
			if (dialog?.mode === "edit") {
				return candidateApi.update(dialog.candidate.id, {
					name: name.trim(),
					position,
					...(image ? { image } : {}),
				});
			}
			return candidateApi.create({
				name: name.trim(),
				position,
				...(image ? { image } : {}),
			});
		},
		onSuccess: () => {
			notify.success(
				dialog?.mode === "edit" ? "Candidate updated" : "Candidate added",
			);
			setDialog(null);
			invalidate();
		},
		onError: fail("Save candidate"),
	});

	// Photo set straight from the card — no dialog needed.
	const photoMut = useMutation({
		mutationFn: ({ id, file }: { id: string; file: File }) =>
			candidateApi.update(id, { image: file }),
		onSuccess: () => {
			notify.success("Photo updated");
			invalidate();
		},
		onError: fail("Set photo"),
	});

	const removeMut = useMutation({
		mutationFn: (id: string) => candidateApi.remove(id),
		onSuccess: () => {
			notify.success("Candidate removed");
			invalidate();
		},
		onError: fail("Remove candidate"),
	});

	function onSubmit(e: FormEvent): void {
		e.preventDefault();
		saveMut.mutate();
	}

	const grouped = new Map<string, Candidate[]>();
	for (const c of listQuery.data?.candidates ?? []) {
		const list = grouped.get(c.position) ?? [];
		list.push(c);
		grouped.set(c.position, list);
	}

	return (
		<Card className="p-4 sm:p-6">
			<SectionTitle
				action={
					<Button
						size="sm"
						variant="outline"
						icon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
						onClick={openAdd}
					>
						Add candidate
					</Button>
				}
			>
				Candidates
				<span className="ml-2 text-sm font-normal text-zinc-400 tabular-nums">
					{listQuery.data?.candidates.length ?? 0}
				</span>
			</SectionTitle>

			{listQuery.isPending ? (
				<div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
					{[0, 1, 2, 3].map((i) => (
						<Skeleton key={i} className="aspect-[3/4]" />
					))}
				</div>
			) : listQuery.isError ? (
				<p role="alert" className="text-xs font-medium text-red-700">
					Could not load candidates.
				</p>
			) : grouped.size === 0 ? (
				<EmptyState
					title="No candidates yet"
					body="Add the first candidate for the ballot — name, position, and an optional portrait."
					action={
						<Button size="sm" onClick={openAdd}>
							Add candidate
						</Button>
					}
				/>
			) : (
				<div className="space-y-6">
					{[...grouped.entries()].map(([pos, list]) => (
						<div key={pos}>
							<h3 className="mb-2.5 text-[11px] font-medium tracking-[0.18em] text-zinc-400 uppercase">
								{pos}
								<span className="ml-1.5 font-normal tabular-nums normal-case">
									{list.length}
								</span>
							</h3>
							<ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
								{list.map((c) => (
									<li
										key={c.id}
										className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white transition-colors hover:border-zinc-300"
									>
										<PhotoTile
											current={c.image}
											pending={photoMut.isPending && photoMut.variables?.id === c.id}
											onChange={(file) => {
												if (file) photoMut.mutate({ id: c.id, file });
											}}
										/>
										<div className="px-3 py-2.5">
											<p className="truncate text-sm font-medium text-zinc-900">
												{c.name}
											</p>
											<p className="mt-0.5 text-xs tabular-nums text-zinc-400">
												{c.votes} vote{c.votes === 1 ? "" : "s"}
											</p>
											<div className="mt-1.5 flex items-center justify-end gap-0.5">
												<Button
													variant="ghost"
													size="sm"
													aria-label={`Edit ${c.name}`}
													icon={
														<Pencil className="h-3.5 w-3.5" aria-hidden="true" />
													}
													onClick={() => openEdit(c)}
												>
													<span className="sr-only">Edit</span>
												</Button>
												<ConfirmAction
													buttonSize="sm"
													variant="ghost"
													label="Delete"
													title={`Remove ${c.name}?`}
													body="Candidates with recorded votes cannot be removed — reset those ballots first."
													confirmLabel="Remove"
													pending={removeMut.isPending}
													onConfirm={() => removeMut.mutate(c.id)}
												/>
											</div>
										</div>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			)}

			<DialogShell
				open={dialog !== null}
				onOpenChange={(o) => {
					if (!o) setDialog(null);
				}}
				title={dialog?.mode === "edit" ? "Edit candidate" : "Add candidate"}
				description="Portraits show on the ballot. Drop a photo onto the tile or click it to choose a file — JPG, PNG, WebP or GIF up to 5MB."
			>
				<form onSubmit={onSubmit} className="mt-1 space-y-4">
					<div className="grid gap-3 sm:grid-cols-[auto,1fr]">
						<PhotoTile
							current={dialog?.mode === "edit" ? dialog.candidate.image : null}
							preview={preview}
							onChange={setImage}
							className="h-36 w-28 shrink-0"
							rounded="rounded-xl"
						/>
						<div className="min-w-0 space-y-3">
							<Field label="Full name" htmlFor="cd-name">
								<TextInput
									id="cd-name"
									required
									value={name}
									onChange={(e) => setName(e.target.value)}
								/>
							</Field>
						</div>
					</div>
					<Field label="Position" htmlFor="cd-position">
						<SelectInput
							id="cd-position"
							label="Position"
							value={position}
							onChange={setPosition}
							options={POSITIONS}
						/>
					</Field>
					<div className="flex justify-end gap-2 pt-1">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setDialog(null)}
							type="button"
						>
							Cancel
						</Button>
						<Button type="submit" size="sm" loading={saveMut.isPending}>
							{dialog?.mode === "edit" ? "Save changes" : "Add candidate"}
						</Button>
					</div>
				</form>
			</DialogShell>
		</Card>
	);
}
