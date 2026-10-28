// resources/js/pages/admin/complaints/show.tsx
import { Head, Link, router, useForm, usePage } from "@inertiajs/react";
import { ArrowLeft, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import AdminLayout from "@/layouts/admin-layout";

// ───────── Types ─────────
type Opt = { id: number; name: string; requires_reason?: boolean };

type Complaint = {
    complaint_id: number;
    reference_no: string;
    title: string;
    description: string;
    status_id: number;
    status_code: string;
    status_name: string;
    priority: string;
    category_name: string | null;
    received_channel: string;
    received_at: string;
    incident_datetime: string | null;
    target_date: string | null;
    office_name: string | null;
    recorder_name: string | null;
    updated_at: string;
    resolution_summary: string | null;
    is_overdue: boolean;
    // location
    specific_location: string | null;
    barangay: string | null;
    municipality: string | null;
    province_name: string | null;
    // complainant
    is_anonymous: boolean;
    complainant_name: string | null;
    complainant_contact: string | null;
    complainant_email: string | null;
};

type HistoryItem = {
    id: number;
    from_name: string | null;
    to_name: string;
    reason: string | null;
    full_name: string | null;
    created_at: string;
};
type AssignmentItem = {
    id: number;
    assignment_type: "primary" | "secondary";
    is_current: boolean;
    reason: string | null;
    target_date: string | null;
    created_at: string;
    acknowledged_at: string | null;
    from_name: string | null;
    to_name: string;
    by_name: string | null;
};
type ActionItem = {
    id: number;
    action_type: string;
    details: string;
    action_date: string;
    full_name: string | null;
    office_name: string | null;
    photos: {
        document_id: number;
        original_name: string | null;
        url: string;
    }[];
};

type EditValues = {
    title: string;
    category_id: string;
    priority: string;
    description: string;
    received_channel: string;
    received_at: string; // YYYY-MM-DDTHH:mm
    incident_datetime: string; // YYYY-MM-DDTHH:mm
    target_date: string; // YYYY-MM-DD
    province_id: string;
    municipality: string;
    barangay: string;
    specific_location: string;
    is_anonymous: boolean;
    complainant_name: string;
    complainant_contact: string;
    complainant_email: string;
};

type Props = {
    complaint: Complaint;
    history: HistoryItem[];
    assignments: AssignmentItem[];
    actions: ActionItem[];
    transitions: Opt[];
    assignOffices: { office_id: number; office_name: string }[];
    categories: { category_id: number; category_name: string }[];
    provinces: { province_id: number; province_name: string }[];
    edit: EditValues;
    permissions: {
        can_assign: boolean;
        can_update: boolean;
        photos_required: boolean;
        can_edit: boolean;
        can_delete: boolean;
        is_owner: boolean;
        restrict_reason: string | null;
    };
};

type Errs = Record<string, string | undefined>;

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
const CHANNEL: Record<string, string> = {
    phone: "Phone call",
    email: "Email",
    letter: "Letter",
    walk_in: "Walk-in",
    referral: "Referral",
    social_media: "Social media",
    other: "Other",
};

const ACTION_LABELS: Record<string, string> = {
    inspection: "Inspection",
    investigation_update: "Investigation update",
    finding: "Finding",
    recommendation: "Recommendation",
    info_request: "Information request",
    rdac_remark: "RDAC remark",
    follow_up: "Follow-up",
    internal_remark: "Internal remark",
};

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const dt = (s?: string | null) =>
    s
        ? new Date(s.replace(" ", "T")).toLocaleString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
          })
        : "—";
const d = (s?: string | null) =>
    s
        ? new Date(`${s.slice(0, 10)}T00:00:00`).toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
          })
        : "—";

