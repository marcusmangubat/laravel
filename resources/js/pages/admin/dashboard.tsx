import { Head, Link, router, useForm } from "@inertiajs/react";
import {
    CircleCheck,
    CircleHelp,
    Eye,
    FolderOpen,
    Hourglass,
    Inbox,
    RefreshCw,
    Search,
    TriangleAlert,
    type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/layouts/admin-layout";

// ───────── Types (match what DashboardController sends) ─────────
type Row = { label: string; total: number };
type Cards = {
    total: number;
    new_recorded: number;
    awaiting_assignment: number;
    under_investigation: number;
    awaiting_info: number;
    for_review: number;
    resolved_closed: number;
    overdue: number;
};
type Recent = {
    complaint_id: number;
    reference_no: string;
    title: string;
    office_name: string;
    status_code: string;
    status_name: string;
    updated_at: string;
};
type Activity = {
    action: string;
    entity_type: string | null;
    full_name: string | null;
    created_at: string;
};
type Props = {
    filters: { from: string; to: string };
    generated: string;
    cards: Cards;
    by_status: Row[];
    by_province: Row[];
    by_category: Row[];
    by_office: Row[];
    trend: Row[];
    recent: Recent[];
    activity: Activity[];
    accounts: { total: number; active: number };
    unread: number;
};

// ───────── Constants ─────────
const serif = { fontFamily: "'DM Serif Display', serif" };

// How many items each section shows before it collapses.
const LIMITS = {
    status: 6,
    province: 5,
    category: 6,
    office: 6,
    recent: 6,
    activity: 6,
} as const;

const STATUS_CLS: Record<string, string> = {
    recorded: "bg-slate-100 text-slate-700",
    for_review: "bg-sky-100 text-sky-800",
    for_assignment: "bg-amber-100 text-amber-800",
    assigned: "bg-blue-100 text-blue-800",
    under_investigation: "bg-indigo-100 text-indigo-800",
    for_info: "bg-orange-100 text-orange-800",
    for_rdac_review: "bg-purple-100 text-purple-800",
    resolved: "bg-green-100 text-green-800",
    closed: "bg-emerald-100 text-emerald-900",
};

const CARD_DEFS: {
    key: keyof Cards;
    label: string;
    icon: LucideIcon;
    color: string;
}[] = [
    {
        key: "total",
        label: "Total complaints",
        icon: FolderOpen,
        color: "text-slate-700",
    },
    {
        key: "new_recorded",
        label: "New in last 7 days",
        icon: Inbox,
        color: "text-sky-700",
    },
    {
        key: "awaiting_assignment",
        label: "Awaiting assignment",
        icon: Hourglass,
        color: "text-amber-700",
    },
    {
        key: "under_investigation",
        label: "Under investigation",
        icon: Search,
        color: "text-indigo-700",
    },
    {
        key: "awaiting_info",
        label: "Awaiting information",
        icon: CircleHelp,
        color: "text-orange-700",
    },
    {
        key: "for_review",
        label: "For RDAC review",
        icon: Eye,
        color: "text-purple-700",
    },
    {
        key: "resolved_closed",
        label: "Resolved or closed",
        icon: CircleCheck,
        color: "text-green-700",
    },
    {
        key: "overdue",
        label: "Overdue",
        icon: TriangleAlert,
        color: "text-red-700",
    },
];

// Data that changes over time and is re-fetched by the 60-second auto-refresh
const LIVE_PROPS = [
    "generated",
    "cards",
    "by_status",
    "by_province",
    "by_category",
    "by_office",
    "trend",
    "recent",
    "activity",
    "accounts",
    "unread",
];

const fmtDate = (s: string) =>
    s
        ? new Date(s.replace(" ", "T")).toLocaleString("en-PH", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
          })
        : "";

