import { Inbox, LoaderCircle } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

export function Card({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}): ReactElement {
	return (
		<div
			className={`rounded-2xl border border-zinc-200/80 bg-white ${
				className
			}`}
		>
			{children}
		</div>
	);
}

export function SectionTitle({
	children,
	action,
}: {
	children: ReactNode;
	action?: ReactNode;
}): ReactElement {
	return (
		<div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-3">
			<h2 className="font-crest min-w-0 text-lg font-semibold tracking-tight text-zinc-900 [overflow-wrap:anywhere]">
				{children}
			</h2>
			{action ? (
				<div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto [&>*]:max-w-full [&>.flex]:flex-wrap">
					{action}
				</div>
			) : null}
		</div>
	);
}

type BadgeTone = "brand" | "green" | "amber" | "red" | "zinc";

const BADGES: Record<BadgeTone, string> = {
	brand: "bg-brand-50 text-brand-700 ring-brand-200/70",
	green: "bg-green-50 text-green-700 ring-green-200/70",
	amber: "bg-amber-50 text-amber-700 ring-amber-200/70",
	red: "bg-red-50 text-red-700 ring-red-200/70",
	zinc: "bg-zinc-100 text-zinc-500 ring-zinc-200/80",
};

export function Badge({
	tone = "zinc",
	children,
}: {
	tone?: BadgeTone;
	children: ReactNode;
}): ReactElement {
	return (
		<span
			className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] [overflow-wrap:anywhere] font-medium tracking-wide ring-1 ring-inset ${BADGES[tone]}`}
		>
			{children}
		</span>
	);
}

export function Stat({
	label,
	value,
	loading = false,
}: {
	label: string;
	value: ReactNode;
	loading?: boolean;
}): ReactElement {
	return (
		<div className="rounded-2xl border border-zinc-200/80 bg-white px-4 py-4 text-left">
			<p className="text-[11px] font-medium tracking-wide text-zinc-400 uppercase">
				{label}
			</p>
			<p className="font-crest mt-1.5 text-2xl font-semibold tabular-nums text-zinc-900">
				{loading ? <span className="text-zinc-300">…</span> : value}
			</p>
		</div>
	);
}

export function ProgressBar({
	value,
	max = 100,
	label,
}: {
	value: number;
	max?: number;
	label: string;
}): ReactElement {
	const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
	return (
		<div
			role="progressbar"
			aria-label={label}
			aria-valuenow={Math.round(pct)}
			aria-valuemin={0}
			aria-valuemax={100}
			className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200/80"
		>
			<div
				className="h-full rounded-full bg-brand-600 transition-[width] duration-300"
				style={{ width: `${pct}%` }}
			/>
		</div>
	);
}

export function Spinner({
	label = "Loading…",
}: {
	label?: string;
}): ReactElement {
	return (
		<p className="flex items-center gap-2 text-sm text-zinc-500" role="status">
			<LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
			{label}
		</p>
	);
}

export function Skeleton({
	className = "",
}: {
	className?: string;
}): ReactElement {
	return (
		<div
			aria-hidden="true"
			className={`animate-pulse rounded-lg bg-zinc-200/70 ${className}`}
		/>
	);
}

export function EmptyState({
	icon,
	title,
	body,
	action,
}: {
	icon?: ReactNode;
	title: string;
	body?: string;
	action?: ReactNode;
}): ReactElement {
	return (
		<div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-12 text-center">
			<span className="rounded-full bg-zinc-100 p-2.5 text-zinc-400">
				{icon ?? <Inbox className="h-5 w-5" aria-hidden="true" />}
			</span>
			<p className="text-sm font-medium text-zinc-700">{title}</p>
			{body ? <p className="max-w-sm text-xs text-zinc-500">{body}</p> : null}
			{action ? <div className="mt-2">{action}</div> : null}
		</div>
	);
}
