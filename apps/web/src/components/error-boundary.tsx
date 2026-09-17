import { TriangleAlert } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { Component } from "react";
import { Button } from "../ui/button";
import { Card } from "../ui/display";

interface State {
	failed: boolean;
}

export class RouteErrorBoundary extends Component<
	{ children: ReactNode },
	State
> {
	state: State = { failed: false };

	static getDerivedStateFromError(): State {
		return { failed: true };
	}

	render(): ReactNode {
		if (!this.state.failed) return this.props.children;
		return (
			<Card className="p-6 text-center">
				<TriangleAlert
					className="mx-auto h-8 w-8 text-amber-500"
					aria-hidden="true"
				/>
				<h1 className="mt-2 text-base font-bold text-zinc-900">
					Something went wrong
				</h1>
				<p className="mx-auto mt-1 max-w-sm text-xs text-zinc-500">
					This page hit an unexpected error. Your vote is safe — nothing was
					submitted twice.
				</p>
				<Button
					variant="outline"
					size="sm"
					className="mt-3"
					onClick={() => window.location.reload()}
				>
					Reload page
				</Button>
			</Card>
		);
	}
}

export function withBoundary(children: ReactElement): ReactElement {
	return <RouteErrorBoundary>{children}</RouteErrorBoundary>;
}
