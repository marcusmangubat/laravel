import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, Loader2, X } from 'lucide-react';
import {
    type ChangeEvent,
    type FormEvent,
    type ReactNode,
    useEffect,
    useState,
} from 'react';
// Same layout as the complaints list page. Change if yours differs.
import FieldLayout from '@/layouts/FieldLayouts';

// ───────── Types ─────────
type Complaint = {
    complaint_id: number;
    reference_no: string;
    title: string;
    description: string;
    status_id: number;
    status_code: string;
    status_name: string;
    priority: string;
    category_id: number | null;
    category_name: string | null;
    received_channel: string;
    received_at: string;
    incident_datetime: string | null;
    target_date: string | null;
    province_id: number | null;
    province_name: string | null;
    municipality: string | null;
    barangay: string | null;
    specific_location: string | null;
    is_outside_region: number | boolean;
    is_anonymous: number | boolean;
    complainant_name: string | null;
    complainant_contact: string | null;
    complainant_email: string | null;
    office_name: string | null;
    updated_at: string;
    is_overdue: number | boolean;
};
type HistoryRow = {
    created_at: string;
    reason: string | null;
    from_name: string | null;
    to_name: string;
    full_name: string | null;
};
type AssignmentRow = {
    assignment_type: string;
    is_current: boolean;
    reason: string | null;
    target_date: string | null;
    created_at: string;
    acknowledged_at: string | null;
    from_name: string | null;
    to_name: string;
    by_name: string | null;
};
type ActionRow = {
    id: number;
    action_type: string;
    details: string;
    action_date: string;
    full_name: string | null;
    office_name: string | null;
    photos: { document_id: number; original_name: string | null }[];
};
type View = {
    transitions: { id: number; name: string; requires_reason: boolean }[];
    can_acknowledge: boolean;
    can_post_update: boolean;
    photos_required: boolean;
    can_edit: boolean;
    can_delete: boolean;
    is_owner: boolean;
    restrict_reason: string | null;
    history: HistoryRow[];
    assignments: AssignmentRow[];
    actions: ActionRow[];
};
type Options = {
    categories: { category_id: number; category_name: string }[];
    provinces: { province_id: number; province_name: string }[];
};

// ───────── Constants / helpers ─────────
const serif = { fontFamily: "'DM Serif Display', serif" };

const STATUS_CLS: Record<string, string> = {
    recorded: 'bg-slate-100 text-slate-700',
    for_review: 'bg-sky-100 text-sky-800',
    for_assignment: 'bg-amber-100 text-amber-800',
    assigned: 'bg-blue-100 text-blue-800',
    under_investigation: 'bg-indigo-100 text-indigo-800',
    for_info: 'bg-orange-100 text-orange-800',
    for_rdac_review: 'bg-purple-100 text-purple-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-emerald-100 text-emerald-900',
};
const PRIORITY_CLS: Record<string, string> = {
    urgent: 'bg-red-100 text-red-800',
    high: 'bg-orange-100 text-orange-800',
    normal: 'bg-slate-100 text-slate-700',
    low: 'bg-slate-50 text-slate-500',
};
const CHANNELS: Record<string, string> = {
    phone: 'Phone call',
    email: 'Email',
    letter: 'Letter',
    walk_in: 'Walk-in',
    referral: 'Referral',
    social_media: 'Social media',
    other: 'Other',
};
const WAIT: Record<
    'status' | 'update' | 'ack',
    { title: string; steps: string[] }
> = {
    status: {
        title: 'Updating complaint status',
        steps: [
            'Saving the new status',
            'Sending notification emails to the concerned staff',
        ],
    },
    update: {
        title: 'Saving investigation update',
        steps: [
            'Saving the update and photos',
            'Sending notification emails to the concerned staff',
        ],
    },
    ack: {
        title: 'Acknowledging assignment',
        steps: [
            'Recording the acknowledgement',
            'Sending notification emails to RDAC',
        ],
    },
};

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const parse = (s: string) =>
    new Date(s.length <= 10 ? `${s}T00:00` : s.replace(' ', 'T'));
