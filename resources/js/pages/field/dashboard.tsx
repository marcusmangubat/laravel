import { Head, Link, router, useForm } from "@inertiajs/react";
import {
    CalendarDays,
    CircleCheck,
    FolderOpen,
    Hourglass,
    Inbox,
    RefreshCw,
    Search,
    Send,
    TriangleAlert,
    type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
    BarList,
    Card,
    TrendChart,
    cap,
    fmtDate,
    fmtDateTime,
    serif,
    todayStr,
    type Row,
} from "@/Components/dashboard-widgets";
import FieldLayout from "@/layouts/FieldLayouts";

// ───────── Types (match what FieldDashboardController sends) ─────────
type Cards = {
    total: number;
    newly_assigned: number;
    under_investigation: number;
    awaiting_action: number;
    submitted: number;
    completed: number;
    due_soon: number;
    overdue: number;
};
type Need = {
    complaint_id: number;
    reference_no: string;
    title: string;
    priority: string;
    target_date: string | null;
    status_code: string;
    status_name: string;
    is_overdue: number;
};
type Assignment = {
    assignment_type: string;
    is_current: number;
    created_at: string;
    complaint_id: number;
    reference_no: string;
    title: string;
};
type Activity = {
    action_type: string;
    action_date: string;
    reference_no: string;
    full_name: string;
};
type Props = {
    filters: { from: string; to: string };
    generated: string;
    cards: Cards;
    by_status: Row[];
    by_category: Row[];
    by_priority: Row[];
    trend: Row[];
    needs: Need[];
    assignments: Assignment[];
    activity: Activity[];
    unread: number;
};

// ───────── Constants ─────────
// How many items each section shows before it collapses.
const LIMITS = {
    status: 6,
    category: 6,
    priority: 4, // urgent / high / normal / low
    needs: 6,
    assignments: 5,
    activity: 6,
} as const;

const STATUS_CLS: Record<string, string> = {
    assigned: "bg-blue-100 text-blue-800",
    under_investigation: "bg-indigo-100 text-indigo-800",
    for_info: "bg-orange-100 text-orange-800",
};
const PRIORITY_CLS: Record<string, string> = {
    urgent: "bg-red-100 text-red-800",
    high: "bg-orange-100 text-orange-800",
    normal: "bg-slate-100 text-slate-700",
    low: "bg-slate-50 text-slate-500",
};
const ACTION_LABEL: Record<string, string> = {
    inspection: "Inspection",
    investigation_update: "Investigation update",
    finding: "Finding",
    recommendation: "Recommendation",
    info_request: "Information request",
    rdac_remark: "RDAC remark",
    follow_up: "Follow-up",
    internal_remark: "Internal remark",
};

const CARD_DEFS: {
    key: keyof Cards;
    label: string;
    icon: LucideIcon;
    color: string;
}[] = [
    {
        key: "total",
        label: "Assigned to my office",
        icon: FolderOpen,
        color: "text-slate-700",
    },
    {
        key: "newly_assigned",
        label: "Newly assigned",
        icon: Inbox,
        color: "text-blue-700",
    },
    {
        key: "under_investigation",
        label: "Under investigation",
        icon: Search,
        color: "text-indigo-700",
    },
    {
        key: "awaiting_action",
        label: "Awaiting my action",
        icon: Hourglass,
        color: "text-amber-700",
    },
    {
        key: "submitted",
        label: "Submitted to RDAC",
        icon: Send,
        color: "text-purple-700",
    },
    {
        key: "completed",
        label: "Completed",
        icon: CircleCheck,
        color: "text-green-700",
    },
    {
        key: "due_soon",
        label: "Due in 7 days",
        icon: CalendarDays,
        color: "text-orange-700",
    },
    {
        key: "overdue",
        label: "Overdue",
        icon: TriangleAlert,
        color: "text-red-700",
    },
];

// Data that the 60-second auto-refresh re-fetches (filters are kept from the URL)
const LIVE_PROPS = [
    "generated",
    "cards",
    "by_status",
    "by_category",
    "by_priority",
    "trend",
    "needs",
    "assignments",
    "activity",
    "unread",
];

