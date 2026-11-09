import { Head, Link, router, useForm, usePage } from "@inertiajs/react";
import { AlertCircle, CheckCircle2, Plus, Search, X } from "lucide-react";
import {
    type ChangeEvent,
    type FormEvent,
    type ReactNode,
    useEffect,
    useRef,
    useState,
} from "react";
// ASSUMPTION: a field-office layout exists. Change this import to your real one.
import FieldLayout from "@/layouts/FieldLayouts";

// ───────── Types ─────────
type Complaint = {
    complaint_id: number;
    reference_no: string;
    title: string;
    category_name: string | null;
    municipality: string | null;
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
    from: string;
    to: string;
};
type Options = {
    statuses: { status_id: number; status_name: string }[];
    categories: { category_id: number; category_name: string }[];
    provinces: { province_id: number; province_name: string }[];
};
type OfficeInfo = { name: string; province_id: number | null };

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

const fieldCls =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-green-200 disabled:bg-slate-100 aria-[invalid=true]:border-red-500";
const lblCls = "mb-1 block text-xs font-semibold text-slate-500";

function Field({
    label,
    htmlFor,
    error,
    hint,
    children,
}: {
    label: ReactNode;
    htmlFor: string;
    error?: string;
    hint?: string;
    children: ReactNode;
}) {
    return (
        <div>
            <label htmlFor={htmlFor} className={lblCls}>
                {label}
            </label>
            {children}
            {hint && !error && (
                <p className="mt-1 text-xs text-slate-400">{hint}</p>
            )}
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    );
}
const Req = () => <span className="text-red-600"> *</span>;

const emptyForm = {
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
};
type TextKey = Exclude<keyof typeof emptyForm, "is_anonymous">;

