import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "@inertiajs/react";
import { FileSpreadsheet, Search } from "lucide-react";

export interface Option {
    id: number;
    name: string;
}

interface Filters {
    q: string;
    from: string;
    to: string;
    status_id: string;
    category_id: string;
    province_id: string;
    office_id: string;
    priority: string;
    overdue: string;
}

interface ComplaintRow {
    complaint_id: number;
    reference_no: string;
    title: string;
    category_name: string | null;
    barangay: string | null;
    municipality: string | null;
    province_name: string | null;
    office_name: string | null;
    status_code: string;
    status_name: string;
    priority: "urgent" | "high" | "normal" | "low";
    received_at: string | null;
    target_date: string | null;
    is_overdue: number | boolean;
}

interface Payload {
    rows: ComplaintRow[];
    total: number;
    page: number;
    pages: number;
    per_page: number;
}

export interface ReportViewProps {
    today: string;
    statuses: Option[];
    categories: Option[];
    provinces?: Option[];
    offices?: Option[];
    dataUrl: string;
    exportUrl: string;
    /** Base path for the complaint detail links, e.g. "/admin/complaints" */
    complaintBase: string;
    /** true = admin (province + office filters, Office column) */
    admin: boolean;
    description: ReactNode;
}

const FIELD =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-[#0f3d2e] focus:outline-none focus:ring-4 focus:ring-green-200";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600";

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
const PRIORITY_CLS: Record<string, string> = {
    urgent: "bg-red-100 text-red-800",
    high: "bg-orange-100 text-orange-800",
    normal: "bg-slate-100 text-slate-700",
    low: "bg-slate-50 text-slate-500",
};
const EMPTY: Filters = {
    q: "",
    from: "",
    to: "",
    status_id: "",
    category_id: "",
    province_id: "",
    office_id: "",
    priority: "",
    overdue: "",
};
const FILTER_KEYS = Object.keys(EMPTY) as (keyof Filters)[];

const cap = (s?: string | null) =>
    s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
const fmt = (s?: string | null) =>
    s
        ? new Date(s.replace(" ", "T")).toLocaleString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
          })
        : "";
const fmtDate = (s?: string | null) =>
    s
        ? new Date(s.slice(0, 10) + "T00:00:00").toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
          })
        : "—";
const place = (r: ComplaintRow) =>
    [r.barangay, r.municipality, r.province_name].filter(Boolean).join(", ") ||
    "—";

function toParams(filters: Filters, page: number): URLSearchParams {
    const p = new URLSearchParams();
    FILTER_KEYS.forEach((k) => {
        if (filters[k]) p.set(k, filters[k]);
    });
    if (page > 1) p.set("page", String(page));
    return p;
}

function Field({
    id,
    label,
    children,
}: {
    id: string;
    label: string;
    children: ReactNode;
}) {
    return (
        <div>
            <label className={LABEL} htmlFor={id}>
                {label}
            </label>
            {children}
        </div>
    );
}

function Select({
    id,
    value,
    onChange,
    all,
    options,
    extra,
}: {
    id: string;
    value: string;
    onChange: (v: string) => void;
    all: string;
    options: Option[];
    extra?: ReactNode;
}) {
    return (
        <select
            id={id}
            className={FIELD}
            value={value}
            onChange={(e) => onChange(e.target.value)}
        >
            <option value="">{all}</option>
            {extra}
            {options.map((o) => (
                <option key={o.id} value={o.id}>
                    {o.name}
                </option>
            ))}
        </select>
    );
}

