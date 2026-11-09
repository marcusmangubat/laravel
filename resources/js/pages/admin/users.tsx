import { Head, router, useForm, usePage } from "@inertiajs/react";
import { AlertCircle, CheckCircle2, Plus, Search, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import AdminLayout from "@/layouts/admin-layout";

// ───────── Types (match what UserController sends) ─────────
type Account = {
    user_id: number;
    username: string;
    email: string;
    full_name: string;
    position_title: string | null;
    office_name: string | null;
    office_code: string | null;
    is_active: number;
    is_locked: number;
    must_change_password: number;
    last_login_at: string | null;
};
type Paginated = {
    data: Account[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
};
type Filters = { q: string; office_id: string; is_active: string };
type Office = {
    office_id: number;
    office_name: string;
    office_code: string | null;
};

const serif = { fontFamily: "'DM Serif Display', serif" };

const fieldCls =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-green-200 aria-[invalid=true]:border-red-500";
const lblCls = "mb-1 block text-xs font-semibold text-slate-500";

const fmt = (s: string | null) =>
    s
        ? new Date(s.replace(" ", "T")).toLocaleString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
          })
        : "Never";

const officeLabel = (o: Office) =>
    o.office_name + (o.office_code ? ` (${o.office_code})` : "");

/** 12 random characters from a safe alphabet, with at least one letter and one number. */
function generatePassword(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    for (;;) {
        const bytes = crypto.getRandomValues(new Uint32Array(12));
        const p = Array.from(bytes, (b) => chars[b % chars.length]).join("");
        if (/[A-Za-z]/.test(p) && /\d/.test(p)) return p;
    }
}

function Field({
    label,
    htmlFor,
    error,
    hint,
    required,
    children,
}: {
    label: string;
    htmlFor: string;
    error?: string;
    hint?: string;
    required?: boolean;
    children: ReactNode;
}) {
    return (
        <div>
            <label htmlFor={htmlFor} className={lblCls}>
                {label}
                {required && <span className="text-red-600"> *</span>}
            </label>
            {children}
            {hint && !error && (
                <p className="mt-1 text-xs text-slate-400">{hint}</p>
            )}
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    );
}