const fmt = (s: string | null) =>
    s
        ? parse(s).toLocaleString('en-PH', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
          })
        : '—';
const fmtDate = (s: string | null) =>
    s
        ? parse(s).toLocaleDateString('en-PH', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
          })
        : '—';
const toLocalInput = (s: string | null) =>
    s ? s.replace(' ', 'T').slice(0, 16) : '';

const pad = (n: number) => String(n).padStart(2, '0');
const nowLocal = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fieldCls =
    'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-green-200 disabled:bg-slate-100 aria-[invalid=true]:border-red-500';
const lblCls = 'mb-1 block text-xs font-semibold text-slate-500';
const card = 'rounded-2xl border border-slate-200 bg-white p-6';
const h3Cls = 'mb-3 font-semibold text-slate-700';
const primaryBtn =
    'w-full rounded-xl bg-[#15803d] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0f3d2e] focus:outline-none focus:ring-4 focus:ring-green-200 disabled:cursor-not-allowed disabled:opacity-60';

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

function Info({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div>
            <dt className="text-xs font-semibold text-slate-500">{label}</dt>
            <dd className="mt-0.5 text-sm break-words">{value || '—'}</dd>
        </div>
    );
}

const Banner = ({ children }: { children: ReactNode }) => (
    <p
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
    >
        {children}
    </p>
);

const ACTION_LABELS: Record<string, string> = {
    inspection: 'Inspection',
    investigation_update: 'Investigation update',
    finding: 'Finding',
    recommendation: 'Recommendation',
    info_request: 'Information request',
    rdac_remark: 'RDAC remark',
    follow_up: 'Follow-up',
    internal_remark: 'Internal remark',
};

const Empty = ({ children }: { children: ReactNode }) => (
    <p className="text-sm text-slate-400">{children}</p>
);

