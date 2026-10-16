import { useQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "../lib/auth";
import { disconnectLiveSocket } from "../lib/socket";
import { issueApi, userApi } from "../lib/api";
import { Candidates } from "../components/admin/candidates";
import { IssueQueue } from "../components/admin/issue-queue";
import { AdminOverview } from "../components/admin/overview";
import { ResultsCharts } from "../components/admin/results-charts";
import { Rollbacks } from "../components/admin/rollbacks";
import { Settings } from "../components/admin/settings";
import { Timing } from "../components/admin/timing";
import { UserTable } from "../components/admin/user-table";

type Section =
	| "overview"
	| "timing"
	| "voters"
	| "candidates"
	| "results"
	| "rollbacks"
	| "issues"
	| "settings";

const GROUPS: {
	label: string;
	items: { id: Section; label: string }[];
}[] = [
	{
		label: "Manage",
		items: [
			{ id: "overview", label: "Overview" },
			{ id: "timing", label: "Timing" },
			{ id: "voters", label: "Voters" },
			{ id: "candidates", label: "Candidates" },
		],
	},
	{
		label: "Insights",
		items: [{ id: "results", label: "Results" }],
	},
	{
		label: "System",
		items: [
			{ id: "rollbacks", label: "Rollbacks" },
			{ id: "issues", label: "Issues" },
			{ id: "settings", label: "Settings" },
		],
	},
];

const TITLES: Record<Section, { title: string; body: string }> = {
	overview: {
		title: "Overview",
		body: "Election health at a glance.",
	},
	timing: {
		title: "Timing",
		body: "Schedule, start, and end the election.",
	},
	voters: {
		title: "Voters",
		body: "Register, import, and manage voter accounts.",
	},
	candidates: {
		title: "Candidates",
		body: "Names, positions, and ballot photos.",
	},
	results: {
		title: "Results",
		body: "Live charts and turnout breakdown.",
	},
	rollbacks: {
		title: "Rollbacks",
		body: "Undo ballots and reset the election.",
	},
	issues: {
		title: "Issues",
		body: "Voter-reported problems and triage.",
	},
	settings: {
		title: "Settings",
		body: "Profile, password, and connection.",
	},
};

export function Admin(): ReactElement {
	const { user, logout } = useAuth();
	const [section, setSection] = useState<Section>("overview");
	const usersQuery = useQuery({
		queryKey: ["admin-users"],
		queryFn: ({ signal }) => userApi.list(signal),
	});
	const issuesQuery = useQuery({
		queryKey: ["admin-issues"],
		queryFn: ({ signal }) => issueApi.list(undefined, signal),
	});

	const openIssues =
		issuesQuery.data?.issues.filter((i) => i.status !== "resolved").length ??
		0;

	function badgeFor(id: Section): number | null {
		if (id === "voters") return usersQuery.data?.users.length ?? null;
		if (id === "issues") return openIssues > 0 ? openIssues : null;
		return null;
	}

	async function onLogout(): Promise<void> {
		disconnectLiveSocket();
		await logout();
	}

	const heading = TITLES[section];
	const initial = (user?.studentId ?? "?").slice(0, 1).toUpperCase();

	return (
		<div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-8 lg:flex lg:items-stretch">
			<aside className="mb-4 px-4 pt-4 sm:px-6 lg:sticky lg:top-[57px] lg:mb-0 lg:flex lg:h-[calc(100vh-57px)] lg:w-60 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:border-l lg:border-stone-200/80 lg:bg-stone-50/60 lg:px-0 lg:py-6 lg:pt-6">
				<p className="mb-1 hidden px-5 text-[10px] font-medium tracking-[0.18em] text-stone-400 uppercase lg:block">
					Admin console
				</p>
				<nav
					aria-label="Admin sections"
					className="flex gap-1 overflow-x-auto rounded-xl border border-stone-200/80 bg-white p-1.5 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:px-3"
				>
					{GROUPS.map((g) => (
						<div key={g.label} className="flex gap-1 lg:mb-3 lg:flex-col lg:gap-0.5">
							<p className="hidden px-3 pt-1 pb-1.5 text-[10px] font-medium tracking-[0.18em] text-stone-400 uppercase lg:block">
								{g.label}
							</p>
							{g.items.map((s) => {
								const active = section === s.id;
								const badge = badgeFor(s.id);
								return (
									<button
										key={s.id}
										type="button"
										onClick={() => setSection(s.id)}
										aria-current={active ? "page" : undefined}
										className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap transition-colors ${
											active
												? "bg-white font-medium text-stone-900 ring-1 ring-stone-200/80 lg:bg-white"
												: "text-stone-500 hover:text-stone-900"
										}`}
									>
										<span
											aria-hidden="true"
											className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${
												active ? "bg-brand-600" : "bg-stone-300"
											}`}
										/>
										<span className="flex-1">{s.label}</span>
										{badge !== null && (
											<span className="text-[11px] tabular-nums text-stone-400">
												{badge}
											</span>
										)}
									</button>
								);
							})}
						</div>
					))}
				</nav>
				<div className="mt-auto hidden border-t border-stone-200/80 p-4 lg:block">
					<div className="flex items-center gap-2.5">
						<span
							aria-hidden="true"
							className="font-crest flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-900 text-sm font-semibold text-white"
						>
							{initial}
						</span>
						<span className="min-w-0 flex-1 leading-tight">
							<span className="block truncate text-xs font-medium text-stone-900">
								{user?.studentId ?? "—"}
							</span>
							<span className="block text-[11px] text-stone-400">
								Administrator
							</span>
						</span>
						<button
							type="button"
							onClick={() => void onLogout()}
							title="Logout"
							aria-label="Logout"
							className="rounded-lg p-2 text-stone-400 hover:bg-stone-200/60 hover:text-stone-800"
						>
							<LogOut className="h-4 w-4" aria-hidden="true" />
						</button>
					</div>
				</div>
			</aside>

			<div className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
				<div className="mb-6 max-w-2xl">
					<h1 className="font-crest text-2xl font-semibold tracking-tight text-stone-900">
						{heading.title}
					</h1>
					<p className="mt-1 text-[13px] text-stone-500">{heading.body}</p>
				</div>
				{section === "overview" && (
					<AdminOverview onNavigate={(s: string) => setSection(s as Section)} />
				)}
				{section === "timing" && <Timing />}
				{section === "voters" && <UserTable />}
				{section === "candidates" && <Candidates />}
				{section === "results" && <ResultsCharts />}
				{section === "rollbacks" && <Rollbacks />}
				{section === "issues" && <IssueQueue />}
				{section === "settings" && <Settings />}
			</div>
		</div>
	);
}
