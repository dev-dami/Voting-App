import { Tabs as BaseTabs } from "@base-ui-components/react/tabs";
import type { ReactElement, ReactNode } from "react";

export interface PageTab {
	value: string;
	label: ReactNode;
}

// Underline tab bar shared by Official and Admin. Panels are passed as children.
export function PageTabs({
	defaultValue,
	tabs,
	children,
}: {
	defaultValue: string;
	tabs: PageTab[];
	children: ReactNode;
}): ReactElement {
	return (
		<BaseTabs.Root defaultValue={defaultValue}>
			<BaseTabs.List
				aria-label="Sections"
				className="flex gap-5 overflow-x-auto border-b border-zinc-200"
			>
				{tabs.map((t) => (
					<BaseTabs.Tab
						key={t.value}
						value={t.value}
						className="min-h-11 shrink-0 border-b-2 border-transparent px-2 py-3 text-sm font-semibold whitespace-nowrap text-zinc-600 transition-colors hover:text-zinc-800 focus-visible:-outline-offset-2 data-[selected]:border-brand-600 data-[selected]:text-brand-700"
					>
						{t.label}
					</BaseTabs.Tab>
				))}
			</BaseTabs.List>
			{children}
		</BaseTabs.Root>
	);
}
