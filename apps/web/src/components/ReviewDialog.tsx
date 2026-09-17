import type { ReactElement } from "react";
import { useEffect, useRef } from "react";

export interface ReviewItem {
	position: string;
	name: string;
	image: string;
}

interface Props {
	open: boolean;
	items: ReviewItem[];
	submitting: boolean;
	error: string | null;
	onClose: () => void;
	onConfirm: () => void;
}

export function ReviewDialog({
	open,
	items,
	submitting,
	error,
	onClose,
	onConfirm,
}: Props): ReactElement | null {
	const confirmRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!open) return;
		confirmRef.current?.focus();
		function onKey(e: KeyboardEvent): void {
			if (e.key === "Escape") onClose();
		}
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-40 flex justify-end" role="presentation">
			<button
				type="button"
				aria-label="Close review"
				onClick={onClose}
				className="absolute inset-0 cursor-default bg-zinc-950/40"
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="review-title"
				className="relative flex w-full max-w-sm flex-col bg-white shadow-xl"
			>
				<div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
					<h2 id="review-title" className="text-base font-bold">
						Review your vote
					</h2>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						className="rounded px-2 py-1 text-zinc-500 hover:bg-zinc-100"
					>
						✕
					</button>
				</div>
				<ul className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
					{items.map((it) => (
						<li
							key={it.position}
							className="flex items-center gap-3 rounded border border-zinc-200 bg-zinc-50 p-2"
						>
							<img
								src={it.image}
								alt=""
								className="h-9 w-9 rounded-full object-cover"
							/>
							<div>
								<p className="font-semibold">{it.position}</p>
								<p className="text-zinc-600">{it.name}</p>
							</div>
						</li>
					))}
				</ul>
				{error && (
					<p
						role="alert"
						className="px-4 pb-1 text-xs font-medium text-red-700"
					>
						{error}
					</p>
				)}
				<div className="space-y-2 border-t border-zinc-200 px-4 py-3">
					<button
						ref={confirmRef}
						type="button"
						disabled={submitting}
						onClick={onConfirm}
						className="w-full rounded bg-brand py-2 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
					>
						{submitting ? "Submitting…" : "Confirm and submit"}
					</button>
					<button
						type="button"
						onClick={onClose}
						className="w-full rounded bg-zinc-200 py-2 font-semibold text-zinc-800 hover:bg-zinc-300"
					>
						Back to ballot
					</button>
					<p className="text-center text-xs text-zinc-500">
						Submitted votes cannot be changed.
					</p>
				</div>
			</div>
		</div>
	);
}
