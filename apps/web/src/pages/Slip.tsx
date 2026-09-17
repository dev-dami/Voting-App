import { useQuery } from "@tanstack/react-query";
import { Check, CircleAlert, LogOut, Printer } from "lucide-react";
import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { ballotApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button } from "../ui/button";
import { EmptyState, Skeleton } from "../ui/display";

export function Slip(): ReactElement {
	const { logout } = useAuth();
	const slipQuery = useQuery({
		queryKey: ["slip"],
		queryFn: ({ signal }) => ballotApi.slip(signal),
	});

	if (slipQuery.isPending) {
		return (
			<div
				className="mx-auto max-w-xl space-y-3"
				role="status"
				aria-label="Loading slip"
			>
				<Skeleton className="mx-auto h-16 w-16 rounded-full" />
				<Skeleton className="h-6 w-48 mx-auto" />
				<Skeleton className="h-40" />
			</div>
		);
	}
	if (slipQuery.isError || !slipQuery.data) {
		return (
			<EmptyState
				icon={<CircleAlert className="h-5 w-5" aria-hidden="true" />}
				title="Could not load your vote slip"
				body="Check your connection and try again."
				action={
					<Button
						variant="outline"
						size="sm"
						onClick={() => void slipQuery.refetch()}
					>
						Retry
					</Button>
				}
			/>
		);
	}

	const voted = slipQuery.data.votedPositions;

	return (
		<div className="mx-auto max-w-xl">
			<div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-md print:border-0 print:shadow-none">
				<div className="px-6 pt-6 pb-4 text-center">
					<span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
						<Check className="h-7 w-7 text-green-700" aria-hidden="true" />
					</span>
					<h1 className="mt-2 text-lg font-bold text-zinc-900">
						Vote recorded
					</h1>
					<p className="mt-0.5 text-xs text-zinc-500">
						Thank you for participating. Your vote is secure and anonymous.
					</p>
				</div>
				{voted.length === 0 ? (
					<p className="px-6 pb-4 text-center text-sm text-zinc-500">
						No vote summary available.{" "}
						<Link to="/vote" className="font-medium text-brand-700 underline">
							Back to ballot
						</Link>
					</p>
				) : (
					<ul className="space-y-2 px-6 pb-2">
						{voted.map((v) => (
							<li
								key={v.position}
								className="flex items-center gap-2.5 rounded-lg bg-zinc-50 px-3 py-2"
							>
								<Check
									className="h-4 w-4 shrink-0 text-green-700"
									aria-hidden="true"
								/>
								<span className="min-w-0 flex-1">
									<span className="block text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
										{v.position}
									</span>
									<span className="block truncate text-sm font-semibold text-zinc-900">
										{v.candidateName ?? "Unknown"}
									</span>
								</span>
							</li>
						))}
					</ul>
				)}
				<div className="flex justify-center gap-2 px-6 py-4 print:hidden">
					<Button
						size="sm"
						icon={<Printer className="h-4 w-4" aria-hidden="true" />}
						onClick={() => window.print()}
					>
						Print slip
					</Button>
					<Button
						variant="outline"
						size="sm"
						icon={<LogOut className="h-4 w-4" aria-hidden="true" />}
						onClick={() => void logout()}
					>
						Logout
					</Button>
				</div>
			</div>
		</div>
	);
}
