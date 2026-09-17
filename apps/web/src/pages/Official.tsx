import { Tabs as BaseTabs } from "@base-ui-components/react/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Crown, Pause, Play } from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { BarChart } from "../components/BarChart";
import { resultsApi } from "../lib/api";
import { connectLiveSocket } from "../lib/socket";
import type { LiveVoteCast } from "../lib/types";
import { Badge, Card, ProgressBar, SectionTitle, Stat } from "../ui/display";
import { SearchInput } from "../ui/inputs";
import { PageTabs } from "../ui/tabs";

interface FeedItem {
	id: string;
	voterId: string;
	candidateName: string;
	position: string;
	createdAt: string;
}

function toFeed(p: LiveVoteCast): FeedItem {
	return {
		id: crypto.randomUUID(),
		voterId: p.voterId,
		candidateName: p.candidateName,
		position: p.position,
		createdAt: p.createdAt,
	};
}

export function Official(): ReactElement {
	const queryClient = useQueryClient();
	const [category, setCategory] = useState("all");
	const [live, setLive] = useState<FeedItem[]>([]);
	const [paused, setPaused] = useState(false);
	const [connected, setConnected] = useState(false);
	const [filter, setFilter] = useState("");

	const resultsQuery = useQuery({
		queryKey: ["results"],
		queryFn: ({ signal }) => resultsApi.get(signal),
		refetchInterval: 30_000,
	});

	useEffect(() => {
		const disconnect = connectLiveSocket({
			onOpen: () => setConnected(true),
			onClose: () => setConnected(false),
			onVoteCast: (p) => {
				setLive((prev) => [toFeed(p), ...prev].slice(0, 50));
				void queryClient.invalidateQueries({ queryKey: ["results"] });
			},
			onVoteUpdate: () => {
				void queryClient.invalidateQueries({ queryKey: ["results"] });
			},
		});
		return disconnect;
	}, [queryClient]);

	const categories = resultsQuery.data?.turnoutByCategory ?? [];
	const scoped =
		category === "all"
			? {
					totalVoters: resultsQuery.data?.totalVoters,
					totalVotes: resultsQuery.data?.totalVotes,
					rate: resultsQuery.data?.turnoutPercentage,
				}
			: (() => {
					const row = categories.find((c) => c.category === category);
					return {
						totalVoters: row?.totalVoters,
						totalVotes: row?.totalVotes,
						rate: row?.turnoutPercentage,
					};
				})();

	const q = filter.trim().toLowerCase();
	const feed = (paused ? [] : live).filter(
		(a) =>
			q.length === 0 ||
			a.voterId.toLowerCase().includes(q) ||
			a.candidateName.toLowerCase().includes(q),
	);

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-2">
				<h1 className="text-lg font-bold text-zinc-900">Official overview</h1>
				<Badge tone={connected ? "green" : "zinc"}>
					<span
						aria-hidden="true"
						className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-green-600" : "bg-zinc-400"}`}
					/>
					{connected ? "Live" : "Offline"}
				</Badge>
			</div>

			<PageTabs
				defaultValue="turnout"
				tabs={[
					{ value: "turnout", label: "Turnout" },
					{ value: "results", label: "Results" },
					{
						value: "live",
						label: `Live activity${live.length > 0 ? ` (${live.length})` : ""}`,
					},
				]}
			>
				<BaseTabs.Panel value="turnout" className="pt-3">
					<fieldset className="rounded-lg bg-zinc-200 p-1">
						<legend className="sr-only">Turnout category</legend>
						<div className="flex gap-1">
							{["all", ...categories.map((c) => c.category)].map((c) => (
								<label
									key={c}
									className={`flex-1 cursor-pointer rounded px-2 py-1.5 text-center text-xs font-semibold ${
										category === c
											? "bg-white shadow-sm"
											: "text-zinc-500 hover:text-zinc-800"
									}`}
								>
									<input
										type="radio"
										name="turnout-category"
										value={c}
										checked={category === c}
										onChange={() => setCategory(c)}
										className="sr-only"
									/>
									{c === "all" ? "All" : c.replaceAll("_", " ")}
								</label>
							))}
						</div>
					</fieldset>

					<div className="mt-3 grid grid-cols-3 gap-3">
						<Stat
							label="Eligible"
							value={scoped.totalVoters ?? "—"}
							loading={resultsQuery.isPending}
						/>
						<Stat
							label="Voted"
							value={scoped.totalVotes ?? "—"}
							loading={resultsQuery.isPending}
						/>
						<Stat
							label="Turnout"
							value={scoped.rate === undefined ? "—" : `${scoped.rate}%`}
							loading={resultsQuery.isPending}
						/>
					</div>
					<Card className="mt-3 flex items-center gap-3 p-3">
						<ProgressBar
							value={scoped.rate ?? 0}
							label="Overall turnout progress"
						/>
						<span className="text-xs font-bold tabular-nums text-zinc-700">
							{scoped.rate ?? 0}%
						</span>
					</Card>
				</BaseTabs.Panel>

				<BaseTabs.Panel value="results" className="pt-3">
					<Card className="p-4">
						<SectionTitle>Results by position</SectionTitle>
						{resultsQuery.isPending ? (
							<p className="text-xs text-zinc-500">Loading results…</p>
						) : resultsQuery.isError || !resultsQuery.data ? (
							<p role="alert" className="text-xs font-medium text-red-700">
								Could not load results.
							</p>
						) : (
							<div className="space-y-5">
								{resultsQuery.data.positions.map((r) => (
									<div key={r.position}>
										<h3 className="mb-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-zinc-600">
											{r.position}
											<span className="font-normal">
												({r.totalVotes} votes)
											</span>
											{r.winner && (
												<Badge tone="amber">
													<Crown className="h-3 w-3" aria-hidden="true" />
													{r.winner.name}
												</Badge>
											)}
										</h3>
										<BarChart
											ariaLabel={`${r.position} results`}
											data={r.candidates.map((c) => ({
												label: `${c.name} (${c.percentage}%)`,
												value: c.votes,
											}))}
										/>
									</div>
								))}
							</div>
						)}
					</Card>
				</BaseTabs.Panel>

				<BaseTabs.Panel value="live" className="pt-3">
					<Card className="p-4">
						<SectionTitle
							action={
								<div className="flex items-center gap-2">
									<SearchInput
										id="live-filter"
										aria-label="Filter activity"
										placeholder="Filter…"
										value={filter}
										onChange={(e) => setFilter(e.target.value)}
										className="w-36 py-1 text-xs"
									/>
									<button
										type="button"
										onClick={() => setPaused((p) => !p)}
										aria-pressed={paused}
										className="rounded-md border border-zinc-300 p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
										title={paused ? "Resume feed" : "Pause feed"}
									>
										{paused ? (
											<Play className="h-3.5 w-3.5" aria-hidden="true" />
										) : (
											<Pause className="h-3.5 w-3.5" aria-hidden="true" />
										)}
									</button>
								</div>
							}
						>
							<span className="flex items-center gap-1.5">
								<Activity className="h-3.5 w-3.5" aria-hidden="true" />
								Live activity
							</span>
						</SectionTitle>
						{feed.length === 0 ? (
							<p className="text-xs text-zinc-500">
								{paused
									? "Feed paused — resume to see new votes."
									: "No live votes yet. Votes appear here as they are cast."}
							</p>
						) : (
							<ul className="max-h-80 space-y-1 overflow-y-auto text-xs">
								{feed.map((a) => (
									<li
										key={a.id}
										className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-2.5 py-1.5"
									>
										<span className="min-w-0">
											<span className="font-semibold text-zinc-900">
												{a.voterId}
											</span>
											<span className="text-zinc-500">
												{" "}
												voted for {a.candidateName}
											</span>
											<span className="text-zinc-400"> ({a.position})</span>
										</span>
										<span className="shrink-0 tabular-nums text-zinc-400">
											{new Date(a.createdAt).toLocaleTimeString()}
										</span>
									</li>
								))}
							</ul>
						)}
					</Card>
				</BaseTabs.Panel>
			</PageTabs>
		</div>
	);
}
