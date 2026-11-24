import { Head, Link, router, useForm, usePage } from "@inertiajs/react";
import { Field, Req, Select, fieldCls } from "@/Components/form-controls";
import {
    AlertCircle,
    CheckCircle2,
    ChevronRight,
    MapPin,
    Building2,
    Clock,
    Plus,
    Search,
    SlidersHorizontal,
    X,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import AdminLayout from "@/layouts/admin-layout";

// ───────── Types ─────────
type Complaint = {
    complaint_id: number;
    reference_no: string;
    title: string;
    category_name: string | null;
    municipality: string | null;
    province_name: string | null;
    office_name: string | null;
    status_code: string;
    status_name: string;
    priority: string;
    received_at: string;
    is_overdue: number | boolean;
};
type Paginated = {
    data: Complaint[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
};
type Filters = {
    q: string;
    status_id: string;
    category_id: string;
    province_id: string;
    office_id: string;
    from: string;
    to: string;
};
type Options = {
    statuses: { status_id: number; status_name: string }[];
    categories: { category_id: number; category_name: string }[];
    provinces: { province_id: number; province_name: string }[];
    offices: { office_id: number; office_name: string }[];
};

// ───────── Constants / helpers ─────────
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
const PRIORITY_CLS: Record<string, string> = {
    urgent: "bg-red-100 text-red-800",
    high: "bg-orange-100 text-orange-800",
    normal: "bg-slate-100 text-slate-700",
    low: "bg-slate-50 text-slate-500",
};
// Colored edge on mobile cards so priority is visible at a glance
const PRIORITY_EDGE: Record<string, string> = {
    urgent: "border-l-red-500",
    high: "border-l-orange-400",
    normal: "border-l-slate-300",
    low: "border-l-slate-200",
};

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const fmt = (s: string) =>
    s
        ? new Date(s.replace(" ", "T")).toLocaleString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
          })
        : "";

