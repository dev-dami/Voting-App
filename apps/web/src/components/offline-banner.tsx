import { WifiOff } from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";

export function OfflineBanner(): ReactElement | null {
	const [online, setOnline] = useState(
		typeof navigator === "undefined" ? true : navigator.onLine,
	);

	useEffect(() => {
		const up = (): void => setOnline(true);
		const down = (): void => setOnline(false);
		window.addEventListener("online", up);
		window.addEventListener("offline", down);
		return () => {
			window.removeEventListener("online", up);
			window.removeEventListener("offline", down);
		};
	}, []);

	if (online) return null;
	return (
		<p
			role="alert"
			className="flex items-center justify-center gap-1.5 bg-amber-100 px-4 py-1.5 text-center text-xs font-semibold text-amber-900"
		>
			<WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
			No connection to the voting server — check the LAN connection. Your
			progress on this device is kept.
		</p>
	);
}
