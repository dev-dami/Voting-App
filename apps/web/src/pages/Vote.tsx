import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, CircleAlert } from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, ballotApi, electionApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button } from "../ui/button";
import { Card, EmptyState, Skeleton } from "../ui/display";
import { notify } from "../ui/toast";

const BALLOT_KEY = "ballot-key";

function ballotKey(): string {
	const existing = sessionStorage.getItem(BALLOT_KEY);
	if (existing) return existing;
	const fresh = crypto.randomUUID();
	sessionStorage.setItem(BALLOT_KEY, fresh);
	return fresh;
}

export function Vote(): ReactElement {
	const { user } = useAuth();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [selections, setSelections] = useState<Record<string, string>>({});
	const [step, setStep] = useState(0);
	const advanceTimer = useRef<number | null>(null);

	const groupedQuery = useQuery({
		queryKey: ["ballot"],
		queryFn: ({ signal }) => ballotApi.ballot(signal),
	});
	const electionQuery = useQuery({
		queryKey: ["election"],
		queryFn: ({ signal }) => electionApi.status(signal),
	});

	const candidates = groupedQuery.data?.groupedCandidates;
	const positions = useMemo(
		() => (candidates ? Object.keys(candidates) : []),
		[candidates],
	);
	const chosen = positions.filter((p) => selections[p]).length;
	const isReview = step >= positions.length;
	const current = isReview ? null : (positions[step] ?? null);

	useEffect(
		() => () => {
			if (advanceTimer.current !== null)
				window.clearTimeout(advanceTimer.current);
		},
		[],
	);

	const submit = useMutation({
		mutationFn: (payload: Record<string, string>) =>
			ballotApi.submit(payload, ballotKey()),
		onSuccess: () => {
			sessionStorage.removeItem(BALLOT_KEY);
			notify.success("Vote recorded", "Thank you for participating.");
			void queryClient.invalidateQueries({ queryKey: ["slip"] });
			navigate("/slip", { replace: true });
		},
		onError: (err: unknown) => {
			if (err instanceof ApiError && err.status === 409) {
				navigate("/slip", { replace: true });
				return;
			}
			notify.error("Submit failed", "Your choices are kept — safe to retry.");
		},
	});

	function choose(position: string, id: string): void {
		setSelections((s) => ({ ...s, [position]: id }));
		if (advanceTimer.current !== null)
			window.clearTimeout(advanceTimer.current);
		advanceTimer.current = window.setTimeout(() => {
			setStep((s) => s + 1);
		}, 280);
	}

	function confirm(): void {
		const payload: Record<string, string> = {};
		for (const p of positions) {
			const id = selections[p];
			if (id) payload[p] = id;
		}
		submit.mutate(payload);
	}

	if (groupedQuery.isPending || electionQuery.isPending) {
		return (
			<div className="space-y-3" role="status" aria-label="Loading ballot">
				<Skeleton className="h-10 w-64" />
				<div className="grid gap-3 sm:grid-cols-2">
					{[0, 1, 2, 3].map((i) => (
						<Skeleton key={i} className="h-52" />
					))}
				</div>
			</div>
		);
	}
	if (electionQuery.data?.status && electionQuery.data.status !== "running") {
		return (
			<EmptyState
				title="Election is not running"
				body={`Current status: ${electionQuery.data.status}. Come back when officials open the ballot.`}
			/>
		);
	}
	const ballotNotRunning =
		groupedQuery.error instanceof ApiError && groupedQuery.error.status === 409;
	if (ballotNotRunning) {
		return (
			<EmptyState
				title="Election is not running"
				body="Come back when officials open the ballot."
			/>
		);
	}
	const ballotForbidden =
		groupedQuery.error instanceof ApiError && groupedQuery.error.status === 403;
	if (ballotForbidden) {
		return (
			<EmptyState
				title="You cannot vote with this account"
				body="Only student and staff voter accounts can open the ballot. Officials and admins use the Official and Admin pages instead."
			/>
		);
	}
	if (
		groupedQuery.isError ||
		electionQuery.isError ||
		!groupedQuery.data ||
		!electionQuery.data ||
		!candidates
	) {
		return (
			<EmptyState
				icon={<CircleAlert className="h-5 w-5" aria-hidden="true" />}
				title="Could not load the ballot"
				body="Check your connection and try again."
				action={
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							void groupedQuery.refetch();
							void electionQuery.refetch();
						}}
					>
						Retry
					</Button>
				}
			/>
		);
	}
	if (electionQuery.data.status !== "running") {
		return (
			<EmptyState
				title="Election is not running"
				body={`Current status: ${electionQuery.data.status}. Come back when officials open the ballot.`}
			/>
		);
	}
	if (positions.length === 0) {
		return (
			<EmptyState
				title="No positions yet"
				body="Officials have not published any positions or candidates."
			/>
		);
	}

	return (
		<div className="mx-auto max-w-5xl">
			<div className="mb-4">
				<h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
					Cast your vote
				</h1>
				<p className="mt-1 text-sm text-zinc-600 sm:text-base">
					Voting as <span className="font-semibold">{user?.studentId}</span> ·{" "}
					{chosen}/{positions.length} chosen
				</p>
			</div>

			<ol
				aria-label="Ballot progress"
				className="mb-5 flex items-center gap-1.5 overflow-x-auto pb-1"
			>
				{positions.map((p, i) => {
					const done = Boolean(selections[p]);
					const active = i === step;
					return (
						<li key={p} className="flex shrink-0 items-center gap-1">
							<button
								type="button"
								onClick={() => setStep(i)}
								aria-label={`${p}${done ? " (chosen)" : ""}`}
								aria-current={active ? "step" : undefined}
								title={p}
								className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors sm:h-10 sm:w-10 sm:text-base ${
									done
										? "bg-brand-600 text-white"
										: active
											? "bg-brand-50 text-brand-700 ring-2 ring-brand-600"
											: "bg-zinc-200 text-zinc-500 hover:bg-zinc-300"
								}`}
							>
								{done ? (
									<Check className="h-4 w-4" aria-hidden="true" />
								) : (
									i + 1
								)}
							</button>
							{i < positions.length - 1 ? (
								<span aria-hidden="true" className="h-px w-3 bg-zinc-300" />
							) : null}
						</li>
					);
				})}
				<li className="flex shrink-0 items-center gap-1">
					<span aria-hidden="true" className="h-px w-3 bg-zinc-300" />
					<span
						className={`flex h-9 items-center rounded-full px-4 text-sm font-bold sm:h-10 sm:text-base ${
							isReview ? "bg-brand-600 text-white" : "bg-zinc-200 text-zinc-500"
						}`}
					>
						Review
					</span>
				</li>
			</ol>

			{!isReview && current ? (
				<fieldset key={current}>
					<legend className="mb-3 text-xl font-bold text-zinc-900 sm:text-2xl">
						<span className="flex flex-wrap items-center gap-2">
							{current}
							<span
								className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset sm:text-base ${
									selections[current]
										? "bg-brand-50 text-brand-700 ring-brand-200"
										: "bg-zinc-100 text-zinc-600 ring-zinc-200"
								}`}
							>
								{selections[current] ? "Chosen" : "Choose one"}
							</span>
						</span>
					</legend>
					<div className="grid gap-3 sm:grid-cols-2">
						{candidates[current].map((c) => {
							const selected = selections[current] === c.id;
							return (
								<label
									key={c.id}
									className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 bg-white p-4 transition-all sm:p-5 ${
										selected
											? "border-brand-600 shadow-sm"
											: "border-zinc-200 hover:border-zinc-300 hover:shadow-sm"
									}`}
								>
									<input
										type="radio"
										name={current}
										value={c.id}
										checked={selected}
										onChange={() => choose(current, c.id)}
										className="h-5 w-5 shrink-0 accent-brand-600 sm:h-6 sm:w-6"
									/>
									<img
										src={c.image}
										alt=""
										loading="lazy"
										className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-zinc-200 sm:h-20 sm:w-20"
									/>
									<span className="min-w-0">
										<span className="block text-base font-bold text-zinc-900 [overflow-wrap:anywhere] sm:text-lg">
											{c.name}
										</span>
										{selected ? (
											<span className="mt-1 flex items-center gap-1 text-sm font-medium text-brand-700">
												<Check className="h-4 w-4" aria-hidden="true" />
												Selected
											</span>
										) : null}
									</span>
								</label>
							);
						})}
					</div>
				</fieldset>
			) : (
				<Card className="p-5 sm:p-6">
					<h2 className="text-xl font-bold text-zinc-900 sm:text-2xl">
						Review your choices
					</h2>
					<p className="mt-1 text-sm text-zinc-600">
						Votes are final once submitted — change anything before confirming.
					</p>
					<ul className="mt-4 space-y-2.5">
						{positions.map((p) => {
							const c = candidates[p].find((x) => x.id === selections[p]);
							return (
								<li
									key={p}
									className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 px-4 py-3"
								>
									<span className="min-w-0">
										<span className="block text-xs font-semibold tracking-wide text-zinc-500 uppercase">
											{p}
										</span>
										<span className="block text-base font-bold text-zinc-900 [overflow-wrap:anywhere]">
											{c?.name ?? "Unknown"}
										</span>
									</span>
									<Button
										variant="ghost"
										size="md"
										onClick={() => setStep(positions.indexOf(p))}
									>
										Change
									</Button>
								</li>
							);
						})}
					</ul>
					<Button
						size="lg"
						loading={submit.isPending}
						onClick={confirm}
						className="mt-5 w-full"
					>
						Confirm and submit vote
					</Button>
				</Card>
			)}

			<div className="sticky bottom-3 mt-5 flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white/95 p-2.5 shadow-sm backdrop-blur">
				<Button
					variant="outline"
					size="md"
					disabled={step === 0}
					icon={<ChevronLeft className="h-5 w-5" aria-hidden="true" />}
					onClick={() => setStep((s) => Math.max(0, s - 1))}
				>
					Back
				</Button>
				{!isReview ? (
					<Button
						size="md"
						disabled={!selections[current ?? ""]}
						icon={<ChevronRight className="h-5 w-5" aria-hidden="true" />}
						onClick={() => setStep((s) => s + 1)}
					>
						{step === positions.length - 1 ? "Review" : "Next"}
					</Button>
				) : (
					<span className="px-2 text-sm font-medium text-zinc-500">
						{chosen}/{positions.length} chosen
					</span>
				)}
			</div>
		</div>
	);
}
