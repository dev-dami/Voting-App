import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import type { ReactElement } from "react";
import { ApiError, issueApi } from "../../lib/api";
import type { IssueStatus } from "../../lib/types";
import {
	Badge,
	Card,
	EmptyState,
	SectionTitle,
	Skeleton,
} from "../../ui/display";
import { SelectInput } from "../../ui/inputs";
import { notify } from "../../ui/toast";

const STATUSES: IssueStatus[] = ["pending", "in-progress", "resolved"];

function tone(s: IssueStatus): "amber" | "brand" | "green" {
	if (s === "resolved") return "green";
	if (s === "in-progress") return "brand";
	return "amber";
}

export function IssueQueue(): ReactElement {
	const queryClient = useQueryClient();
	const issuesQuery = useQuery({
		queryKey: ["admin-issues"],
		queryFn: ({ signal }) => issueApi.list(undefined, signal),
	});

	const statusMut = useMutation({
		mutationFn: ({ id, status }: { id: string; status: IssueStatus }) =>
			issueApi.setStatus(id, status),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["admin-issues"] });
		},
		onError: (e: unknown) => {
			notify.error(
				"Status update failed",
				e instanceof ApiError ? e.message : undefined,
			);
		},
	});

	const issues = issuesQuery.data?.issues ?? [];
	const open = issues.filter((i) => i.status !== "resolved").length;

	return (
		<Card className="p-4">
			<SectionTitle
				action={
					issues.length > 0 ? <Badge tone="amber">{open} open</Badge> : null
				}
			>
				Reported issues ({issues.length})
			</SectionTitle>
			{issuesQuery.isPending ? (
				<div className="space-y-2">
					{[0, 1].map((i) => (
						<Skeleton key={i} className="h-12" />
					))}
				</div>
			) : issuesQuery.isError || !issuesQuery.data ? (
				<p role="alert" className="text-xs font-medium text-red-700">
					Could not load issues.
				</p>
			) : issues.length === 0 ? (
				<EmptyState
					icon={<Inbox className="h-5 w-5" aria-hidden="true" />}
					title="No issues reported"
					body="Voter-submitted problems will land here."
				/>
			) : (
				<ul className="max-h-72 space-y-1.5 overflow-y-auto text-xs">
					{issues.map((issue) => (
						<li
							key={issue.id}
							className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-50 px-2.5 py-2"
						>
							<span className="min-w-0 flex-1">
								<span className="font-semibold text-zinc-900">
									{issue.name} ({issue.className})
								</span>
								<span className="text-zinc-500"> — {issue.problem}</span>
							</span>
							<span className="flex items-center gap-1.5">
								<Badge tone={tone(issue.status)}>{issue.status}</Badge>
								<SelectInput
									id={`issue-${issue.id}`}
									label={`Status for issue from ${issue.name}`}
									value={issue.status}
									onChange={(v) =>
										statusMut.mutate({
											id: issue.id,
											status: v as IssueStatus,
										})
									}
									options={STATUSES.map((s) => ({ value: s, label: s }))}
								/>
							</span>
						</li>
					))}
				</ul>
			)}
		</Card>
	);
}
