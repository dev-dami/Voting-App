import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RouteErrorBoundary } from "./components/error-boundary";
import { Layout } from "./components/Layout";
import { OfflineBanner } from "./components/offline-banner";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./lib/auth";
import { Admin } from "./pages/Admin";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Official } from "./pages/Official";
import { ReportIssue } from "./pages/ReportIssue";
import { Slip } from "./pages/Slip";
import { Vote } from "./pages/Vote";
import { Toaster } from "./ui/toast";

const queryClient = new QueryClient({
	defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
});

const VOTER_ROLES = [
	"student",
	"teaching_staff",
	"non_teaching_staff",
] as const;

export function App(): ReactElement {
	return (
		<QueryClientProvider client={queryClient}>
			<AuthProvider>
				<BrowserRouter>
					<OfflineBanner />
					<Layout>
						<RouteErrorBoundary>
							<Routes>
								<Route path="/" element={<Home />} />
								<Route path="/login" element={<Login />} />
								<Route path="/report-issue" element={<ReportIssue />} />
								<Route
									path="/vote"
									element={
										<ProtectedRoute allow={[...VOTER_ROLES]}>
											<Vote />
										</ProtectedRoute>
									}
								/>
								<Route
									path="/slip"
									element={
										<ProtectedRoute allow={[...VOTER_ROLES]}>
											<Slip />
										</ProtectedRoute>
									}
								/>
								<Route
									path="/official"
									element={
										<ProtectedRoute allow={["official", "admin"]}>
											<Official />
										</ProtectedRoute>
									}
								/>
								<Route
									path="/admin"
									element={
										<ProtectedRoute allow={["admin"]}>
											<Admin />
										</ProtectedRoute>
									}
								/>
								<Route path="*" element={<Navigate to="/" replace />} />
							</Routes>
						</RouteErrorBoundary>
					</Layout>
					<Toaster />
				</BrowserRouter>
			</AuthProvider>
		</QueryClientProvider>
	);
}
