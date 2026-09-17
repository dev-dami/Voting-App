import type { ReactElement, ReactNode } from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { authApi } from "./api";
import type { AuthUser, Role } from "./types";

export type AuthStatus = "loading" | "authed" | "guest";

interface AuthValue {
	status: AuthStatus;
	user: AuthUser | null;
	login: (voterId: string, password: string) => Promise<AuthUser>;
	refresh: () => Promise<AuthUser>;
	logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function homeFor(role: Role, hasVoted: boolean): string {
	if (role === "admin") return "/admin";
	if (role === "official") return "/official";
	return hasVoted ? "/slip" : "/vote";
}

export function AuthProvider({
	children,
}: {
	children: ReactNode;
}): ReactElement {
	const [status, setStatus] = useState<AuthStatus>("loading");
	const [user, setUser] = useState<AuthUser | null>(null);

	useEffect(() => {
		let live = true;
		authApi
			.me()
			.then((r) => r.user)
			.catch(() => authApi.refresh().then((r) => r.user))
			.then((u) => {
				if (live && u) {
					setUser(u);
					setStatus("authed");
				} else if (live) {
					setStatus("guest");
				}
			})
			.catch(() => {
				if (live) setStatus("guest");
			});
		return () => {
			live = false;
		};
	}, []);

	const login = useCallback(
		async (voterId: string, password: string): Promise<AuthUser> => {
			const { user: u } = await authApi.login(voterId, password);
			setUser(u);
			setStatus("authed");
			return u;
		},
		[],
	);

	const refresh = useCallback(async (): Promise<AuthUser> => {
		const { user: u } = await authApi.refresh();
		setUser(u);
		setStatus("authed");
		return u;
	}, []);

	const logout = useCallback(async (): Promise<void> => {
		try {
			await authApi.logout();
		} finally {
			setUser(null);
			setStatus("guest");
		}
	}, []);

	const value = useMemo<AuthValue>(
		() => ({ status, user, login, refresh, logout }),
		[status, user, login, refresh, logout],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within AuthProvider");
	return ctx;
}
