import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { POSITION_LIST } from "@yhs-voting/shared";
import { ImagePlus, Pencil, Plus } from "lucide-react";
import type { FormEvent, ReactElement } from "react";
import { useState } from "react";
import { ApiError, candidateApi } from "../../lib/api";
import type { Candidate } from "../../lib/types";
import { Button } from "../../ui/button";
import { ConfirmAction, DialogShell } from "../../ui/dialog";
import {
	Badge,
	Card,
	EmptyState,
	SectionTitle,
	Skeleton,
} from "../../ui/display";
import { Field, SelectInput, TextInput } from "../../ui/inputs";
import { notify } from "../../ui/toast";

const POSITIONS = POSITION_LIST.map((p) => ({ value: p, label: p }));

function fail(action: string): (e: unknown) => void {
	return (e: unknown) => {
		notify.error(
			`${action} failed`,
			e instanceof ApiError ? e.message : undefined,
		);
	};
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
		<Card className="p-4">
			<SectionTitle
				action={
					<Button
						size="sm"
						icon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
						onClick={openAdd}
					>
						Add candidate
					</Button>
				}
			>
				Candidates ({listQuery.data?.candidates.length ?? 0})
			</SectionTitle>

			{listQuery.isPending ? (
				<div className="space-y-2">
					{[0, 1].map((i) => (
						<Skeleton key={i} className="h-20" />
					))}
				</div>
			) : listQuery.isError ? (
				<p role="alert" className="text-xs font-medium text-red-700">
					Could not load candidates.
				</p>
			) : grouped.size === 0 ? (
				<EmptyState
					title="No candidates yet"
					body="Add the first candidate for the ballot."
					action={
						<Button size="sm" onClick={openAdd}>
							Add candidate
						</Button>
					}
				/>
			) : (
				<div className="space-y-4">
					{[...grouped.entries()].map(([pos, list]) => (
						<div key={pos}>
							<h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-zinc-700">
								{pos}
								<Badge tone="zinc">{list.length}</Badge>
							</h3>
							<ul className="grid gap-2 sm:grid-cols-2">
								{list.map((c) => (
									<li
										key={c.id}
										className="flex items-center gap-2.5 rounded-xl border border-zinc-200 p-2.5"
									>
										<img
											src={c.image}
											alt=""
											loading="lazy"
											className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-zinc-200"
										/>
										<span className="min-w-0 flex-1">
											<span className="block truncate text-sm font-semibold text-zinc-900">
												{c.name}
											</span>
											<span className="block text-xs tabular-nums text-zinc-500">
												{c.votes} vote{c.votes === 1 ? "" : "s"}
											</span>
										</span>
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
											label="Remove"
											title={`Remove ${c.name}?`}
											body="Candidates with recorded votes cannot be removed — reset those ballots first."
											confirmLabel="Remove"
											pending={removeMut.isPending}
											onConfirm={() => removeMut.mutate(c.id)}
										/>
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
			>
				<form onSubmit={onSubmit} className="mt-3 space-y-3">
					<Field label="Full name" htmlFor="cd-name">
						<TextInput
							id="cd-name"
							required
							value={name}
							onChange={(e) => setName(e.target.value)}
						/>
					</Field>
					<Field label="Position" htmlFor="cd-position">
						<SelectInput
							id="cd-position"
							label="Position"
							value={position}
							onChange={setPosition}
							options={POSITIONS}
						/>
					</Field>
					<Field label="Photo" htmlFor="cd-image" hint="JPG or PNG, max 5MB">
						<label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-600 hover:border-brand-400 hover:text-brand-700">
							<ImagePlus className="h-4 w-4" aria-hidden="true" />
							{image ? image.name : "Choose photo…"}
							<input
								id="cd-image"
								type="file"
								accept="image/jpeg,image/png,image/webp"
								className="sr-only"
								onChange={(e) => setImage(e.target.files?.[0] ?? null)}
							/>
						</label>
					</Field>
					<Button type="submit" loading={saveMut.isPending} className="w-full">
						{dialog?.mode === "edit" ? "Save changes" : "Add candidate"}
					</Button>
				</form>
			</DialogShell>
		</Card>
	);
}
