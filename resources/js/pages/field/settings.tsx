import { Head, router, useForm } from "@inertiajs/react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import {
    type FormEvent,
    type ReactNode,
    useEffect,
    useRef,
    useState,
} from "react";
import FieldLayout from "@/layouts/FieldLayouts";

type Props = {
    profile: {
        username: string;
        email: string;
        full_name: string;
        position_title: string;
        contact_number: string;
    };
    office: {
        office_name: string;
        office_code: string;
        office_type: string;
        province_name: string | null;
        parent_name: string | null;
    } | null;
    activity: {
        last_login_at: string | null;
        password_changed_at: string | null;
    };
};

const fieldCls =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-green-200 disabled:bg-slate-100 aria-[invalid=true]:border-red-500";
const lblCls = "mb-1 block text-xs font-semibold text-slate-500";
const card = "rounded-2xl border border-slate-200 bg-white p-6";
const primaryBtn =
    "rounded-xl bg-[#15803d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f3d2e] focus:outline-none focus:ring-4 focus:ring-green-200 disabled:cursor-not-allowed disabled:opacity-60";

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

function Info({ label, value }: { label: string; value?: string | null }) {
    return (
        <div>
            <dt className="text-xs font-semibold text-slate-500">{label}</dt>
            <dd className="mt-0.5 text-sm break-words">{value || "—"}</dd>
        </div>
    );
}

