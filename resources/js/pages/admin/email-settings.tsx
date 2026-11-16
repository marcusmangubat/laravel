import { FormEvent, useState } from "react";
import { Head, router, useForm, usePage } from "@inertiajs/react";
import AdminLayout from "@/layouts/admin-layout";

type Settings = {
    admin_email: string;
    from_email: string;
    from_name: string;
    subject_prefix: string;
    alert_recipient: string;
    cooldown_hours: number;
    driver: "smtp" | "mail";
    smtp_host: string;
    smtp_port: number;
    smtp_encryption: "ssl" | "tls" | "none";
    smtp_user: string;
    has_smtp_password: boolean;
};

type Account = {
    account_id: number;
    label: string;
    email: string;
    daily_limit: number;
    sent_today: number;
    total_sent: number;
    priority: number;
    is_active: boolean;
    exhausted_until: string | null;
    last_error: string | null;
    last_used_at: string | null;
    status: "ready" | "limit_reached" | "disabled";
};

type Props = {
    settings: Settings;
    accounts: Account[];
    flash?: { success?: string };
};

const fieldClass =
    "mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const labelClass = "block text-sm font-medium text-slate-700";
const errorClass = "mt-1 text-xs text-red-600";

export default function EmailSettingsPage({ settings, accounts }: Props) {
    const { flash } = usePage<Props>().props;
    const [testOpen, setTestOpen] = useState(false);
    const [testEmail, setTestEmail] = useState(
        settings.admin_email || settings.from_email,
    );
    const [testMessage, setTestMessage] = useState("");
    const [testOk, setTestOk] = useState<boolean | null>(null);
    const [sendingTest, setSendingTest] = useState(false);

    const form = useForm({
        admin_email: settings.admin_email ?? "",
        from_email: settings.from_email ?? "",
        from_name:
            settings.from_name ?? "DENR RDAC Complaint Management System",
        subject_prefix: settings.subject_prefix ?? "[DENR RDAC]",
        alert_recipient: settings.alert_recipient ?? "",
        cooldown_hours: Number(settings.cooldown_hours ?? 12),
        driver: settings.driver ?? "smtp",
        smtp_host: settings.smtp_host ?? "",
        smtp_port: Number(settings.smtp_port ?? 465),
        smtp_encryption: settings.smtp_encryption ?? "ssl",
        smtp_user: settings.smtp_user ?? "",
        smtp_pass: "",
    });

    function submit(e: FormEvent) {
        e.preventDefault();
        form.put("/admin/email-settings", { preserveScroll: true });
    }

    function updateEncryption(value: "ssl" | "tls" | "none") {
        form.setData((data) => ({
            ...data,
            smtp_encryption: value,
            smtp_port:
                value === "ssl" ? 465 : value === "tls" ? 587 : data.smtp_port,
        }));
    }

    async function sendTest(e: FormEvent) {
        e.preventDefault();
        setSendingTest(true);
        setTestMessage("Sending test email…");
        setTestOk(null);

        try {
            const response = await fetch("/admin/email-settings/test", {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    "X-CSRF-TOKEN":
                        document.querySelector<HTMLMetaElement>(
                            'meta[name="csrf-token"]',
                        )?.content ?? "",
                },
                body: JSON.stringify({ test_email: testEmail }),
            });
            const data = await response.json();
            setTestOk(Boolean(data.ok));
            setTestMessage(
                data.message ??
                    (data.ok
                        ? "Test email sent."
                        : "Failed to send test email."),
            );
        } catch {
            setTestOk(false);
            setTestMessage(
                "The server did not return a valid response. Reload the page and try again.",
            );
        } finally {
            setSendingTest(false);
        }
    }

    return (
        <AdminLayout title="Email Settings">
            <Head title="Email Settings" />
            <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
                <header>
                    <h1 className="text-2xl font-bold text-slate-900">
                        Email Settings
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Configure the sender and outgoing email transport.
                    </p>
                </header>

                {flash?.success && (
                    <div
                        role="status"
                        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800"
                    >
                        {flash.success}
                    </div>
                )}

                <form
                    onSubmit={submit}
                    className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                    autoComplete="off"
                >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h2 className="font-bold text-slate-800">
                                Sender &amp; general settings
                            </h2>
                            <p className="mt-1 text-sm text-slate-500">
                                These values are stored in email_settings (row
                                id 1).
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setTestMessage("");
                                setTestOk(null);
                                setTestOpen(true);
                            }}
                            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            Test email connection
                        </button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label="From name" error={form.errors.from_name}>
                            <input
                                className={fieldClass}
                                maxLength={150}
                                value={form.data.from_name}
                                onChange={(e) =>
                                    form.setData("from_name", e.target.value)
                                }
                            />
                        </Field>
                        <Field
                            label="From email address"
                            error={form.errors.from_email}
                        >
                            <input
                                type="email"
                                required
                                className={fieldClass}
                                maxLength={150}
                                value={form.data.from_email}
                                onChange={(e) =>
                                    form.setData("from_email", e.target.value)
                                }
                                placeholder="name@gmail.com"
                            />
                        </Field>
                        <Field
                            label="Admin contact email"
                            error={form.errors.admin_email}
                        >
                            <input
                                type="email"
                                className={fieldClass}
                                maxLength={150}
                                value={form.data.admin_email}
                                onChange={(e) =>
                                    form.setData("admin_email", e.target.value)
                                }
                            />
                        </Field>
                        <Field
                            label="Alert recipient email"
                            error={form.errors.alert_recipient}
                        >
                            <input
                                type="email"
                                className={fieldClass}
                                maxLength={150}
                                value={form.data.alert_recipient}
                                onChange={(e) =>
                                    form.setData(
                                        "alert_recipient",
                                        e.target.value,
                                    )
                                }
                            />
                        </Field>
                        <Field
                            label="Subject prefix"
                            error={form.errors.subject_prefix}
                        >
                            <input
                                className={fieldClass}
                                maxLength={100}
                                value={form.data.subject_prefix}
                                onChange={(e) =>
                                    form.setData(
                                        "subject_prefix",
                                        e.target.value,
                                    )
                                }
                            />
                        </Field>
                        <Field
                            label="Cooldown period (hours)"
                            error={form.errors.cooldown_hours}
                        >
                            <input
                                type="number"
                                min={1}
                                max={168}
                                required
                                className={fieldClass}
                                value={form.data.cooldown_hours}
                                onChange={(e) =>
                                    form.setData(
                                        "cooldown_hours",
                                        Number(e.target.value),
                                    )
                                }
                            />
                        </Field>
                    </div>

                    <hr className="border-slate-200" />
                    <div>
                        <h2 className="font-bold text-slate-800">
                            SMTP transport
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Gmail: smtp.gmail.com, SSL/465 or TLS/587, full
                            Gmail username and an App Password.
                        </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Mail driver" error={form.errors.driver}>
                            <select
                                className={fieldClass}
                                value={form.data.driver}
                                onChange={(e) =>
                                    form.setData(
                                        "driver",
                                        e.target.value as "smtp" | "mail",
                                    )
                                }
                            >
                                <option value="smtp">SMTP server</option>
                                <option value="mail">PHP native mail</option>
                            </select>
                        </Field>
                        <Field label="SMTP host" error={form.errors.smtp_host}>
                            <input
                                className={fieldClass}
                                maxLength={255}
                                value={form.data.smtp_host}
                                onChange={(e) =>
                                    form.setData("smtp_host", e.target.value)
                                }
                                placeholder="smtp.gmail.com"
                            />
                        </Field>
                        <Field label="SMTP port" error={form.errors.smtp_port}>
                            <input
                                type="number"
                                min={1}
                                max={65535}
                                required
                                className={fieldClass}
                                value={form.data.smtp_port}
                                onChange={(e) =>
                                    form.setData(
                                        "smtp_port",
                                        Number(e.target.value),
                                    )
                                }
                            />
                        </Field>
                        <Field
                            label="Encryption"
                            error={form.errors.smtp_encryption}
                        >
                            <select
                                className={fieldClass}
                                value={form.data.smtp_encryption}
                                onChange={(e) =>
                                    updateEncryption(
                                        e.target.value as
                                            | "ssl"
                                            | "tls"
                                            | "none",
                                    )
                                }
                            >
                                <option value="ssl">SSL (port 465)</option>
                                <option value="tls">
                                    TLS / STARTTLS (port 587)
                                </option>
                                <option value="none">None</option>
                            </select>
                        </Field>
                        <Field
                            label="SMTP username"
                            error={form.errors.smtp_user}
                        >
                            <input
                                className={fieldClass}
                                maxLength={150}
                                autoComplete="off"
                                value={form.data.smtp_user}
                                onChange={(e) =>
                                    form.setData("smtp_user", e.target.value)
                                }
                                placeholder="name@gmail.com"
                            />
                        </Field>
                        <Field
                            label="SMTP password"
                            error={form.errors.smtp_pass}
                        >
                            <input
                                type="password"
                                className={fieldClass}
                                autoComplete="new-password"
                                value={form.data.smtp_pass}
                                onChange={(e) =>
                                    form.setData("smtp_pass", e.target.value)
                                }
                                placeholder={
                                    settings.has_smtp_password
                                        ? "Leave blank to keep current password"
                                        : "Enter SMTP password"
                                }
                            />
                        </Field>
                    </div>

                    {form.errors && Object.keys(form.errors).length > 0 && (
                        <p
                            role="alert"
                            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                        >
                            Please correct the highlighted fields.
                        </p>
                    )}

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={form.processing}
                            className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                        >
                            {form.processing ? "Saving…" : "Save configuration"}
                        </button>
                    </div>
                </form>

                <GmailQueue
                    accounts={accounts ?? []}
                    defaultEmail={settings.admin_email || settings.from_email}
                />
            </main>

            {testOpen && (
                <div
                    className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
                    role="presentation"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) setTestOpen(false);
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="test-title"
                        className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl"
                    >
                        <div className="flex items-center justify-between">
                            <h2
                                id="test-title"
                                className="text-lg font-bold text-slate-800"
                            >
                                Send test email
                            </h2>
                            <button
                                type="button"
                                onClick={() => setTestOpen(false)}
                                aria-label="Close"
                                className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
                            >
                                ✕
                            </button>
                        </div>
                        <p className="text-sm text-slate-500">
                            Save the form first, then send a sample message
                            using the stored settings.
                        </p>
                        <form onSubmit={sendTest} className="space-y-4">
                            <Field label="Recipient email address">
                                <input
                                    type="email"
                                    required
                                    className={fieldClass}
                                    value={testEmail}
                                    onChange={(e) =>
                                        setTestEmail(e.target.value)
                                    }
                                    placeholder="your-email@example.com"
                                />
                            </Field>
                            {testMessage && (
                                <p
                                    role="status"
                                    className={`rounded-xl border p-3 text-sm ${testOk === true ? "border-emerald-200 bg-emerald-50 text-emerald-800" : testOk === false ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}
                                >
                                    {testMessage}
                                </p>
                            )}
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setTestOpen(false)}
                                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={sendingTest}
                                    className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                                >
                                    {sendingTest ? "Sending…" : "Send test"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </AdminLayout>
    );
}

function Field({
    label,
    error,
    children,
}: {
    label: string;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <label className={labelClass}>
                {label}
                {children}
            </label>
            {error && <p className={errorClass}>{error}</p>}
        </div>
    );
}

function GmailQueue({
    accounts,
    defaultEmail,
}: {
    accounts: Account[];
    defaultEmail: string;
}) {
    const form = useForm({
        label: "",
        email: "",
        smtp_pass: "",
        daily_limit: 450,
    });

    const [testTo, setTestTo] = useState(defaultEmail ?? "");
    const [testing, setTesting] = useState<string | null>(null);
    const [result, setResult] = useState<{
        ok: boolean;
        message: string;
    } | null>(null);

    async function runTest(url: string, key: string) {
        setTesting(key);
        setResult(null);
        try {
            const response = await fetch(url, {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    "X-CSRF-TOKEN":
                        document.querySelector<HTMLMetaElement>(
                            'meta[name="csrf-token"]',
                        )?.content ?? "",
                },
                body: JSON.stringify({ test_email: testTo }),
            });
            const data = await response.json();
            setResult({
                ok: Boolean(data.ok),
                message:
                    data.message ??
                    (data.errors
                        ? Object.values(data.errors).flat().join(" ")
                        : "Test failed."),
            });
            router.reload({ only: ["accounts"] });
        } catch {
            setResult({
                ok: false,
                message:
                    "The server did not return a valid response. Reload the page and try again.",
            });
        } finally {
            setTesting(null);
        }
    }

    const act = (path: string, method: "post" | "delete" = "post", data = {}) =>
        router[method](path, data, { preserveScroll: true });

    const badge = {
        ready: "bg-emerald-100 text-emerald-800",
        limit_reached: "bg-amber-100 text-amber-800",
        disabled: "bg-slate-200 text-slate-600",
    } as const;
    const badgeText = {
        ready: "Ready",
        limit_reached: "Limit reached / cooling down",
        disabled: "Disabled",
    } as const;
    const btn =
        "rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-40";

    return (
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div>
                <h2 className="font-bold text-slate-800">
                    Gmail sending queue (automatic failover)
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                    Emails are sent from the top account first. When it hits its
                    limit or fails to authenticate, the system switches to the
                    next available account. Use a Gmail App Password for each
                    account.
                </p>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label className={labelClass}>
                    Test recipient email
                    <input
                        type="email"
                        className={fieldClass}
                        value={testTo}
                        onChange={(e) => setTestTo(e.target.value)}
                        placeholder="your-email@example.com"
                    />
                </label>
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        disabled={testing !== null || !testTo}
                        onClick={() =>
                            runTest("/admin/email-settings/test", "queue")
                        }
                        className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                    >
                        {testing === "queue"
                            ? "Sending…"
                            : "Test queue (failover)"}
                    </button>
                    <span className="text-xs text-slate-500">
                        Sends through the queue and shows which account was
                        used.
                    </span>
                </div>
                {result && (
                    <p
                        role="status"
                        className={`rounded-xl border p-3 text-sm ${result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}
                    >
                        {result.message}
                    </p>
                )}
            </div>

            <ol className="space-y-3">
                {accounts.length === 0 && (
                    <li className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                        No accounts in the queue yet. Add one below.
                    </li>
                )}
                {accounts.map((a, i) => (
                    <li
                        key={a.account_id}
                        className="rounded-xl border border-slate-200 p-4"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold text-slate-800">
                                    #{i + 1} · {a.email}
                                    {a.label && (
                                        <span className="ml-2 font-normal text-slate-500">
                                            ({a.label})
                                        </span>
                                    )}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                    Today: {a.sent_today}/{a.daily_limit} ·
                                    Total sent: {a.total_sent}
                                    {a.exhausted_until &&
                                        a.status === "limit_reached" &&
                                        ` · Retry after ${a.exhausted_until}`}
                                </p>
                            </div>
                            <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${badge[a.status]}`}
                            >
                                {badgeText[a.status]}
                            </span>
                        </div>

                        {a.last_error && (
                            <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
                                Last error: {a.last_error}
                            </p>
                        )}

                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                            <button
                                type="button"
                                disabled={i === 0}
                                className={btn}
                                onClick={() =>
                                    act(
                                        `/admin/email-accounts/${a.account_id}/move`,
                                        "post",
                                        { direction: "up" },
                                    )
                                }
                            >
                                ↑ Up
                            </button>

                            <button
                                type="button"
                                disabled={i === accounts.length - 1}
                                className={btn}
                                onClick={() =>
                                    act(
                                        `/admin/email-accounts/${a.account_id}/move`,
                                        "post",
                                        { direction: "down" },
                                    )
                                }
                            >
                                ↓ Down
                            </button>
                            <button
                                type="button"
                                className={btn}
                                onClick={() =>
                                    act(
                                        `/admin/email-accounts/${a.account_id}/toggle`,
                                    )
                                }
                            >
                                {a.is_active ? "Disable" : "Enable"}
                            </button>
                            <button
                                type="button"
                                className={btn}
                                onClick={() =>
                                    act(
                                        `/admin/email-accounts/${a.account_id}/reset`,
                                    )
                                }
                            >
                                Reset counter
                            </button>

                            <button
                                type="button"
                                disabled={testing !== null || !testTo}
                                className={btn}
                                onClick={() =>
                                    runTest(
                                        `/admin/email-accounts/${a.account_id}/test`,
                                        `acct-${a.account_id}`,
                                    )
                                }
                            >
                                {testing === `acct-${a.account_id}`
                                    ? "Testing…"
                                    : "Test"}
                            </button>

                            <button
                                type="button"
                                className={btn}
                                onClick={() => {
                                    const label = prompt(
                                        "Label",
                                        a.label ?? "",
                                    );
                                    if (label === null) return;
                                    const limit = prompt(
                                        "Daily limit (1-2000)",
                                        String(a.daily_limit),
                                    );
                                    if (limit === null) return;
                                    router.put(
                                        `/admin/email-accounts/${a.account_id}`,
                                        { label, daily_limit: Number(limit) },
                                        { preserveScroll: true },
                                    );
                                }}
                            >
                                Edit
                            </button>
                            <button
                                type="button"
                                className="rounded-lg border border-red-200 px-3 py-1.5 text-red-700 hover:bg-red-50"
                                onClick={() => {
                                    if (
                                        confirm(
                                            `Remove ${a.email} from the queue?`,
                                        )
                                    ) {
                                        act(
                                            `/admin/email-accounts/${a.account_id}`,
                                            "delete",
                                        );
                                    }
                                }}
                            >
                                Remove
                            </button>
                        </div>
                    </li>
                ))}
            </ol>

            <hr className="border-slate-200" />

            <form
                autoComplete="off"
                className="grid gap-4 md:grid-cols-2"
                onSubmit={(e) => {
                    e.preventDefault();
                    form.post("/admin/email-accounts", {
                        preserveScroll: true,
                        onSuccess: () => form.reset(),
                    });
                }}
            >
                <Field label="Label (optional)" error={form.errors.label}>
                    <input
                        className={fieldClass}
                        maxLength={100}
                        placeholder="Backup 1"
                        value={form.data.label}
                        onChange={(e) => form.setData("label", e.target.value)}
                    />
                </Field>
                <Field label="Gmail address" error={form.errors.email}>
                    <input
                        type="email"
                        required
                        className={fieldClass}
                        placeholder="name@gmail.com"
                        value={form.data.email}
                        onChange={(e) => form.setData("email", e.target.value)}
                    />
                </Field>
                <Field label="App Password" error={form.errors.smtp_pass}>
                    <input
                        type="password"
                        required
                        autoComplete="new-password"
                        className={fieldClass}
                        value={form.data.smtp_pass}
                        onChange={(e) =>
                            form.setData("smtp_pass", e.target.value)
                        }
                    />
                </Field>
                <Field label="Daily limit" error={form.errors.daily_limit}>
                    <input
                        type="number"
                        min={1}
                        max={2000}
                        required
                        className={fieldClass}
                        value={form.data.daily_limit}
                        onChange={(e) =>
                            form.setData("daily_limit", Number(e.target.value))
                        }
                    />
                </Field>
                <div className="flex justify-end md:col-span-2">
                    <button
                        type="submit"
                        disabled={form.processing}
                        className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                    >
                        {form.processing ? "Adding…" : "Add Gmail account"}
                    </button>
                </div>
            </form>
        </section>
    );
}
