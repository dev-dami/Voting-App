export function registerSw(): void {
	if (import.meta.env.PROD && "serviceWorker" in navigator) {
		window.addEventListener("load", () => {
			void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
		});
	}
}
