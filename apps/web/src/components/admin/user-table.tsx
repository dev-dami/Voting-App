import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, KeyRound, Plus, Upload, UserPlus } from "lucide-react";
import type { FormEvent, ReactElement } from "react";
import { useState } from "react";
import { ApiError, userApi } from "../../lib/api";
import { toCsv, userRowsFromCsv } from "../../lib/csv";
import type { ManagedUser, UserImportRow } from "../../lib/types";
import { Button } from "../../ui/button";
import { ConfirmAction, DialogShell } from "../../ui/dialog";
import {
	Badge,
	Card,
	EmptyState,
	SectionTitle,
	Skeleton,
} from "../../ui/display";
import { Field, SearchInput, SelectInput, TextInput } from "../../ui/inputs";
import { notify } from "../../ui/toast";

const CATEGORIES = [
	{ value: "student", label: "Student" },
	{ value: "teaching_staff", label: "Teaching staff" },
	{ value: "non_teaching_staff", label: "Non-teaching staff" },
];

const ROLES = [
	...CATEGORIES,
	{ value: "official", label: "Election official" },
	{ value: "admin", label: "Administrator" },
];

function isVoter(role: string): boolean {
	return CATEGORIES.some((category) => category.value === role);
}

function roleLabel(role: string): string {
	return (
		ROLES.find((option) => option.value === role)?.label ??
		role.replaceAll("_", " ")
	);
}

function statusBadge(u: ManagedUser): ReactElement {
	return (
		<div className="flex flex-wrap gap-1.5">
			{u.isSuspended && <Badge tone="red">Suspended</Badge>}
			{!isVoter(u.role) ? (
				<Badge tone="zinc">Non-voting account</Badge>
			) : u.hasVoted ? (
				<Badge tone="green">Voted</Badge>
			) : (
				<Badge tone="zinc">Not voted</Badge>
			)}
		</div>
	);
}

function fail(action: string): (e: unknown) => void {
	return (e: unknown) => {
		notify.error(
			`${action} failed`,
			e instanceof ApiError ? e.message : undefined,
		);
	};
}