function HistoryList({ rows }: { rows: HistoryRow[] }) {
    if (!rows.length) return <Empty>No status changes yet.</Empty>;
    return (
        <ul className="space-y-4">
            {rows.map((r, i) => (
                <li key={i} className="border-l-2 border-slate-300 pl-4">
                    <p className="text-sm font-semibold">
                        {r.from_name ? `${r.from_name} → ` : ''}
                        {r.to_name}
                    </p>
                    {r.reason && (
                        <p className="mt-0.5 text-sm break-words">{r.reason}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-400">
                        {r.full_name ?? 'Unknown'} · {fmt(r.created_at)}
                    </p>
                </li>
            ))}
        </ul>
    );
}

function AssignmentList({ rows }: { rows: AssignmentRow[] }) {
    if (!rows.length)
        return (
            <Empty>
                This complaint has not been assigned to an office yet.
            </Empty>
        );
    return (
        <ul className="space-y-4">
            {rows.map((a, i) => (
                <li
                    key={i}
                    className={`border-l-2 pl-4 ${a.is_current ? 'border-green-500' : 'border-slate-300'}`}
                >
                    <p className="text-sm font-semibold">
                        {a.from_name ? `${a.from_name} → ` : ''}
                        {a.to_name}
                        <span className="ml-2 text-xs font-medium text-slate-500">
                            {cap(a.assignment_type)} ·{' '}
                            {a.is_current ? 'current' : 'ended'}
                        </span>
                    </p>
                    {a.reason && (
                        <p className="mt-1 text-sm break-words">{a.reason}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-400">
                        Assigned by {a.by_name ?? 'Unknown'} ·{' '}
                        {fmt(a.created_at)}
                        {a.target_date && ` · target ${fmtDate(a.target_date)}`}
                        {a.acknowledged_at &&
                            ` · acknowledged ${fmt(a.acknowledged_at)}`}
                    </p>
                </li>
            ))}
        </ul>
    );
}

function ActionList({ rows }: { rows: ActionRow[] }) {
    if (!rows.length) return <Empty>No actions have been recorded yet.</Empty>;
    return (
        <ul className="space-y-4">
            {rows.map((a) => (
                <li key={a.id} className="border-l-2 border-green-500 pl-4">
                    <p className="text-sm font-semibold">
                        {ACTION_LABELS[a.action_type] ?? a.action_type}
                    </p>
                    <p className="mt-1 text-sm break-words whitespace-pre-line">
                        {a.details}
                    </p>
                    {a.photos.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {a.photos.map((p) => (
                                <a
                                    key={p.document_id}
                                    href={`/field/documents/${p.document_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block"
                                >
                                    <img
                                        src={`/field/documents/${p.document_id}`}
                                        alt={
                                            p.original_name ||
                                            'Investigation photo'
                                        }
                                        loading="lazy"
                                        className="h-24 w-24 rounded-lg border border-slate-200 object-cover"
                                    />
                                </a>
                            ))}
                        </div>
                    )}
                    <p className="mt-1 text-xs text-slate-400">
                        {a.full_name ?? 'Unknown'}
                        {a.office_name && ` · ${a.office_name}`} ·{' '}
                        {fmt(a.action_date)}
                    </p>
                </li>
            ))}
        </ul>
    );
}

const editInit = (c: Complaint) => ({
    title: c.title ?? '',
    category_id: c.category_id ? String(c.category_id) : '',
    priority: c.priority ?? 'normal',
    description: c.description ?? '',
    received_channel: c.received_channel ?? '',
    received_at: toLocalInput(c.received_at),
    incident_datetime: toLocalInput(c.incident_datetime),
    target_date: c.target_date ? c.target_date.slice(0, 10) : '',
    province_id: c.province_id ? String(c.province_id) : '',
    municipality: c.municipality ?? '',
    barangay: c.barangay ?? '',
    specific_location: c.specific_location ?? '',
    is_anonymous: !!c.is_anonymous,
    complainant_name: c.complainant_name ?? '',
    complainant_contact: c.complainant_contact ?? '',
    complainant_email: c.complainant_email ?? '',
});
type EditData = ReturnType<typeof editInit>;
type TextKey = Exclude<keyof EditData, 'is_anonymous'>;

// ───────── Page ─────────
export default function FieldComplaintView({
    complaint: c,
    view,
    options,
    is_primary,
}: {
    complaint: Complaint;
    view: View;
    options: Options;
    is_primary: boolean;
}) {
    const page = usePage<any>();
    const base = `/field/complaints/${c.complaint_id}`;

    // ---- Toast from the server's flash message ----
    const [toast, setToast] = useState('');
    const flash: string | undefined = page.props.flash?.success;
    useEffect(() => {
        if (!flash) return;
        setToast(flash);
        const t = setTimeout(() => setToast(''), 4500);
        return () => clearTimeout(t);
    }, [flash]);

    // ---- Forms ----
    const ackForm = useForm({});
    const statusForm = useForm({ to_status_id: '', reason: '' });
    const updateForm = useForm<{ details: string; photos: File[] }>({
        details: '',
        photos: [],
    });
    const editForm = useForm<EditData>(editInit(c));
    const [fileKey, setFileKey] = useState(0); // resets the uncontrolled file input

    const errs = (f: { errors: object }) =>
        f.errors as Record<string, string | undefined>;
    const setErrs = (f: any, e: Record<string, string>) => f.setError(e);

    const waitKind: 'status' | 'update' | 'ack' | null = ackForm.processing
        ? 'ack'
        : statusForm.processing
          ? 'status'
          : updateForm.processing
            ? 'update'
            : null;

    const submitAck = (e: FormEvent) => {
        e.preventDefault();
        if (ackForm.processing) return;
        ackForm.clearErrors();
        ackForm.post(`${base}/acknowledge`, { preserveScroll: true });
    };

    const submitStatus = (e: FormEvent) => {
        e.preventDefault();
        if (statusForm.processing) return;
        statusForm.clearErrors();
        if (!statusForm.data.to_status_id) {
            setErrs(statusForm, { form: 'Choose the next status.' });
            return;
        }
        if (!statusForm.data.reason.trim()) {
            setErrs(statusForm, {
                reason: 'Reason is required.',
                form: 'Please fix the highlighted fields.',
            });
            document.getElementById('status_reason')?.focus();
            return;
        }
        // from_status_id lets the server detect a stale page (409 conflict)
        statusForm.transform((d) => ({ ...d, from_status_id: c.status_id }));
        statusForm.post(`${base}/status`, {
            preserveScroll: true,
            onSuccess: () => statusForm.reset(),
        });
    };

    const submitUpdate = (e: FormEvent) => {
        e.preventDefault();
        if (updateForm.processing) return;
        updateForm.clearErrors();
        if (!updateForm.data.details.trim()) {
            setErrs(updateForm, { form: 'Describe the investigation update.' });
            return;
        }
        if (view.photos_required && !updateForm.data.photos.length) {
            setErrs(updateForm, {
                photos: 'Attach at least one photo of the investigation.',
                form: 'Please fix the highlighted fields.',
            });
            return;
        }
        updateForm.post(`${base}/update`, {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                updateForm.reset();
                setFileKey((k) => k + 1);
            },
        });
    };

    // ---- Edit modal ----
    const [editOpen, setEditOpen] = useState(false);
    const openEdit = () => {
        editForm.setData(editInit(c));
        editForm.clearErrors();
        setEditOpen(true);
    };
    const submitEdit = (e: FormEvent) => {
        e.preventDefault();
        if (editForm.processing) return;
        editForm.put(base, {
            preserveScroll: true,
            onSuccess: () => setEditOpen(false),
        });
    };
    const toggleAnonymous = (checked: boolean) =>
        editForm.setData((d) => ({
            ...d,
            is_anonymous: checked,
            ...(checked
                ? {
                      complainant_name: '',
                      complainant_contact: '',
                      complainant_email: '',
                  }
                : {}),
        }));

    const editErr = errs(editForm);
    const bindEdit = (k: TextKey) => ({
        id: `edit_${k}`,
        value: editForm.data[k],
        'aria-invalid': editErr[k] ? (true as const) : undefined,
        onChange: (
            e: ChangeEvent<
                HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
            >,
        ) => editForm.setData(k, e.target.value),
    });

    // ---- Delete confirm ----
    const [confirmDel, setConfirmDel] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const doDelete = () => {
        if (deleting) return;
        setDeleting(true);
        setDeleteError('');
        router.delete(base, {
            onError: (e) =>
                setDeleteError(e.form || 'This complaint cannot be deleted.'),
            onFinish: () => setDeleting(false),
            // on success the controller redirects to the list with a flash message
        });
    };

    // Lock page scroll and close on Escape while a modal is open
    useEffect(() => {
        if (!editOpen && !confirmDel) return;
        document.body.classList.add('overflow-hidden');
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            setEditOpen(false);
            setConfirmDel(false);
        };
        document.addEventListener('keydown', onKey);
        return () => {
            document.body.classList.remove('overflow-hidden');
            document.removeEventListener('keydown', onKey);
        };
    }, [editOpen, confirmDel]);

    // ---- Derived display values ----
    let location = [
        c.specific_location,
        c.barangay ? `Brgy. ${c.barangay}` : '',
        c.municipality,
        c.province_name,
    ]
        .filter(Boolean)
        .join(', ');
    if (c.is_outside_region)
        location = `${location} (outside Region IV-A)`.trim();

    const forInfo = c.status_code === 'for_info';
    const ownerRestricted = view.is_owner && !view.can_edit && !view.can_delete;
    const ackErr = errs(ackForm);
    const stErr = errs(statusForm);
    const upErr = errs(updateForm);
    const edErrCount = Object.keys(editErr).length;

    return (
        <FieldLayout title={c.reference_no}>
            <Head title={`DENR RDAC IV-A – ${c.reference_no}`} />

            <Link
                href="/field/complaints"
                className="inline-flex items-center text-sm text-slate-500 hover:text-slate-800"
            >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back to my complaints
            </Link>

            {/* Header */}
            <section className={card}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#15803d]">
                            {c.reference_no}
                        </p>
                        <h2
                            className="mt-1 text-2xl break-words text-[#0f3d2e]"
                            style={serif}
                        >
                            {c.title}
                        </h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span
                            className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_CLS[c.status_code] ?? 'bg-slate-100 text-slate-700'}`}
                        >
                            {c.status_name}
                        </span>
                        <span
                            className={`rounded-full px-3 py-1 text-sm font-medium ${PRIORITY_CLS[c.priority] ?? ''}`}
                        >
                            {cap(c.priority)} priority
                        </span>
                        {Number(c.is_overdue) === 1 && (
                            <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-800">
                                Overdue
                            </span>
                        )}
                        {view.can_edit && (
                            <button
                                type="button"
                                onClick={openEdit}
                                className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Edit
                            </button>
                        )}
                        {view.can_delete && (
                            <button
                                type="button"
                                onClick={() => {
                                    setDeleteError('');
                                    setConfirmDel(true);
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
                            CHANNELS[c.received_channel] ?? c.received_channel
                        }
                    />
                    <Info label="Date received" value={fmt(c.received_at)} />
                    <Info
                        label="Date of incident"
                        value={
                            c.incident_datetime
                                ? fmt(c.incident_datetime)
                                : 'Unknown'
                        }
                    />
                    <Info
                        label="Responsible office"
                        value={c.office_name ?? 'Not yet assigned'}
                    />
                    <Info
                        label="Target response date"
                        value={fmtDate(c.target_date)}
                    />
                    <Info
                        label="Your role"
                        value={
                            is_primary
                                ? 'Primary office'
                                : 'Coordinating office'
                        }
                    />
                    <Info label="Last updated" value={fmt(c.updated_at)} />
                </dl>
            </section>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Main column */}
                <div className="space-y-6 lg:col-span-2">
                    <section className={card}>
                        <h3 className={h3Cls}>Description</h3>
                        <p className="text-sm break-words whitespace-pre-line">
                            {c.description}
                        </p>
                    </section>
                    <section className={card}>
                        <h3 className={h3Cls}>
                            Actions and investigation updates
                        </h3>
                        <ActionList rows={view.actions} />
                    </section>
                    <section className={card}>
                        <h3 className={h3Cls}>Assignment history</h3>
                        <AssignmentList rows={view.assignments} />
                    </section>
                </div>

                {/* Side column */}
                <div className="space-y-6">
                    <section className={card}>
                        <h3 className={h3Cls}>Location</h3>
                        <p className="text-sm break-words">
                            {location || 'Unknown'}
                        </p>
                    </section>
                    <section className={card}>
                        <h3 className={h3Cls}>Complainant</h3>
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

                    {ownerRestricted && view.restrict_reason && (
                        <p className="text-xs text-slate-500">
                            {view.restrict_reason}
                        </p>
                    )}

                    {/* Acknowledge */}
                    {view.can_acknowledge && (
                        <section className={card}>
                            <h3 className="mb-2 font-semibold text-slate-700">
                                Acknowledge assignment
                            </h3>
                            <p className="mb-3 text-xs text-slate-500">
                                Confirm that your office has received this
                                complaint.
                            </p>
                            <form onSubmit={submitAck} className="space-y-3">
                                {(ackErr.form || ackErr.message) && (
                                    <Banner>
                                        {ackErr.form || ackErr.message}
                                    </Banner>
                                )}
                                <button
                                    type="submit"
                                    disabled={ackForm.processing}
                                    className="w-full rounded-xl bg-[#0f3d2e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#15803d] focus:ring-4 focus:ring-green-200 focus:outline-none disabled:opacity-60"
                                >
                                    Acknowledge
                                </button>
                            </form>
                        </section>
                    )}

                    {/* Investigation update / additional information */}
                    {view.can_post_update && (
                        <section className={card}>
                            <h3 className="mb-2 font-semibold text-slate-700">
                                {forInfo
                                    ? 'Additional information'
                                    : 'Investigation update'}
                            </h3>
                            <p className="mb-3 text-xs text-slate-500">
                                {forInfo
                                    ? 'Submit supplementary information or supporting photos without changing the original complaint.'
                                    : 'While this complaint is under investigation, add a written update and attach photos (JPEG, PNG, WebP or GIF, up to 8 files, 5 MB each).'}
                            </p>
                            <form
                                onSubmit={submitUpdate}
                                noValidate
                                className="space-y-3"
                            >
                                <Field
                                    label="Update"
                                    htmlFor="update_details"
                                    error={upErr.details}
                                >
                                    <textarea
                                        id="update_details"
                                        rows={4}
                                        maxLength={4000}
                                        className={fieldCls}
                                        aria-invalid={
                                            upErr.details ? true : undefined
                                        }
                                        value={updateForm.data.details}
                                        onChange={(e) =>
                                            updateForm.setData(
                                                'details',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </Field>
                                <Field
                                    label="Photos"
                                    htmlFor="update_photos"
                                    error={upErr.photos}
                                >
                                    <input
                                        key={fileKey}
                                        id="update_photos"
                                        type="file"
                                        multiple
                                        accept="image/jpeg,image/png,image/webp,image/gif"
                                        className={fieldCls}
                                        aria-invalid={
                                            upErr.photos ? true : undefined
                                        }
                                        onChange={(e) =>
                                            updateForm.setData(
                                                'photos',
                                                Array.from(
                                                    e.target.files ?? [],
                                                ),
                                            )
                                        }
                                    />
                                </Field>
                                {(upErr.form || upErr.message) && (
                                    <Banner>
                                        {upErr.form || upErr.message}
                                    </Banner>
                                )}
                                <button
                                    type="submit"
                                    disabled={updateForm.processing}
                                    className={primaryBtn}
                                >
                                    {view.photos_required
                                        ? 'Save update with photos'
                                        : 'Save additional information'}
                                </button>
                            </form>
                        </section>
                    )}

                    {/* Status change */}
                    {view.transitions.length > 0 ? (
                        <section className={card}>
                            <h3 className={h3Cls}>Update status</h3>
                            <p className="mb-3 text-xs text-slate-500">
                                Only the primary office can change status.
                                Coordinating offices can acknowledge and add
                                updates.
                            </p>
                            <form
                                onSubmit={submitStatus}
                                noValidate
                                className="space-y-3"
                            >
                                <Field
                                    label="Next status"
                                    htmlFor="to_status_id"
                                    error={stErr.to_status_id}
                                >
                                    <select
                                        id="to_status_id"
                                        className={fieldCls}
                                        value={statusForm.data.to_status_id}
                                        onChange={(e) =>
                                            statusForm.setData(
                                                'to_status_id',
                                                e.target.value,
                                            )
                                        }
                                    >
                                        <option value="">
                                            Select next status
                                        </option>
                                        {view.transitions.map((t) => (
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
                                    error={stErr.reason}
                                >
                                    <textarea
                                        id="status_reason"
                                        rows={3}
                                        maxLength={500}
                                        className={fieldCls}
                                        aria-invalid={
                                            stErr.reason ? true : undefined
                                        }
                                        value={statusForm.data.reason}
                                        onChange={(e) =>
                                            statusForm.setData(
                                                'reason',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </Field>
                                {(stErr.form || stErr.message) && (
                                    <Banner>
                                        {stErr.form || stErr.message}
                                    </Banner>
                                )}
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
                            {is_primary
                                ? 'No status change is available for your office at this stage.'
                                : 'Coordinating offices cannot change status. The primary office owns the case.'}
                        </p>
                    )}

                    <section className={card}>
                        <h3 className={h3Cls}>Status history</h3>
                        <HistoryList rows={view.history} />
                    </section>
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div
                    role="status"
                    className="fixed right-5 bottom-5 z-50 rounded-xl bg-[#0f3d2e] px-4 py-3 text-sm text-white shadow-lg"
                >
                    {toast}
                </div>
            )}

            {/* Blocking wait overlay while the server saves and sends emails */}
            {waitKind && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
                    role="alertdialog"
                    aria-modal="true"
                    aria-labelledby="waitTitle"
                >
                    <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-sm shadow-2xl">
                        <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-[#15803d]" />
                        <h2
                            id="waitTitle"
                            className="mb-2 text-center text-lg text-[#0f3d2e]"
                            style={serif}
                        >
                            {WAIT[waitKind].title}
                        </h2>
                        <p>Please keep this page open. The system is:</p>
                        <ol className="mt-2 ml-5 list-decimal leading-relaxed">
                            {WAIT[waitKind].steps.map((s) => (
                                <li key={s}>{s}</li>
                            ))}
                        </ol>
                    </div>
                </div>
            )}

            {/* Delete confirm */}
            {confirmDel && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    role="alertdialog"
                    aria-modal="true"
                    aria-labelledby="delTitle"
                >
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                        <h2
                            id="delTitle"
                            className="text-xl text-[#0f3d2e]"
                            style={serif}
                        >
                            Delete this complaint?
                        </h2>
                        <p className="mt-2 text-sm text-slate-600">
                            The record will be hidden but kept for audit
                            history. Assignments and investigation records are
                            not erased.
                        </p>
                        {deleteError && (
                            <div className="mt-3">
                                <Banner>{deleteError}</Banner>
                            </div>
                        )}
                        <div className="mt-5 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirmDel(false)}
                                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={deleting}
                                onClick={doDelete}
                                className="rounded-xl bg-red-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-800 focus:ring-4 focus:ring-red-200 focus:outline-none disabled:opacity-60"
                            >
                                {deleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit complaint modal */}
            {editOpen && (
                <div
                    className="fixed inset-0 z-50 overflow-y-auto bg-black/50"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="editModalTitle"
                >
                    <div className="flex min-h-full items-start justify-center p-4 sm:p-8">
                        <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
                            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                                <h2
                                    id="editModalTitle"
                                    className="text-xl text-[#0f3d2e]"
                                    style={serif}
                                >
                                    Edit complaint
                                </h2>
                                <button
                                    type="button"
                                    onClick={() => setEditOpen(false)}
                                    aria-label="Close"
                                    className="h-9 w-9 rounded-lg text-slate-500 hover:bg-slate-100"
                                >
                                    <X className="mx-auto h-4 w-4" />
                                </button>
                            </div>

                            <form
                                onSubmit={submitEdit}
                                noValidate
                                className="space-y-6 px-6 py-5"
                            >
                                {edErrCount > 0 && (
                                    <div
                                        role="alert"
                                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                                    >
                                        {editErr.form ||
                                            editErr.message ||
                                            'Please fix the highlighted fields.'}
                                    </div>
                                )}
                                <p className="text-sm text-slate-500">
                                    You can change the original complaint
                                    details only while it is still Recorded or
                                    For Initial Review. Status, assignments, and
                                    investigation records are not changed here.
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
                                        error={editErr.title}
                                    >
                                        <input
                                            className={fieldCls}
                                            maxLength={200}
                                            autoFocus
                                            {...bindEdit('title')}
                                        />
                                    </Field>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <Field
                                            label="Category"
                                            htmlFor="edit_category_id"
                                            error={editErr.category_id}
                                        >
                                            <select
                                                className={fieldCls}
                                                {...bindEdit('category_id')}
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
                                            htmlFor="edit_priority"
                                            error={editErr.priority}
                                        >
                                            <select
                                                className={fieldCls}
                                                {...bindEdit('priority')}
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
                                        htmlFor="edit_description"
                                        error={editErr.description}
                                    >
                                        <textarea
                                            rows={5}
                                            className={fieldCls}
                                            {...bindEdit('description')}
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
                                            error={editErr.received_channel}
                                        >
                                            <select
                                                className={fieldCls}
                                                {...bindEdit(
                                                    'received_channel',
                                                )}
                                            >
                                                <option value="">
                                                    Select channel
                                                </option>
                                                {Object.entries(CHANNELS).map(
                                                    ([v, l]) => (
                                                        <option
                                                            key={v}
                                                            value={v}
                                                        >
                                                            {l}
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
                                            error={editErr.received_at}
                                        >
                                            <input
                                                type="datetime-local"
                                                className={fieldCls}
                                                max={nowLocal()}
                                                {...bindEdit('received_at')}
                                            />
                                        </Field>
                                        <Field
                                            label="Date and time of incident"
                                            htmlFor="edit_incident_datetime"
                                            error={editErr.incident_datetime}
                                            hint="Leave blank if unknown."
                                        >
                                            <input
                                                type="datetime-local"
                                                className={fieldCls}
                                                max={nowLocal()}
                                                {...bindEdit(
                                                    'incident_datetime',
                                                )}
                                            />
                                        </Field>
                                    </div>
                                    <div className="sm:w-1/3">
                                        <Field
                                            label="Target response date"
                                            htmlFor="edit_target_date"
                                            error={editErr.target_date}
                                        >
                                            <input
                                                type="date"
                                                className={fieldCls}
                                                {...bindEdit('target_date')}
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
                                            error={editErr.province_id}
                                        >
                                            <select
                                                className={fieldCls}
                                                {...bindEdit('province_id')}
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
                                            htmlFor="edit_municipality"
                                            error={editErr.municipality}
                                        >
                                            <input
                                                className={fieldCls}
                                                maxLength={100}
                                                {...bindEdit('municipality')}
                                            />
                                        </Field>
                                        <Field
                                            label="Barangay"
                                            htmlFor="edit_barangay"
                                            error={editErr.barangay}
                                        >
                                            <input
                                                className={fieldCls}
                                                maxLength={100}
                                                {...bindEdit('barangay')}
                                            />
                                        </Field>
                                    </div>
                                    <Field
                                        label="Specific location"
                                        htmlFor="edit_specific_location"
                                        error={editErr.specific_location}
                                    >
                                        <input
                                            className={fieldCls}
                                            maxLength={255}
                                            {...bindEdit('specific_location')}
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
                                            checked={editForm.data.is_anonymous}
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
                                            htmlFor="edit_complainant_name"
                                            error={editErr.complainant_name}
                                        >
                                            <input
                                                className={fieldCls}
                                                maxLength={150}
                                                autoComplete="off"
                                                disabled={
                                                    editForm.data.is_anonymous
                                                }
                                                {...bindEdit(
                                                    'complainant_name',
                                                )}
                                            />
                                        </Field>
                                        <Field
                                            label="Contact number"
                                            htmlFor="edit_complainant_contact"
                                            error={editErr.complainant_contact}
                                        >
                                            <input
                                                className={fieldCls}
                                                maxLength={100}
                                                autoComplete="off"
                                                disabled={
                                                    editForm.data.is_anonymous
                                                }
                                                {...bindEdit(
                                                    'complainant_contact',
                                                )}
                                            />
                                        </Field>
                                        <Field
                                            label="Email"
                                            htmlFor="edit_complainant_email"
                                            error={editErr.complainant_email}
                                        >
                                            <input
                                                type="email"
                                                className={fieldCls}
                                                maxLength={150}
                                                autoComplete="off"
                                                disabled={
                                                    editForm.data.is_anonymous
                                                }
                                                {...bindEdit(
                                                    'complainant_email',
                                                )}
                                            />
                                        </Field>
                                    </div>
                                </fieldset>

                                <div className="flex justify-end gap-3 border-t border-slate-200 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setEditOpen(false)}
                                        className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={editForm.processing}
                                        className="rounded-xl bg-[#15803d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f3d2e] focus:ring-4 focus:ring-green-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {editForm.processing
                                            ? 'Saving...'
                                            : 'Save changes'}
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