export default function FieldSettings({ profile, office, activity }: Props) {
    const [toast, setToast] = useState<{
        text: string;
        type: "success" | "error";
    } | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const [showPwd, setShowPwd] = useState(false);

    const showToast = (text: string, type: "success" | "error" = "success") => {
        clearTimeout(timer.current);
        setToast({ text, type });
        timer.current = setTimeout(
            () => setToast(null),
            type === "error" ? 7000 : 4500,
        );
    };

    useEffect(() => {
        const offHttp = router.on("httpException", (event: any) => {
            event.preventDefault();
            const s = event.detail?.response?.status;
            showToast(
                s === 419
                    ? "Your session expired. Reload the page and try again."
                    : s === 429
                      ? "Too many attempts. Please wait a minute and try again."
                      : "Something went wrong on the server. Please try again.",
                "error",
            );
        });
        const offNet = router.on("networkError", (event: any) => {
            event.preventDefault();
            showToast(
                "Network problem. Check your connection and try again.",
                "error",
            );
        });
        return () => {
            offHttp();
            offNet();
            clearTimeout(timer.current);
        };
    }, []);

    // ---- Profile ----
    const profileForm = useForm({
        full_name: profile.full_name,
        position_title: profile.position_title,
        contact_number: profile.contact_number,
    });
    const pe = profileForm.errors as Record<string, string | undefined>;

    const submitProfile = (e: FormEvent) => {
        e.preventDefault();
        if (profileForm.processing) return;
        profileForm.put("/field/settings/profile", {
            preserveScroll: true,
            onSuccess: () => showToast("Your profile was updated."),
            onError: () =>
                showToast("Please fix the highlighted fields.", "error"),
        });
    };

    // ---- Password ----
    const pwdForm = useForm({
        current_password: "",
        password: "",
        password_confirmation: "",
    });
    const we = pwdForm.errors as Record<string, string | undefined>;
    const np = pwdForm.data.password;
    const reqs = [
        { label: "At least 8 characters", ok: np.length >= 8 },
        {
            label: "An uppercase and a lowercase letter",
            ok: /[A-Z]/.test(np) && /[a-z]/.test(np),
        },
        { label: "At least one number", ok: /\d/.test(np) },
        {
            label: "At least one special character",
            ok: /[^A-Za-z0-9]/.test(np),
        },
    ];

    const submitPassword = (e: FormEvent) => {
        e.preventDefault();
        if (pwdForm.processing) return;
        pwdForm.put("/field/settings/password", {
            preserveScroll: true,
            onSuccess: () => {
                pwdForm.reset();
                setShowPwd(false);
                showToast("Your password was changed.");
            },
            onError: () =>
                showToast(
                    "Could not change the password. Check the highlighted fields.",
                    "error",
                ),
        });
    };

    const pwdType = showPwd ? "text" : "password";

    return (
        <FieldLayout title="Settings">
            <Head title="DENR RDAC IV-A – Settings" />

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    {/* Profile */}
                    <section className={card}>
                        <h2 className="mb-1 font-semibold text-slate-700">
                            Profile
                        </h2>
                        <p className="mb-4 text-xs text-slate-500">
                            This information appears on updates and actions you
                            record.
                        </p>
                        <form
                            onSubmit={submitProfile}
                            noValidate
                            className="space-y-4"
                        >
                            <Field
                                label="Full name *"
                                htmlFor="full_name"
                                error={pe.full_name}
                            >
                                <input
                                    id="full_name"
                                    className={fieldCls}
                                    maxLength={150}
                                    autoComplete="name"
                                    aria-invalid={
                                        pe.full_name ? true : undefined
                                    }
                                    value={profileForm.data.full_name}
                                    onChange={(e) =>
                                        profileForm.setData(
                                            "full_name",
                                            e.target.value,
                                        )
                                    }
                                />
                            </Field>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field
                                    label="Position"
                                    htmlFor="position_title"
                                    error={pe.position_title}
                                >
                                    <input
                                        id="position_title"
                                        className={fieldCls}
                                        maxLength={120}
                                        value={profileForm.data.position_title}
                                        onChange={(e) =>
                                            profileForm.setData(
                                                "position_title",
                                                e.target.value,
                                            )
                                        }
                                    />
                                </Field>
                                <Field
                                    label="Contact number"
                                    htmlFor="contact_number"
                                    error={pe.contact_number}
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
                                        aria-invalid={
                                            pe.contact_number ? true : undefined
                                        }
                                        value={profileForm.data.contact_number}
                                        onChange={(e) => {
                                            const value = e.target.value
                                                .replace(/\D/g, "")
                                                .slice(0, 11);

                                            profileForm.setData(
                                                "contact_number",
                                                value,
                                            );
                                        }}
                                    />
                                </Field>
                            </div>
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={
                                        profileForm.processing ||
                                        !profileForm.isDirty
                                    }
                                    className={primaryBtn}
                                >
                                    {profileForm.processing
                                        ? "Saving..."
                                        : "Save profile"}
                                </button>
                            </div>
                        </form>
                    </section>

                    {/* Password */}
                    <section className={card}>
                        <h2 className="mb-1 font-semibold text-slate-700">
                            Change password
                        </h2>
                        <p className="mb-4 text-xs text-slate-500">
                            Use a password you do not use anywhere else.
                        </p>
                        <form
                            onSubmit={submitPassword}
                            noValidate
                            className="space-y-4"
                        >
                            <Field
                                label="Current password *"
                                htmlFor="current_password"
                                error={we.current_password}
                            >
                                <input
                                    id="current_password"
                                    type={pwdType}
                                    className={fieldCls}
                                    autoComplete="current-password"
                                    aria-invalid={
                                        we.current_password ? true : undefined
                                    }
                                    value={pwdForm.data.current_password}
                                    onChange={(e) =>
                                        pwdForm.setData(
                                            "current_password",
                                            e.target.value,
                                        )
                                    }
                                />
                            </Field>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field
                                    label="New password *"
                                    htmlFor="password"
                                    error={we.password}
                                >
                                    <input
                                        id="password"
                                        type={pwdType}
                                        className={fieldCls}
                                        maxLength={72}
                                        autoComplete="new-password"
                                        aria-invalid={
                                            we.password ? true : undefined
                                        }
                                        value={pwdForm.data.password}
                                        onChange={(e) =>
                                            pwdForm.setData(
                                                "password",
                                                e.target.value,
                                            )
                                        }
                                    />
                                </Field>
                                <Field
                                    label="Confirm new password *"
                                    htmlFor="password_confirmation"
                                >
                                    <input
                                        id="password_confirmation"
                                        type={pwdType}
                                        className={fieldCls}
                                        maxLength={72}
                                        autoComplete="new-password"
                                        value={
                                            pwdForm.data.password_confirmation
                                        }
                                        onChange={(e) =>
                                            pwdForm.setData(
                                                "password_confirmation",
                                                e.target.value,
                                            )
                                        }
                                    />
                                </Field>
                            </div>
                            <ul className="space-y-1 text-xs">
                                {reqs.map((r) => (
                                    <li
                                        key={r.label}
                                        className={
                                            r.ok
                                                ? "text-green-700"
                                                : np
                                                  ? "text-red-600"
                                                  : "text-slate-500"
                                        }
                                    >
                                        • {r.label}
                                    </li>
                                ))}
                            </ul>
                            <div className="flex flex-wrap items-center justify-between gap-3">
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
                                <button
                                    type="submit"
                                    disabled={
                                        pwdForm.processing ||
                                        !pwdForm.data.current_password ||
                                        !pwdForm.data.password
                                    }
                                    className={primaryBtn}
                                >
                                    {pwdForm.processing
                                        ? "Saving..."
                                        : "Change password"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>

                {/* Read-only side */}
                <div className="space-y-6">
                    <section className={card}>
                        <h2 className="mb-3 font-semibold text-slate-700">
                            Account
                        </h2>
                        <dl className="space-y-3">
                            <Info label="Username" value={profile.username} />
                            <Info label="Email" value={profile.email} />
                            <Info
                                label="Last sign-in"
                                value={fmt(activity.last_login_at)}
                            />
                            <Info
                                label="Password last changed"
                                value={
                                    activity.password_changed_at
                                        ? fmt(activity.password_changed_at)
                                        : "Not recorded"
                                }
                            />
                        </dl>
                        <p className="mt-4 text-xs text-slate-400">
                            To change your username or email, contact the RDAC
                            Administrator.
                        </p>
                    </section>

                    <section className={card}>
                        <h2 className="mb-3 font-semibold text-slate-700">
                            Your office
                        </h2>
                        <dl className="space-y-3">
                            <Info label="Office" value={office?.office_name} />
                            <Info label="Code" value={office?.office_code} />
                            <Info
                                label="Province"
                                value={office?.province_name}
                            />
                            <Info
                                label="Reports to"
                                value={office?.parent_name}
                            />
                        </dl>
                    </section>
                </div>
            </div>

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
        </FieldLayout>
    );
}