export function UserTable(): ReactElement {
	const queryClient = useQueryClient();
	const invalidate = (): void => {
		void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
		void queryClient.invalidateQueries({ queryKey: ["results"] });
		void queryClient.invalidateQueries({ queryKey: ["admin-candidates"] });
	};
	const usersQuery = useQuery({
		queryKey: ["admin-users"],
		queryFn: ({ signal }) => userApi.list(signal),
	});

	const [search, setSearch] = useState("");
	const [csvErrors, setCsvErrors] = useState<string[]>([]);
	const [addOpen, setAddOpen] = useState(false);
	const [newUser, setNewUser] = useState<UserImportRow>({
		voterId: "",
		password: "",
		role: "student",
		voterCategory: "student",
		classOrDept: "",
	});
	const [pwId, setPwId] = useState<string | null>(null);
	const [pwValue, setPwValue] = useState("");

	const importMut = useMutation({
		mutationFn: (rows: UserImportRow[]) => userApi.importUsers(rows),
		onSuccess: (r) => {
			notify.success(`Imported ${r.created} users`, `${r.skipped} skipped.`);
			invalidate();
		},
		onError: fail("Import"),
	});
	const createMut = useMutation({
		mutationFn: () => {
			const { voterCategory, ...account } = newUser;
			return userApi.create({
				...account,
				voterId: account.voterId.trim(),
				...(isVoter(account.role ?? "student") ? { voterCategory } : {}),
			});
		},
		onSuccess: () => {
			notify.success("User created");
			setNewUser({
				voterId: "",
				password: "",
				role: "student",
				voterCategory: "student",
				classOrDept: "",
			});
			setAddOpen(false);
			invalidate();
		},
		onError: fail("Create user"),
	});
	const suspendMut = useMutation({
		mutationFn: ({ id, s }: { id: string; s: boolean }) =>
			s ? userApi.suspend(id) : userApi.enable(id),
		onSuccess: invalidate,
		onError: fail("Update user"),
	});
	const pwMut = useMutation({
		mutationFn: ({ id, pw }: { id: string; pw: string }) =>
			userApi.resetPassword(id, pw),
		onSuccess: () => {
			notify.success("Password reset");
			setPwId(null);
			setPwValue("");
		},
		onError: fail("Password reset"),
	});
	const votesMut = useMutation({
		mutationFn: (id: string) => userApi.resetVotes(id),
		onSuccess: () => {
			notify.success("Votes reset for voter");
			invalidate();
		},
		onError: fail("Reset votes"),
	});

	async function onCsvFile(file: File): Promise<void> {
		setCsvErrors([]);
		const text = await file.text();
		const { rows, errors } = userRowsFromCsv(text);
		setCsvErrors(errors);
		if (rows.length > 0) importMut.mutate(rows);
		else if (errors.length === 0) setCsvErrors(["CSV has no valid rows."]);
	}

	function onAddUser(e: FormEvent): void {
		e.preventDefault();
		if (!newUser.voterId.trim()) {
			notify.error(
				"User ID is required",
				"Enter an ID that is not only spaces.",
			);
			return;
		}
		createMut.mutate();
	}

	function downloadUsersCsv(): void {
		const rows: (string | number)[][] = [
			["voterId", "role", "voterCategory", "hasVoted", "isSuspended"],
			...(usersQuery.data?.users ?? []).map((u) => [
				u.studentId,
				u.role,
				u.voterCategory ?? "",
				u.hasVoted ? 1 : 0,
				u.isSuspended ? 1 : 0,
			]),
		];
		const blob = new Blob([toCsv(rows)], { type: "text/csv" });
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = "users.csv";
		a.click();
		URL.revokeObjectURL(a.href);
	}

	const users = usersQuery.data?.users ?? [];
	const filtered = users.filter((u) =>
		[u.studentId, roleLabel(u.role), u.classOrDept].some((value) =>
			value.toLowerCase().includes(search.trim().toLowerCase()),
		),
	);

	return (
		<Card className="min-w-0 p-4 sm:p-5">
			<SectionTitle>
				Users{usersQuery.isSuccess ? ` (${users.length})` : ""}
			</SectionTitle>
			<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<SearchInput
					id="user-search"
					aria-label="Search users by ID, role, or department"
					placeholder="Search ID, role, or department"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="sm:w-72"
				/>
				<Button
					variant="outline"
					icon={<UserPlus className="h-4 w-4" aria-hidden="true" />}
					onClick={() => setAddOpen(true)}
				>
					Add user
				</Button>
			</div>

			<div className="mb-3 flex flex-wrap items-center gap-2">
				<label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-600">
					<Upload className="h-3.5 w-3.5" aria-hidden="true" />
					Import CSV
					<input
						type="file"
						accept=".csv,text/csv"
						className="sr-only"
						onChange={(e) => {
							const f = e.target.files?.[0];
							if (f)
								void onCsvFile(f).catch(() =>
									notify.error("Import failed", "Could not read file."),
								);
							e.target.value = "";
						}}
					/>
				</label>
				<Button
					variant="ghost"
					size="sm"
					icon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}
					onClick={downloadUsersCsv}
				>
					Export all users
				</Button>
				<span className="text-[11px] text-zinc-400">
					voterId, password, role, voterCategory, classOrDept
				</span>
			</div>

			{csvErrors.length > 0 && (
				<ul className="mb-2 space-y-0.5 rounded-lg bg-red-50 p-2 text-[11px] font-medium text-red-700">
					{csvErrors.map((m) => (
						<li key={m}>{m}</li>
					))}
				</ul>
			)}

			{usersQuery.isPending ? (
				<div className="space-y-2">
					{[0, 1, 2].map((i) => (
						<Skeleton key={i} className="h-12" />
					))}
				</div>
			) : usersQuery.isError ? (
				<p role="alert" className="text-xs font-medium text-red-700">
					Could not load users.
				</p>
			) : filtered.length === 0 ? (
				<EmptyState
					title={users.length === 0 ? "No users yet" : "No matches"}
					body={
						users.length === 0
							? "Add the first voter or import a CSV."
							: "Try a different search."
					}
				/>
			) : (
				<section
					className="max-h-[32rem] overflow-auto rounded-lg border border-zinc-200"
					aria-label="Users list"
				>
					<table className="w-full min-w-[720px] text-left text-sm [&_th]:px-3 [&_th]:py-3 [&_td]:px-3 [&_td]:py-3">
						<caption className="sr-only">
							{filtered.length} of {users.length} users. Account roles, voting
							status, and management actions.
						</caption>
						<thead className="sticky top-0 bg-white">
							<tr className="border-b border-zinc-200 text-zinc-500">
								<th scope="col" className="py-1.5 pr-2 font-semibold">
									User ID
								</th>
								<th scope="col" className="py-1.5 pr-2 font-semibold">
									Role
								</th>
								<th scope="col" className="py-1.5 pr-2 font-semibold">
									Status
								</th>
								<th scope="col" className="py-1.5 font-semibold">
									<span className="sr-only">Actions</span>
								</th>
							</tr>
						</thead>
						<tbody>
							{filtered.map((u) => (
								<tr key={u.id} className="border-b border-zinc-100">
									<td className="py-1.5 pr-2 font-medium text-zinc-900">
										{u.studentId}
									</td>
									<td className="py-1.5 pr-2 text-zinc-500">
										{roleLabel(u.role)}
										{isVoter(u.role) &&
										u.voterCategory &&
										u.voterCategory !== u.role ? (
											<span className="block text-xs text-zinc-600">
												Voter group: {roleLabel(u.voterCategory)}
											</span>
										) : null}
									</td>
									<td className="py-1.5 pr-2">{statusBadge(u)}</td>
									<td className="py-1.5">
										<div className="flex flex-wrap gap-1">
											<Button
												variant="outline"
												size="sm"
												loading={suspendMut.isPending}
												onClick={() =>
													suspendMut.mutate({ id: u.id, s: !u.isSuspended })
												}
											>
												{u.isSuspended ? "Enable" : "Suspend"}
											</Button>
											<Button
												variant="ghost"
												size="sm"
												icon={
													<KeyRound className="h-3 w-3" aria-hidden="true" />
												}
												onClick={() => {
													setPwId(u.id);
													setPwValue("");
												}}
											>
												Password
											</Button>
											{u.hasVoted && (
												<ConfirmAction
													label="Reset votes"
													title={`Reset votes for ${u.studentId}?`}
													body="Their ballot is deleted and candidate counts drop. They can vote again."
													confirmLabel="Reset votes"
													pending={votesMut.isPending}
													onConfirm={() => votesMut.mutate(u.id)}
												/>
											)}
										</div>
										{pwId === u.id && (
											<form
												className="mt-1.5 flex gap-1"
												onSubmit={(e) => {
													e.preventDefault();
													pwMut.mutate({ id: u.id, pw: pwValue });
												}}
											>
												<input
													type="password"
													required
													minLength={6}
													aria-label={`New password for ${u.studentId}`}
													placeholder="New password (6+ chars)"
													value={pwValue}
													onChange={(e) => setPwValue(e.target.value)}
													className="w-40 rounded-md border border-zinc-300 px-2 py-1 text-xs"
												/>
												<Button
													type="submit"
													size="sm"
													loading={pwMut.isPending}
												>
													Save
												</Button>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => setPwId(null)}
												>
													Cancel
												</Button>
											</form>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</section>
			)}

			<DialogShell
				open={addOpen}
				onOpenChange={setAddOpen}
				title="Add user"
				description="Single voter, official, or admin account."
			>
				<form onSubmit={onAddUser} className="mt-3 space-y-3">
					<Field label="User ID" htmlFor="nu-id">
						<TextInput
							id="nu-id"
							required
							value={newUser.voterId}
							onChange={(e) =>
								setNewUser((u) => ({ ...u, voterId: e.target.value }))
							}
						/>
					</Field>
					<Field label="Password" htmlFor="nu-pw" hint="Minimum 6 characters">
						<TextInput
							id="nu-pw"
							type="password"
							required
							minLength={6}
							value={newUser.password}
							onChange={(e) =>
								setNewUser((u) => ({ ...u, password: e.target.value }))
							}
						/>
					</Field>
					<div className="grid grid-cols-2 gap-3">
						<Field label="Role" htmlFor="nu-role">
							<SelectInput
								id="nu-role"
								label="Role"
								value={newUser.role ?? "student"}
								onChange={(v) => setNewUser((u) => ({ ...u, role: v }))}
								options={ROLES}
							/>
						</Field>
						<Field label="Category" htmlFor="nu-cat">
							<SelectInput
								id="nu-cat"
								label="Category"
								value={newUser.voterCategory ?? "student"}
								onChange={(v) =>
									setNewUser((u) => ({ ...u, voterCategory: v }))
								}
								options={CATEGORIES}
							/>
						</Field>
					</div>
					<Field label="Class / Dept" htmlFor="nu-class">
						<TextInput
							id="nu-class"
							value={newUser.classOrDept ?? ""}
							onChange={(e) =>
								setNewUser((u) => ({ ...u, classOrDept: e.target.value }))
							}
						/>
					</Field>
					<Button
						type="submit"
						loading={createMut.isPending}
						icon={<Plus className="h-4 w-4" aria-hidden="true" />}
						className="w-full"
					>
						Add user
					</Button>
				</form>
			</DialogShell>
		</Card>
	);
}
