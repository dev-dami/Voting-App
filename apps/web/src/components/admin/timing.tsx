import { useQuery } from "@tanstack/react-query";
import { Hourglass } from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { electionApi } from "../../lib/api";
import { Card, SectionTitle } from "../../ui/display";
import { ElectionControls } from "./election-controls";

function parts(ms: number): { d: number; h: number; m: number; s: number } {
	const total = Math.max(0, Math.floor(ms / 1000));
	return {
		d: Math.floor(total / 86400),
		h: Math.floor((total % 86400) / 3600),
		m: Math.floor((total % 3600) / 60),
		s: total % 60,
	};
}

// Ticks every second, but only while the election is running with an end
// time — a 1s interval on this tiny component is negligible.
function Countdown({ endTime }: { endTime: string }): ReactElement {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const t = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(t);
	}, []);
	const left = new Date(endTime).getTime() - now;
	const p = parts(left);
	const cells: [string, number][] = [
		["days", p.d],
		["hrs", p.h],
		["min", p.m],
		["sec", p.s],
	];
	return (
		<Card className="flex items-center gap-4 bg-zinc-900 p-4 text-white">
			<Hourglass
				className="h-6 w-6 shrink-0 text-brand-200"
				aria-hidden="true"
			/>
			<div>
				<p className="text-[11px] font-semibold tracking-widest text-zinc-400 uppercase">
					{left <= 0 ? "Voting closed" : "Voting closes in"}
				</p>
				<p
					className="font-crest text-2xl font-bold tabular-nums"
					aria-live="off"
				>
					{cells.map(([label, v], i) => (
						<span key={label}>
							{i > 0 && <span className="text-zinc-500"> : </span>}
							{String(v).padStart(2, "0")}
							<span className="ml-0.5 align-middle text-[11px] font-sans font-medium text-zinc-400">
								{label}
							</span>
						</span>
					))}
				</p>
			</div>
		</Card>
	);
}

export function Timing(): ReactElement {
	const electionQuery = useQuery({
		queryKey: ["election"],
		queryFn: ({ signal }) => electionApi.status(signal),
		refetchInterval: 30_000,
	});
	const election = electionQuery.data;

	return (
		<div className="space-y-4">
			{election?.status === "running" && election.endTime ? (
				<Countdown endTime={election.endTime} />
			) : (
				<Card className="p-4">
					<SectionTitle>Schedule</SectionTitle>
					<p className="text-xs text-zinc-500">
						{election?.status === "ended"
							? "The election has ended. Reset it from Rollbacks to run again."
							: "No live countdown — start the election with an end time to schedule the close."}
					</p>
				</Card>
			)}
			<ElectionControls />
		</div>
	);
}