// ───────── Page ─────────
export default function FieldComplaints({
    complaints,
    filters,
    options,
    office,
}: {
    complaints: Paginated;
    filters: Filters;
    options: Options;
    office: OfficeInfo;
}) {
    const page = usePage<any>();
    const TODAY = todayStr();

    // ---- Filters: stored in state, sent to the server as URL parameters ----
    const [f, setF] = useState<Filters>(filters);
    const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    );
    const [filterError, setFilterError] = useState("");
    const serverFilterError =
        page.props.errors?.from || page.props.errors?.to || "";

    const go = (next: Filters, pageNo = 1) => {
        const params: Record<string, string | number> = {};
        (Object.keys(next) as (keyof Filters)[]).forEach((k) => {
            if (next[k]) params[k] = next[k];
        });
        if (pageNo > 1) params.page = pageNo;
        router.get("/field/complaints", params, {
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
        const empty: Filters = { q: "", status_id: "", from: "", to: "" };
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
    // The province starts as the office's own province; reset() brings it back.
    const form = useForm({
        ...emptyForm,
        province_id: office.province_id ? String(office.province_id) : "",
    });
    const { data, setData, errors } = form;
    const errorMap = errors as Record<string, string | undefined>;

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

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (form.processing) return; // blocks duplicate submissions
        form.post("/field/complaints", {
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

    const err = (k: string) => errorMap[k];
    const bad = (k: string) => (errorMap[k] ? true : undefined);
    const hasErrors = Object.keys(errors).length > 0;
    // "form" = a general problem from the server (e.g. office inactive); other keys are field errors
    const bannerText = errorMap.form || "Please fix the highlighted fields.";

    // Props shared by plain text / select / textarea inputs
    const bind = (k: TextKey) => ({
        id: k,
        value: data[k],
        "aria-invalid": bad(k),
        onChange: (
            e: ChangeEvent<
                HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
            >,
        ) => setData(k, e.target.value),
    });

    const start = complaints.total
        ? (complaints.current_page - 1) * complaints.per_page + 1
        : 0;
    const end = Math.min(
        complaints.current_page * complaints.per_page,
        complaints.total,
    );

    return (
        <FieldLayout title="My Complaints">
            <Head title="DENR RDAC IV-A – My Complaints" />

            {/* Toolbar */}
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="relative max-w-md min-w-[16rem] flex-1">
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
                    <button
                        type="button"
                        onClick={openForm}
                        className="rounded-xl bg-[#15803d] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0f3d2e] focus:ring-4 focus:ring-green-200 focus:outline-none"
                    >
                        <Plus className="mr-2 inline h-4 w-4" />
                        Record complaint
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field label="Status" htmlFor="f_status">
                        <select
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
                        </select>
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
                    className="text-sm text-slate-500 underline hover:text-slate-800"
                >
                    Clear filters
                </button>
            </section>

            {/* Filter error */}
            {(filterError || serverFilterError) && (
                <div
                    role="alert"
                    className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700"
                >
                    {filterError || serverFilterError}
                </div>
            )}

            {/* Table */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                                {[
                                    "Reference",
                                    "Subject",
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
                                            {/* The detail page is not part of this port yet */}
                                            <Link
                                                href={`/field/complaints/${r.complaint_id}`}
                                                className="font-semibold text-[#15803d] hover:underline"
                                            >
                                                {r.reference_no}
                                            </Link>
                                        </td>
                                        <td className="max-w-xs px-4 py-3">
                                            <p className="truncate">
                                                {r.title}
                                            </p>
                                            <p className="truncate text-xs text-slate-400">
                                                {r.category_name ||
                                                    "Uncategorized"}
                                            </p>
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
                                        colSpan={5}
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
                        {complaints.total
                            ? `Showing ${start}–${end} of ${complaints.total.toLocaleString()}`
                            : "0 results"}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={complaints.current_page <= 1}
                            onClick={() => go(f, complaints.current_page - 1)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Previous
                        </button>
                        <span>
                            Page {complaints.current_page} of{" "}
                            {complaints.last_page}
                        </span>
                        <button
                            type="button"
                            disabled={
                                complaints.current_page >= complaints.last_page
                            }
                            onClick={() => go(f, complaints.current_page + 1)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
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
                    className={`fixed right-5 bottom-5 z-[70] flex max-w-sm items-start gap-2 rounded-xl px-4 py-3 text-sm text-white shadow-lg ${toast.type === "error" ? "bg-red-700" : "bg-[#0f3d2e]"}`}
                >
                    {toast.type === "error" ? (
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-300" />
                    )}
                    <span>{toast.text}</span>
                </div>
            )}
            {/* Record complaint modal */}
            {open && (
                <div
                    className="fixed inset-0 z-50 overflow-y-auto bg-black/50"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="modalTitle"
                >
                    <div className="flex min-h-full items-start justify-center p-4 sm:p-8">
                        <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
                            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                                <h2
                                    id="modalTitle"
                                    className="text-xl text-[#0f3d2e]"
                                    style={serif}
                                >
                                    Record a complaint
                                </h2>
                                <button
                                    type="button"
                                    onClick={closeForm}
                                    aria-label="Close"
                                    className="h-9 w-9 rounded-lg text-slate-500 hover:bg-slate-100"
                                >
                                    <X className="mx-auto h-4 w-4" />
                                </button>
                            </div>

                            <form
                                onSubmit={submit}
                                noValidate
                                className="space-y-6 px-6 py-5"
                            >
                                {hasErrors && (
                                    <div
                                        role="alert"
                                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                                    >
                                        {bannerText}
                                    </div>
                                )}

                                <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
                                    This complaint will be recorded as coming
                                    from{" "}
                                    <span className="font-semibold">
                                        {office.name}
                                    </span>{" "}
                                    and assigned to your office.
                                </p>

                                <fieldset className="space-y-4">
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
                                            className={fieldCls}
                                            maxLength={200}
                                            autoFocus
                                            {...bind("title")}
                                        />
                                    </Field>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <Field
                                            label="Category"
                                            htmlFor="category_id"
                                            error={err("category_id")}
                                        >
                                            <select
                                                className={fieldCls}
                                                {...bind("category_id")}
                                            >
                                                <option value="">
                                                    Select category
                                                </option>
                                                {options.categories.map((o) => (
                                                    <option
                                                        key={o.category_id}
                                                        value={o.category_id}
                                                    >
                                                        {o.category_name}
                                                    </option>
                                                ))}
                                            </select>
                                        </Field>
                                        <Field
                                            label="Priority"
                                            htmlFor="priority"
                                            error={err("priority")}
                                        >
                                            <select
                                                className={fieldCls}
                                                {...bind("priority")}
                                            >
                                                <option value="low">Low</option>
                                                <option value="normal">
                                                    Normal
                                                </option>
                                                <option value="high">
                                                    High
                                                </option>
                                                <option value="urgent">
                                                    Urgent
                                                </option>
                                            </select>
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
                                            rows={5}
                                            className={fieldCls}
                                            {...bind("description")}
                                        />
                                    </Field>
                                </fieldset>

                                <fieldset className="space-y-4">
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
                                            <select
                                                className={fieldCls}
                                                {...bind("received_channel")}
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
                                            </select>
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
                                                type="datetime-local"
                                                className={fieldCls}
                                                max={nowLocal()}
                                                {...bind("received_at")}
                                            />
                                        </Field>
                                        <Field
                                            label="Date and time of incident"
                                            htmlFor="incident_datetime"
                                            error={err("incident_datetime")}
                                            hint="Leave blank if unknown."
                                        >
                                            <input
                                                type="datetime-local"
                                                className={fieldCls}
                                                max={nowLocal()}
                                                {...bind("incident_datetime")}
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
                                                type="date"
                                                className={fieldCls}
                                                {...bind("target_date")}
                                            />
                                        </Field>
                                    </div>
                                </fieldset>

                                <fieldset className="space-y-4">
                                    <legend className="mb-1 font-semibold text-slate-700">
                                        Incident location
                                    </legend>
                                    <p className="text-xs text-slate-400">
                                        Complaints are accepted only for
                                        incidents within Region IV-A
                                        (CALABARZON).
                                    </p>
                                    <div className="grid gap-4 sm:grid-cols-3">
                                        <Field
                                            label="Province"
                                            htmlFor="province_id"
                                            error={err("province_id")}
                                        >
                                            <select
                                                className={fieldCls}
                                                {...bind("province_id")}
                                            >
                                                <option value="">
                                                    Unknown
                                                </option>
                                                {options.provinces.map((o) => (
                                                    <option
                                                        key={o.province_id}
                                                        value={o.province_id}
                                                    >
                                                        {o.province_name}
                                                    </option>
                                                ))}
                                            </select>
                                        </Field>
                                        <Field
                                            label="Municipality or city"
                                            htmlFor="municipality"
                                            error={err("municipality")}
                                        >
                                            <input
                                                className={fieldCls}
                                                maxLength={100}
                                                {...bind("municipality")}
                                            />
                                        </Field>
                                        <Field
                                            label="Barangay"
                                            htmlFor="barangay"
                                            error={err("barangay")}
                                        >
                                            <input
                                                className={fieldCls}
                                                maxLength={100}
                                                {...bind("barangay")}
                                            />
                                        </Field>
                                    </div>
                                    <Field
                                        label="Specific location"
                                        htmlFor="specific_location"
                                        error={err("specific_location")}
                                    >
                                        <input
                                            className={fieldCls}
                                            maxLength={255}
                                            placeholder="Landmark, sitio, or other details"
                                            {...bind("specific_location")}
                                        />
                                    </Field>
                                </fieldset>

                                <fieldset className="space-y-4">
                                    <legend className="mb-1 font-semibold text-slate-700">
                                        Complainant
                                    </legend>
                                    <label className="flex items-center gap-2 text-sm text-slate-600">
                                        <input
                                            type="checkbox"
                                            className="rounded border-slate-300"
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
                                                className={fieldCls}
                                                maxLength={150}
                                                autoComplete="off"
                                                disabled={data.is_anonymous}
                                                {...bind("complainant_name")}
                                            />
                                        </Field>
                                        <Field
                                            label="Contact number"
                                            htmlFor="complainant_contact"
                                            error={err("complainant_contact")}
                                        >
                                            <input
                                                className={fieldCls}
                                                maxLength={100}
                                                autoComplete="off"
                                                disabled={data.is_anonymous}
                                                {...bind("complainant_contact")}
                                            />
                                        </Field>
                                        <Field
                                            label="Email"
                                            htmlFor="complainant_email"
                                            error={err("complainant_email")}
                                        >
                                            <input
                                                type="email"
                                                className={fieldCls}
                                                maxLength={150}
                                                autoComplete="off"
                                                disabled={data.is_anonymous}
                                                {...bind("complainant_email")}
                                            />
                                        </Field>
                                    </div>
                                    <p className="text-xs text-slate-400">
                                        Collect only the personal details that
                                        are needed to act on the complaint.
                                    </p>
                                </fieldset>

                                <div className="flex justify-end gap-3 border-t border-slate-200 pt-2">
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
        </FieldLayout>
    );
}
