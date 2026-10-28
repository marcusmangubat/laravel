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
import { useEffect, useState } from "react";
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
            className={`rounded-2xl border border-slate-200 bg-white p-5 ${className}`}
        >
            {children}
        </div>
    );
}

function BarList({ rows }: { rows: Row[] }) {
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
                            {r.label}
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

function TrendChart({ rows }: { rows: Row[] }) {
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
        "rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-green-200";

    return (
        <AdminLayout
            title="Dashboard"
            unread={unread}
            actions={
                <button
                    type="button"
                    onClick={() => refresh()}
                    className="h-10 rounded-xl border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-green-200"
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
                className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"
            >
                <div>
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
                <div>
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
                <button
                    type="submit"
                    className="rounded-xl bg-[#15803d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f3d2e] focus:outline-none focus:ring-4 focus:ring-green-200"
                >
                    Apply
                </button>
                <button
                    type="button"
                    onClick={clear}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                    Clear
                </button>
                <p className="ml-auto text-xs text-slate-400">
                    Updated {generated}
                </p>
            </form>

            {/* Error banner */}
            {error && (
                <div
                    role="alert"
                    className="flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700"
                >
                    <span>{error}</span>
                    <button
                        type="button"
                        onClick={() => {
                            setLocalError("");
                            clearErrors();
                        }}
                        className="font-semibold underline"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* Summary cards */}
            <section
                aria-label="Summary"
                className="grid grid-cols-2 gap-4 md:grid-cols-4"
            >
                {CARD_DEFS.map(({ key, label, icon: Icon, color }) => (
                    <div
                        key={key}
                        className={`rounded-2xl border border-slate-200 bg-white p-4 ${
                            key === "overdue" && cards[key] > 0
                                ? "ring-2 ring-red-200"
                                : ""
                        }`}
                    >
                        <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                            <span>{label}</span>
                            <Icon className={`h-4 w-4 ${color}`} />
                        </div>
                        <p className={`mt-2 text-3xl ${color}`} style={serif}>
                            {Number(cards[key]).toLocaleString()}
                        </p>
                    </div>
                ))}
            </section>

            {/* Trend + status */}
            <section className="grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <h2 className="mb-4 font-semibold text-slate-700">
                        Complaints received, last 12 months
                    </h2>
                    <TrendChart rows={trend} />
                </Card>
                <Card>
                    <h2 className="mb-4 font-semibold text-slate-700">
                        By status
                    </h2>
                    <BarList rows={by_status} />
                </Card>
            </section>

            {/* Breakdowns */}
            <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                <Card>
                    <h2 className="mb-4 font-semibold text-slate-700">
                        By province
                    </h2>
                    <BarList rows={by_province} />
                </Card>
                <Card>
                    <h2 className="mb-4 font-semibold text-slate-700">
                        By category
                    </h2>
                    <BarList rows={by_category} />
                </Card>
                <Card className="md:col-span-2 xl:col-span-1">
                    <h2 className="mb-4 font-semibold text-slate-700">
                        By receiving office
                    </h2>
                    <BarList rows={by_office} />
                </Card>
            </section>

            {/* Recent complaints + side column */}
            <section className="grid gap-6 xl:grid-cols-3">
                <Card className="xl:col-span-2">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="font-semibold text-slate-700">
                            Recently updated complaints
                        </h2>
                        <Link
                            href="/admin/complaints"
                            className="text-sm font-semibold text-[#15803d] hover:text-[#0f3d2e]"
                        >
                            View all
                        </Link>
                    </div>
                    <div className="overflow-x-auto">
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
                                {recent.length ? (
                                    recent.map((r) => (
                                        <tr
                                            key={r.complaint_id}
                                            className="border-b border-slate-100 hover:bg-slate-50"
                                        >
                                            <td className="whitespace-nowrap py-2.5 pr-3">
                                                <Link
                                                    href={`/admin/complaints/${r.complaint_id}`}
                                                    className="font-semibold text-[#15803d] hover:underline"
                                                >
                                                    {r.reference_no}
                                                </Link>
                                            </td>
                                            <td className="max-w-xs truncate py-2.5 pr-3">
                                                {r.title}
                                            </td>
                                            <td className="whitespace-nowrap py-2.5 pr-3 text-slate-600">
                                                {r.office_name}
                                            </td>
                                            <td className="whitespace-nowrap py-2.5 pr-3">
                                                <span
                                                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[r.status_code] ?? "bg-slate-100 text-slate-700"}`}
                                                >
                                                    {r.status_name}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap py-2.5 text-xs text-slate-500">
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

                <div className="space-y-6">
                    <Card>
                        <h2 className="mb-3 font-semibold text-slate-700">
                            Field office accounts
                        </h2>
                        <p className="mb-4 text-sm text-slate-600">
                            {accounts.active} active of {accounts.total} field
                            office account{accounts.total === 1 ? "" : "s"}.
                        </p>
                        <div className="flex gap-2">
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
                        <h2 className="mb-3 font-semibold text-slate-700">
                            Recent activity
                        </h2>
                        <ul className="space-y-3 text-sm">
                            {activity.length ? (
                                activity.map((a, i) => (
                                    <li key={i} className="flex gap-3">
                                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#22c55e]" />
                                        <div>
                                            <p className="text-slate-700">
                                                {a.action.replace(/_/g, " ")}
                                                {a.entity_type
                                                    ? ` · ${a.entity_type}`
                                                    : ""}
                                            </p>
                                            <p className="text-xs text-slate-400">
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
