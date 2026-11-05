import { FormEvent, useState } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';

type Settings = {
    admin_email: string;
    from_email: string;
    from_name: string;
    subject_prefix: string;
    alert_recipient: string;
    cooldown_hours: number;
    driver: 'smtp' | 'mail';
    smtp_host: string;
    smtp_port: number;
    smtp_encryption: 'ssl' | 'tls' | 'none';
    smtp_user: string;
    has_smtp_password: boolean;
};

type Props = {
    settings: Settings;
    flash?: { success?: string };
};

const fieldClass =
    'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';
const labelClass = 'block text-sm font-medium text-slate-700';
const errorClass = 'mt-1 text-xs text-red-600';

export default function EmailSettingsPage({ settings }: Props) {
    const { flash } = usePage<Props>().props;
    const [testOpen, setTestOpen] = useState(false);
    const [testEmail, setTestEmail] = useState(
        settings.admin_email || settings.from_email,
    );
    const [testMessage, setTestMessage] = useState('');
    const [testOk, setTestOk] = useState<boolean | null>(null);
    const [sendingTest, setSendingTest] = useState(false);

    const form = useForm({
        admin_email: settings.admin_email ?? '',
        from_email: settings.from_email ?? '',
        from_name:
            settings.from_name ?? 'DENR RDAC Complaint Management System',
        subject_prefix: settings.subject_prefix ?? '[DENR RDAC]',
        alert_recipient: settings.alert_recipient ?? '',
        cooldown_hours: Number(settings.cooldown_hours ?? 12),
        driver: settings.driver ?? 'smtp',
        smtp_host: settings.smtp_host ?? '',
        smtp_port: Number(settings.smtp_port ?? 465),
        smtp_encryption: settings.smtp_encryption ?? 'ssl',
        smtp_user: settings.smtp_user ?? '',
        smtp_pass: '',
    });

    function submit(e: FormEvent) {
        e.preventDefault();
        form.put('/admin/email-settings', { preserveScroll: true });
    }

    function updateEncryption(value: 'ssl' | 'tls' | 'none') {
        form.setData((data) => ({
            ...data,
            smtp_encryption: value,
            smtp_port:
                value === 'ssl' ? 465 : value === 'tls' ? 587 : data.smtp_port,
        }));
    }

    async function sendTest(e: FormEvent) {
        e.preventDefault();
        setSendingTest(true);
        setTestMessage('Sending test email…');
        setTestOk(null);

        try {
            const response = await fetch('/admin/email-settings/test', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN':
                        document.querySelector<HTMLMetaElement>(
                            'meta[name="csrf-token"]',
                        )?.content ?? '',
                },
                body: JSON.stringify({ test_email: testEmail }),
            });
            const data = await response.json();
            setTestOk(Boolean(data.ok));
            setTestMessage(
                data.message ??
                    (data.ok
                        ? 'Test email sent.'
                        : 'Failed to send test email.'),
            );
        } catch {
            setTestOk(false);
            setTestMessage(
                'The server did not return a valid response. Reload the page and try again.',
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
                                setTestMessage('');
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
                                    form.setData('from_name', e.target.value)
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
                                    form.setData('from_email', e.target.value)
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
                                    form.setData('admin_email', e.target.value)
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
                                        'alert_recipient',
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
                                        'subject_prefix',
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
                                        'cooldown_hours',
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
                                        'driver',
                                        e.target.value as 'smtp' | 'mail',
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
                                    form.setData('smtp_host', e.target.value)
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
                                        'smtp_port',
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
                                            | 'ssl'
                                            | 'tls'
                                            | 'none',
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
                                    form.setData('smtp_user', e.target.value)
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
                                    form.setData('smtp_pass', e.target.value)
                                }
                                placeholder={
                                    settings.has_smtp_password
                                        ? 'Leave blank to keep current password'
                                        : 'Enter SMTP password'
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
                            {form.processing ? 'Saving…' : 'Save configuration'}
                        </button>
                    </div>
                </form>
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
                                    className={`rounded-xl border p-3 text-sm ${testOk === true ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : testOk === false ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
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
                                    {sendingTest ? 'Sending…' : 'Send test'}
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