// Today as YYYY-MM-DD in the browser's local time (used to block future dates)
const todayStr = () => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// ───────── Small components ─────────
function Card({
    className = "",
    children,
}: {
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <div
            className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 ${className}`}
        >
            {children}
        </div>
    );
}

function SectionTitle({
    children,
    count,
}: {
    children: React.ReactNode;
    count?: string;
}) {
    return (
        <div className="mb-4 flex items-baseline justify-between gap-2">
            <h2 className="font-semibold text-slate-700">{children}</h2>
            {count && <span className="text-xs text-slate-400">{count}</span>}
        </div>
    );
}

function ToggleButton({
    expanded,
    hidden,
    onClick,
}: {
    expanded: boolean;
    hidden: number;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-expanded={expanded}
            className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-[#15803d] hover:bg-slate-50 focus:ring-4 focus:ring-green-200 focus:outline-none"
        >
            {expanded ? "Show less" : `Show ${hidden} more`}
        </button>
    );
}

/** Ranked bar list: sorted by total, capped at `limit`, expandable. */
function BarList({ rows, limit }: { rows: Row[]; limit: number }) {
    const [expanded, setExpanded] = useState(false);

    const sorted = useMemo(
        () => [...rows].sort((a, b) => Number(b.total) - Number(a.total)),
        [rows],
    );

    if (!sorted.length) {
        return (
            <p className="text-sm text-slate-400">
                No complaints match the current filters.
            </p>
        );
    }

    const visible = expanded ? sorted : sorted.slice(0, limit);
    const hidden = sorted.length - limit;
    const max = Math.max(...sorted.map((r) => Number(r.total)), 1);

    return (
        <>
            <div className="space-y-3">
                {visible.map((r) => (
                    <div key={r.label}>
                        <div className="mb-1 flex justify-between gap-2 text-xs">
                            <span
                                className="truncate text-slate-600"
                                title={r.label}
                            >
                                {r.label}
                            </span>
                            <span className="shrink-0 font-semibold text-slate-700">
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
            {hidden > 0 && (
                <ToggleButton
                    expanded={expanded}
                    hidden={hidden}
                    onClick={() => setExpanded((v) => !v)}
                />
            )}
        </>
    );
}

function TrendChart({ rows }: { rows: Row[] }) {
    const max = Math.max(...rows.map((r) => Number(r.total)), 1);
    return (
        <div className="overflow-x-auto">
            <div className="min-w-[320px]">
                <div className="flex h-40 items-end gap-1 sm:h-48 sm:gap-1.5">
                    {rows.map((r) => {
                        const t = Number(r.total);
                        return (
                            <div
                                key={r.label}
                                title={`${r.label}: ${t}`}
                                className="flex h-full flex-1 flex-col items-center justify-end"
                            >
                                <span className="mb-1 text-[9px] text-slate-500 sm:text-[10px]">
                                    {t || ""}
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
                <div className="mt-2 flex gap-1 text-[9px] text-slate-400 sm:gap-1.5 sm:text-[10px]">
                    {rows.map((r) => (
                        <div
                            key={r.label}
                            className="flex-1 truncate text-center"
                        >
                            {r.label.slice(0, 3)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ code, name }: { code: string; name: string }) {
    return (
        <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_CLS[code] ?? "bg-slate-100 text-slate-700"}`}
        >
            {name}
        </span>
    );
}

