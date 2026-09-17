import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import type { ReactElement } from "react";
import { ApiError, electionApi } from "../../lib/api";
import { ConfirmAction } from "../../ui/dialog";
import { Card, SectionTitle } from "../../ui/display";
import { notify } from "../../ui/toast";

export function DangerZone({ bare = false }: { bare?: boolean }): ReactElement {
	const queryClient = useQueryClient();
	const electionQuery = useQuery({
		queryKey: ["election"],
		queryFn: ({ signal }) => electionApi.status(signal),
	});

	const resetMut = useMutation({
		mutationFn: () => electionApi.reset(),
		onSuccess: () => {
			notify.success("Election reset", "All votes cleared.");
			void queryClient.invalidateQueries({ queryKey: ["election"] });
			void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
			void queryClient.invalidateQueries({ queryKey: ["admin-candidates"] });
			void queryClient.invalidateQueries({ queryKey: ["results"] });
		},
		onError: (e: unknown) => {
			notify.error(
				"Reset failed",
				e instanceof ApiError ? e.message : undefined,
			);
		},
	});

	const body = (
		<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 p-3">
			<span className="flex items-start gap-2 text-xs text-red-800">
				<TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
				<span>
					<span className="font-bold">Reset election.</span> Clears every vote,
					resets all voters
					{electionQuery.data
						? ` (currently ${electionQuery.data.status})`
						: ""}
					. This cannot be undone.
				</span>
			</span>
			<ConfirmAction
				label="Reset election"
				title="Reset the election?"
				body="All votes are cleared and every voter is reset to not-voted. Export anything you need first."
				confirmLabel="Reset everything"
				pending={resetMut.isPending}
				onConfirm={() => resetMut.mutate()}
			/>
		</div>
	);

	if (bare) return body;
	return (
		<Card className="border-red-200 p-4">
			<SectionTitle>Danger zone</SectionTitle>
			{body}
		</Card>
	);
}
