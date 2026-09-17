import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Undo2 } from "lucide-react";
import type { ReactElement } from "react";
import { useState } from "react";
import { ApiError, userApi } from "../../lib/api";
import { ConfirmAction } from "../../ui/dialog";
import {
	Badge,
	Card,
	EmptyState,
	SectionTitle,
	Skeleton,
} from "../../ui/display";
import { SearchInput } from "../../ui/inputs";
import { notify } from "../../ui/toast";
import { DangerZone } from "./danger-zone";

export function Rollbacks(): ReactElement {
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const usersQuery = useQuery({
		queryKey: ["admin-users"],
		queryFn: ({ signal }) => userApi.list(signal),
	});

	const votesMut = useMutation({
		mutationFn: (id: string) => userApi.resetVotes(id),
		onSuccess: () => {
			notify.success("Ballot rolled back", "The voter can vote again.");
			void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
			void queryClient.invalidateQueries({ queryKey: ["admin-candidates"] });
			void queryClient.invalidateQueries({ queryKey: ["results"] });
		},
		onError: (e: unknown) => {
			notify.error(
				"Rollback failed",
				e instanceof ApiError ? e.message : undefined,
			);
		},
	});

	const q = search.trim().toLowerCase();
	const voted =
		usersQuery.data?.users.filter(
			(u) =>
				u.hasVoted && (q.length === 0 || u.studentId.toLowerCase().includes(q)),
		) ?? [];

	return (
		<div className="space-y-4">
			<Card className="p-4">
				<SectionTitle
					action={
						<SearchInput
							id="rollback-search"
							aria-label="Find voter to roll back"
							placeholder="Find voter…"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="w-40 py-1 text-xs"
						/>
					}
				>
					<span className="flex items-center gap-1.5">
						<Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
						Roll back a ballot
					</span>
				</SectionTitle>
				<p className="mb-3 text-xs text-zinc-500">
					Deletes a voter&apos;s ballot and restores candidate counts, so they
					can vote again. Use for spoiled or mistaken votes.
				</p>
				{usersQuery.isPending ? (
					<div className="space-y-2">
						{[0, 1].map((i) => (
							<Skeleton key={i} className="h-12" />
						))}
					</div>
				) : usersQuery.isError ? (
					<p role="alert" className="text-xs font-medium text-red-700">
						Could not load voters.
					</p>
				) : voted.length === 0 ? (
					<EmptyState
						title="No ballots to roll back"
						body={
							q.length > 0
								? "No voted voter matches that search."
								: "Nobody has voted yet."
						}
					/>
				) : (
					<ul className="max-h-80 space-y-1.5 overflow-y-auto">
						{voted.map((u) => (
							<li
								key={u.id}
								className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs"
							>
								<span className="flex min-w-0 items-center gap-2">
									<span className="truncate font-semibold text-zinc-900">
										{u.studentId}
									</span>
									<Badge tone="green">voted</Badge>
									{u.isSuspended && <Badge tone="red">suspended</Badge>}
								</span>
								<ConfirmAction
									label="Roll back"
									title={`Roll back ${u.studentId}'s ballot?`}
									body="Their votes are deleted, counts drop, and they can vote again."
									confirmLabel="Roll back ballot"
									pending={votesMut.isPending}
									onConfirm={() => votesMut.mutate(u.id)}
								/>
							</li>
						))}
					</ul>
				)}
			</Card>

			<Card className="p-4">
				<SectionTitle>
					<span className="flex items-center gap-1.5">
						<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
						Full election rollback
					</span>
				</SectionTitle>
				<DangerZone bare />
			</Card>
		</div>
	);
}
