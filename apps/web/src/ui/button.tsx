import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from "react";

type Variant = "brand" | "outline" | "ghost" | "danger" | "soft";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
	brand:
		"bg-brand-600 font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60",
	outline:
		"border border-zinc-300 bg-white font-semibold text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 disabled:opacity-60",
	ghost:
		"font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-60",
	danger:
		"bg-red-700 font-semibold text-white shadow-sm hover:bg-red-800 disabled:opacity-60",
	soft: "bg-brand-50 font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-60",
};

const SIZES: Record<Size, string> = {
	sm: "min-h-10 min-w-10 rounded-md px-3 py-2 text-sm",
	md: "min-h-11 min-w-11 rounded-lg px-4 py-2 text-sm",
	lg: "min-h-12 min-w-12 rounded-lg px-6 py-3 text-base",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: Variant;
	size?: Size;
	loading?: boolean;
	icon?: ReactNode;
}

export function Button({
	variant = "brand",
	size = "md",
	loading = false,
	icon,
	children,
	disabled,
	className = "",
	type = "button",
	...rest
}: ButtonProps): ReactElement {
	return (
		<button
			type={type}
			disabled={disabled ?? loading}
			className={`inline-flex max-w-full items-center justify-center gap-2 whitespace-normal [overflow-wrap:anywhere] transition-colors disabled:cursor-not-allowed [&>svg]:shrink-0 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
			{...rest}
		>
			{loading ? (
				<LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
			) : (
				icon
			)}
			{children}
		</button>
	);
}
