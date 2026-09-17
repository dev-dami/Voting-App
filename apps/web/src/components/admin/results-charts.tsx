import { useQuery } from "@tanstack/react-query";
import {
	ArcElement,
	BarElement,
	CategoryScale,
	Chart as ChartJS,
	Legend,
	LinearScale,
	Tooltip,
} from "chart.js";
import type { ReactElement } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import { resultsApi } from "../../lib/api";
import { Card, EmptyState, SectionTitle, Skeleton } from "../../ui/display";

ChartJS.register(
	CategoryScale,
	LinearScale,
	BarElement,
	ArcElement,
	Tooltip,
	Legend,
);

const BARS = [
	"#a73434",
	"#8f2c2c",
	"#c94848",
	"#752727",
	"#e06f6f",
	"#5f2121",
	"#b45309",
	"#166534",
];

const CATEGORY_COLORS = ["#a73434", "#b45309", "#166534", "#475569"];

export function ResultsCharts(): ReactElement {
	const resultsQuery = useQuery({
		queryKey: ["results"],
		queryFn: ({ signal }) => resultsApi.get(signal),
		refetchInterval: 30_000,
	});

	if (resultsQuery.isPending) {
		return (
			<Card className="p-4">
				<SectionTitle>Results</SectionTitle>
				<Skeleton className="h-64" />
			</Card>
		);
	}
	if (resultsQuery.isError || !resultsQuery.data) {
		return (
			<Card className="p-4">
				<SectionTitle>Results</SectionTitle>
				<p role="alert" className="text-xs font-medium text-red-700">
					Could not load results.
				</p>
			</Card>
		);
	}

	const data = resultsQuery.data;
	if (data.positions.length === 0) {
		return (
			<Card className="p-4">
				<SectionTitle>Results</SectionTitle>
				<EmptyState
					title="No results yet"
					body="Charts appear once candidates exist and votes are cast."
				/>
			</Card>
		);
	}

	return (
		<div className="space-y-4">
			<Card className="p-4">
				<SectionTitle>Turnout by voter group</SectionTitle>
				<div className="mx-auto max-w-xs">
					<Doughnut
						data={{
							labels: data.turnoutByCategory.map((c) =>
								c.category.replaceAll("_", " "),
							),
							datasets: [
								{
									data: data.turnoutByCategory.map((c) => c.totalVotes),
									backgroundColor: CATEGORY_COLORS,
									borderWidth: 2,
									borderColor: "#ffffff",
								},
							],
						}}
						options={{
							maintainAspectRatio: true,
							plugins: {
								legend: { position: "bottom", labels: { boxWidth: 12 } },
							},
						}}
					/>
				</div>
			</Card>

			{data.positions.map((p) => (
				<Card key={p.position} className="p-4">
					<SectionTitle>{p.position}</SectionTitle>
					<div className="h-56">
						<Bar
							data={{
								labels: p.candidates.map((c) => c.name),
								datasets: [
									{
										label: "Votes",
										data: p.candidates.map((c) => c.votes),
										backgroundColor: p.candidates.map(
											(_, i) => BARS[i % BARS.length],
										),
										borderRadius: 6,
									},
								],
							}}
							options={{
								maintainAspectRatio: false,
								indexAxis: "y",
								plugins: { legend: { display: false } },
								scales: {
									x: { beginAtZero: true, ticks: { precision: 0 } },
								},
							}}
						/>
					</div>
				</Card>
			))}
		</div>
	);
}