const pad = (n: number) => String(n).padStart(2, "0");
const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const nowLocal = () =>
    `${todayStr()}T${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;

const locationOf = (r: Complaint) =>
    [r.municipality, r.province_name].filter(Boolean).join(", ") || "Unknown";

// ───────── Page ─────────
export default function Complaints({
    complaints,
    filters,
    options,
}: {
    complaints: Paginated;
    filters: Filters;
    options: Options;
}) {
    const page = usePage<any>();
    const TODAY = todayStr();

    // ---- Filters: stored in state, sent to the server as URL parameters ----
    const [f, setF] = useState<Filters>(filters);
    const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    );
    const [filterError, setFilterError] = useState("");
    const [showFilters, setShowFilters] = useState(false); // mobile only
    const serverFilterError =
        page.props.errors?.from || page.props.errors?.to || "";

    // Number of active filters (excluding search) for the mobile badge
    const activeFilters = (
        [
            "status_id",
            "category_id",
            "province_id",
            "office_id",
            "from",
            "to",
        ] as (keyof Filters)[]
    ).filter((k) => f[k]).length;

    const go = (next: Filters, pageNo = 1) => {
        const params: Record<string, string | number> = {};
        (Object.keys(next) as (keyof Filters)[]).forEach((k) => {
            if (next[k]) params[k] = next[k];
        });
        if (pageNo > 1) params.page = pageNo;
        router.get("/admin/complaints", params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: ["complaints", "filters", "errors"],
        });
    };

    const setFilter = (key: keyof Filters, value: string) => {
        const next = { ...f, [key]: value };
        setF(next);
        setFilterError("");
        if (key === "q") {
            clearTimeout(debounce.current);
            debounce.current = setTimeout(() => go(next), 350); // wait until typing pauses
            return;
        }
        if (next.from && next.to && next.from > next.to) {
            setFilterError("The start date must be on or before the end date.");
            return;
        }
        go(next);
    };

    const clearFilters = () => {
        const empty: Filters = {
            q: "",
            status_id: "",
            category_id: "",
            province_id: "",
            office_id: "",
            from: "",
            to: "",
        };
        setF(empty);
        setFilterError("");
        go(empty);
    };

    // ---- Success / error toast ----
    const [toast, setToast] = useState<{
        text: string;
        type: "success" | "error";
    } | null>(null);
    const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    );

    const showToast = (text: string, type: "success" | "error" = "success") => {
        clearTimeout(toastTimer.current);
        setToast({ text, type });
        toastTimer.current = setTimeout(
            () => setToast(null),
            type === "error" ? 7000 : 4500,
        );
    };

    // Server message if there is one, otherwise the default text
    const okMsg = (res: any, fallback: string) =>
        res?.props?.flash?.success || fallback;
    const failMsg = (errs: Record<string, string>, fallback: string) =>
        errs.form || errs.message || fallback;

    // Show the server's flash message (e.g. "Complaint deleted." after the redirect)
    const flash: string | undefined = page.props.flash?.success;
    useEffect(() => {
        if (flash) showToast(flash);
    }, [flash]);

    // Catch server crashes, expired sessions, permission errors, network loss
    useEffect(() => {
        const offHttp = router.on("httpException", (event: any) => {
            event.preventDefault();
            const s = event.detail?.response?.status;
            showToast(
                s === 403
                    ? "You do not have permission to do that."
                    : s === 404
                      ? "The page or record could not be found."
                      : s === 419
                        ? "Your session expired. Reload the page and try again."
                        : s === 429
                          ? "Too many requests. Please wait a moment and try again."
                          : "Something went wrong on the server. Please try again.",
                "error",
            );
        });
        const offNetwork = router.on("networkError", (event: any) => {
            event.preventDefault();
            showToast(
                "Network problem. Check your connection and try again.",
                "error",
            );
        });
        return () => {
            offHttp();
            offNetwork();
            clearTimeout(toastTimer.current);
            clearTimeout(debounce.current);
        };
    }, []);

    // ---- Record-complaint modal ----
    const [open, setOpen] = useState(false);
    const form = useForm({
        title: "",
        category_id: "",
        priority: "normal",
        description: "",
        received_channel: "",
        received_at: "",
        incident_datetime: "",
        target_date: "",
        province_id: "",
        municipality: "",
        barangay: "",
        specific_location: "",
        is_anonymous: false,
        complainant_name: "",
        complainant_contact: "",
        complainant_email: "",
    });
    const { data, setData, errors } = form;

    const openForm = () => {
        form.reset();
        form.clearErrors();
        setData("received_at", nowLocal());
        setOpen(true);
    };
    const closeForm = () => setOpen(false);

    // Lock page scroll and close on Escape while the modal is open
    useEffect(() => {
        if (!open) return;
        document.body.classList.add("overflow-hidden");
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeForm();
        document.addEventListener("keydown", onKey);
        return () => {
            document.body.classList.remove("overflow-hidden");
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (form.processing) return; // blocks duplicate submissions
        form.post("/admin/complaints", {
            preserveScroll: true,
            onSuccess: (res) => {
                closeForm();
                form.reset();
                showToast(okMsg(res, "Complaint recorded successfully."));
            },
            onError: (errs) =>
                showToast(
                    failMsg(
                        errs,
                        "Could not save the complaint. Please fix the highlighted fields.",
                    ),
                    "error",
                ),
            // on validation errors the modal stays open and keeps what was typed
        });
    };

    const toggleAnonymous = (checked: boolean) => {
        form.setData((d) => ({
            ...d,
            is_anonymous: checked,
            ...(checked
                ? {
                      complainant_name: "",
                      complainant_contact: "",
                      complainant_email: "",
                  }
                : {}),
        }));
    };

    const err = (k: keyof typeof errors) => errors[k] as string | undefined;
    const bad = (k: keyof typeof errors) => (errors[k] ? true : undefined);
    const hasErrors = Object.keys(errors).length > 0;

    const start = complaints.total
        ? (complaints.current_page - 1) * complaints.per_page + 1
        : 0;
    const end = Math.min(
        complaints.current_page * complaints.per_page,
        complaints.total,
    );

    return (
        <AdminLayout title="Complaints">
            <Head title="DENR RDAC IV-A – Complaints" />

            {/* Toolbar */}
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <div className="relative order-1 min-w-0 flex-1 basis-full sm:basis-64 md:max-w-md">
                        <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <label htmlFor="q" className="sr-only">
                            Search complaints
                        </label>
                        <input
                            id="q"
                            type="search"
                            className={`${fieldCls} pl-10`}
                            placeholder="Search reference, subject or location"
                            value={f.q}
                            onChange={(e) => setFilter("q", e.target.value)}
                        />
                    </div>

                    {/* Filter toggle (mobile / tablet-portrait only) */}
                    <button
                        type="button"
                        onClick={() => setShowFilters((v) => !v)}
                        aria-expanded={showFilters}
                        aria-controls="filterPanel"
                        className="relative order-2 inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:ring-4 focus:ring-green-200 focus:outline-none md:hidden"
                    >
                        <SlidersHorizontal className="h-4 w-4" />
                        Filters
                        {activeFilters > 0 && (
                            <span className="rounded-full bg-[#15803d] px-1.5 py-0.5 text-[10px] leading-none font-semibold text-white">
                                {activeFilters}
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={openForm}
                        className="order-3 inline-flex flex-1 items-center justify-center rounded-xl bg-[#15803d] px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-white hover:bg-[#0f3d2e] focus:ring-4 focus:ring-green-200 focus:outline-none sm:flex-none md:ml-auto"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Record complaint
                    </button>
                </div>

                <div
                    id="filterPanel"
                    className={`${showFilters ? "grid" : "hidden"} grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid md:grid-cols-3 xl:grid-cols-6`}
                >
                    <Field label="Status" htmlFor="f_status">
                        <Select
                            id="f_status"
                            className={fieldCls}
                            value={f.status_id}
                            onChange={(e) =>
                                setFilter("status_id", e.target.value)
                            }
                        >
                            <option value="">All statuses</option>
                            {options.statuses.map((o) => (
                                <option key={o.status_id} value={o.status_id}>
                                    {o.status_name}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Category" htmlFor="f_category">
                        <Select
                            id="f_category"
                            className={fieldCls}
                            value={f.category_id}
                            onChange={(e) =>
                                setFilter("category_id", e.target.value)
                            }
                        >
                            <option value="">All categories</option>
                            {options.categories.map((o) => (
                                <option
                                    key={o.category_id}
                                    value={o.category_id}
                                >
                                    {o.category_name}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Province" htmlFor="f_province">
                        <Select
                            id="f_province"
                            className={fieldCls}
                            value={f.province_id}
                            onChange={(e) =>
                                setFilter("province_id", e.target.value)
                            }
                        >
                            <option value="">All provinces</option>
                            {options.provinces.map((o) => (
                                <option
                                    key={o.province_id}
                                    value={o.province_id}
                                >
                                    {o.province_name}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Office" htmlFor="f_office">
                        <Select
                            id="f_office"
                            className={fieldCls}
                            value={f.office_id}
                            onChange={(e) =>
                                setFilter("office_id", e.target.value)
                            }
                        >
                            <option value="">All offices</option>
                            <option value="none">Not yet assigned</option>
                            {options.offices.map((o) => (
                                <option key={o.office_id} value={o.office_id}>
                                    {o.office_name}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Received from" htmlFor="f_from">
                        <input
                            id="f_from"
                            type="date"
                            className={fieldCls}
                            value={f.from}
                            max={f.to || TODAY}
                            onChange={(e) => setFilter("from", e.target.value)}
                        />
                    </Field>
                    <Field label="Received to" htmlFor="f_to">
                        <input
                            id="f_to"
                            type="date"
                            className={fieldCls}
                            value={f.to}
                            min={f.from || undefined}
                            max={TODAY}
                            onChange={(e) => setFilter("to", e.target.value)}
                        />
                    </Field>
                </div>

                <button
                    type="button"
                    onClick={clearFilters}
                    className="py-1 text-sm text-slate-500 underline hover:text-slate-800"
                >
                    Clear filters
                </button>
            </section>

            {/* Filter error */}
            {(filterError || serverFilterError) && (
                <div
                    role="alert"
                    className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:px-5"
                >
                    {filterError || serverFilterError}
                </div>
            )}

            {/* Results */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {/* Desktop / tablet: table */}
                <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                                {[
                                    "Reference",
                                    "Subject",
                                    "Location",
                                    "Office",
                                    "Status",
                                    "Priority",
                                    "Received",
                                ].map((h) => (
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
                            {complaints.data.length ? (
                                complaints.data.map((r) => (
                                    <tr
                                        key={r.complaint_id}
                                        className="border-b border-slate-100 hover:bg-slate-50"
                                    >
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <Link
                                                href={`/admin/complaints/${r.complaint_id}`}
                                                className="font-semibold text-[#15803d] hover:underline"
                                            >
                                                {r.reference_no}
                                            </Link>
                                        </td>
                                        <td className="max-w-[16rem] px-4 py-3 lg:max-w-xs">
                                            <p className="truncate">
                                                {r.title}
                                            </p>
                                            <p className="truncate text-xs text-slate-400">
                                                {r.category_name ||
                                                    "Uncategorized"}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                                            {locationOf(r)}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                                            {r.office_name ||
                                                "Not yet assigned"}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[r.status_code] ?? "bg-slate-100 text-slate-700"}`}
                                            >
                                                {r.status_name}
                                            </span>
                                            {Number(r.is_overdue) === 1 && (
                                                <span className="ml-1 text-xs font-semibold text-red-700">
                                                    Overdue
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_CLS[r.priority] ?? ""}`}
                                            >
                                                {cap(r.priority)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-500">
                                            {fmt(r.received_at)}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="py-12 text-center text-slate-400"
                                    >
                                        No complaints match these filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile: cards */}
                <ul className="divide-y divide-slate-100 md:hidden">
                    {complaints.data.length ? (
                        complaints.data.map((r) => (
                            <li key={r.complaint_id}>
                                <Link
                                    href={`/admin/complaints/${r.complaint_id}`}
                                    className={`block border-l-4 px-4 py-3.5 active:bg-slate-50 ${PRIORITY_EDGE[r.priority] ?? "border-l-slate-200"}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <span className="text-sm font-semibold break-all text-[#15803d]">
                                            {r.reference_no}
                                        </span>
                                        <span
                                            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_CLS[r.priority] ?? ""}`}
                                        >
                                            {cap(r.priority)}
                                        </span>
                                    </div>

                                    <p className="mt-1.5 line-clamp-2 text-sm font-medium text-slate-800">
                                        {r.title}
                                    </p>
                                    <p className="mt-0.5 truncate text-xs text-slate-400">
                                        {r.category_name || "Uncategorized"}
                                    </p>

                                    <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[r.status_code] ?? "bg-slate-100 text-slate-700"}`}
                                        >
                                            {r.status_name}
                                        </span>
                                        {Number(r.is_overdue) === 1 && (
                                            <span className="text-xs font-semibold text-red-700">
                                                Overdue
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-2.5 flex items-end justify-between gap-2">
                                        <dl className="min-w-0 space-y-1 text-xs text-slate-500">
                                            <div className="flex items-center gap-1.5">
                                                <dt className="sr-only">
                                                    Location
                                                </dt>
                                                <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                                <dd className="truncate">
                                                    {locationOf(r)}
                                                </dd>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <dt className="sr-only">
                                                    Office
                                                </dt>
                                                <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                                <dd className="truncate">
                                                    {r.office_name ||
                                                        "Not yet assigned"}
                                                </dd>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <dt className="sr-only">
                                                    Received
                                                </dt>
                                                <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                                <dd>{fmt(r.received_at)}</dd>
                                            </div>
                                        </dl>
                                        <ChevronRight
                                            className="h-5 w-5 shrink-0 text-slate-300"
                                            aria-hidden="true"
                                        />
                                    </div>
                                </Link>
                            </li>
                        ))
                    ) : (
                        <li className="px-4 py-12 text-center text-sm text-slate-400">
                            No complaints match these filters.
                        </li>
                    )}
                </ul>

                {/* Pagination */}
                <div className="flex flex-col items-center gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:justify-between">
                    <p>
                        {complaints.total
                            ? `Showing ${start}–${end} of ${complaints.total.toLocaleString()}`
                            : "0 results"}
                    </p>
                    <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
                        <button
                            type="button"
                            disabled={complaints.current_page <= 1}
                            onClick={() => go(f, complaints.current_page - 1)}
                            className="rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:py-1.5"
                        >
                            Previous
                        </button>
                        <span className="text-center">
                            Page {complaints.current_page} of{" "}
                            {complaints.last_page}
                        </span>
                        <button
                            type="button"
                            disabled={
                                complaints.current_page >= complaints.last_page
                            }
                            onClick={() => go(f, complaints.current_page + 1)}
                            className="rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:py-1.5"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </section>

            {/* Toast */}
            {toast && (
                <div
                    role={toast.type === "error" ? "alert" : "status"}
                    aria-live={toast.type === "error" ? "assertive" : "polite"}
                    className={`fixed inset-x-3 bottom-3 z-[70] flex items-start gap-2 rounded-xl px-4 py-3 text-sm text-white shadow-lg sm:inset-x-auto sm:right-5 sm:bottom-5 sm:max-w-sm ${toast.type === "error" ? "bg-red-700" : "bg-[#0f3d2e]"}`}
                >
                    {toast.type === "error" ? (
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-300" />
                    )}
                    <span>{toast.text}</span>
                </div>
            )}

            {/* Record complaint modal (full-screen sheet on mobile) */}
            {open && (
                <div
                    className="fixed inset-0 z-50 overflow-y-auto bg-black/50"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="modalTitle"
                    onClick={closeForm}
                >
                    <div className="flex min-h-full items-start justify-center sm:p-8">
                        <div
                            className="flex min-h-dvh w-full max-w-3xl flex-col bg-white shadow-2xl sm:min-h-0 sm:rounded-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:rounded-t-2xl sm:px-6 sm:py-4">
                                <h2
                                    id="modalTitle"
                                    className="text-lg text-[#0f3d2e] sm:text-xl"
                                    style={serif}
                                >
                                    Record a complaint
                                </h2>
                                <button
                                    type="button"
                                    onClick={closeForm}
                                    aria-label="Close"
                                    className="h-10 w-10 rounded-lg text-slate-500 hover:bg-slate-100 sm:h-9 sm:w-9"
                                >
                                    <X className="mx-auto h-5 w-5 sm:h-4 sm:w-4" />
                                </button>
                            </div>

                            <form
                                onSubmit={submit}
                                noValidate
                                className="flex flex-1 flex-col"
                            >
                                <div className="flex-1 space-y-6 px-4 py-5 sm:px-6">
                                    {hasErrors && (
                                        <div
                                            role="alert"
                                            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                                        >
                                            {(errors as Record<string, string>)
                                                .form ||
                                                "Please fix the highlighted fields."}
                                        </div>
                                    )}

                                    <fieldset className="min-w-0 space-y-4">
                                        <legend className="mb-1 font-semibold text-slate-700">
                                            Complaint details
                                        </legend>
                                        <Field
                                            label={
                                                <>
                                                    Title or subject
                                                    <Req />
                                                </>
                                            }
                                            htmlFor="title"
                                            error={err("title")}
                                        >
                                            <input
                                                id="title"
                                                className={fieldCls}
                                                maxLength={200}
                                                aria-invalid={bad("title")}
                                                value={data.title}
                                                onChange={(e) =>
                                                    setData(
                                                        "title",
                                                        e.target.value,
                                                    )
                                                }
                                                autoFocus
                                            />
                                        </Field>
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <Field
                                                label="Category"
                                                htmlFor="category_id"
                                                error={err("category_id")}
                                            >
                                                <Select
                                                    id="category_id"
                                                    className={fieldCls}
                                                    value={data.category_id}
                                                    onChange={(e) =>
                                                        setData(
                                                            "category_id",
                                                            e.target.value,
                                                        )
                                                    }
                                                >
                                                    <option value="">
                                                        Select category
                                                    </option>
                                                    {options.categories.map(
                                                        (o) => (
                                                            <option
                                                                key={
                                                                    o.category_id
                                                                }
                                                                value={
                                                                    o.category_id
                                                                }
                                                            >
                                                                {
                                                                    o.category_name
                                                                }
                                                            </option>
                                                        ),
                                                    )}
                                                </Select>
                                            </Field>
                                            <Field
                                                label="Priority"
                                                htmlFor="priority"
                                                error={err("priority")}
                                            >
                                                <Select
                                                    id="priority"
                                                    className={fieldCls}
                                                    value={data.priority}
                                                    onChange={(e) =>
                                                        setData(
                                                            "priority",
                                                            e.target.value,
                                                        )
                                                    }
                                                >
                                                    <option value="low">
                                                        Low
                                                    </option>
                                                    <option value="normal">
                                                        Normal
                                                    </option>
                                                    <option value="high">
                                                        High
                                                    </option>
                                                    <option value="urgent">
                                                        Urgent
                                                    </option>
                                                </Select>
                                            </Field>
                                        </div>
                                        <Field
                                            label={
                                                <>
                                                    Description
                                                    <Req />
                                                </>
                                            }
                                            htmlFor="description"
                                            error={err("description")}
                                        >
                                            <textarea
                                                id="description"
                                                rows={5}
                                                className={fieldCls}
                                                aria-invalid={bad(
                                                    "description",
                                                )}
                                                value={data.description}
                                                onChange={(e) =>
                                                    setData(
                                                        "description",
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </Field>
                                    </fieldset>

                                    <fieldset className="min-w-0 space-y-4">
                                        <legend className="mb-1 font-semibold text-slate-700">
                                            How and when it was received
                                        </legend>
                                        <div className="grid gap-4 sm:grid-cols-3">
                                            <Field
                                                label={
                                                    <>
                                                        Channel
                                                        <Req />
                                                    </>
                                                }
                                                htmlFor="received_channel"
                                                error={err("received_channel")}
                                            >
                                                <Select
                                                    id="received_channel"
                                                    className={fieldCls}
                                                    aria-invalid={bad(
                                                        "received_channel",
                                                    )}
                                                    value={
                                                        data.received_channel
                                                    }
                                                    onChange={(e) =>
                                                        setData(
                                                            "received_channel",
                                                            e.target.value,
                                                        )
                                                    }
                                                >
                                                    <option value="">
                                                        Select channel
                                                    </option>
                                                    <option value="phone">
                                                        Phone call
                                                    </option>
                                                    <option value="email">
                                                        Email
                                                    </option>
                                                    <option value="letter">
                                                        Letter
                                                    </option>
                                                    <option value="walk_in">
                                                        Walk-in
                                                    </option>
                                                    <option value="referral">
                                                        Referral
                                                    </option>
                                                    <option value="social_media">
                                                        Social media
                                                    </option>
                                                    <option value="other">
                                                        Other
                                                    </option>
                                                </Select>
                                            </Field>
                                            <Field
                                                label={
                                                    <>
                                                        Date and time received
                                                        <Req />
                                                    </>
                                                }
                                                htmlFor="received_at"
                                                error={err("received_at")}
                                            >
                                                <input
                                                    id="received_at"
                                                    type="datetime-local"
                                                    className={fieldCls}
                                                    max={nowLocal()}
                                                    aria-invalid={bad(
                                                        "received_at",
                                                    )}
                                                    value={data.received_at}
                                                    onChange={(e) =>
                                                        setData(
                                                            "received_at",
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                            </Field>
                                            <Field
                                                label="Date and time of incident"
                                                htmlFor="incident_datetime"
                                                error={err("incident_datetime")}
                                                hint="Leave blank if unknown."
                                            >
                                                <input
                                                    id="incident_datetime"
                                                    type="datetime-local"
                                                    className={fieldCls}
                                                    max={nowLocal()}
                                                    aria-invalid={bad(
                                                        "incident_datetime",
                                                    )}
                                                    value={
                                                        data.incident_datetime
                                                    }
                                                    onChange={(e) =>
                                                        setData(
                                                            "incident_datetime",
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                            </Field>
                                        </div>
                                        <div className="sm:w-1/3">
                                            <Field
                                                label="Target response date"
                                                htmlFor="target_date"
                                                error={err("target_date")}
                                            >
                                                <input
                                                    id="target_date"
                                                    type="date"
                                                    className={fieldCls}
                                                    min={TODAY}
                                                    aria-invalid={bad(
                                                        "target_date",
                                                    )}
                                                    value={data.target_date}
                                                    onChange={(e) =>
                                                        setData(
                                                            "target_date",
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                            </Field>
                                        </div>
                                    </fieldset>

                                    <fieldset className="min-w-0 space-y-4">
                                        <legend className="mb-1 font-semibold text-slate-700">
                                            Incident location
                                        </legend>
                                        <div className="grid gap-4 sm:grid-cols-3">
                                            <Field
                                                label="Province"
                                                htmlFor="province_id"
                                                error={err("province_id")}
                                            >
                                                <Select
                                                    id="province_id"
                                                    className={fieldCls}
                                                    value={data.province_id}
                                                    onChange={(e) =>
                                                        setData(
                                                            "province_id",
                                                            e.target.value,
                                                        )
                                                    }
                                                >
                                                    <option value="">
                                                        Unknown
                                                    </option>
                                                    {options.provinces.map(
                                                        (o) => (
                                                            <option
                                                                key={
                                                                    o.province_id
                                                                }
                                                                value={
                                                                    o.province_id
                                                                }
                                                            >
                                                                {
                                                                    o.province_name
                                                                }
                                                            </option>
                                                        ),
                                                    )}
                                                </Select>
                                            </Field>
                                            <Field
                                                label="Municipality or city"
                                                htmlFor="municipality"
                                                error={err("municipality")}
                                            >
                                                <input
                                                    id="municipality"
                                                    className={fieldCls}
                                                    maxLength={100}
                                                    value={data.municipality}
                                                    onChange={(e) =>
                                                        setData(
                                                            "municipality",
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                            </Field>
                                            <Field
                                                label="Barangay"
                                                htmlFor="barangay"
                                                error={err("barangay")}
                                            >
                                                <input
                                                    id="barangay"
                                                    className={fieldCls}
                                                    maxLength={100}
                                                    value={data.barangay}
                                                    onChange={(e) =>
                                                        setData(
                                                            "barangay",
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                            </Field>
                                        </div>
                                        <Field
                                            label="Specific location"
                                            htmlFor="specific_location"
                                            error={err("specific_location")}
                                        >
                                            <input
                                                id="specific_location"
                                                className={fieldCls}
                                                maxLength={255}
                                                placeholder="Landmark, sitio, or other details"
                                                value={data.specific_location}
                                                onChange={(e) =>
                                                    setData(
                                                        "specific_location",
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </Field>
                                    </fieldset>

                                    <fieldset className="min-w-0 space-y-4">
                                        <legend className="mb-1 font-semibold text-slate-700">
                                            Complainant
                                        </legend>
                                        <label className="flex items-center gap-2 py-1 text-sm text-slate-600">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-slate-300"
                                                checked={data.is_anonymous}
                                                onChange={(e) =>
                                                    toggleAnonymous(
                                                        e.target.checked,
                                                    )
                                                }
                                            />
                                            Anonymous complainant
                                        </label>
                                        <div className="grid gap-4 sm:grid-cols-3">
                                            <Field
                                                label="Name"
                                                htmlFor="complainant_name"
                                                error={err("complainant_name")}
                                            >
                                                <input
                                                    id="complainant_name"
                                                    className={fieldCls}
                                                    maxLength={150}
                                                    autoComplete="off"
                                                    disabled={data.is_anonymous}
                                                    value={
                                                        data.complainant_name
                                                    }
                                                    onChange={(e) =>
                                                        setData(
                                                            "complainant_name",
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                            </Field>
                                            <Field
                                                label="Contact number"
                                                htmlFor="complainant_contact"
                                                error={err(
                                                    "complainant_contact",
                                                )}
                                            >
                                                <input
                                                    id="complainant_contact"
                                                    type="tel"
                                                    inputMode="numeric"
                                                    pattern="[0-9]{11}"
                                                    className={fieldCls}
                                                    maxLength={11}
                                                    autoComplete="off"
                                                    placeholder="09XXXXXXXXX"
                                                    disabled={data.is_anonymous}
                                                    value={
                                                        data.complainant_contact
                                                    }
                                                    onChange={(e) => {
                                                        const value =
                                                            e.target.value
                                                                .replace(
                                                                    /\D/g,
                                                                    "",
                                                                )
                                                                .slice(0, 11);

                                                        setData(
                                                            "complainant_contact",
                                                            value,
                                                        );
                                                    }}
                                                />
                                            </Field>
                                            <Field
                                                label="Email"
                                                htmlFor="complainant_email"
                                                error={err("complainant_email")}
                                            >
                                                <input
                                                    id="complainant_email"
                                                    type="email"
                                                    className={fieldCls}
                                                    maxLength={150}
                                                    autoComplete="off"
                                                    disabled={data.is_anonymous}
                                                    value={
                                                        data.complainant_email
                                                    }
                                                    onChange={(e) =>
                                                        setData(
                                                            "complainant_email",
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                            </Field>
                                        </div>
                                        <p className="text-xs text-slate-400">
                                            Collect only the personal details
                                            that are needed to act on the
                                            complaint.
                                        </p>
                                    </fieldset>
                                </div>

                                {/* Sticky action bar so Save is always reachable on phones */}
                                <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:flex-row sm:justify-end sm:gap-3 sm:rounded-b-2xl sm:px-6 sm:pb-3">
                                    <button
                                        type="button"
                                        onClick={closeForm}
                                        className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={form.processing}
                                        className="rounded-xl bg-[#15803d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f3d2e] focus:ring-4 focus:ring-green-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {form.processing
                                            ? "Saving..."
                                            : "Save complaint"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