// ───────── Local helpers ─────────
function Title({ children }: { children: React.ReactNode }) {
    return <h2 className="mb-4 font-semibold text-slate-700">{children}</h2>;
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

/**
 * Wraps the shared BarList: caps the rows at `limit` and adds a
 * "Show more / Show less" toggle. `sort` ranks by total (highest first).
 */
function LimitedBarList({
    rows,
    limit,
    sort = true,
    labelFn,
}: {
    rows: Row[];
    limit: number;
    sort?: boolean;
    labelFn?: (s: string) => string;
}) {
    const [expanded, setExpanded] = useState(false);
    const ordered = useMemo(
        () =>
            sort
                ? [...rows].sort((a, b) => Number(b.total) - Number(a.total))
                : rows,
        [rows, sort],
    );
    const visible = expanded ? ordered : ordered.slice(0, limit);
    const hidden = ordered.length - limit;

    return (
        <>
            {labelFn ? (
                <BarList rows={visible} labelFn={labelFn} />
            ) : (
                <BarList rows={visible} />
            )}
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

function Badge({ cls, children }: { cls: string; children: React.ReactNode }) {
    return (
        <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${cls}`}
        >
            {children}
        </span>
    );
}

// ───────── Page ─────────
export default function FieldDashboard(props: Props) {
    const {
        filters,
        generated,
        cards,
        by_status,
        by_category,
        by_priority,
        trend,
        needs,
        assignments,
        activity,
        unread,
    } = props;

    const TODAY = todayStr();
    const { data, setData, get, errors, clearErrors } = useForm({
        from: filters.from ?? "",
        to: filters.to ?? "",
    });
    const [localError, setLocalError] = useState("");
    const [refreshing, setRefreshing] = useState(false);
    const error = localError || errors.from || errors.to || "";

    // Latest items only — keeps lists short no matter how much data exists
    const needsShown = needs.slice(0, LIMITS.needs);
    const assignmentsShown = assignments.slice(0, LIMITS.assignments);
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
        get("/field/dashboard", { preserveState: true, preserveScroll: true });
    };

    const clear = () => {
        setData({ from: "", to: "" });
        setLocalError("");
        clearErrors();
        router.get("/field/dashboard", {}, { preserveScroll: true });
    };

    const inputCls =
        "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-green-200";

    return (
        <FieldLayout
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
            <Head title="DENR RDAC IV-A – Field Office Dashboard" />

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
                        className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 ${key === "overdue" && cards[key] > 0 ? "ring-2 ring-red-200" : ""}`}
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

            {/* Needs action */}
            <Card>
                <div className="mb-4 flex items-center justify-between gap-2">
                    <h2 className="font-semibold text-slate-700">
                        Complaints needing action
                    </h2>
                    <Link
                        href="/field/complaints"
                        className="shrink-0 text-sm font-semibold text-[#15803d] hover:text-[#0f3d2e]"
                    >
                        View all
                    </Link>
                </div>

                {/* Mobile: stacked cards */}
                <ul className="space-y-3 md:hidden">
                    {needsShown.length ? (
                        needsShown.map((r) => {
                            const overdue = Number(r.is_overdue) === 1;
                            return (
                                <li
                                    key={r.complaint_id}
                                    className="rounded-xl border border-slate-200 p-3"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <Link
                                            href={`/field/complaints/${r.complaint_id}`}
                                            className="text-sm font-semibold break-all text-[#15803d] hover:underline"
                                        >
                                            {r.reference_no}
                                        </Link>
                                        <Badge
                                            cls={PRIORITY_CLS[r.priority] ?? ""}
                                        >
                                            {cap(r.priority)}
                                        </Badge>
                                    </div>
                                    <p className="mt-1.5 line-clamp-2 text-sm text-slate-700">
                                        {r.title}
                                    </p>
                                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                        <Badge
                                            cls={
                                                STATUS_CLS[r.status_code] ??
                                                "bg-slate-100 text-slate-700"
                                            }
                                        >
                                            {r.status_name}
                                        </Badge>
                                        <span
                                            className={`text-xs ${overdue ? "font-semibold text-red-700" : "text-slate-500"}`}
                                        >
                                            Due {fmtDate(r.target_date)}
                                            {overdue ? " · overdue" : ""}
                                        </span>
                                    </div>
                                </li>
                            );
                        })
                    ) : (
                        <li className="py-6 text-center text-sm text-slate-400">
                            Nothing needs your action right now.
                        </li>
                    )}
                </ul>

                {/* Tablet / desktop: table */}
                <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                                {[
                                    "Reference",
                                    "Subject",
                                    "Priority",
                                    "Status",
                                    "Target date",
                                ].map((h) => (
                                    <th
                                        key={h}
                                        className="py-2 pr-3 font-semibold"
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {needsShown.length ? (
                                needsShown.map((r) => {
                                    const overdue = Number(r.is_overdue) === 1;
                                    return (
                                        <tr
                                            key={r.complaint_id}
                                            className="border-b border-slate-100 hover:bg-slate-50"
                                        >
                                            <td className="py-2.5 pr-3 whitespace-nowrap">
                                                <Link
                                                    href={`/field/complaints/${r.complaint_id}`}
                                                    className="font-semibold text-[#15803d] hover:underline"
                                                >
                                                    {r.reference_no}
                                                </Link>
                                            </td>
                                            <td
                                                className="max-w-[16rem] truncate py-2.5 pr-3"
                                                title={r.title}
                                            >
                                                {r.title}
                                            </td>
                                            <td className="py-2.5 pr-3 whitespace-nowrap">
                                                <Badge
                                                    cls={
                                                        PRIORITY_CLS[
                                                            r.priority
                                                        ] ?? ""
                                                    }
                                                >
                                                    {cap(r.priority)}
                                                </Badge>
                                            </td>
                                            <td className="py-2.5 pr-3 whitespace-nowrap">
                                                <Badge
                                                    cls={
                                                        STATUS_CLS[
                                                            r.status_code
                                                        ] ??
                                                        "bg-slate-100 text-slate-700"
                                                    }
                                                >
                                                    {r.status_name}
                                                </Badge>
                                            </td>
                                            <td
                                                className={`py-2.5 text-xs whitespace-nowrap ${overdue ? "font-semibold text-red-700" : "text-slate-500"}`}
                                            >
                                                {fmtDate(r.target_date)}
                                                {overdue ? " · overdue" : ""}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="py-8 text-center text-slate-400"
                                    >
                                        Nothing needs your action right now.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Trend + status */}
            <section className="grid gap-4 sm:gap-6 lg:grid-cols-3">
                <Card className="min-w-0 lg:col-span-2">
                    <Title>
                        Complaints received by my office, last 12 months
                    </Title>
                    <div className="overflow-x-auto">
                        <div className="min-w-[320px]">
                            <TrendChart rows={trend} />
                        </div>
                    </div>
                </Card>
                <Card className="min-w-0">
                    <Title>By status</Title>
                    <LimitedBarList rows={by_status} limit={LIMITS.status} />
                </Card>
            </section>

            {/* Breakdowns + lists */}
            <section className="grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-4">
                <Card className="min-w-0">
                    <Title>By category</Title>
                    <LimitedBarList
                        rows={by_category}
                        limit={LIMITS.category}
                    />
                </Card>
                <Card className="min-w-0">
                    <Title>By priority</Title>
                    {/* Keep natural priority order (urgent → low), no ranking */}
                    <LimitedBarList
                        rows={by_priority}
                        limit={LIMITS.priority}
                        sort={false}
                        labelFn={cap}
                    />
                </Card>
                <Card className="min-w-0">
                    <Title>Recent assignments</Title>
                    <ul className="space-y-3 text-sm">
                        {assignmentsShown.length ? (
                            assignmentsShown.map((a, i) => (
                                <li key={i} className="min-w-0">
                                    <Link
                                        href={`/field/complaints/${a.complaint_id}`}
                                        className="font-semibold break-all text-[#15803d] hover:underline"
                                    >
                                        {a.reference_no}
                                    </Link>
                                    <p className="truncate text-slate-600">
                                        {a.title}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        {cap(a.assignment_type)}
                                        {Number(a.is_current) === 1
                                            ? ""
                                            : " (ended)"}{" "}
                                        · {fmtDateTime(a.created_at)}
                                    </p>
                                </li>
                            ))
                        ) : (
                            <li className="text-slate-400">
                                No assignments yet.
                            </li>
                        )}
                    </ul>
                </Card>
                <Card className="min-w-0">
                    <Title>Recent activity</Title>
                    <ul className="space-y-3 text-sm">
                        {activityShown.length ? (
                            activityShown.map((a, i) => (
                                <li key={i} className="flex gap-3">
                                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#22c55e]" />
                                    <div className="min-w-0">
                                        <p className="truncate text-slate-700">
                                            {ACTION_LABEL[a.action_type] ??
                                                a.action_type}{" "}
                                            · {a.reference_no}
                                        </p>
                                        <p className="truncate text-xs text-slate-400">
                                            {a.full_name} ·{" "}
                                            {fmtDateTime(a.action_date)}
                                        </p>
                                    </div>
                                </li>
                            ))
                        ) : (
                            <li className="text-slate-400">No activity yet.</li>
                        )}
                    </ul>
                </Card>
            </section>
        </FieldLayout>
    );
}
