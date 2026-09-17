import { Select as BaseSelect } from "@base-ui-components/react/select";
import { ChevronDown, Eye, EyeOff, Search } from "lucide-react";
import type { AriaAttributes, InputHTMLAttributes, ReactElement, ReactNode } from "react";
import { createContext, useContext, useId, useState } from "react";

const INPUT_CLASS =
	"min-h-11 w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 placeholder:text-zinc-500 focus:border-brand-600 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-600 sm:text-sm";

const FieldContext = createContext<{
	id: string;
	descriptionId?: string;
	invalid: boolean;
} | null>(null);

function useFieldAccessibility(id: string, props: AriaAttributes): AriaAttributes {
	const field = useContext(FieldContext);
	const matches = field?.id === id;
	return {
		"aria-describedby":
			[props["aria-describedby"], matches ? field.descriptionId : undefined]
				.filter(Boolean)
				.join(" ") || undefined,
		"aria-invalid": props["aria-invalid"] ?? (matches && field.invalid ? true : undefined),
	};
}

export function Field({
	label,
	htmlFor,
	hint,
	error,
	children,
}: {
	label: string;
	htmlFor: string;
	hint?: string;
	error?: string | null;
	children: ReactNode;
}): ReactElement {
	const descriptionId = useId();
	return (
		<FieldContext.Provider
			value={{ id: htmlFor, descriptionId: error || hint ? descriptionId : undefined, invalid: Boolean(error) }}
		>
			<div className="min-w-0">
				<label
					htmlFor={htmlFor}
					className="mb-1.5 block text-sm font-semibold text-zinc-700"
				>
					{label}
				</label>
				{children}
				{error ? (
					<p id={descriptionId} role="alert" className="mt-1.5 text-sm font-medium leading-relaxed text-red-700 [overflow-wrap:anywhere]">
						{error}
					</p>
				) : hint ? (
					<p id={descriptionId} className="mt-1.5 text-sm leading-relaxed text-zinc-600 [overflow-wrap:anywhere]">{hint}</p>
				) : null}
			</div>
		</FieldContext.Provider>
	);
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
	id: string;
}

export function TextInput({ id, ...rest }: TextInputProps): ReactElement {
	return (
		<input
			id={id}
			{...rest}
			{...useFieldAccessibility(id, rest)}
			className={`${INPUT_CLASS} ${rest.className ?? ""}`}
		/>
	);
}

export function PasswordInput({ id, ...rest }: TextInputProps): ReactElement {
	const [shown, setShown] = useState(false);
	return (
		<div className="relative">
			<input
				id={id}
				type={shown ? "text" : "password"}
				{...rest}
			{...useFieldAccessibility(id, rest)}
				className={`${INPUT_CLASS} pr-10 ${rest.className ?? ""}`}
			/>
			<button
				type="button"
				onClick={() => setShown((s) => !s)}
				aria-label={shown ? "Hide password" : "Show password"}
				aria-pressed={shown}
				disabled={rest.disabled}
				className="absolute top-1/2 right-1 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
			>
				{shown ? (
					<EyeOff className="h-4 w-4" aria-hidden="true" />
				) : (
					<Eye className="h-4 w-4" aria-hidden="true" />
				)}
			</button>
		</div>
	);
}

export function SearchInput({ id, ...rest }: TextInputProps): ReactElement {
	return (
		<div className="relative">
			<Search
				className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-zinc-400"
				aria-hidden="true"
			/>
			<input
				id={id}
				type="search"
				{...rest}
			{...useFieldAccessibility(id, rest)}
				className={`${INPUT_CLASS} pr-3 pl-9 ${rest.className ?? ""}`}
			/>
		</div>
	);
}

export function Textarea({
	id,
	...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
	id: string;
}): ReactElement {
	return (
		<textarea
			id={id}
			{...rest}
			{...useFieldAccessibility(id, rest)}
			className={`${INPUT_CLASS} min-h-24 ${rest.className ?? ""}`}
		/>
	);
}

export function SelectInput({
	id,
	label,
	value,
	onChange,
	options,
	placeholder = "Select…",
	...ariaProps
}: AriaAttributes & {
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	options: { value: string; label: string }[];
	placeholder?: string;
}): ReactElement {
	return (
		<BaseSelect.Root value={value} onValueChange={(v) => onChange(v ?? "")}>
			<BaseSelect.Trigger
				id={id}
				aria-label={label}
				{...ariaProps}
				{...useFieldAccessibility(id, ariaProps)}
				className={`${INPUT_CLASS} flex cursor-default items-center justify-between gap-2`}
			>
				<BaseSelect.Value>
					{(v: string | null) =>
						v ?? <span className="text-zinc-400">{placeholder}</span>
					}
				</BaseSelect.Value>
				<BaseSelect.Icon>
					<ChevronDown
						className="h-4 w-4 shrink-0 text-zinc-400"
						aria-hidden="true"
					/>
				</BaseSelect.Icon>
			</BaseSelect.Trigger>
			<BaseSelect.Portal>
				<BaseSelect.Positioner className="z-50" sideOffset={4}>
					<BaseSelect.Popup className="ui-popup max-h-64 min-w-(--anchor-width) overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
						{options.map((o) => (
							<BaseSelect.Item
								key={o.value}
								value={o.value}
								className="cursor-default px-3 py-1.5 text-sm text-zinc-800 outline-none data-[highlighted]:bg-brand-50 data-[highlighted]:text-brand-800 data-[selected]:font-semibold"
							>
								<BaseSelect.ItemText>{o.label}</BaseSelect.ItemText>
							</BaseSelect.Item>
						))}
					</BaseSelect.Popup>
				</BaseSelect.Positioner>
			</BaseSelect.Portal>
		</BaseSelect.Root>
	);
}
