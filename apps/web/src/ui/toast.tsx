import { Toast as BaseToast } from "@base-ui-components/react/toast";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import type { ReactElement } from "react";

export const toastManager = BaseToast.createToastManager();

export const notify = {
	success: (title: string, description?: string): void => {
		toastManager.add({ title, description, type: "success" });
	},
	error: (title: string, description?: string): void => {
		toastManager.add({ title, description, type: "error" });
	},
	info: (title: string, description?: string): void => {
		toastManager.add({ title, description, type: "info" });
	},
};

export function Toaster(): ReactElement {
	return (
		<BaseToast.Provider toastManager={toastManager} limit={3} timeout={4500}>
			<BaseToast.Portal>
				<BaseToast.Viewport className="fixed right-4 bottom-4 z-[60] flex max-h-[calc(100dvh-2rem)] w-80 max-w-[calc(100%-2rem)] flex-col gap-3 overflow-y-auto overscroll-contain p-1">
					<ToastList />
				</BaseToast.Viewport>
			</BaseToast.Portal>
		</BaseToast.Provider>
	);
}

function ToastList(): ReactElement {
	const { toasts } = BaseToast.useToastManager();
	return (
		<>
			{toasts.map((t) => (
				<BaseToast.Root
					key={t.id}
					toast={t}
					className="ui-popup flex items-stretch gap-2.5 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg"
				>
					<span
						aria-hidden="true"
						className="hidden w-1 shrink-0 bg-green-600 [[data-type=success]_&]:block"
					/>
					<span
						aria-hidden="true"
						className="hidden w-1 shrink-0 bg-red-600 [[data-type=error]_&]:block"
					/>
					<span
						aria-hidden="true"
						className="hidden w-1 shrink-0 bg-brand-600 [[data-type=info]_&]:block"
					/>
					<span className="flex flex-1 items-start gap-2 py-2.5 pr-2">
						<CircleCheck
							aria-hidden="true"
							className="mt-0.5 hidden h-4 w-4 shrink-0 text-green-600 [[data-type=success]_&]:block"
						/>
						<CircleAlert
							aria-hidden="true"
							className="mt-0.5 hidden h-4 w-4 shrink-0 text-red-600 [[data-type=error]_&]:block"
						/>
						<Info
							aria-hidden="true"
							className="mt-0.5 hidden h-4 w-4 shrink-0 text-brand-600 [[data-type=info]_&]:block"
						/>
						<span className="min-w-0 flex-1">
							<BaseToast.Title className="text-xs font-bold text-zinc-900" />
							<BaseToast.Description className="mt-0.5 text-xs break-words text-zinc-600" />
						</span>
						<BaseToast.Close
							aria-label="Dismiss notification"
							className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
						>
							<X className="h-3.5 w-3.5" aria-hidden="true" />
						</BaseToast.Close>
					</span>
				</BaseToast.Root>
			))}
		</>
	);
}
