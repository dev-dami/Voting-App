import { useMutation } from "@tanstack/react-query";
import { CircleCheck, Send } from "lucide-react";
import type { FormEvent, ReactElement } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, issueApi } from "../lib/api";
import { Button } from "../ui/button";
import { Card, EmptyState } from "../ui/display";
import { Field, Textarea, TextInput } from "../ui/inputs";
import { notify } from "../ui/toast";

export function ReportIssue(): ReactElement {
	const [name, setName] = useState("");
	const [className, setClassName] = useState("");
	const [problem, setProblem] = useState("");
	const [reference, setReference] = useState<string | null>(null);

	const submit = useMutation({
		mutationFn: () =>
			issueApi.submit({
				name: name.trim(),
				className: className.trim(),
				problem: problem.trim(),
			}),
		onSuccess: (r) => {
			setReference(r.id);
			notify.success("Issue submitted", "An official will review it shortly.");
		},
		onError: (e: unknown) => {
			notify.error(
				"Submit failed",
				e instanceof ApiError ? e.message : "Try again in a moment.",
			);
		},
	});

	function onSubmit(e: FormEvent): void {
		e.preventDefault();
		submit.mutate();
	}

	if (reference) {
		return (
			<div className="mx-auto max-w-md">
				<EmptyState
					icon={
						<CircleCheck
							className="h-5 w-5 text-green-700"
							aria-hidden="true"
						/>
					}
					title="Issue submitted"
					body={`Reference #${reference}. An official will review it shortly.`}
					action={
						<Link to="/login">
							<Button variant="outline" size="sm">
								Back to login
							</Button>
						</Link>
					}
				/>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-md">
			<Card className="p-5">
				<h1 className="text-lg font-bold text-zinc-900">Report an issue</h1>
				<p className="mt-0.5 text-xs text-zinc-500">
					Can&apos;t sign in or vote? Tell the election team.
				</p>
				<form onSubmit={onSubmit} className="mt-4 space-y-3">
					<Field label="Your name" htmlFor="ri-name">
						<TextInput
							id="ri-name"
							required
							autoComplete="name"
							value={name}
							onChange={(e) => setName(e.target.value)}
						/>
					</Field>
					<Field
						label="Your class"
						htmlFor="ri-class"
						hint="e.g. JSS2, SS1, or staff department"
					>
						<TextInput
							id="ri-class"
							required
							value={className}
							onChange={(e) => setClassName(e.target.value)}
						/>
					</Field>
					<Field label="What happened?" htmlFor="ri-problem">
						<Textarea
							id="ri-problem"
							required
							value={problem}
							onChange={(e) => setProblem(e.target.value)}
						/>
					</Field>
					<Button
						type="submit"
						loading={submit.isPending}
						icon={<Send className="h-4 w-4" aria-hidden="true" />}
						className="w-full"
					>
						Submit issue
					</Button>
				</form>
			</Card>
		</div>
	);
}
