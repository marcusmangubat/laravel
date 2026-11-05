// resources/js/components/dashboard-widgets.tsx
// Small pieces shared by the Admin and Field Office dashboards.

import type { ReactNode } from 'react';

export type Row = { label: string; total: number };

export const serif = { fontFamily: "'DM Serif Display', serif" };

export const cap = (s: string) =>
    s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

export const fmtDateTime = (s: string) =>
    s
        ? new Date(s.replace(' ', 'T')).toLocaleString('en-PH', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
          })
        : '';

export const fmtDate = (s: string | null) =>
    s
        ? new Date(s + 'T00:00:00').toLocaleDateString('en-PH', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
          })
        : 'Not set';

/** Today as YYYY-MM-DD in the browser's local time (used to block future dates). */
export const todayStr = () => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export function Card({
    className = '',
    children,
}: {
    className?: string;
    children: ReactNode;
}) {
    return (
        <div
            className={`rounded-2xl border border-slate-200 bg-white p-5 ${className}`}
        >
            {children}
        </div>
    );
}

/** Horizontal bars. `labelFn` lets a page reformat labels (e.g. capitalise priorities). */
export function BarList({
    rows,
    labelFn,
}: {
    rows: Row[];
    labelFn?: (l: string) => string;
}) {
    if (!rows.length) {
        return (
            <p className="text-sm text-slate-400">
                No complaints match the current filters.
            </p>
        );
    }
    const max = Math.max(...rows.map((r) => Number(r.total)), 1);
    return (
        <div className="space-y-3">
            {rows.map((r) => (
                <div key={r.label}>
                    <div className="mb-1 flex justify-between text-xs">
                        <span className="truncate pr-2 text-slate-600">
                            {labelFn ? labelFn(r.label) : r.label}
                        </span>
                        <span className="font-semibold text-slate-700">
                            {Number(r.total).toLocaleString()}
                        </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                        <div
                            className="h-2 rounded-full bg-[#15803d]"
                            style={{
                                width: `${(Number(r.total) / max) * 100}%`,
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}

/** 12-month bar chart. */
export function TrendChart({ rows }: { rows: Row[] }) {
    const max = Math.max(...rows.map((r) => Number(r.total)), 1);
    return (
        <>
            <div className="flex h-48 items-end gap-1.5">
                {rows.map((r) => {
                    const t = Number(r.total);
                    return (
                        <div
                            key={r.label}
                            title={`${r.label}: ${t}`}
                            className="flex h-full flex-1 flex-col items-center justify-end"
                        >
                            <span className="mb-1 text-[10px] text-slate-500">
                                {t || ''}
                            </span>
                            <div
                                className="w-full rounded-t bg-[#15803d]"
                                style={{
                                    height: `${Math.max((t / max) * 100, t ? 4 : 1)}%`,
                                }}
                            />
                        </div>
                    );
                })}
            </div>
            <div className="mt-2 flex gap-1.5 text-[10px] text-slate-400">
                {rows.map((r) => (
                    <div key={r.label} className="flex-1 truncate text-center">
                        {r.label.slice(0, 3)}
                    </div>
                ))}
            </div>
        </>
    );
}