const pad = (n: number) => String(n).padStart(2, "0");
const nowLocal = () => {
    const n = new Date();
    return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}T${pad(n.getHours())}:${pad(n.getMinutes())}`;
};

const fieldCls =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-green-200 disabled:bg-slate-100 aria-[invalid=true]:border-red-500";
const lblCls = "mb-1 block text-xs font-semibold text-slate-500";
const panelCls = "rounded-2xl border border-slate-200 bg-white p-6";
const primaryBtn =
    "w-full rounded-xl bg-[#15803d] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0f3d2e] focus:outline-none focus:ring-4 focus:ring-green-200 disabled:cursor-not-allowed disabled:opacity-60";

const inv = (errors: Errs, k: string) => (errors[k] ? true : undefined);

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

function Info({ label, value }: { label: string; value?: string | null }) {
    return (
        <div>
            <dt className="text-xs font-semibold text-slate-500">{label}</dt>
            <dd className="mt-0.5 break-words text-sm">{value || "—"}</dd>
        </div>
    );
}

function FormBanner({ errors }: { errors: Errs }) {
    if (!Object.keys(errors).length) return null;
    return (
        <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
            {errors.form ?? "Please fix the highlighted fields."}
        </p>
    );
}

/** Modal shell: locks page scroll and closes on Escape. */
function Modal({
    titleId,
    title,
    onClose,
    maxWidth = "max-w-3xl",
    children,
}: {
    titleId: string;
    title: string;
    onClose: () => void;
    maxWidth?: string;
    children: ReactNode;
}) {
    useEffect(() => {
        document.body.classList.add("overflow-hidden");
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        document.addEventListener("keydown", onKey);
        return () => {
            document.body.classList.remove("overflow-hidden");
            document.removeEventListener("keydown", onKey);
        };
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/50"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
        >
            <div className="flex min-h-full items-start justify-center p-4 sm:p-8">
                <div
                    className={`w-full ${maxWidth} rounded-2xl bg-white shadow-2xl`}
                >
                    <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                        <h2
                            id={titleId}
                            className="text-xl text-[#0f3d2e]"
                            style={serif}
                        >
                            {title}
                        </h2>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="h-9 w-9 rounded-lg text-slate-500 hover:bg-slate-100"
                        >
                            <X className="mx-auto h-4 w-4" />
                        </button>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}

// ───────── Page ─────────
export default function ComplaintShow({
    complaint: c,
    history,
    assignments,
    actions,
    transitions,
    assignOffices,
    categories,
    provinces,
    edit,
    permissions: p,
}: Props) {
    const page = usePage<any>();
    const base = `/admin/complaints/${c.complaint_id}`;

    // ---- Toast from the server's flash message ----
    const [toast, setToast] = useState("");
    const flash: string | undefined = page.props.flash?.success;
    useEffect(() => {
        if (!flash) return;
        setToast(flash);
        const t = setTimeout(() => setToast(""), 4500);
        return () => clearTimeout(t);
    }, [flash]);

    // ---- Update status ----
    const statusForm = useForm({ to_status_id: "", reason: "" });
    const submitStatus = (e: React.FormEvent) => {
        e.preventDefault();
        if (statusForm.processing) return;
        statusForm.clearErrors();
        if (!statusForm.data.to_status_id)
            statusForm.setError("to_status_id", "Choose the next status.");
        if (!statusForm.data.reason.trim())
            statusForm.setError("reason", "Reason is required.");
        if (!statusForm.data.to_status_id || !statusForm.data.reason.trim())
            return;
        statusForm.transform((v) => ({
            ...v,
            from_status_id: c.status_id,
        }));

        statusForm.post(`${base}/status`, {
            preserveScroll: true,
            onSuccess: () => statusForm.reset(),
        });
    };

    // ---- Assign office ----
    const assignForm = useForm({
        office_id: "",
        assignment_type: "primary",
        target_date: c.target_date?.slice(0, 10) ?? "",
        reason: "",
    });
    const submitAssign = (e: React.FormEvent) => {
        e.preventDefault();
        if (assignForm.processing) return;
        assignForm.clearErrors();
        if (!assignForm.data.office_id)
            assignForm.setError("office_id", "Select an office.");
        if (!assignForm.data.reason.trim())
            assignForm.setError("reason", "Reason is required.");
        if (!assignForm.data.office_id || !assignForm.data.reason.trim())
            return;
        assignForm.post(`${base}/assign`, {
            preserveScroll: true,
            onSuccess: () => assignForm.reset("office_id", "reason"),
        });
    };

    // ---- Investigation update / additional information ----
    const updateForm = useForm<{ details: string; photos: File[] }>({
        details: "",
        photos: [],
    });
    const [fileKey, setFileKey] = useState(0); // remounts the file input to clear it
    const submitUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (updateForm.processing) return;
        updateForm.clearErrors();
        if (!updateForm.data.details.trim())
            updateForm.setError(
                "details",
                "Describe the investigation update.",
            );
        if (p.photos_required && !updateForm.data.photos.length)
            updateForm.setError(
                "photos",
                "Attach at least one photo of the investigation.",
            );
        if (
            !updateForm.data.details.trim() ||
            (p.photos_required && !updateForm.data.photos.length)
        )
            return;
        updateForm.post(`${base}/updates`, {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                updateForm.reset();
                setFileKey((k) => k + 1);
            },
        });
    };
    const forInfo = c.status_code === "for_info";

    // ---- Edit modal ----
    const [editOpen, setEditOpen] = useState(false);
    const editForm = useForm<EditValues>(edit);
    const openEdit = () => {
        editForm.setData(edit);
        editForm.clearErrors();
        setEditOpen(true);
    };
    const closeEdit = () => setEditOpen(false);
    const submitEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editForm.processing) return;
        editForm.put(base, {
            preserveScroll: true,
            onSuccess: closeEdit,
        });
    };
    const toggleAnonymous = (checked: boolean) =>
        editForm.setData((v) => ({
            ...v,
            is_anonymous: checked,
            ...(checked
                ? {
                      complainant_name: "",
                      complainant_contact: "",
                      complainant_email: "",
                  }
                : {}),
        }));
    const ee = editForm.errors as Errs;
    const ed = editForm.data;

    // ---- Delete confirmation ----
    const [delOpen, setDelOpen] = useState(false);
    const [delBusy, setDelBusy] = useState(false);
    const [delError, setDelError] = useState("");
    const confirmDelete = () => {
        router.delete(base, {
            onStart: () => {
                setDelBusy(true);
                setDelError("");
            },
            onError: (errs) =>
                setDelError(
                    Object.values(errs)[0] ??
                        "This complaint cannot be deleted.",
                ),
            onFinish: () => setDelBusy(false),
        });
    };

    const location = [
        c.specific_location,
        c.barangay ? `Brgy. ${c.barangay}` : "",
        c.municipality,
        c.province_name,
    ]
        .filter(Boolean)
        .join(", ");

    const saving =
        statusForm.processing || assignForm.processing || updateForm.processing;
    const showRestrictNote =
        p.is_owner && !p.can_edit && !p.can_delete && p.restrict_reason;

    return (
        <AdminLayout title={c.reference_no}>
            <Head title={`DENR RDAC IV-A – ${c.reference_no}`} />

            <Link
                href="/admin/complaints"
                className="inline-flex items-center text-sm text-slate-500 hover:text-slate-800"
            >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back to complaints
            </Link>

            {/* Summary */}
            <section className={panelCls}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#15803d]">
                            {c.reference_no}
                        </p>
                        <h2
                            className="mt-1 break-words text-2xl text-[#0f3d2e]"
                            style={serif}
                        >
                            {c.title}
                        </h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span
                            className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_CLS[c.status_code] ?? "bg-slate-100 text-slate-700"}`}
                        >
                            {c.status_name}
                        </span>
                        <span
                            className={`rounded-full px-3 py-1 text-sm font-medium ${PRIORITY_CLS[c.priority] ?? ""}`}
                        >
                            {cap(c.priority)} priority
                        </span>
                        {c.is_overdue && (
                            <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-800">
                                Overdue
                            </span>
                        )}
                        {p.can_edit && (
                            <button
                                type="button"
                                onClick={openEdit}
                                className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Edit
                            </button>
                        )}
                        {p.can_delete && (
                            <button
                                type="button"
                                onClick={() => {
                                    setDelError("");
                                    setDelOpen(true);
                                }}
                                className="rounded-xl border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                            >
                                Delete
                            </button>
                        )}
                    </div>
                </div>

                <dl className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Info label="Category" value={c.category_name} />
                    <Info
                        label="Received through"
                        value={
                            CHANNEL[c.received_channel] ?? c.received_channel
                        }
                    />
                    <Info label="Date received" value={dt(c.received_at)} />
                    <Info
                        label="Date of incident"
                        value={
                            c.incident_datetime
                                ? dt(c.incident_datetime)
                                : "Unknown"
                        }
                    />
                    <Info
                        label="Responsible office"
                        value={c.office_name ?? "Not yet assigned"}
                    />
                    <Info
                        label="Target response date"
                        value={d(c.target_date)}
                    />
                    <Info label="Recorded by" value={c.recorder_name} />
                    <Info label="Last updated" value={dt(c.updated_at)} />
                </dl>

                {c.resolution_summary && (
                    <div className="mt-4">
                        <p className="text-xs font-semibold text-slate-500">
                            Resolution summary
                        </p>
                        <p className="mt-0.5 whitespace-pre-line break-words text-sm">
                            {c.resolution_summary}
                        </p>
                    </div>
                )}
            </section>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Left column */}
                <div className="space-y-6 lg:col-span-2">
                    <section className={panelCls}>
                        <h3 className="mb-3 font-semibold text-slate-700">
                            Description
                        </h3>
                        <p className="whitespace-pre-line break-words text-sm">
                            {c.description}
                        </p>
                    </section>

                    <section className={panelCls}>
                        <h3 className="mb-3 font-semibold text-slate-700">
                            Actions and investigation updates
                        </h3>
                        {actions.length ? (
                            <ul className="space-y-4">
                                {actions.map((a) => (
                                    <li
                                        key={a.id}
                                        className="border-l-2 border-green-500 pl-4"
                                    >
                                        <p className="text-sm font-semibold">
                                            {ACTION_LABELS[a.action_type] ??
                                                a.action_type}
                                        </p>
                                        <p className="mt-1 whitespace-pre-line break-words text-sm">
                                            {a.details}
                                        </p>
                                        {a.photos.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {a.photos.map((ph) => (
                                                    <a
                                                        key={ph.document_id}
                                                        href={ph.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="block"
                                                    >
                                                        <img
                                                            src={ph.url}
                                                            alt={
                                                                ph.original_name ||
                                                                "Investigation photo"
                                                            }
                                                            className="h-24 w-24 rounded-lg border border-slate-200 object-cover"
                                                        />
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                        <p className="mt-1 text-xs text-slate-400">
                                            {a.full_name ?? "Unknown"}
                                            {a.office_name
                                                ? ` · ${a.office_name}`
                                                : ""}{" "}
                                            · {dt(a.action_date)}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-slate-400">
                                No actions have been recorded yet.
                            </p>
                        )}
                    </section>

                    <section className={panelCls}>
                        <h3 className="mb-3 font-semibold text-slate-700">
                            Assignment history
                        </h3>
                        {assignments.length ? (
                            <ul className="space-y-4">
                                {assignments.map((a) => (
                                    <li
                                        key={a.id}
                                        className={`border-l-2 pl-4 ${a.is_current ? "border-green-500" : "border-slate-300"}`}
                                    >
                                        <p className="text-sm font-semibold">
                                            {a.from_name
                                                ? `${a.from_name} → `
                                                : ""}
                                            {a.to_name}
                                            <span className="ml-2 text-xs font-medium text-slate-500">
                                                {cap(a.assignment_type)}
                                                {a.is_current
                                                    ? " · current"
                                                    : " · ended"}
                                            </span>
                                        </p>
                                        {a.reason && (
                                            <p className="mt-1 break-words text-sm">
                                                {a.reason}
                                            </p>
                                        )}
                                        <p className="mt-1 text-xs text-slate-400">
                                            Assigned by {a.by_name ?? "Unknown"}{" "}
                                            · {dt(a.created_at)}
                                            {a.target_date
                                                ? ` · target ${d(a.target_date)}`
                                                : ""}
                                            {a.acknowledged_at
                                                ? ` · acknowledged ${dt(a.acknowledged_at)}`
                                                : ""}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-slate-400">
                                This complaint has not been assigned to an
                                office yet.
                            </p>
                        )}
                    </section>
                </div>

                {/* Right column */}
                <div className="space-y-6">
                    <section className={panelCls}>
                        <h3 className="mb-3 font-semibold text-slate-700">
                            Location
                        </h3>
                        <p className="break-words text-sm">
                            {location || "Unknown"}
                        </p>
                    </section>

                    <section className={panelCls}>
                        <h3 className="mb-3 font-semibold text-slate-700">
                            Complainant
                        </h3>
                        {c.is_anonymous ? (
                            <p className="text-sm text-slate-500">
                                Anonymous complaint.
                            </p>
                        ) : (
                            <dl className="space-y-3">
                                <Info label="Name" value={c.complainant_name} />
                                <Info
                                    label="Contact number"
                                    value={c.complainant_contact}
                                />
                                <Info
                                    label="Email"
                                    value={c.complainant_email}
                                />
                            </dl>
                        )}
                    </section>

                    {showRestrictNote && (
                        <p className="text-xs text-slate-500">
                            {p.restrict_reason}
                        </p>
                    )}

                    {/* Investigation update / additional info */}
                    {p.can_update && (
                        <section className={panelCls}>
                            <h3 className="mb-2 font-semibold text-slate-700">
                                {forInfo
                                    ? "Additional information"
                                    : "Investigation update"}
                            </h3>
                            <p className="mb-3 text-xs text-slate-500">
                                {forInfo
                                    ? "Submit supplementary information or supporting photos without changing the original complaint."
                                    : "While this complaint is under investigation, add a written update and attach photos (JPEG, PNG, WebP or GIF, up to 8 files, 5 MB each)."}
                            </p>
                            <form
                                onSubmit={submitUpdate}
                                noValidate
                                className="space-y-3"
                            >
                                <Field
                                    label="Update"
                                    htmlFor="update_details"
                                    error={updateForm.errors.details}
                                >
                                    <textarea
                                        id="update_details"
                                        rows={4}
                                        maxLength={4000}
                                        className={fieldCls}
                                        aria-invalid={inv(
                                            updateForm.errors,
                                            "details",
                                        )}
                                        value={updateForm.data.details}
                                        onChange={(e) =>
                                            updateForm.setData(
                                                "details",
                                                e.target.value,
                                            )
                                        }
                                    />
                                </Field>
                                <Field
                                    label="Photos"
                                    htmlFor="update_photos"
                                    error={updateForm.errors.photos}
                                >
                                    <input
                                        key={fileKey}
                                        id="update_photos"
                                        type="file"
                                        multiple
                                        accept="image/jpeg,image/png,image/webp,image/gif"
                                        className={fieldCls}
                                        aria-invalid={inv(
                                            updateForm.errors,
                                            "photos",
                                        )}
                                        onChange={(e) =>
                                            updateForm.setData(
                                                "photos",
                                                Array.from(
                                                    e.target.files ?? [],
                                                ),
                                            )
                                        }
                                    />
                                </Field>
                                <FormBanner errors={updateForm.errors} />
                                <button
                                    type="submit"
                                    disabled={updateForm.processing}
                                    className={primaryBtn}
                                >
                                    {p.photos_required
                                        ? "Save update with photos"
                                        : "Save additional information"}
                                </button>
                            </form>
                        </section>
                    )}

                    {/* Update status */}
                    {transitions.length > 0 ? (
                        <section className={panelCls}>
                            <h3 className="mb-3 font-semibold text-slate-700">
                                Update status
                            </h3>
                            <p className="mb-3 text-xs text-slate-500">
                                Allowed next statuses for RDAC. Assigning an
                                office is the only way to move a complaint to
                                Assigned.
                            </p>
                            <form
                                onSubmit={submitStatus}
                                noValidate
                                className="space-y-3"
                            >
                                <Field
                                    label="Next status"
                                    htmlFor="to_status_id"
                                    error={statusForm.errors.to_status_id}
                                >
                                    <select
                                        id="to_status_id"
                                        className={fieldCls}
                                        aria-invalid={inv(
                                            statusForm.errors,
                                            "to_status_id",
                                        )}
                                        value={statusForm.data.to_status_id}
                                        onChange={(e) =>
                                            statusForm.setData(
                                                "to_status_id",
                                                e.target.value,
                                            )
                                        }
                                    >
                                        <option value="">
                                            Select next status
                                        </option>
                                        {transitions.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.name}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                                <Field
                                    label={
                                        <>
                                            Reason
                                            <Req />
                                        </>
                                    }
                                    htmlFor="status_reason"
                                    error={statusForm.errors.reason}
                                >
                                    <textarea
                                        id="status_reason"
                                        rows={3}
                                        maxLength={500}
                                        className={fieldCls}
                                        aria-invalid={inv(
                                            statusForm.errors,
                                            "reason",
                                        )}
                                        value={statusForm.data.reason}
                                        onChange={(e) =>
                                            statusForm.setData(
                                                "reason",
                                                e.target.value,
                                            )
                                        }
                                    />
                                </Field>
                                <FormBanner errors={statusForm.errors} />
                                <button
                                    type="submit"
                                    disabled={statusForm.processing}
                                    className={primaryBtn}
                                >
                                    Update status
                                </button>
                            </form>
                        </section>
                    ) : (
                        <p className="text-sm text-slate-400">
                            No status change is available from here.{" "}
                            {c.status_code === "for_assignment"
                                ? "Assign an office to move this complaint to Assigned."
                                : c.status_code === "closed"
                                  ? "This complaint is closed."
                                  : "Use “Assign office” if you need to change the responsible office."}
                        </p>
                    )}

                    {/* Assign office */}
                    {p.can_assign && (
                        <section className={panelCls}>
                            <h3 className="mb-3 font-semibold text-slate-700">
                                Assign office
                            </h3>
                            <p className="mb-3 text-xs text-slate-500">
                                Primary office owns the case. Coordinating
                                offices can be added after a primary office is
                                set. Reassignment requires a reason.
                            </p>
                            <form
                                onSubmit={submitAssign}
                                noValidate
                                className="space-y-3"
                            >
                                <Field
                                    label="Office"
                                    htmlFor="office_id"
                                    error={assignForm.errors.office_id}
                                >
                                    <select
                                        id="office_id"
                                        className={fieldCls}
                                        aria-invalid={inv(
                                            assignForm.errors,
                                            "office_id",
                                        )}
                                        value={assignForm.data.office_id}
                                        onChange={(e) =>
                                            assignForm.setData(
                                                "office_id",
                                                e.target.value,
                                            )
                                        }
                                    >
                                        <option value="">Select office</option>
                                        {assignOffices.map((o) => (
                                            <option
                                                key={o.office_id}
                                                value={o.office_id}
                                            >
                                                {o.office_name}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                                <Field
                                    label="Assignment type"
                                    htmlFor="assignment_type"
                                    error={assignForm.errors.assignment_type}
                                >
                                    <select
                                        id="assignment_type"
                                        className={fieldCls}
                                        value={assignForm.data.assignment_type}
                                        onChange={(e) =>
                                            assignForm.setData(
                                                "assignment_type",
                                                e.target.value,
                                            )
                                        }
                                    >
                                        <option value="primary">
                                            Primary (responsible office)
                                        </option>
                                        <option value="secondary">
                                            Coordinating office
                                        </option>
                                    </select>
                                </Field>
                                <Field
                                    label="Target response date"
                                    htmlFor="assign_target"
                                    error={assignForm.errors.target_date}
                                >
                                    <input
                                        id="assign_target"
                                        type="date"
                                        className={fieldCls}
                                        value={assignForm.data.target_date}
                                        onChange={(e) =>
                                            assignForm.setData(
                                                "target_date",
                                                e.target.value,
                                            )
                                        }
                                    />
                                </Field>
                                <Field
                                    label={
                                        <>
                                            Reason
                                            <Req />
                                        </>
                                    }
                                    htmlFor="assign_reason"
                                    error={assignForm.errors.reason}
                                >
                                    <textarea
                                        id="assign_reason"
                                        rows={3}
                                        maxLength={500}
                                        className={fieldCls}
                                        aria-invalid={inv(
                                            assignForm.errors,
                                            "reason",
                                        )}
                                        value={assignForm.data.reason}
                                        onChange={(e) =>
                                            assignForm.setData(
                                                "reason",
                                                e.target.value,
                                            )
                                        }
                                    />
                                </Field>
                                <FormBanner errors={assignForm.errors} />
                                <button
                                    type="submit"
                                    disabled={assignForm.processing}
                                    className={primaryBtn}
                                >
                                    Save assignment
                                </button>
                            </form>
                        </section>
                    )}

                    {/* Status history */}
                    <section className={panelCls}>
                        <h3 className="mb-3 font-semibold text-slate-700">
                            Status history
                        </h3>
                        {history.length ? (
                            <ul className="space-y-4">
                                {history.map((h) => (
                                    <li
                                        key={h.id}
                                        className="border-l-2 border-slate-300 pl-4"
                                    >
                                        <p className="text-sm font-semibold">
                                            {h.from_name
                                                ? `${h.from_name} → `
                                                : ""}
                                            {h.to_name}
                                        </p>
                                        {h.reason && (
                                            <p className="mt-0.5 break-words text-sm">
                                                {h.reason}
                                            </p>
                                        )}
                                        <p className="mt-1 text-xs text-slate-400">
                                            {h.full_name ?? "Unknown"} ·{" "}
                                            {dt(h.created_at)}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-slate-400">
                                No status changes yet.
                            </p>
                        )}
                    </section>
                </div>
            </div>

            {/* Waiting overlay while emails are being sent */}
            {saving && (
                <div
                    role="status"
                    aria-live="polite"
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
                >
                    <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-sm shadow-2xl">
                        <p className="text-lg text-[#0f3d2e]" style={serif}>
                            {statusForm.processing
                                ? "Updating complaint status"
                                : assignForm.processing
                                  ? "Saving office assignment"
                                  : "Saving investigation update"}
                        </p>
                        <p className="mt-2 text-slate-600">
                            Please keep this page open. The system is saving
                            your changes and sending notification emails to the
                            concerned staff.
                        </p>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div
                    role="status"
                    className="fixed bottom-5 right-5 z-50 rounded-xl bg-[#0f3d2e] px-4 py-3 text-sm text-white shadow-lg"
                >
                    {toast}
                </div>
            )}

            {/* Delete confirmation */}
            {delOpen && (
                <Modal
                    titleId="delTitle"
                    title="Delete this complaint?"
                    maxWidth="max-w-md"
                    onClose={() => !delBusy && setDelOpen(false)}
                >
                    <div className="space-y-4 px-6 py-5">
                        <p className="text-sm text-slate-600">
                            The record will be hidden but kept for audit
                            history. Assignments and investigation records are
                            not erased.
                        </p>
                        {delError && (
                            <p
                                role="alert"
                                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                            >
                                {delError}
                            </p>
                        )}
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setDelOpen(false)}
                                disabled={delBusy}
                                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDelete}
                                disabled={delBusy}
                                className="rounded-xl bg-red-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
                            >
                                {delBusy ? "Deleting..." : "Delete complaint"}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Edit modal */}
            {editOpen && (
                <Modal
                    titleId="editTitle"
                    title="Edit complaint"
                    onClose={closeEdit}
                >
                    <form
                        onSubmit={submitEdit}
                        noValidate
                        className="space-y-6 px-6 py-5"
                    >
                        <FormBanner errors={ee} />
                        <p className="text-sm text-slate-500">
                            You can change the original complaint details only
                            while it is still Recorded or For Initial Review.
                            Status, assignments, and investigation records are
                            not changed here.
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
                                htmlFor="edit_title"
                                error={ee.title}
                            >
                                <input
                                    id="edit_title"
                                    className={fieldCls}
                                    maxLength={200}
                                    aria-invalid={inv(ee, "title")}
                                    value={ed.title}
                                    onChange={(e) =>
                                        editForm.setData(
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
                                    htmlFor="edit_category_id"
                                    error={ee.category_id}
                                >
                                    <select
                                        id="edit_category_id"
                                        className={fieldCls}
                                        value={ed.category_id}
                                        onChange={(e) =>
                                            editForm.setData(
                                                "category_id",
                                                e.target.value,
                                            )
                                        }
                                    >
                                        <option value="">
                                            Select category
                                        </option>
                                        {categories.map((o) => (
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
                                    htmlFor="edit_priority"
                                    error={ee.priority}
                                >
                                    <select
                                        id="edit_priority"
                                        className={fieldCls}
                                        value={ed.priority}
                                        onChange={(e) =>
                                            editForm.setData(
                                                "priority",
                                                e.target.value,
                                            )
                                        }
                                    >
                                        <option value="low">Low</option>
                                        <option value="normal">Normal</option>
                                        <option value="high">High</option>
                                        <option value="urgent">Urgent</option>
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
                                htmlFor="edit_description"
                                error={ee.description}
                            >
                                <textarea
                                    id="edit_description"
                                    rows={5}
                                    className={fieldCls}
                                    aria-invalid={inv(ee, "description")}
                                    value={ed.description}
                                    onChange={(e) =>
                                        editForm.setData(
                                            "description",
                                            e.target.value,
                                        )
                                    }
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
                                    htmlFor="edit_received_channel"
                                    error={ee.received_channel}
                                >
                                    <select
                                        id="edit_received_channel"
                                        className={fieldCls}
                                        aria-invalid={inv(
                                            ee,
                                            "received_channel",
                                        )}
                                        value={ed.received_channel}
                                        onChange={(e) =>
                                            editForm.setData(
                                                "received_channel",
                                                e.target.value,
                                            )
                                        }
                                    >
                                        <option value="">Select channel</option>
                                        {Object.entries(CHANNEL).map(
                                            ([k, v]) => (
                                                <option key={k} value={k}>
                                                    {v}
                                                </option>
                                            ),
                                        )}
                                    </select>
                                </Field>
                                <Field
                                    label={
                                        <>
                                            Date and time received
                                            <Req />
                                        </>
                                    }
                                    htmlFor="edit_received_at"
                                    error={ee.received_at}
                                >
                                    <input
                                        id="edit_received_at"
                                        type="datetime-local"
                                        className={fieldCls}
                                        max={nowLocal()}
                                        aria-invalid={inv(ee, "received_at")}
                                        value={ed.received_at}
                                        onChange={(e) =>
                                            editForm.setData(
                                                "received_at",
                                                e.target.value,
                                            )
                                        }
                                    />
                                </Field>
                                <Field
                                    label="Date and time of incident"
                                    htmlFor="edit_incident_datetime"
                                    error={ee.incident_datetime}
                                    hint="Leave blank if unknown."
                                >
                                    <input
                                        id="edit_incident_datetime"
                                        type="datetime-local"
                                        className={fieldCls}
                                        max={nowLocal()}
                                        aria-invalid={inv(
                                            ee,
                                            "incident_datetime",
                                        )}
                                        value={ed.incident_datetime}
                                        onChange={(e) =>
                                            editForm.setData(
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
                                    htmlFor="edit_target_date"
                                    error={ee.target_date}
                                >
                                    <input
                                        id="edit_target_date"
                                        type="date"
                                        className={fieldCls}
                                        value={ed.target_date}
                                        onChange={(e) =>
                                            editForm.setData(
                                                "target_date",
                                                e.target.value,
                                            )
                                        }
                                    />
                                </Field>
                            </div>
                        </fieldset>

                        <fieldset className="space-y-4">
                            <legend className="mb-1 font-semibold text-slate-700">
                                Incident location
                            </legend>
                            <div className="grid gap-4 sm:grid-cols-3">
                                <Field
                                    label="Province"
                                    htmlFor="edit_province_id"
                                    error={ee.province_id}
                                >
                                    <select
                                        id="edit_province_id"
                                        className={fieldCls}
                                        value={ed.province_id}
                                        onChange={(e) =>
                                            editForm.setData(
                                                "province_id",
                                                e.target.value,
                                            )
                                        }
                                    >
                                        <option value="">Unknown</option>
                                        {provinces.map((o) => (
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
                                    htmlFor="edit_municipality"
                                    error={ee.municipality}
                                >
                                    <input
                                        id="edit_municipality"
                                        className={fieldCls}
                                        maxLength={100}
                                        value={ed.municipality}
                                        onChange={(e) =>
                                            editForm.setData(
                                                "municipality",
                                                e.target.value,
                                            )
                                        }
                                    />
                                </Field>
                                <Field
                                    label="Barangay"
                                    htmlFor="edit_barangay"
                                    error={ee.barangay}
                                >
                                    <input
                                        id="edit_barangay"
                                        className={fieldCls}
                                        maxLength={100}
                                        value={ed.barangay}
                                        onChange={(e) =>
                                            editForm.setData(
                                                "barangay",
                                                e.target.value,
                                            )
                                        }
                                    />
                                </Field>
                            </div>
                            <Field
                                label="Specific location"
                                htmlFor="edit_specific_location"
                                error={ee.specific_location}
                            >
                                <input
                                    id="edit_specific_location"
                                    className={fieldCls}
                                    maxLength={255}
                                    placeholder="Landmark, sitio, or other details"
                                    value={ed.specific_location}
                                    onChange={(e) =>
                                        editForm.setData(
                                            "specific_location",
                                            e.target.value,
                                        )
                                    }
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
                                    checked={ed.is_anonymous}
                                    onChange={(e) =>
                                        toggleAnonymous(e.target.checked)
                                    }
                                />
                                Anonymous complainant
                            </label>
                            {!ed.is_anonymous && (
                                <div className="grid gap-4 sm:grid-cols-3">
                                    <Field
                                        label="Name"
                                        htmlFor="edit_complainant_name"
                                        error={ee.complainant_name}
                                    >
                                        <input
                                            id="edit_complainant_name"
                                            className={fieldCls}
                                            maxLength={150}
                                            autoComplete="off"
                                            value={ed.complainant_name}
                                            onChange={(e) =>
                                                editForm.setData(
                                                    "complainant_name",
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </Field>
                                    <Field
                                        label="Contact number"
                                        htmlFor="edit_complainant_contact"
                                        error={ee.complainant_contact}
                                    >
                                        <input
                                            id="edit_complainant_contact"
                                            className={fieldCls}
                                            maxLength={100}
                                            autoComplete="off"
                                            value={ed.complainant_contact}
                                            onChange={(e) =>
                                                editForm.setData(
                                                    "complainant_contact",
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </Field>
                                    <Field
                                        label="Email"
                                        htmlFor="edit_complainant_email"
                                        error={ee.complainant_email}
                                    >
                                        <input
                                            id="edit_complainant_email"
                                            type="email"
                                            className={fieldCls}
                                            maxLength={150}
                                            autoComplete="off"
                                            value={ed.complainant_email}
                                            onChange={(e) =>
                                                editForm.setData(
                                                    "complainant_email",
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </Field>
                                </div>
                            )}
                        </fieldset>

                        <div className="flex justify-end gap-3 border-t border-slate-200 pt-2">
                            <button
                                type="button"
                                onClick={closeEdit}
                                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={editForm.processing}
                                className="rounded-xl bg-[#15803d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f3d2e] focus:outline-none focus:ring-4 focus:ring-green-200 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {editForm.processing
                                    ? "Saving..."
                                    : "Save changes"}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </AdminLayout>
    );
}
