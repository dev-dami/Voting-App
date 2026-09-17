import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";
import { registerSw } from "./pwa";

const el = document.getElementById("root");
if (!el) throw new Error("Missing #root element");

createRoot(el).render(
	<StrictMode>
		<App />
	</StrictMode>,
);

registerSw();
