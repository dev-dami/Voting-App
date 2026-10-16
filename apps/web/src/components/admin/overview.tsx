import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarClock, Crown, Inbox, Users } from "lucide-react";
import type { ReactElement } from "react";
import { electionApi, issueApi, resultsApi, userApi } from "../../lib/api";
import { Badge, Card, SectionTitle, Skeleton, Stat } from "../../ui/display";

export function AdminOverview({
	onNavigate,
}: {
	onNavigate: (section: string) => void;
}): ReactElement {
	const resultsQuery = useQuery({
		queryKey: ["results"],
		queryFn: ({ signal }) => resultsApi.get(signal),
	});
	const usersQuery = useQuery({
		queryKey: ["admin-users"],
		queryFn: ({ signal }) => userApi.list(signal),
	});
	const issuesQuery = useQuery({
		queryKey: ["admin-issues"],
		queryFn: ({ signal }) => issueApi.list(undefined, signal),
	});
	const electionQuery = useQuery({
		queryKey: ["election"],
		queryFn: ({ signal }) => electionApi.status(signal),
	});

	const loading =
		resultsQuery.isPending || usersQuery.isPending || issuesQuery.isPending;
	const openIssues =
		issuesQuery.data?.issues.filter((i) => i.status !== "resolved").length ?? 0;
	const voted = usersQuery.data?.users.filter((u) => u.hasVoted).length ?? 0;
	const positions = resultsQuery.data?.positions.length ?? 0;
	const candidates =
		resultsQuery.data?.positions.reduce((n, p) => n + p.candidates.length, 0) ??
		0;

	const shortcuts: { label: string; body: string; section: string }[] = [
		{
			label: "Timing",
			body: "Start, end, or schedule the election.",
			section: "timing",
		},
		{
			label: "Users",
			body: "Manage voter, official, and administrator accounts.",
			section: "users",
		},
		{
			label: "Candidates",
			body: "Manage names, positions, photos.",
			section: "candidates",
		},
		{
			label: "Results",
			body: "Charts and turnout breakdown.",
			section: "results",
		},
	];

	return (
		<div className="space-y-5">
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<Stat
					label="Election"
					value={electionQuery.data?.status ?? "—"}
					loading={electionQuery.isPending}
				/>
				<Stat
					label="Turnout"
					value={
						resultsQuery.data ? `${resultsQuery.data.turnoutPercentage}%` : "—"
					}
					loading={resultsQuery.isPending}
				/>
				<Stat
					label="Voted (voter accounts)"
					value={voted}
					loading={usersQuery.isPending}
				/>
				<Stat
					label="Open issues"
					value={openIssues}
					loading={issuesQuery.isPending}
				/>
			</div>

			<Card className="p-5">
				<SectionTitle>At a glance</SectionTitle>
				{loading ? (
					<div className="space-y-2">
						<Skeleton className="h-5" />
						<Skeleton className="h-5" />
					</div>
				) : (
					<ul className="grid gap-2.5 text-[13px] sm:grid-cols-2">
						<li className="flex items-center gap-2.5 rounded-xl border border-zinc-100 bg-zinc-50/70 px-3.5 py-2.5 text-zinc-600">
							<Users className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
							<span>
								<span className="font-semibold text-zinc-900">
									{usersQuery.data?.users.length ?? 0}
								</span>{" "}
								user accounts registered
							</span>
						</li>
						<li className="flex items-center gap-2.5 rounded-xl border border-zinc-100 bg-zinc-50/70 px-3.5 py-2.5 text-zinc-600">
							<Crown className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
							<span>
								<span className="font-semibold text-zinc-900">{candidates}</span>{" "}
								candidates across{" "}
								<span className="font-semibold text-zinc-900">{positions}</span>{" "}
								positions
							</span>
						</li>
						<li className="flex items-center gap-2.5 rounded-xl border border-zinc-100 bg-zinc-50/70 px-3.5 py-2.5 text-zinc-600">
							<CalendarClock
								className="h-4 w-4 shrink-0 text-zinc-400"
								aria-hidden="true"
							/>
							<span>
								Election{" "}
								<Badge
									tone={
										electionQuery.data?.status === "running" ? "green" : "amber"
									}
								>
									{electionQuery.data?.status ?? "unknown"}
								</Badge>
							</span>
						</li>
						<li className="flex items-center gap-2.5 rounded-xl border border-zinc-100 bg-zinc-50/70 px-3.5 py-2.5 text-zinc-600">
							<Inbox className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
							<span>
								<span className="font-semibold text-zinc-900">{openIssues}</span>{" "}
								open issues —{" "}
								<button
									type="button"
									onClick={() => onNavigate("issues")}
									className="rounded font-medium text-brand-700 underline decoration-zinc-300 underline-offset-2 hover:text-brand-900 focus-visible:outline-2 focus-visible:outline-offset-2"
								>
									manage issues
								</button>
							</span>
						</li>
					</ul>
				)}
			</Card>

			<div className="grid gap-2.5 sm:grid-cols-2">
				{shortcuts.map((s) => (
					<button
						key={s.section}
						type="button"
						onClick={() => onNavigate(s.section)}
						className="group flex items-center justify-between gap-2 rounded-2xl border border-zinc-200/80 bg-white p-4 text-left transition-colors hover:border-brand-300"
					>
						<span>
							<span className="block text-sm font-medium text-zinc-900">
								{s.label}
							</span>
							<span className="block mt-0.5 text-xs text-zinc-500">{s.body}</span>
						</span>
						<ArrowRight
							className="h-4 w-4 shrink-0 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:text-brand-600"
							aria-hidden="true"
						/>
					</button>
				))}
			</div>
		</div>
	);
}