export default function ReportView({
    today,
    statuses,
    categories,
    provinces = [],
    offices = [],
    dataUrl,
    exportUrl,
    complaintBase,
    admin,
    description,
}: ReportViewProps) {
    const headers = admin
        ? [
              "Reference",
              "Subject",
              "Category",
              "Location",
              "Office",
              "Status",
              "Priority",
              "Received",
              "Target date",
          ]
        : [
              "Reference",
              "Subject",
              "Category",
              "Location",
              "Status",
              "Priority",
              "Received",
              "Target date",
          ];
    const cols = headers.length;

    const cleanDate = (v: string) =>
        /^\d{4}-\d{2}-\d{2}$/.test(v) && v <= today ? v : "";

    const [filters, setFilters] = useState<Filters>(() => {
        const sp = new URLSearchParams(window.location.search);
        const f = Object.fromEntries(
            FILTER_KEYS.map((k) => [k, sp.get(k) || ""]),
        ) as unknown as Filters;
        return { ...f, from: cleanDate(f.from), to: cleanDate(f.to) };
    });
    const [page, setPage] = useState<number>(() =>
        Math.max(
            1,
            parseInt(
                new URLSearchParams(window.location.search).get("page") || "1",
                10,
            ),
        ),
    );
    const [qInput, setQInput] = useState(filters.q);
    const [data, setData] = useState<Payload>({
        rows: [],
        total: 0,
        page: 1,
        pages: 1,
        per_page: 15,
    });
    const [loading, setLoading] = useState(true);
    const [serverError, setServerError] = useState("");
    const [toast, setToast] = useState("");
    const abortRef = useRef<AbortController | null>(null);
    const reqRef = useRef(0);

    const dateError = useMemo(() => {
        const { from, to } = filters;
        if (from > today || to > today)
            return "Future dates cannot be selected. Please choose today or an earlier date.";
        if (from && to && from > to)
            return "The start date must be on or before the end date.";
        return "";
    }, [filters.from, filters.to, today]);

    const set = (key: keyof Filters) => (value: string) => {
        setFilters((f) => ({ ...f, [key]: value }));
        setPage(1);
    };

    // Debounce the search box
    useEffect(() => {
        const t = setTimeout(() => {
            if (qInput !== filters.q) {
                setFilters((f) => ({ ...f, q: qInput }));
                setPage(1);
            }
        }, 350);
        return () => clearTimeout(t);
    }, [qInput]);

    // Load data whenever filters or page change
    useEffect(() => {
        if (dateError) return;
        void load();
        return () => abortRef.current?.abort();
    }, [filters, page, dateError]);

    async function load() {
        const my = ++reqRef.current;
        abortRef.current?.abort();
        const ctl = new AbortController();
        abortRef.current = ctl;

        const params = toParams(filters, page);
        window.history.replaceState(
            null,
            "",
            params.toString() ? `?${params}` : window.location.pathname,
        );
        setLoading(true);
        setServerError("");

        try {
            const res = await fetch(`${dataUrl}?${params}`, {
                headers: {
                    Accept: "application/json",
                    "X-Requested-With": "XMLHttpRequest",
                },
                credentials: "same-origin",
                signal: ctl.signal,
            });
            if (res.status === 401 || res.status === 419) {
                window.location.href = "/login";
                return;
            }

            const d = await res.json();
            if (my !== reqRef.current) return;

            if (res.status === 422) {
                setData((x) => ({ ...x, rows: [] }));
                setServerError(d.error || "Please check the selected dates.");
                return;
            }
            if (!res.ok || !d.ok) throw new Error("server");

            // Page past the last page: jump back to the last one
            if (!d.rows.length && d.total > 0 && page > d.pages) {
                setPage(d.pages);
                return;
            }
            setData(d as Payload);
        } catch (e) {
            if ((e as Error).name === "AbortError") return;
            setData((x) => ({ ...x, rows: [] }));
            setServerError(
                "The report could not be loaded. Check your connection and try again.",
            );
        } finally {
            if (my === reqRef.current) setLoading(false);
        }
    }

    function exportExcel() {
        if (dateError) return;
        setToast("Preparing Excel file…");
        window.setTimeout(() => setToast(""), 4500);
        window.location.href = `${exportUrl}?${toParams(filters, 1)}`;
    }

    function clearFilters() {
        setQInput("");
        setFilters(EMPTY);
        setPage(1);
    }

    const error = dateError || serverError;
    const start = data.total ? (data.page - 1) * data.per_page + 1 : 0;

    return (
        <>
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-slate-600">{description}</p>
                    <button
                        type="button"
                        onClick={exportExcel}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#0f3d2e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#14532d] focus:outline-none focus:ring-4 focus:ring-green-200"
                    >
                        <FileSpreadsheet className="h-4 w-4" />
                        Export to Excel
                    </button>
                </div>

                <div className="relative max-w-md">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <label htmlFor="q" className="sr-only">
                        Search
                    </label>
                    <input
                        type="search"
                        id="q"
                        className={`${FIELD} pl-10`}
                        placeholder="Search reference, subject or location"
                        value={qInput}
                        onChange={(e) => setQInput(e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                    <Field id="f_from" label="Received from">
                        <input
                            type="date"
                            id="f_from"
                            className={FIELD}
                            value={filters.from}
                            max={filters.to || today}
                            onChange={(e) => set("from")(e.target.value)}
                        />
                    </Field>
                    <Field id="f_to" label="Received to">
                        <input
                            type="date"
                            id="f_to"
                            className={FIELD}
                            value={filters.to}
                            min={filters.from || undefined}
                            max={today}
                            onChange={(e) => set("to")(e.target.value)}
                        />
                    </Field>
                    <Field id="f_status" label="Status">
                        <Select
                            id="f_status"
                            value={filters.status_id}
                            onChange={set("status_id")}
                            all="All statuses"
                            options={statuses}
                        />
                    </Field>
                    <Field id="f_category" label="Category">
                        <Select
                            id="f_category"
                            value={filters.category_id}
                            onChange={set("category_id")}
                            all="All categories"
                            options={categories}
                        />
                    </Field>
                    {admin && (
                        <>
                            <Field id="f_province" label="Province">
                                <Select
                                    id="f_province"
                                    value={filters.province_id}
                                    onChange={set("province_id")}
                                    all="All provinces"
                                    options={provinces}
                                />
                            </Field>
                            <Field id="f_office" label="Office">
                                <Select
                                    id="f_office"
                                    value={filters.office_id}
                                    onChange={set("office_id")}
                                    all="All offices"
                                    options={offices}
                                    extra={
                                        <option value="none">
                                            Not yet assigned
                                        </option>
                                    }
                                />
                            </Field>
                        </>
                    )}
                    <Field id="f_priority" label="Priority">
                        <select
                            id="f_priority"
                            className={FIELD}
                            value={filters.priority}
                            onChange={(e) => set("priority")(e.target.value)}
                        >
                            <option value="">All priorities</option>
                            <option value="urgent">Urgent</option>
                            <option value="high">High</option>
                            <option value="normal">Normal</option>
                            <option value="low">Low</option>
                        </select>
                    </Field>
                    <Field id="f_overdue" label="Overdue">
                        <select
                            id="f_overdue"
                            className={FIELD}
                            value={filters.overdue}
                            onChange={(e) => set("overdue")(e.target.value)}
                        >
                            <option value="">All</option>
                            <option value="1">Overdue only</option>
                        </select>
                    </Field>
                </div>

                <button
                    type="button"
                    onClick={clearFilters}
                    className="text-sm text-slate-500 underline hover:text-slate-800"
                >
                    Clear filters
                </button>
            </section>

            {error && (
                <div
                    role="alert"
                    className="flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700"
                >
                    <span>{error}</span>
                    {!dateError && (
                        <button
                            type="button"
                            onClick={() => void load()}
                            className="font-semibold underline"
                        >
                            Try again
                        </button>
                    )}
                </div>
            )}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="overflow-x-auto" aria-busy={loading}>
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                                {headers.map((h) => (
                                    <th
                                        key={h}
                                        className="px-4 py-3 font-semibold"
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading &&
                                Array.from({ length: 4 }, (_, i) => (
                                    <tr key={`sk${i}`}>
                                        <td colSpan={cols} className="p-3">
                                            <div className="h-6 animate-pulse rounded bg-slate-200" />
                                        </td>
                                    </tr>
                                ))}

                            {!loading &&
                                data.rows.map((r) => (
                                    <tr
                                        key={r.complaint_id}
                                        className="border-b border-slate-100 hover:bg-slate-50"
                                    >
                                        <td className="whitespace-nowrap px-4 py-3">
                                            <Link
                                                className="font-semibold text-[#0f3d2e] hover:underline"
                                                href={`${complaintBase}/${r.complaint_id}`}
                                            >
                                                {r.reference_no}
                                            </Link>
                                        </td>
                                        <td
                                            className="max-w-xs truncate px-4 py-3"
                                            title={r.title}
                                        >
                                            {r.title}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                                            {r.category_name || "Uncategorized"}
                                        </td>
                                        <td
                                            className="max-w-[14rem] truncate px-4 py-3 text-slate-600"
                                            title={place(r)}
                                        >
                                            {place(r)}
                                        </td>
                                        {admin && (
                                            <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                                                {r.office_name ||
                                                    "Not yet assigned"}
                                            </td>
                                        )}
                                        <td className="whitespace-nowrap px-4 py-3">
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                                    STATUS_CLS[r.status_code] ??
                                                    "bg-slate-100 text-slate-700"
                                                }`}
                                            >
                                                {r.status_name}
                                            </span>
                                            {Number(r.is_overdue) === 1 && (
                                                <span className="ml-1 text-xs font-semibold text-red-700">
                                                    Overdue
                                                </span>
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3">
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                                    PRIORITY_CLS[r.priority] ??
                                                    ""
                                                }`}
                                            >
                                                {cap(r.priority)}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                                            {fmt(r.received_at)}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                                            {fmtDate(r.target_date)}
                                        </td>
                                    </tr>
                                ))}

                            {!loading && !data.rows.length && !error && (
                                <tr>
                                    <td
                                        colSpan={cols}
                                        className="py-12 text-center text-slate-400"
                                    >
                                        No complaints match these filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
                    <p>
                        {data.total
                            ? `Showing ${start}–${Math.min(
                                  data.page * data.per_page,
                                  data.total,
                              )} of ${data.total.toLocaleString()} complaints`
                            : "0 complaints"}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => p - 1)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40"
                        >
                            Previous
                        </button>
                        <span>
                            Page {data.page} of {data.pages}
                        </span>
                        <button
                            type="button"
                            disabled={page >= data.pages}
                            onClick={() => setPage((p) => p + 1)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </section>

            {toast && (
                <div
                    role="status"
                    className="fixed bottom-6 right-6 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg"
                >
                    {toast}
                </div>
            )}
        </>
    );
}
