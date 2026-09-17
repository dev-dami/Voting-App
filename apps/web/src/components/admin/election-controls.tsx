import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Play } from "lucide-react";
import type { ReactElement } from "react";
import { useState } from "react";
import { ApiError, electionApi } from "../../lib/api";
import { Button } from "../../ui/button";
import { ConfirmAction } from "../../ui/dialog";
import { Badge, Card, SectionTitle, Skeleton } from "../../ui/display";
import { Field, TextInput } from "../../ui/inputs";
import { notify } from "../../ui/toast";

function defaultEnd(): string {
	const d = new Date(Date.now() + 24 * 3600 * 1000);
	const p = (n: number): string => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function statusTone(status: string): "green" | "amber" | "zinc" {
	if (status === "running") return "green";
	if (status === "pending") return "amber";
	return "zinc";
}

export function ElectionControls(): ReactElement {
	const queryClient = useQueryClient();
	const [endTime, setEndTime] = useState(defaultEnd);
	const [dateError, setDateError] = useState<string | null>(null);
	const electionQuery = useQuery({
		queryKey: ["election"],
		queryFn: ({ signal }) => electionApi.status(signal),
	});

	function fail(e: unknown): void {
		notify.error(
			"Election action failed",
			e instanceof ApiError ? e.message : undefined,
		);
	}

	const startMut = useMutation({
		mutationFn: () => electionApi.start(new Date(endTime).toISOString()),
		onSuccess: () => {
			notify.success("Election started");
			void queryClient.invalidateQueries({ queryKey: ["election"] });
		},
		onError: fail,
	});
	const endMut = useMutation({
		mutationFn: () => electionApi.end(),
		onSuccess: () => {
			notify.success("Election ended", "Voting is now closed.");
			void queryClient.invalidateQueries({ queryKey: ["election"] });
		},
		onError: fail,
	});

	const election = electionQuery.data;

	function startElection(): void {
		const end = new Date(endTime).getTime();
		if (!Number.isFinite(end) || end <= Date.now()) {
			setDateError("Choose a valid end time in the future.");
			return;
		}
		setDateError(null);
		startMut.mutate();
	}

	return (
		<Card className="p-4">
			<SectionTitle
				action={
					election ? (
						<Badge tone={statusTone(election.status)}>{election.status}</Badge>
					) : null
				}
			>
				Election controls
			</SectionTitle>
			{electionQuery.isPending ? (
				<Skeleton className="h-16" />
			) : electionQuery.isError || !election ? (
				<p role="alert" className="text-xs font-medium text-red-700">
					Could not load election status.
				</p>
			) : (
				<>
					{election.endTime && election.status === "running" && (
						<p className="mb-3 flex items-center gap-1.5 text-xs text-zinc-500">
							<CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
							Ends {new Date(election.endTime).toLocaleString()}
						</p>
					)}
					<div className="flex flex-wrap items-end gap-2">
						{election.status === "pending" && (
							<>
								<Field
									label="End time (your local time)"
									htmlFor="endTime"
									error={dateError}
								>
									<TextInput
										id="endTime"
										type="datetime-local"
										value={endTime}
										required
										aria-invalid={Boolean(dateError)}
										onChange={(e) => {
											setEndTime(e.target.value);
											setDateError(null);
										}}
										className="max-w-full"
									/>
								</Field>
								<Button
									size="sm"
									loading={startMut.isPending}
									icon={<Play className="h-4 w-4" aria-hidden="true" />}
									onClick={startElection}
								>
									Start election
								</Button>
							</>
						)}
						{election.status === "running" && (
							<ConfirmAction
								label="End election"
								title="End the election now?"
								body="Voting will close immediately. Submitted ballots are kept, but voters who have not finished will no longer be able to submit."
								confirmLabel="End election"
								pending={endMut.isPending}
								onConfirm={() => endMut.mutate()}
							/>
						)}
						{election.status === "ended" && (
							<p className="text-xs text-zinc-500">
								Election ended. To run a new election, use Reset election in the
								Rollbacks section.
							</p>
						)}
					</div>
				</>
			)}
		</Card>
	);
}
