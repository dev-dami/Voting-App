import {
	LogOut,
	Menu,
	Receipt,
	Settings,
	ShieldCheck,
	Vote as VoteIcon,
	X,
} from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { homeFor, useAuth } from "../lib/auth";
import { disconnectLiveSocket } from "../lib/socket";
import type { AuthUser, Role } from "../lib/types";
import { Badge } from "../ui/display";

const VOTER_ROLES: Role[] = ["student", "teaching_staff", "non_teaching_staff"];

interface NavItem {
	to: string;
	label: string;
	icon: typeof VoteIcon;
}

function itemsFor(user: AuthUser | null): NavItem[] {
	if (!user) return [];
	const items: NavItem[] = [];
	if (VOTER_ROLES.includes(user.role)) {
		items.push(
			{ to: "/vote", label: "Vote", icon: VoteIcon },
			{ to: "/slip", label: "Slip", icon: Receipt },
		);
	}
	if (user.role === "official" || user.role === "admin") {
		items.push({ to: "/official", label: "Official", icon: ShieldCheck });
	}
	if (user.role === "admin") {
		items.push({ to: "/admin", label: "Admin", icon: Settings });
	}
	return items;
}

function linkClass({ isActive }: { isActive: boolean }): string {
	return `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
		isActive
			? "bg-brand-50 text-brand-700"
			: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
	}`;
}

export function Layout({ children }: { children: ReactNode }): ReactElement {
	const { status, user, logout } = useAuth();
	const navigate = useNavigate();
	const [menuOpen, setMenuOpen] = useState(false);

	async function onLogout(): Promise<void> {
		disconnectLiveSocket();
		await logout();
		setMenuOpen(false);
		navigate("/login");
	}

	const items = itemsFor(user);
	const initial = (user?.studentId ?? "?").slice(0, 1).toUpperCase();

	return (
		<div className="flex min-h-screen flex-col font-sans antialiased">
			<header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur">
				<div className="flex h-14 items-center justify-between gap-2 px-4 sm:px-6">
					<Link
						to={user ? homeFor(user.role, user.hasVoted) : "/login"}
						className="flex min-w-0 items-center gap-2.5"
						onClick={() => setMenuOpen(false)}
					>
						<img
							src="/logo.png"
							alt="Yeshua High School logo"
							className="h-9 w-9 shrink-0 rounded-full ring-1 ring-zinc-200"
						/>
						<span className="min-w-0 leading-tight">
							<span className="block truncate text-sm font-bold tracking-tight text-zinc-900">
								Yeshua High School
							</span>
							<span className="hidden text-[11px] font-medium text-brand-700 sm:block">
								Jesus Our Perfect Example
							</span>
						</span>
					</Link>

					<nav
						className="hidden items-center gap-1 md:flex"
						aria-label="Primary"
					>
						{status === "authed" && user ? (
							<>
								{items.map((item) => (
									<NavLink key={item.to} to={item.to} className={linkClass}>
										<item.icon className="h-3.5 w-3.5" aria-hidden="true" />
										{item.label}
									</NavLink>
								))}
								<span
									className="mx-1 h-5 w-px bg-zinc-200"
									aria-hidden="true"
								/>
								<span
									className="flex items-center gap-1.5 pl-1"
									title={`Signed in as ${user.studentId}`}
								>
									<span
										aria-hidden="true"
										className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white"
									>
										{initial}
									</span>
									<span className="hidden max-w-28 truncate text-xs font-semibold text-zinc-700 lg:block">
										{user.studentId}
									</span>
									<Badge tone="zinc">{user.role.replaceAll("_", " ")}</Badge>
								</span>
								<button
									type="button"
									onClick={() => void onLogout()}
									title="Logout"
									aria-label="Logout"
									className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
								>
									<LogOut className="h-4 w-4" aria-hidden="true" />
								</button>
							</>
						) : (
							<>
								<NavLink to="/login" className={linkClass}>
									Login
								</NavLink>
								<NavLink to="/report-issue" className={linkClass}>
									Report issue
								</NavLink>
							</>
						)}
					</nav>

					<button
						type="button"
						className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 md:hidden"
						aria-label={menuOpen ? "Close menu" : "Open menu"}
						aria-expanded={menuOpen}
						onClick={() => setMenuOpen((o) => !o)}
					>
						{menuOpen ? (
							<X className="h-5 w-5" aria-hidden="true" />
						) : (
							<Menu className="h-5 w-5" aria-hidden="true" />
						)}
					</button>
				</div>

				{menuOpen ? (
					<nav
						className="border-t border-zinc-100 px-4 py-2 md:hidden"
						aria-label="Mobile"
					>
						{status === "authed" && user ? (
							<div className="flex flex-col gap-0.5 pb-1">
								{items.map((item) => (
									<NavLink
										key={item.to}
										to={item.to}
										onClick={() => setMenuOpen(false)}
										className={({ isActive }) =>
											`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold ${
												isActive
													? "bg-brand-50 text-brand-700"
													: "text-zinc-700 hover:bg-zinc-100"
											}`
										}
									>
										<item.icon className="h-4 w-4" aria-hidden="true" />
										{item.label}
									</NavLink>
								))}
								<div className="mt-1 flex items-center justify-between border-t border-zinc-100 px-3 pt-2 pb-1">
									<span className="flex items-center gap-2 text-xs text-zinc-500">
										<span
											aria-hidden="true"
											className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white"
										>
											{initial}
										</span>
										{user.studentId}
									</span>
									<button
										type="button"
										onClick={() => void onLogout()}
										className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
									>
										<LogOut className="h-3.5 w-3.5" aria-hidden="true" />
										Logout
									</button>
								</div>
							</div>
						) : (
							<div className="flex flex-col gap-0.5 pb-1">
								<NavLink
									to="/login"
									onClick={() => setMenuOpen(false)}
									className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
								>
									Login
								</NavLink>
								<NavLink
									to="/report-issue"
									onClick={() => setMenuOpen(false)}
									className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
								>
									Report issue
								</NavLink>
							</div>
						)}
					</nav>
				) : null}
			</header>
			<main className="w-full flex-1 px-4 py-6 sm:px-6 lg:px-8">
				{children}
			</main>
			<footer className="border-t border-zinc-200 py-3 text-center text-xs text-zinc-500">
				Yeshua High School · Jesus Our Perfect Example · Sabo-Ojodu, Lagos
			</footer>
		</div>
	);
}