// ───────── Page ─────────
export default function Users({
    users,
    filters,
    offices,
}: {
    users: Paginated;
    filters: Filters;
    offices: Office[];
}) {
    const page = usePage<any>();

    // ---- Filters ----
    const [f, setF] = useState<Filters>(filters);
    const [loading, setLoading] = useState(false);
    const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    );

    const go = (next: Filters, pageNo = 1) => {
        const params: Record<string, string | number> = {};
        (Object.keys(next) as (keyof Filters)[]).forEach((k) => {
            if (next[k] !== "") params[k] = next[k];
        });
        if (pageNo > 1) params.page = pageNo;
        router.get("/admin/users", params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: ["users", "filters", "errors"],
            onStart: () => setLoading(true),
            onFinish: () => setLoading(false),
        });
    };
    const setFilter = (key: keyof Filters, value: string) => {
        const next = { ...f, [key]: value };
        setF(next);
        if (key === "q") {
            clearTimeout(debounce.current);
            debounce.current = setTimeout(() => go(next), 350);
            return;
        }
        go(next);
    };
    const clearFilters = () => {
        const empty: Filters = { q: "", office_id: "", is_active: "" };
        setF(empty);
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
            type === "error" ? 7000 : 6000,
        );
    };

    // Server message if there is one, otherwise the default text
    const okMsg = (res: any, fallback: string) =>
        res?.props?.flash?.success || fallback;
    const failMsg = (errs: Record<string, string>, fallback: string) =>
        errs.form || errs.message || Object.values(errs)[0] || fallback;

    // Catch server crashes, expired sessions, permission errors, network loss
    useEffect(() => {
        const offHttp = router.on("httpException", (event: any) => {
            event.preventDefault();
            const s = event.detail?.response?.status;
            showToast(
                s === 403
                    ? "You do not have permission to do that."
                    : s === 404
                      ? "This account could not be found. It may have been removed."
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

    // ---- Activate / deactivate ----
    const [busyId, setBusyId] = useState<number | null>(null);
    const toggle = (u: Account) => {
        if (busyId) return;
        const deactivating = u.is_active === 1;
        router.patch(
            `/admin/users/${u.user_id}/status`,
            { is_active: deactivating ? 0 : 1 },
            {
                preserveScroll: true,
                onStart: () => setBusyId(u.user_id),
                onFinish: () => setBusyId(null),
                onSuccess: (res) =>
                    showToast(
                        okMsg(
                            res,
                            deactivating
                                ? `${u.full_name} has been deactivated.`
                                : `${u.full_name} has been activated.`,
                        ),
                    ),
                onError: (errs) =>
                    showToast(
                        failMsg(
                            errs,
                            deactivating
                                ? `Could not deactivate ${u.full_name}. Please try again.`
                                : `Could not activate ${u.full_name}. Please try again.`,
                        ),
                        "error",
                    ),
            },
        );
    };

    // ---- Create-account modal ----
    const [open, setOpen] = useState(false);
    const [showPwd, setShowPwd] = useState(false);
    const form = useForm({
        office_id: "",
        full_name: "",
        username: "",
        email: "",
        position_title: "",
        contact_number: "",
        password: "",
        password_confirmation: "",
    });
    const { data, setData, errors } = form;

    const openForm = () => {
        form.reset();
        form.clearErrors();
        setShowPwd(false);
        setOpen(true);
    };
    const closeForm = () => setOpen(false);

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
        if (form.processing) return;
        const name = data.full_name;
        form.post("/admin/users", {
            preserveScroll: true,
            onSuccess: (res) => {
                closeForm();
                form.reset();
                showToast(okMsg(res, `Account created for ${name}.`));
            },
            onError: (errs) =>
                showToast(
                    failMsg(
                        errs,
                        "Could not create the account. Please fix the highlighted fields.",
                    ),
                    "error",
                ),
        });
    };

    const fillGenerated = () => {
        const p = generatePassword();
        form.setData((d) => ({ ...d, password: p, password_confirmation: p }));
        setShowPwd(true);
    };

    const err = (k: keyof typeof errors) => errors[k] as string | undefined;
    const bad = (k: keyof typeof errors) => (errors[k] ? true : undefined);
    const pwdType = showPwd ? "text" : "password";

    const start = users.total
        ? (users.current_page - 1) * users.per_page + 1
        : 0;
    const end = Math.min(users.current_page * users.per_page, users.total);
    const filterError = Object.values(page.props.errors ?? {}).find(
        (m) => typeof m === "string",
    ) as string | undefined;

    return (
        <AdminLayout title="Field Office Accounts">
            <Head title="DENR RDAC IV-A – Field Office Accounts" />

            {/* Toolbar */}
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="relative max-w-md min-w-[16rem] flex-1">
                        <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <label htmlFor="q" className="sr-only">
                            Search accounts
                        </label>
                        <input
                            id="q"
                            type="search"
                            className={`${fieldCls} pl-10`}
                            placeholder="Search name, username, email or office"
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
                        Create account
                    </button>
                </div>

                <div className="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Office" htmlFor="f_office">
                        <select
                            id="f_office"
                            className={fieldCls}
                            value={f.office_id}
                            onChange={(e) =>
                                setFilter("office_id", e.target.value)
                            }
                        >
                            <option value="">All offices</option>
                            {offices.map((o) => (
                                <option key={o.office_id} value={o.office_id}>
                                    {officeLabel(o)}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Status" htmlFor="f_active">
                        <select
                            id="f_active"
                            className={fieldCls}
                            value={f.is_active}
                            onChange={(e) =>
                                setFilter("is_active", e.target.value)
                            }
                        >
                            <option value="">All</option>
                            <option value="1">Active</option>
                            <option value="0">Deactivated</option>
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

            {filterError && !open && (
                <div
                    role="alert"
                    className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700"
                >
                    {filterError}
                </div>
            )}

            {/* Table */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div
                    className={`overflow-x-auto transition-opacity ${loading ? "opacity-50" : ""}`}
                    aria-busy={loading}
                >
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                                {[
                                    "Name",
                                    "Username",
                                    "Office",
                                    "Status",
                                    "Last sign-in",
                                    "Actions",
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
                            {users.data.length ? (
                                users.data.map((u) => {
                                    const active = u.is_active === 1;
                                    return (
                                        <tr
                                            key={u.user_id}
                                            className="border-b border-slate-100 hover:bg-slate-50"
                                        >
                                            <td className="px-4 py-3">
                                                <p className="font-semibold">
                                                    {u.full_name}
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    {u.position_title ||
                                                        u.email}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {u.username}
                                                <p className="text-xs text-slate-400">
                                                    {u.email}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">
                                                {u.office_name || "—"}
                                                {u.office_code && (
                                                    <p className="text-xs text-slate-400">
                                                        {u.office_code}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span
                                                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${active ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}
                                                >
                                                    {active
                                                        ? "Active"
                                                        : "Deactivated"}
                                                </span>
                                                {u.is_locked === 1 && (
                                                    <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                                        Locked
                                                    </span>
                                                )}
                                                {u.must_change_password ===
                                                    1 && (
                                                    <span className="ml-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">
                                                        Must change password
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-500">
                                                {fmt(u.last_login_at)}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    onClick={() => toggle(u)}
                                                    disabled={busyId !== null}
                                                    className={`text-sm font-semibold hover:underline disabled:opacity-50 ${active ? "text-red-700" : "text-[#15803d]"}`}
                                                >
                                                    {active
                                                        ? "Deactivate"
                                                        : "Activate"}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="py-12 text-center text-slate-400"
                                    >
                                        No field-office accounts match these
                                        filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
                    <p>
                        {users.total
                            ? `Showing ${start}–${end} of ${users.total.toLocaleString()}`
                            : "0 results"}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={users.current_page <= 1}
                            onClick={() => go(f, users.current_page - 1)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Previous
                        </button>
                        <span>
                            Page {users.current_page} of {users.last_page}
                        </span>
                        <button
                            type="button"
                            disabled={users.current_page >= users.last_page}
                            onClick={() => go(f, users.current_page + 1)}
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
                    className={`fixed right-5 bottom-5 z-[70] flex max-w-md items-start gap-2 rounded-xl px-4 py-3 text-sm text-white shadow-lg ${toast.type === "error" ? "bg-red-700" : "bg-[#0f3d2e]"}`}
                >
                    {toast.type === "error" ? (
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-300" />
                    )}
                    <span>{toast.text}</span>
                </div>
            )}

            {/* Create account modal */}
            {open && (
                <div
                    className="fixed inset-0 z-50 overflow-y-auto bg-black/50"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="modalTitle"
                >
                    <div className="flex min-h-full items-start justify-center p-4 sm:p-8">
                        <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
                            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                                <h2
                                    id="modalTitle"
                                    className="text-xl text-[#0f3d2e]"
                                    style={serif}
                                >
                                    Create a field-office account
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
                                className="space-y-5 px-6 py-5"
                            >
                                {Object.keys(errors).length > 0 && (
                                    <div
                                        role="alert"
                                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                                    >
                                        {(errors as Record<string, string>)
                                            .form ||
                                            "Please fix the highlighted fields."}
                                    </div>
                                )}
                                <p className="text-sm text-slate-500">
                                    This person will sign in to the field-office
                                    workspace for the office you choose. They
                                    must change the temporary password at first
                                    sign-in.
                                </p>

                                <Field
                                    label="Office"
                                    htmlFor="office_id"
                                    required
                                    error={err("office_id")}
                                >
                                    <select
                                        id="office_id"
                                        className={fieldCls}
                                        aria-invalid={bad("office_id")}
                                        autoFocus
                                        value={data.office_id}
                                        onChange={(e) =>
                                            setData("office_id", e.target.value)
                                        }
                                    >
                                        <option value="">Select office</option>
                                        {offices.map((o) => (
                                            <option
                                                key={o.office_id}
                                                value={o.office_id}
                                            >
                                                {officeLabel(o)}
                                            </option>
                                        ))}
                                    </select>
                                </Field>

                                <Field
                                    label="Full name"
                                    htmlFor="full_name"
                                    required
                                    error={err("full_name")}
                                >
                                    <input
                                        id="full_name"
                                        className={fieldCls}
                                        maxLength={150}
                                        autoComplete="name"
                                        aria-invalid={bad("full_name")}
                                        value={data.full_name}
                                        onChange={(e) =>
                                            setData("full_name", e.target.value)
                                        }
                                    />
                                </Field>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field
                                        label="Username"
                                        htmlFor="username"
                                        required
                                        error={err("username")}
                                        hint="Letters, numbers, periods and underscores."
                                    >
                                        <input
                                            id="username"
                                            className={fieldCls}
                                            maxLength={60}
                                            autoComplete="off"
                                            aria-invalid={bad("username")}
                                            value={data.username}
                                            onChange={(e) =>
                                                setData(
                                                    "username",
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </Field>
                                    <Field
                                        label="Email"
                                        htmlFor="email"
                                        required
                                        error={err("email")}
                                    >
                                        <input
                                            id="email"
                                            type="email"
                                            className={fieldCls}
                                            maxLength={150}
                                            autoComplete="off"
                                            aria-invalid={bad("email")}
                                            value={data.email}
                                            onChange={(e) =>
                                                setData("email", e.target.value)
                                            }
                                        />
                                    </Field>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field
                                        label="Position"
                                        htmlFor="position_title"
                                        error={err("position_title")}
                                    >
                                        <input
                                            id="position_title"
                                            className={fieldCls}
                                            maxLength={120}
                                            autoComplete="off"
                                            value={data.position_title}
                                            onChange={(e) =>
                                                setData(
                                                    "position_title",
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </Field>
                                    <Field
                                        label="Contact number"
                                        htmlFor="contact_number"
                                        error={err("contact_number")}
                                    >
                                        <input
                                            id="contact_number"
                                            className={fieldCls}
                                            maxLength={50}
                                            autoComplete="off"
                                            value={data.contact_number}
                                            onChange={(e) =>
                                                setData(
                                                    "contact_number",
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </Field>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field
                                        label="Temporary password"
                                        htmlFor="password"
                                        required
                                        error={err("password")}
                                        hint="At least 10 characters, with a letter and a number."
                                    >
                                        <input
                                            id="password"
                                            type={pwdType}
                                            className={fieldCls}
                                            maxLength={72}
                                            autoComplete="new-password"
                                            aria-invalid={bad("password")}
                                            value={data.password}
                                            onChange={(e) =>
                                                setData(
                                                    "password",
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </Field>
                                    <Field
                                        label="Confirm password"
                                        htmlFor="password_confirmation"
                                        required
                                        error={err("password_confirmation")}
                                    >
                                        <input
                                            id="password_confirmation"
                                            type={pwdType}
                                            className={fieldCls}
                                            maxLength={72}
                                            autoComplete="new-password"
                                            aria-invalid={bad(
                                                "password_confirmation",
                                            )}
                                            value={data.password_confirmation}
                                            onChange={(e) =>
                                                setData(
                                                    "password_confirmation",
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </Field>
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={fillGenerated}
                                        className="text-sm font-semibold text-[#15803d] hover:underline"
                                    >
                                        Generate a temporary password
                                    </button>
                                    <label className="flex items-center gap-2 text-sm text-slate-600">
                                        <input
                                            type="checkbox"
                                            className="rounded border-slate-300"
                                            checked={showPwd}
                                            onChange={(e) =>
                                                setShowPwd(e.target.checked)
                                            }
                                        />
                                        Show passwords
                                    </label>
                                </div>

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
                                            : "Create account"}
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
