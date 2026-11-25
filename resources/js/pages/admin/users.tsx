import { Head, router, useForm, usePage } from "@inertiajs/react";
import { Field, Select, fieldCls } from "@/Components/form-controls";
import {
    AlertCircle,
    Building2,
    CheckCircle2,
    Clock,
    Inbox,
    Mail,
    Plus,
    Search,
    SlidersHorizontal,
    X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import AdminLayout from "@/layouts/admin-layout";

//  Types (match what UserController sends)
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

// Pending "Request Access" submissions (from GET /admin/access-requests/pending)
type PendingRequest = {
    request_id: number;
    office_id: number;
    office_name: string | null;
    office_code: string | null;
    full_name: string;
    username: string;
    email: string;
    position_title: string;
    contact_number: string;
    created_at: string;
};

const serif = { fontFamily: "'DM Serif Display', serif" };

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
//  Page
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
    const [showFilters, setShowFilters] = useState(false); // mobile only
    const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    );
    const activeFilters = [f.office_id, f.is_active].filter(
        (v) => v !== "",
    ).length;

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
    // ---- Pending access requests ----
    const [pending, setPending] = useState<PendingRequest[]>([]);
    const [reqId, setReqId] = useState<number | null>(null); // set while reviewing a request
    const [rejecting, setRejecting] = useState(false);
    const [reason, setReason] = useState("");
    const [rejectError, setRejectError] = useState<string | null>(null);
    const [rejectBusy, setRejectBusy] = useState(false);

    const closeForm = () => {
        setOpen(false);
        setReqId(null);
        setRejecting(false);
        setReason("");
        setRejectError(null);
    };

    const [pendingError, setPendingError] = useState<string | null>(null);
    const loadPending = () => {
        fetch("/admin/access-requests/pending", {
            credentials: "same-origin",
            headers: {
                Accept: "application/json",
                "X-Requested-With": "XMLHttpRequest",
            },
        })
            .then(async (res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                setPending(json.requests ?? []);
                setPendingError(null);
            })
            .catch((e) =>
                setPendingError(
                    `Could not load access requests (${e?.message ?? "error"}). Run php artisan migrate and php artisan route:clear, then reload.`,
                ),
            );
    };
    useEffect(() => {
        loadPending();
    }, []);

    // Open the Create-account modal already filled in with the requester's details
    const reviewRequest = (r: PendingRequest) => {
        form.clearErrors();
        form.setData({
            office_id: String(r.office_id),
            full_name: r.full_name,
            username: r.username,
            email: r.email,
            position_title: r.position_title,
            contact_number: r.contact_number,
            password: "",
            password_confirmation: "",
        });
        setShowPwd(false);
        setRejecting(false);
        setReason("");
        setRejectError(null);
        setReqId(r.request_id);
        setOpen(true);
    };

    const rejectRequest = () => {
        if (reqId === null || rejectBusy) return;
        if (!reason.trim()) {
            setRejectError("Please give a reason for rejecting.");
            return;
        }
        router.post(
            `/admin/access-requests/${reqId}/reject`,
            { reason },
            {
                preserveScroll: true,
                onStart: () => setRejectBusy(true),
                onFinish: () => setRejectBusy(false),
                onSuccess: (res) => {
                    closeForm();
                    form.reset();
                    loadPending();
                    showToast(okMsg(res, "The access request was rejected."));
                },
                onError: (errs) =>
                    setRejectError(
                        failMsg(errs, "Could not reject the request."),
                    ),
            },
        );
    };

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
        // A reviewed request is approved through its own endpoint, which also
        // marks the request as approved. Otherwise it's a normal new account.
        const url = reqId
            ? `/admin/access-requests/${reqId}/approve`
            : "/admin/users";
        form.post(url, {
            preserveScroll: true,
            onSuccess: (res) => {
                closeForm();
                form.reset();
                loadPending();
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

            {/* Pending access requests */}
            {pendingError && (
                <div
                    role="alert"
                    className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                    {pendingError}
                </div>
            )}
            {pending.length > 0 && (
                <section
                    aria-labelledby="pendingTitle"
                    className="rounded-2xl border border-amber-200 bg-amber-50 p-3 sm:p-4"
                >
                    <h2
                        id="pendingTitle"
                        className="flex items-center gap-2 text-sm font-semibold text-amber-900"
                    >
                        <Inbox className="h-4 w-4" />
                        Pending access requests
                        <span className="rounded-full bg-amber-600 px-2 py-0.5 text-xs leading-none text-white">
                            {pending.length}
                        </span>
                    </h2>
                    <ul className="mt-3 divide-y divide-amber-100 overflow-hidden rounded-xl border border-amber-200 bg-white">
                        {pending.map((r) => (
                            <li
                                key={r.request_id}
                                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                            >
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-800">
                                        {r.full_name}
                                    </p>
                                    <p className="truncate text-xs text-slate-500">
                                        {r.office_name || "—"} · {r.username} ·{" "}
                                        {r.email}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        Requested {fmt(r.created_at)}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => reviewRequest(r)}
                                    className="w-full rounded-xl bg-[#15803d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f3d2e] focus:ring-4 focus:ring-green-200 focus:outline-none sm:w-auto"
                                >
                                    Review
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Toolbar */}
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <div className="relative order-1 min-w-0 flex-1 basis-full sm:basis-64 md:max-w-md">
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

                    {/* Filter toggle (mobile only) */}
                    <button
                        type="button"
                        onClick={() => setShowFilters((v) => !v)}
                        aria-expanded={showFilters}
                        aria-controls="filterPanel"
                        className="order-2 inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:ring-4 focus:ring-green-200 focus:outline-none md:hidden"
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
                        Create account
                    </button>
                </div>

                <div
                    id="filterPanel"
                    className={`${showFilters ? "grid" : "hidden"} max-w-xl grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid`}
                >
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
                            {offices.map((o) => (
                                <option key={o.office_id} value={o.office_id}>
                                    {officeLabel(o)}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Status" htmlFor="f_active">
                        <Select
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
                        </Select>
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

            {filterError && !open && (
                <div
                    role="alert"
                    className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:px-5"
                >
                    {filterError}
                </div>
            )}

            {/* Results */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {/* Desktop / tablet: table */}
                <div
                    className={`hidden overflow-x-auto transition-opacity md:block ${loading ? "opacity-50" : ""}`}
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
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap items-center gap-1">
                                                    <span
                                                        className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${active ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}
                                                    >
                                                        {active
                                                            ? "Active"
                                                            : "Deactivated"}
                                                    </span>
                                                    {u.is_locked === 1 && (
                                                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-amber-800">
                                                            Locked
                                                        </span>
                                                    )}
                                                    {u.must_change_password ===
                                                        1 && (
                                                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-sky-800">
                                                            Must change password
                                                        </span>
                                                    )}
                                                </div>
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

                {/* Mobile: cards */}
                <ul
                    className={`divide-y divide-slate-100 transition-opacity md:hidden ${loading ? "opacity-50" : ""}`}
                    aria-busy={loading}
                >
                    {users.data.length ? (
                        users.data.map((u) => {
                            const active = u.is_active === 1;
                            return (
                                <li
                                    key={u.user_id}
                                    className={`px-4 py-4 ${active ? "" : "bg-slate-50/60"}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-800">
                                                {u.full_name}
                                            </p>
                                            <p className="truncate text-xs text-slate-400">
                                                {u.position_title ||
                                                    `@${u.username}`}
                                            </p>
                                        </div>
                                        <span
                                            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${active ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-600"}`}
                                        >
                                            {active ? "Active" : "Deactivated"}
                                        </span>
                                    </div>

                                    {(u.is_locked === 1 ||
                                        u.must_change_password === 1) && (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {u.is_locked === 1 && (
                                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                                    Locked
                                                </span>
                                            )}
                                            {u.must_change_password === 1 && (
                                                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">
                                                    Must change password
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    <dl className="mt-3 space-y-1.5 text-xs text-slate-500">
                                        <div className="flex items-center gap-1.5">
                                            <dt className="sr-only">Office</dt>
                                            <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                            <dd className="min-w-0">
                                                {u.office_name || "—"}
                                                {u.office_code && (
                                                    <span className="text-slate-400">
                                                        {" "}
                                                        ({u.office_code})
                                                    </span>
                                                )}
                                            </dd>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <dt className="sr-only">
                                                Username and email
                                            </dt>
                                            <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                            <dd className="min-w-0 break-all">
                                                {u.username} · {u.email}
                                            </dd>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <dt className="sr-only">
                                                Last sign-in
                                            </dt>
                                            <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                            <dd>
                                                Last sign-in:{" "}
                                                {fmt(u.last_login_at)}
                                            </dd>
                                        </div>
                                    </dl>

                                    <button
                                        type="button"
                                        onClick={() => toggle(u)}
                                        disabled={busyId !== null}
                                        className={`mt-3 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold disabled:opacity-50 ${active ? "border-red-200 text-red-700 hover:bg-red-50 active:bg-red-100" : "border-green-200 text-[#15803d] hover:bg-green-50 active:bg-green-100"}`}
                                    >
                                        {active
                                            ? "Deactivate account"
                                            : "Activate account"}
                                    </button>
                                </li>
                            );
                        })
                    ) : (
                        <li className="px-4 py-12 text-center text-sm text-slate-400">
                            No field-office accounts match these filters.
                        </li>
                    )}
                </ul>

                {/* Pagination */}
                <div className="flex flex-col items-center gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:justify-between">
                    <p>
                        {users.total
                            ? `Showing ${start}–${end} of ${users.total.toLocaleString()}`
                            : "0 results"}
                    </p>
                    <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
                        <button
                            type="button"
                            disabled={users.current_page <= 1}
                            onClick={() => go(f, users.current_page - 1)}
                            className="rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:py-1.5"
                        >
                            Previous
                        </button>
                        <span className="text-center">
                            Page {users.current_page} of {users.last_page}
                        </span>
                        <button
                            type="button"
                            disabled={users.current_page >= users.last_page}
                            onClick={() => go(f, users.current_page + 1)}
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
                    className={`fixed inset-x-3 bottom-3 z-[70] flex items-start gap-2 rounded-xl px-4 py-3 text-sm text-white shadow-lg sm:inset-x-auto sm:right-5 sm:bottom-5 sm:max-w-md ${toast.type === "error" ? "bg-red-700" : "bg-[#0f3d2e]"}`}
                >
                    {toast.type === "error" ? (
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-300" />
                    )}
                    <span>{toast.text}</span>
                </div>
            )}

            {/* Create account modal (full-screen sheet on mobile) */}
            {open && (
                <div
                    className="fixed inset-0 z-50 overflow-y-auto bg-black/50"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="modalTitle"
                >
                    <div className="flex min-h-full items-start justify-center sm:p-8">
                        <div className="flex min-h-dvh w-full max-w-2xl flex-col bg-white shadow-2xl sm:min-h-0 sm:rounded-2xl">
                            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:rounded-t-2xl sm:px-6 sm:py-4">
                                <h2
                                    id="modalTitle"
                                    className="text-lg text-[#0f3d2e] sm:text-xl"
                                    style={serif}
                                >
                                    {reqId
                                        ? "Review access request"
                                        : "Create a field-office account"}
                                </h2>
                                <button
                                    type="button"
                                    onClick={closeForm}
                                    aria-label="Close"
                                    className="h-10 w-10 shrink-0 rounded-lg text-slate-500 hover:bg-slate-100 sm:h-9 sm:w-9"
                                >
                                    <X className="mx-auto h-5 w-5 sm:h-4 sm:w-4" />
                                </button>
                            </div>

                            <form
                                onSubmit={submit}
                                noValidate
                                className="flex flex-1 flex-col"
                            >
                                <div className="flex-1 space-y-5 px-4 py-5 sm:px-6">
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
                                    {reqId ? (
                                        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                            These details were submitted by the
                                            requester. Check or correct them,
                                            then set a temporary password and
                                            approve to create the account.
                                        </p>
                                    ) : (
                                        <p className="text-sm text-slate-500">
                                            This person will sign in to the
                                            field-office workspace for the
                                            office you choose. They must change
                                            the temporary password at first
                                            sign-in.
                                        </p>
                                    )}

                                    <Field
                                        label="Office"
                                        htmlFor="office_id"
                                        required
                                        error={err("office_id")}
                                    >
                                        <Select
                                            id="office_id"
                                            className={fieldCls}
                                            aria-invalid={bad("office_id")}
                                            autoFocus
                                            value={data.office_id}
                                            onChange={(e) =>
                                                setData(
                                                    "office_id",
                                                    e.target.value,
                                                )
                                            }
                                        >
                                            <option value="">
                                                Select office
                                            </option>
                                            {offices.map((o) => (
                                                <option
                                                    key={o.office_id}
                                                    value={o.office_id}
                                                >
                                                    {officeLabel(o)}
                                                </option>
                                            ))}
                                        </Select>
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
                                                setData(
                                                    "full_name",
                                                    e.target.value,
                                                )
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
                                                autoCapitalize="none"
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
                                                    setData(
                                                        "email",
                                                        e.target.value,
                                                    )
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
                                                type="tel"
                                                inputMode="numeric"
                                                pattern="[0-9]{11}"
                                                className={fieldCls}
                                                maxLength={11}
                                                autoComplete="off"
                                                placeholder="09XXXXXXXXX"
                                                value={data.contact_number}
                                                onChange={(e) => {
                                                    const value = e.target.value
                                                        .replace(/\D/g, "")
                                                        .slice(0, 11);
                                                    setData(
                                                        "contact_number",
                                                        value,
                                                    );
                                                }}
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
                                                value={
                                                    data.password_confirmation
                                                }
                                                onChange={(e) =>
                                                    setData(
                                                        "password_confirmation",
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </Field>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                        <button
                                            type="button"
                                            onClick={fillGenerated}
                                            className="py-1 text-sm font-semibold text-[#15803d] hover:underline"
                                        >
                                            Generate a temporary password
                                        </button>
                                        <label className="flex items-center gap-2 py-1 text-sm text-slate-600">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-slate-300"
                                                checked={showPwd}
                                                onChange={(e) =>
                                                    setShowPwd(e.target.checked)
                                                }
                                            />
                                            Show passwords
                                        </label>
                                    </div>

                                    {reqId && rejecting && (
                                        <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
                                            <Field
                                                label="Reason for rejecting"
                                                htmlFor="reject_reason"
                                                required
                                                error={rejectError ?? undefined}
                                            >
                                                <textarea
                                                    id="reject_reason"
                                                    rows={2}
                                                    maxLength={500}
                                                    className={fieldCls}
                                                    value={reason}
                                                    onChange={(e) => {
                                                        setReason(
                                                            e.target.value,
                                                        );
                                                        setRejectError(null);
                                                    }}
                                                />
                                            </Field>
                                            <button
                                                type="button"
                                                onClick={rejectRequest}
                                                disabled={rejectBusy}
                                                className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
                                            >
                                                {rejectBusy
                                                    ? "Rejecting..."
                                                    : "Confirm rejection"}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Sticky action bar so the submit button is always reachable on phones */}
                                <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:flex-row sm:justify-end sm:gap-3 sm:rounded-b-2xl sm:px-6 sm:pb-3">
                                    <button
                                        type="button"
                                        onClick={closeForm}
                                        className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                                    >
                                        Cancel
                                    </button>
                                    {reqId && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setRejecting((v) => !v)
                                            }
                                            className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                                        >
                                            Reject
                                        </button>
                                    )}
                                    <button
                                        type="submit"
                                        disabled={form.processing}
                                        className="rounded-xl bg-[#15803d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f3d2e] focus:ring-4 focus:ring-green-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {form.processing
                                            ? "Saving..."
                                            : reqId
                                              ? "Approve & create account"
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
