import { ChevronDown } from "lucide-react";
import {
    type ReactNode,
    type SelectHTMLAttributes,
    type KeyboardEvent,
    useState,
} from "react";

// text-base on mobile stops iOS Safari from zooming into focused inputs
export const fieldCls =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-4 focus:ring-green-200 disabled:bg-slate-100 aria-[invalid=true]:border-red-500";
export const lblCls = "mb-1 block text-xs font-semibold text-slate-500";

export const Req = () => <span className="text-red-600"> *</span>;

export function Field({
    label,
    htmlFor,
    error,
    hint,
    required,
    children,
}: {
    label: ReactNode;
    htmlFor: string;
    error?: string;
    hint?: string;
    required?: boolean;
    children: ReactNode;
}) {
    return (
        <div className="min-w-0">
            <label htmlFor={htmlFor} className={lblCls}>
                {label}
                {required && <Req />}
            </label>
            {children}
            {hint && !error && (
                <p className="mt-1 text-xs text-slate-400">{hint}</p>
            )}
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    );
}

/**
 * Native <select> with an animated chevron.
 * The arrow rotates 180° and turns green while the dropdown is open.
 * Keeps the native picker, so mobile and accessibility behavior are unchanged.
 */
export function Select({
    className = "",
    children,
    onBlur,
    onChange,
    onKeyDown,
    onMouseDown,
    disabled,
    ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
    const [open, setOpen] = useState(false);

    const handleKeyDown = (e: KeyboardEvent<HTMLSelectElement>) => {
        if (e.key === "Escape" || e.key === "Tab" || e.key === "Enter") {
            setOpen(false);
        } else if (
            e.key === " " ||
            e.key === "F4" ||
            (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp"))
        ) {
            setOpen((v) => !v);
        }
        onKeyDown?.(e);
    };

    return (
        <div className="group relative">
            <select
                {...props}
                disabled={disabled}
                className={`${fieldCls} cursor-pointer appearance-none pr-10 disabled:cursor-not-allowed ${className}`}
                onMouseDown={(e) => {
                    if (!disabled) setOpen((v) => !v);
                    onMouseDown?.(e);
                }}
                onChange={(e) => {
                    setOpen(false);
                    onChange?.(e);
                }}
                onBlur={(e) => {
                    setOpen(false);
                    onBlur?.(e);
                }}
                onKeyDown={handleKeyDown}
            >
                {children}
            </select>
            <ChevronDown
                aria-hidden="true"
                className={`pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 transition-[transform,color] duration-500 ease-in-out ${
                    open
                        ? "rotate-180 text-[#15803d]"
                        : "text-slate-400 group-hover:text-slate-600"
                } ${disabled ? "opacity-40" : ""}`}
            />
        </div>
    );
}
