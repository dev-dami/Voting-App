import { Dialog as BaseDialog } from "@base-ui-components/react/dialog";
import { TriangleAlert, X } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { useState } from "react";
import { Button } from "./button";

export function DialogShell({
	open,
	onOpenChange,
	title,
	description,
	children,
	wide = false,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: string;
	children: ReactNode;
	wide?: boolean;
}): ReactElement {
	return (
		<BaseDialog.Root open={open} onOpenChange={onOpenChange}>
			<BaseDialog.Portal>
				<BaseDialog.Backdrop className="ui-backdrop fixed inset-0 z-40 bg-black/40" />
				<BaseDialog.Popup
					className={`ui-popup fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-xl bg-white p-4 [overflow-wrap:anywhere] sm:p-5 shadow-xl ${
						wide ? "max-w-lg" : "max-w-md"
					}`}
				>
					<div className="mb-4 flex items-start justify-between gap-3">
						<div className="min-w-0">
							<BaseDialog.Title className="text-base font-bold text-zinc-900">
								{title}
							</BaseDialog.Title>
							{description ? (
								<BaseDialog.Description className="mt-0.5 text-xs text-zinc-500">
									{description}
								</BaseDialog.Description>
							) : null}
						</div>
						<BaseDialog.Close
							aria-label="Close dialog"
							className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
						>
							<X className="h-4 w-4" aria-hidden="true" />
						</BaseDialog.Close>
					</div>
					{children}
				</BaseDialog.Popup>
			</BaseDialog.Portal>
		</BaseDialog.Root>
	);
}

// Controlled confirm dialog for destructive actions. Replaces window.confirm.
export function ConfirmDialog({
	open,
	onOpenChange,
	title,
	body,
	confirmLabel = "Confirm",
	pending = false,
	onConfirm,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	body: string;
	confirmLabel?: string;
	pending?: boolean;
	onConfirm: () => void;
}): ReactElement {
	return (
		<DialogShell open={open} onOpenChange={onOpenChange} title={title}>
			<div className="flex items-start gap-2.5 rounded-lg bg-red-50 p-3 text-xs text-red-800">
				<TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
				<p>{body}</p>
			</div>
			<div className="mt-4 flex justify-end gap-2">
				<Button
					variant="outline"
					size="sm"
					onClick={() => onOpenChange(false)}
					disabled={pending}
				>
					Cancel
				</Button>
				<Button
					variant="danger"
					size="sm"
					loading={pending}
					onClick={onConfirm}
				>
					{confirmLabel}
				</Button>
			</div>
		</DialogShell>
	);
}

// Convenience wrapper: renders a danger button that opens the confirm dialog.
export function ConfirmAction({
	label,
	title,
	body,
	confirmLabel,
	pending = false,
	buttonSize = "sm",
	onConfirm,
}: {
	label: string;
	title: string;
	body: string;
	confirmLabel?: string;
	pending?: boolean;
	buttonSize?: "sm" | "md";
	onConfirm: () => void;
}): ReactElement {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button
				variant="danger"
				size={buttonSize}
				disabled={pending}
				onClick={() => setOpen(true)}
			>
				{label}
			</Button>
			<ConfirmDialog
				open={open}
				onOpenChange={setOpen}
				title={title}
				body={body}
				confirmLabel={confirmLabel}
				pending={pending}
				onConfirm={() => {
					setOpen(false);
					onConfirm();
				}}
			/>
		</>
	);
}
