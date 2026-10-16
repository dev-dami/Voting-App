import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from "react";

type Variant = "brand" | "outline" | "ghost" | "danger" | "soft";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
	brand:
		"bg-stone-900 font-medium text-white hover:bg-stone-800 disabled:opacity-60",
	outline:
		"border border-stone-200 bg-white font-medium text-stone-600 hover:border-stone-300 hover:bg-stone-50 disabled:opacity-60",
	ghost:
		"font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-60",
	danger:
		"bg-red-800 font-medium text-white hover:bg-red-900 disabled:opacity-60",
	soft: "bg-brand-50 font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60",
};

const SIZES: Record<Size, string> = {
	sm: "min-h-10 min-w-10 rounded-lg px-3 py-2 text-sm",
	md: "min-h-11 min-w-11 rounded-lg px-4 py-2 text-sm",
	lg: "min-h-12 min-w-12 rounded-xl px-6 py-3 text-base",
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
