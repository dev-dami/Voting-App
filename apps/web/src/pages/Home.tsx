import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { homeFor, useAuth } from "../lib/auth";

export function Home(): ReactElement {
	const { status, user } = useAuth();
	if (status === "loading") return <p className="text-zinc-500">Loading…</p>;
	if (status === "guest" || !user) return <Navigate to="/login" replace />;
	return <Navigate to={homeFor(user.role, user.hasVoted)} replace />;
}
