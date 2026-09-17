import type { ReactElement } from "react";

export interface BarDatum {
	label: string;
	value: number;
}

// Vendored in-repo SVG bars: no chart dependency, no CDN, works offline on LAN.
export function BarChart({
	data,
	ariaLabel,
}: {
	data: BarDatum[];
	ariaLabel: string;
}): ReactElement {
	const max = Math.max(1, ...data.map((d) => d.value));
	if (data.length === 0) {
		return (
			<p className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm leading-relaxed text-zinc-600">
				{ariaLabel}: No data available yet.
			</p>
		);
	}
	return (
		<div>
			<div role="img" aria-label={ariaLabel} className="space-y-1.5">
				{data.map((d) => (
					<div key={d.label} className="flex items-center gap-2 text-xs">
						<span className="w-28 shrink-0 truncate text-zinc-600">
							{d.label}
						</span>
						<div className="h-3 flex-1 rounded bg-zinc-200">
							<div
								className="h-3 rounded bg-brand"
								style={{ width: `${(d.value / max) * 100}%` }}
							/>
						</div>
						<span className="w-10 shrink-0 text-right font-semibold tabular-nums">
							{d.value}
						</span>
					</div>
				))}
			</div>
			<table className="sr-only">
				<caption>{ariaLabel}</caption>
				<tbody>
					{data.map((d) => (
						<tr key={d.label}>
							<th scope="row">{d.label}</th>
							<td>{d.value}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
