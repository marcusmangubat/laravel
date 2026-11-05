import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout'; // your existing admin shell

type Filters = {
    q: string;
    from: string;
    to: string;
    action: string;
    entity_type: string;
    user_id: string;
};

type AuditRow = {
    audit_id: number;
    action_label: string;
    entity_type: string | null;
    entity_id: number | null;
    reference_no: string | null;
    title: string | null;
    full_name: string | null;
    username: string | null;
    role: string | null;
    ip_address: string | null;
    created_at: string | null;
    details: string;
};

type Paginated<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    from: number | null;
    to: number | null;
    total: number;
};

type Props = {
    logs: Paginated<AuditRow>;
    filters: Filters;
    actions: Record<string, string>;
    users: { id: number; name: string }[];
    today: string;
};

const COLS = 6;
const FIELD =
    'field h-11 w-full min-w-0 border border-slate-300 hover:border-slate-400 focus:border-[var(--green)] focus:outline-none focus:ring-2 focus:ring-[var(--green)]/20';
const EMPTY: Filters = {
    q: '',
    from: '',
    to: '',
    action: '',
    entity_type: '',
    user_id: '',
};

const fmt = (s: string | null) =>
    s
        ? new Date(String(s).replace(' ', 'T')).toLocaleString('en-PH', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
          })
        : '—';

function validateDates({ from, to }: Filters, today: string): string {
    if (from > today || to > today)
        return 'Future dates cannot be selected. Please choose today or an earlier date.';
    if (from && to && from > to)
        return 'The start date must be on or before the end date.';
    return '';
}

function RecordCell({ r }: { r: AuditRow }) {
    if (r.entity_type === 'complaints' && r.entity_id) {
        return (
            <>
                <Link
                    className="font-semibold text-[var(--green)] hover:underline"
                    href={`/admin/complaints/${r.entity_id}`}
                >
                    {r.reference_no || `Complaint #${r.entity_id}`}
                </Link>
                {r.title && (
                    <p
                        className="max-w-xs truncate text-xs text-slate-500"
                        title={r.title}
                    >
                        {r.title}
                    </p>
                )}
            </>
        );
    }
    if (r.entity_type === 'users' && r.entity_id) {
        return (
            <Link
                className="text-[var(--green)] hover:underline"
                href="/admin/users"
            >
                User #{r.entity_id}
            </Link>
        );
    }
    if (r.entity_type === 'email_settings') {
        return (
            <Link
                className="text-[var(--green)] hover:underline"
                href="/admin/email-settings"
            >
                Email settings
            </Link>
        );
    }
    return <span className="text-slate-400">—</span>;
}

