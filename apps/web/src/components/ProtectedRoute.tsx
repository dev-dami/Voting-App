import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { homeFor, useAuth } from "../lib/auth";
import type { Role } from "../lib/types";

interface Props {
	allow: Role[];
	children: ReactElement;
}

export function ProtectedRoute({ allow, children }: Props): ReactElement {
	const { status, user } = useAuth();
	if (status === "loading") return <p className="text-zinc-500">Loading…</p>;
	if (status === "guest" || !user) return <Navigate to="/login" replace />;
	if (!allow.includes(user.role)) {
		return <Navigate to={homeFor(user.role, user.hasVoted)} replace />;
	}
	return children;
}
