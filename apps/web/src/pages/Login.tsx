import { LogIn } from "lucide-react";
import type { FormEvent, ReactElement } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../lib/api";
import { homeFor, useAuth } from "../lib/auth";
import { Button } from "../ui/button";
import { Field, PasswordInput, TextInput } from "../ui/inputs";
import { notify } from "../ui/toast";

export function Login(): ReactElement {
	const { login } = useAuth();
	const navigate = useNavigate();
	const [voterId, setVoterId] = useState("");
	const [password, setPassword] = useState("");
	const [busy, setBusy] = useState(false);

	async function onSubmit(e: FormEvent): Promise<void> {
		e.preventDefault();
		setBusy(true);
		try {
			const user = await login(voterId.trim(), password);
			navigate(homeFor(user.role, user.hasVoted), { replace: true });
		} catch (err) {
			notify.error(
				"Sign in failed",
				err instanceof ApiError
					? err.message
					: "Check your details and try again.",
			);
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="relative mx-auto w-full max-w-sm">
			<img
				src="/logo.png"
				alt=""
				aria-hidden="true"
				className="pointer-events-none absolute -top-16 left-1/2 -z-10 h-64 w-64 -translate-x-1/2 opacity-[0.05]"
			/>
			<div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-md">
				<div className="px-6 pt-6 pb-4 text-center">
					<img
						src="/logo.png"
						alt="Yeshua High School crest"
						className="mx-auto h-24 w-24"
					/>
					<p className="font-crest mt-3 text-2xl font-bold tracking-wide text-brand-700">
						YESHUA HIGH SCHOOL
					</p>
					<p className="mt-1 text-xs text-zinc-500">
						Student & staff election portal
					</p>
				</div>
				<p className="bg-brand-600 py-1.5 text-center text-[11px] font-bold tracking-[0.2em] text-white uppercase">
					Jesus Our Perfect Example
				</p>
				<form
					onSubmit={(e) => void onSubmit(e)}
					className="space-y-3 px-6 py-5"
				>
					<Field label="Voter ID" htmlFor="voterId">
						<TextInput
							id="voterId"
							required
							autoComplete="username"
							placeholder="Enter your voter ID"
							value={voterId}
							onChange={(e) => setVoterId(e.target.value)}
						/>
					</Field>
					<Field label="Password" htmlFor="password">
						<PasswordInput
							id="password"
							required
							autoComplete="current-password"
							placeholder="Enter your password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
						/>
					</Field>
					<Button
						type="submit"
						size="lg"
						loading={busy}
						icon={<LogIn className="h-4 w-4" aria-hidden="true" />}
						className="w-full"
					>
						Sign in to vote
					</Button>
				</form>
				<p className="border-t border-zinc-100 py-3 text-center text-xs">
					<Link
						to="/report-issue"
						className="font-medium text-brand-700 underline"
					>
						Report an issue
					</Link>
				</p>
			</div>
			<p className="mt-3 text-center text-[11px] text-zinc-400">
				Sabo-Ojodu, Lagos · One login for students, staff, officials, admins
			</p>
		</div>
	);
}