// ───────── Page ─────────
export default function Dashboard(props: Props) {
    const {
        filters,
        generated,
        cards,
        by_status,
        by_province,
        by_category,
        by_office,
        trend,
        recent,
        activity,
        accounts,
        unread,
    } = props;

    const TODAY = todayStr();
    const { data, setData, get, errors, clearErrors } = useForm({
        from: filters.from ?? "",
        to: filters.to ?? "",
    });
    const [localError, setLocalError] = useState("");
    const [refreshing, setRefreshing] = useState(false);

    const serverError = errors.from || errors.to || "";
    const error = localError || serverError;

    // Latest items only — keeps the lists short no matter how much data exists
    const recentShown = recent.slice(0, LIMITS.recent);
    const activityShown = activity.slice(0, LIMITS.activity);

    const refresh = (silent = false) => {
        router.reload({
            only: LIVE_PROPS,
            onStart: () => !silent && setRefreshing(true),
            onFinish: () => setRefreshing(false),
        });
    };

    // Auto-refresh every 60s while the tab is visible
    useEffect(() => {
        const t = setInterval(() => {
            if (!document.hidden) refresh(true);
        }, 60000);
        return () => clearInterval(t);
    }, []);

    const apply = (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError("");
        if ((data.from && data.from > TODAY) || (data.to && data.to > TODAY)) {
            setLocalError(
                "Future dates cannot be selected. Please choose today or an earlier date.",
            );
            return;
        }
        if (data.from && data.to && data.from > data.to) {
            setLocalError("The start date must be on or before the end date.");
            return;
        }
        get("/admin/dashboard", { preserveState: true, preserveScroll: true });
    };

    const clear = () => {
        setData({ from: "", to: "" });
        setLocalError("");
        clearErrors();
        router.get("/admin/dashboard", {}, { preserveScroll: true });
    };

    const inputCls =
        "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-green-200";

    return (
        <AdminLayout
            title="Dashboard"
            unread={unread}
            actions={
                <button
                    type="button"
                    onClick={() => refresh()}
                    aria-label="Refresh dashboard"
                    className="h-10 rounded-xl border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50 focus:ring-4 focus:ring-green-200 focus:outline-none"
                >
                    <RefreshCw
                        className={`inline h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                    />
                    <span className="ml-2 hidden sm:inline">Refresh</span>
                </button>
            }
        >
            <Head title="DENR RDAC IV-A – Dashboard" />

            {/* Filters */}
            <form
                onSubmit={apply}
                className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex sm:flex-wrap sm:items-end"
            >
                <div className="sm:w-44">
                    <label
                        htmlFor="from"
                        className="mb-1 block text-xs font-semibold text-slate-500"
                    >
                        Received from
                    </label>
                    <input
                        id="from"
                        type="date"
                        className={inputCls}
                        value={data.from}
                        max={data.to || TODAY}
                        onChange={(e) => setData("from", e.target.value)}
                    />
                </div>
                <div className="sm:w-44">
                    <label
                        htmlFor="to"
                        className="mb-1 block text-xs font-semibold text-slate-500"
                    >
                        Received to
                    </label>
                    <input
                        id="to"
                        type="date"
                        className={inputCls}
                        value={data.to}
                        min={data.from || undefined}
                        max={TODAY}
                        onChange={(e) => setData("to", e.target.value)}
                    />
                </div>
                <div className="col-span-2 flex gap-3 sm:col-span-1">
                    <button
                        type="submit"
                        className="flex-1 rounded-xl bg-[#15803d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f3d2e] focus:ring-4 focus:ring-green-200 focus:outline-none sm:flex-none"
                    >
                        Apply
                    </button>
                    <button
                        type="button"
                        onClick={clear}
                        className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 sm:flex-none"
                    >
                        Clear
                    </button>
                </div>
                <p className="col-span-2 text-xs text-slate-400 sm:col-span-1 sm:ml-auto">
                    Updated {generated}
                </p>
            </form>

            {/* Error banner */}
            {error && (
                <div
                    role="alert"
                    className="flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5"
                >
                    <span>{error}</span>
                    <button
                        type="button"
                        onClick={() => {
                            setLocalError("");
                            clearErrors();
                        }}
                        className="self-start font-semibold underline sm:self-auto"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* Summary cards */}
            <section
                aria-label="Summary"
                className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4"
            >
                {CARD_DEFS.map(({ key, label, icon: Icon, color }) => (
                    <div
                        key={key}
                        className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 ${
                            key === "overdue" && cards[key] > 0
                                ? "ring-2 ring-red-200"
                                : ""
                        }`}
                    >
                        <div className="flex items-start justify-between gap-2 text-xs font-medium text-slate-500">
                            <span className="leading-tight">{label}</span>
                            <Icon className={`h-4 w-4 shrink-0 ${color}`} />
                        </div>
                        <p
                            className={`mt-2 text-2xl sm:text-3xl ${color}`}
                            style={serif}
                        >
                            {Number(cards[key]).toLocaleString()}
                        </p>
                    </div>
                ))}
            </section>

            {/* Trend + status */}
            <section className="grid gap-4 sm:gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <SectionTitle>
                        Complaints received, last 12 months
                    </SectionTitle>
                    <TrendChart rows={trend} />
                </Card>
                <Card>
                    <SectionTitle>By status</SectionTitle>
                    <BarList rows={by_status} limit={LIMITS.status} />
                </Card>
            </section>

            {/* Breakdowns */}
            <section className="grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
                <Card>
                    <SectionTitle>By province</SectionTitle>
                    <BarList rows={by_province} limit={LIMITS.province} />
                </Card>
                <Card>
                    <SectionTitle>By category</SectionTitle>
                    <BarList rows={by_category} limit={LIMITS.category} />
                </Card>
                <Card className="md:col-span-2 xl:col-span-1">
                    <SectionTitle>By receiving office</SectionTitle>
                    <BarList rows={by_office} limit={LIMITS.office} />
                </Card>
            </section>

            {/* Recent complaints + side column */}
            <section className="grid gap-4 sm:gap-6 xl:grid-cols-3">
                <Card className="xl:col-span-2">
                    <div className="mb-4 flex items-center justify-between gap-2">
                        <h2 className="font-semibold text-slate-700">
                            Recently updated complaints
                        </h2>
                        <Link
                            href="/admin/complaints"
                            className="shrink-0 text-sm font-semibold text-[#15803d] hover:text-[#0f3d2e]"
                        >
                            View all
                        </Link>
                    </div>

                    {/* Mobile: stacked cards */}
                    <ul className="space-y-3 md:hidden">
                        {recentShown.length ? (
                            recentShown.map((r) => (
                                <li
                                    key={r.complaint_id}
                                    className="rounded-xl border border-slate-200 p-3"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <Link
                                            href={`/admin/complaints/${r.complaint_id}`}
                                            className="text-sm font-semibold break-all text-[#15803d] hover:underline"
                                        >
                                            {r.reference_no}
                                        </Link>
                                        <StatusBadge
                                            code={r.status_code}
                                            name={r.status_name}
                                        />
                                    </div>
                                    <p className="mt-1.5 line-clamp-2 text-sm text-slate-700">
                                        {r.title}
                                    </p>
                                    <p className="mt-1.5 text-xs text-slate-500">
                                        {r.office_name || "—"} ·{" "}
                                        {fmtDate(r.updated_at)}
                                    </p>
                                </li>
                            ))
                        ) : (
                            <li className="py-6 text-center text-sm text-slate-400">
                                No complaints recorded yet.
                            </li>
                        )}
                    </ul>

                    {/* Tablet / desktop: table */}
                    <div className="hidden overflow-x-auto md:block">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                                    <th className="py-2 pr-3 font-semibold">
                                        Reference
                                    </th>
                                    <th className="py-2 pr-3 font-semibold">
                                        Subject
                                    </th>
                                    <th className="py-2 pr-3 font-semibold">
                                        Office
                                    </th>
                                    <th className="py-2 pr-3 font-semibold">
                                        Status
                                    </th>
                                    <th className="py-2 font-semibold">
                                        Updated
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentShown.length ? (
                                    recentShown.map((r) => (
                                        <tr
                                            key={r.complaint_id}
                                            className="border-b border-slate-100 hover:bg-slate-50"
                                        >
                                            <td className="py-2.5 pr-3 whitespace-nowrap">
                                                <Link
                                                    href={`/admin/complaints/${r.complaint_id}`}
                                                    className="font-semibold text-[#15803d] hover:underline"
                                                >
                                                    {r.reference_no}
                                                </Link>
                                            </td>
                                            <td
                                                className="max-w-[14rem] truncate py-2.5 pr-3"
                                                title={r.title}
                                            >
                                                {r.title}
                                            </td>
                                            <td
                                                className="max-w-[10rem] truncate py-2.5 pr-3 text-slate-600"
                                                title={r.office_name}
                                            >
                                                {r.office_name}
                                            </td>
                                            <td className="py-2.5 pr-3 whitespace-nowrap">
                                                <StatusBadge
                                                    code={r.status_code}
                                                    name={r.status_name}
                                                />
                                            </td>
                                            <td className="py-2.5 text-xs whitespace-nowrap text-slate-500">
                                                {fmtDate(r.updated_at)}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="py-8 text-center text-slate-400"
                                        >
                                            No complaints recorded yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

                <div className="grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-1">
                    <Card>
                        <h2 className="mb-3 font-semibold text-slate-700">
                            Field office accounts
                        </h2>
                        <p className="mb-4 text-sm text-slate-600">
                            {accounts.active} active of {accounts.total} field
                            office account{accounts.total === 1 ? "" : "s"}.
                        </p>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Link
                                href="/admin/users"
                                className="flex-1 rounded-xl bg-[#15803d] px-3 py-2 text-center text-sm font-semibold text-white hover:bg-[#0f3d2e]"
                            >
                                Manage accounts
                            </Link>
                            <Link
                                href="/admin/offices"
                                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-center text-sm text-slate-600 hover:bg-slate-50"
                            >
                                Office directory
                            </Link>
                        </div>
                    </Card>

                    <Card>
                        <SectionTitle>Recent activity</SectionTitle>
                        <ul className="space-y-3 text-sm">
                            {activityShown.length ? (
                                activityShown.map((a, i) => (
                                    <li key={i} className="flex gap-3">
                                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#22c55e]" />
                                        <div className="min-w-0">
                                            <p className="truncate text-slate-700">
                                                {a.action.replace(/_/g, " ")}
                                                {a.entity_type
                                                    ? ` · ${a.entity_type}`
                                                    : ""}
                                            </p>
                                            <p className="truncate text-xs text-slate-400">
                                                {a.full_name || "Unknown user"}{" "}
                                                · {fmtDate(a.created_at)}
                                            </p>
                                        </div>
                                    </li>
                                ))
                            ) : (
                                <li className="text-slate-400">
                                    No activity yet.
                                </li>
                            )}
                        </ul>
                    </Card>
                </div>
            </section>
        </AdminLayout>
    );
}
