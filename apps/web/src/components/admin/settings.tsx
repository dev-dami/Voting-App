import { useMutation } from "@tanstack/react-query";
import { CircleUserRound, KeyRound, MonitorCheck } from "lucide-react";
import type { FormEvent, ReactElement } from "react";
import { useState } from "react";
import { API_BASE, ApiError, userApi } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Button } from "../../ui/button";
import { Badge, Card, SectionTitle } from "../../ui/display";
import { Field, PasswordInput } from "../../ui/inputs";
import { notify } from "../../ui/toast";

export function Settings(): ReactElement {
	const { user } = useAuth();
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");

	const pwMut = useMutation({
		mutationFn: () => {
			if (!user) throw new Error("Not signed in");
			return userApi.resetPassword(user.id, password);
		},
		onSuccess: () => {
			notify.success("Password updated", "Use it next time you sign in.");
			setPassword("");
			setConfirm("");
		},
		onError: (e: unknown) => {
			notify.error(
				"Password update failed",
				e instanceof ApiError ? e.message : undefined,
			);
		},
	});

	function onSubmit(e: FormEvent): void {
		e.preventDefault();
		if (password !== confirm) {
			notify.error("Passwords do not match", "Retype the new password.");
			return;
		}
		pwMut.mutate();
	}

	return (
		<div className="space-y-4">
			<Card className="p-4">
				<SectionTitle>Profile</SectionTitle>
				<div className="flex items-center gap-3">
					<span
						aria-hidden="true"
						className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white"
					>
						{(user?.studentId ?? "?").slice(0, 1).toUpperCase()}
					</span>
					<div>
						<p className="flex items-center gap-1.5 text-sm font-bold text-zinc-900">
							<CircleUserRound
								className="h-4 w-4 text-zinc-400"
								aria-hidden="true"
							/>
							{user?.studentId ?? "—"}
						</p>
						<p className="mt-0.5 flex gap-1">
							<Badge tone="brand">
								{user?.role.replaceAll("_", " ") ?? "—"}
							</Badge>
							{user?.hasVoted ? <Badge tone="green">voted</Badge> : null}
						</p>
					</div>
				</div>
			</Card>

			<Card className="p-4">
				<SectionTitle>Change my password</SectionTitle>
				<form onSubmit={onSubmit} className="max-w-xs space-y-3">
					<Field
						label="New password"
						htmlFor="st-pw"
						hint="Minimum 6 characters"
					>
						<PasswordInput
							id="st-pw"
							required
							minLength={6}
							autoComplete="new-password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
						/>
					</Field>
					<Field label="Confirm password" htmlFor="st-pw2">
						<PasswordInput
							id="st-pw2"
							required
							minLength={6}
							autoComplete="new-password"
							value={confirm}
							onChange={(e) => setConfirm(e.target.value)}
						/>
					</Field>
					<Button
						type="submit"
						size="sm"
						loading={pwMut.isPending}
						icon={<KeyRound className="h-3.5 w-3.5" aria-hidden="true" />}
					>
						Update password
					</Button>
				</form>
			</Card>

			<Card className="p-4">
				<SectionTitle>Connection</SectionTitle>
				<dl className="grid gap-2 text-xs sm:grid-cols-2">
					<div className="rounded-lg bg-zinc-50 px-3 py-2">
						<dt className="font-semibold text-zinc-500">API server</dt>
						<dd className="mt-0.5 flex items-center gap-1.5 font-mono break-all text-zinc-800">
							<MonitorCheck
								className="h-3.5 w-3.5 shrink-0 text-green-600"
								aria-hidden="true"
							/>
							{API_BASE.length > 0 ? API_BASE : window.location.origin}
						</dd>
					</div>
					<div className="rounded-lg bg-zinc-50 px-3 py-2">
						<dt className="font-semibold text-zinc-500">Session</dt>
						<dd className="mt-0.5 text-zinc-800">
							Signed in as {user?.studentId ?? "—"} · expires after 15 minutes
							idle, refreshes automatically up to 7 days.
						</dd>
					</div>
				</dl>
				<p className="mt-3 text-[11px] text-zinc-400">
					Yeshua High School Voting · Jesus Our Perfect Example
				</p>
			</Card>
		</div>
	);
}