export default function Audit({ logs, filters, actions, users, today }: Props) {
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const [form, setForm] = useState<Filters>({ ...EMPTY, ...filters });
    const [loading, setLoading] = useState(false);
    const [dateError, setDateError] = useState('');
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current);
        },
        [],
    );

    const visit = (next: Filters, page = 1) => {
        const params: Record<string, string | number> = Object.fromEntries(
            Object.entries(next).filter(([, v]) => v !== ''),
        );
        if (page > 1) params.page = page;
        router.get('/admin/audit', params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: ['logs', 'filters', 'errors'],
            onStart: () => setLoading(true),
            onFinish: () => setLoading(false),
        });
    };

    const change = (key: keyof Filters, value: string) => {
        const next = { ...form, [key]: value };
        setForm(next);
        const msg = validateDates(next, today);
        setDateError(msg);
        if (msg) return;
        if (timer.current) clearTimeout(timer.current);
        if (key === 'q') timer.current = setTimeout(() => visit(next), 350);
        else visit(next);
    };

    const onInput =
        (key: keyof Filters) =>
        (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
            change(key, e.target.value);

    const clear = () => {
        if (timer.current) clearTimeout(timer.current);
        setForm(EMPTY);
        setDateError('');
        visit(EMPTY);
    };

    const error = dateError || errors?.from || errors?.to || '';
    const hasFilters = Object.values(form).some((v) => v !== '');

    return (
        <AdminLayout title="Audit Trail">
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm text-slate-600">
                    Review who did what in the system: sign-ins, complaint
                    changes, account updates, reports, and email settings.
                </p>

                {/* Row 1: search + clear */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative flex-1 sm:max-w-md">
                        <i className="fa-solid fa-magnifying-glass pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-slate-400" />
                        <label htmlFor="q" className="sr-only">
                            Search
                        </label>
                        <input
                            type="search"
                            id="q"
                            className={`${FIELD} pl-10`}
                            placeholder="Search user, action, or complaint reference"
                            value={form.q}
                            onChange={onInput('q')}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={clear}
                        disabled={!hasFilters}
                        className="h-11 rounded-xl border border-slate-300 px-4 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <i className="fa-solid fa-rotate-left mr-2 text-xs" />
                        Clear filters
                    </button>
                </div>

                <hr className="border-slate-100" />

                {/* Row 2: filters */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {/* Date range spans 2 columns, From/To side by side */}
                    <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                        <div>
                            <label className="lbl" htmlFor="f_from">
                                From
                            </label>
                            <input
                                type="date"
                                id="f_from"
                                className={FIELD}
                                value={form.from}
                                max={form.to || today}
                                onChange={onInput('from')}
                            />
                        </div>
                        <div>
                            <label className="lbl" htmlFor="f_to">
                                To
                            </label>
                            <input
                                type="date"
                                id="f_to"
                                className={FIELD}
                                value={form.to}
                                min={form.from || undefined}
                                max={today}
                                onChange={onInput('to')}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="lbl" htmlFor="f_action">
                            Action
                        </label>
                        <select
                            id="f_action"
                            className={FIELD}
                            value={form.action}
                            onChange={onInput('action')}
                        >
                            <option value="">All actions</option>
                            {Object.entries(actions).map(([code, label]) => (
                                <option key={code} value={code}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="lbl" htmlFor="f_entity">
                            Record type
                        </label>
                        <select
                            id="f_entity"
                            className={FIELD}
                            value={form.entity_type}
                            onChange={onInput('entity_type')}
                        >
                            <option value="">All types</option>
                            <option value="complaints">Complaints</option>
                            <option value="users">Users</option>
                            <option value="email_settings">
                                Email settings
                            </option>
                        </select>
                    </div>

                    <div>
                        <label className="lbl" htmlFor="f_user">
                            User
                        </label>
                        <select
                            id="f_user"
                            className={FIELD}
                            value={form.user_id}
                            onChange={onInput('user_id')}
                        >
                            <option value="">All users</option>
                            {users.map((u) => (
                                <option key={u.id} value={String(u.id)}>
                                    {u.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </section>

            {error && (
                <div
                    role="alert"
                    className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700"
                >
                    {error}
                </div>
            )}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="overflow-x-auto" aria-busy={loading}>
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                                {[
                                    'When',
                                    'User',
                                    'Action',
                                    'Record',
                                    'Details',
                                    'IP address',
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
                            {loading ? (
                                Array.from({ length: 4 }, (_, i) => (
                                    <tr key={i}>
                                        <td colSpan={COLS} className="p-3">
                                            <div className="skeleton h-6 rounded" />
                                        </td>
                                    </tr>
                                ))
                            ) : logs.data.length ? (
                                logs.data.map((r) => (
                                    <tr
                                        key={r.audit_id}
                                        className="border-b border-slate-100 align-top hover:bg-slate-50"
                                    >
                                        <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-500">
                                            {fmt(r.created_at)}
                                        </td>
                                        <td className="px-4 py-3">
                                            {r.full_name || r.username ? (
                                                <>
                                                    <p className="font-medium">
                                                        {r.full_name ||
                                                            r.username}
                                                    </p>
                                                    <p className="text-xs text-slate-400">
                                                        {r.username || ''}
                                                        {r.role
                                                            ? ' · ' +
                                                              r.role.replace(
                                                                  '_',
                                                                  ' ',
                                                              )
                                                            : ''}
                                                    </p>
                                                </>
                                            ) : (
                                                <span className="text-slate-400">
                                                    Unknown
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                                                {r.action_label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <RecordCell r={r} />
                                        </td>
                                        <td className="max-w-sm px-4 py-3 text-xs break-words text-slate-600">
                                            {r.details || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-500">
                                            {r.ip_address || '—'}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td
                                        colSpan={COLS}
                                        className="py-12 text-center text-slate-400"
                                    >
                                        No audit entries match these filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
                    <p>
                        {logs.total
                            ? `Showing ${logs.from}–${logs.to} of ${logs.total.toLocaleString()} entries`
                            : '0 entries'}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={logs.current_page <= 1}
                            onClick={() => visit(form, logs.current_page - 1)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40"
                        >
                            Previous
                        </button>
                        <span>
                            Page {logs.current_page} of {logs.last_page}
                        </span>
                        <button
                            type="button"
                            disabled={logs.current_page >= logs.last_page}
                            onClick={() => visit(form, logs.current_page + 1)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </section>
        </AdminLayout>
    );
}
