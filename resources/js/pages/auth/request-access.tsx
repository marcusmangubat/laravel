import { Head, Link, useForm } from "@inertiajs/react";
import { Req, Select, fieldCls } from "@/Components/form-controls";
import {
    AtSign,
    Briefcase,
    Building2,
    CheckCircle2,
    Mail,
    Phone,
    User,
} from "lucide-react";
import { FormEvent, ReactNode, useState } from "react";

type Office = {
    office_id: number;
    office_name: string;
    office_code: string | null;
};

const officeLabel = (o: Office) =>
    o.office_name + (o.office_code ? ` (${o.office_code})` : "");

const inputBase =
    "w-full rounded-lg border bg-white py-3 pl-11 pr-4 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:ring-4";
const inputOk =
    "border-gray-300 focus:border-green-600 focus:ring-green-600/15";
const inputErr = "border-red-400 focus:border-red-500 focus:ring-red-500/15";

function Field({
    label,
    htmlFor,
    icon,
    error,
    hint,
    children,
}: {
    label: string;
    htmlFor: string;
    icon: ReactNode;
    error?: string;
    hint?: string;
    children: ReactNode;
}) {
    return (
        <div>
            <label
                htmlFor={htmlFor}
                className="mb-1.5 block text-sm font-medium text-gray-700"
            >
                {label}
            </label>
            <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3.5 z-10 -translate-y-1/2 text-gray-400">
                    {icon}
                </span>
                {children}
            </div>
            {error ? (
                <p className="mt-1.5 text-sm text-red-600">{error}</p>
            ) : hint ? (
                <p className="mt-1.5 text-xs text-gray-500">{hint}</p>
            ) : null}
        </div>
    );
}

export default function RequestAccess({ offices }: { offices: Office[] }) {
    const [submitted, setSubmitted] = useState(false);
    const form = useForm({
        office_id: "",
        full_name: "",
        username: "",
        email: "",
        position_title: "",
        contact_number: "",
        website: "", // honeypot, must stay empty
    });
    const { data, setData, errors } = form;

    const err = (k: keyof typeof errors) => errors[k] as string | undefined;
    const bad = (k: keyof typeof errors) => (errors[k] ? true : undefined);
    const cls = (k: keyof typeof errors) =>
        `${inputBase} ${errors[k] ? inputErr : inputOk}`;

    function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (form.processing) return;
        form.post("/request-access", {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setSubmitted(true);
            },
        });
    }

    const icon = "h-5 w-5";

    return (
        <div className="grid min-h-screen lg:grid-cols-2">
            <Head title="DENR RDAC IV-A – Request Access" />

            {/* Brand panel */}
            <aside className="relative hidden overflow-hidden bg-gradient-to-br from-green-800 via-green-700 to-emerald-900 lg:flex lg:flex-col lg:justify-between lg:p-12">
                <div
                    aria-hidden
                    className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/5"
                />
                <div
                    aria-hidden
                    className="absolute -bottom-32 -left-20 h-[28rem] w-[28rem] rounded-full bg-white/5"
                />

                <div className="relative flex items-center gap-3">
                    <img
                        src="/logo.jpg"
                        alt="DENR Logo"
                        className="h-12 w-12"
                    />
                    <span className="text-sm font-semibold tracking-widest text-green-100 uppercase">
                        DENR
                    </span>
                </div>

                <div className="relative max-w-md">
                    <h2 className="text-4xl leading-tight font-bold text-white">
                        Request field-office access.
                    </h2>
                    <p className="mt-4 text-base leading-relaxed text-green-100/90">
                        Submit your details and an RDAC administrator will
                        review your request and set up your account.
                    </p>
                </div>

                <p className="relative text-xs text-green-100/70">
                    &copy; {new Date().getFullYear()} DENR. All rights reserved.
                </p>
            </aside>

            {/* Form panel */}
            <main className="flex items-center justify-center bg-gray-50 px-6 py-12">
                <div className="w-full max-w-md">
                    {/* Mobile brand */}
                    <div className="mb-8 flex items-center gap-3 lg:hidden">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
                            <img
                                src="/logo.jpg"
                                alt="DENR Logo"
                                className="h-full w-full object-contain"
                            />
                        </div>
                        <span className="text-sm font-semibold tracking-widest text-green-800 uppercase">
                            DENR
                        </span>
                    </div>

                    {submitted ? (
                        <div className="text-center">
                            <CheckCircle2 className="mx-auto h-12 w-12 text-green-700" />
                            <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">
                                Request submitted
                            </h1>
                            <p className="mt-2 text-sm text-gray-500">
                                You will receive your temporary password from
                                the administrator once your request is approved.
                            </p>
                            <Link
                                href="/login"
                                className="mt-8 flex w-full items-center justify-center rounded-lg bg-green-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-800 focus:ring-4 focus:ring-green-600/30 focus:outline-none"
                            >
                                Back to sign in
                            </Link>
                        </div>
                    ) : (
                        <>
                            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                                Request access
                            </h1>
                            <p className="mt-2 text-sm text-gray-500">
                                Fill in your details to request a field-office
                                account.
                            </p>

                            <form
                                onSubmit={submit}
                                noValidate
                                className="mt-8 space-y-5"
                            >
                                <Field
                                    label="Office"
                                    htmlFor="office_id"
                                    icon={<Building2 className={icon} />}
                                    error={err("office_id")}
                                >
                                    <Select
                                        id="office_id"
                                        className={`${cls("office_id")} !appearance-none pr-10 ${data.office_id ? "" : "text-gray-400"}`}
                                        aria-invalid={bad("office_id")}
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
                                                className="text-gray-900"
                                            >
                                                {officeLabel(o)}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>

                                <Field
                                    label="Full name"
                                    htmlFor="full_name"
                                    icon={<User className={icon} />}
                                    error={err("full_name")}
                                >
                                    <input
                                        id="full_name"
                                        className={cls("full_name")}
                                        maxLength={150}
                                        autoComplete="name"
                                        aria-invalid={bad("full_name")}
                                        value={data.full_name}
                                        onChange={(e) =>
                                            setData("full_name", e.target.value)
                                        }
                                    />
                                </Field>

                                <Field
                                    label="Username"
                                    htmlFor="username"
                                    icon={<AtSign className={icon} />}
                                    error={err("username")}
                                    hint="Letters, numbers, periods and underscores."
                                >
                                    <input
                                        id="username"
                                        className={cls("username")}
                                        maxLength={60}
                                        autoComplete="off"
                                        autoCapitalize="none"
                                        aria-invalid={bad("username")}
                                        value={data.username}
                                        onChange={(e) =>
                                            setData("username", e.target.value)
                                        }
                                    />
                                </Field>

                                <Field
                                    label="Email"
                                    htmlFor="email"
                                    icon={<Mail className={icon} />}
                                    error={err("email")}
                                >
                                    <input
                                        id="email"
                                        type="email"
                                        className={cls("email")}
                                        maxLength={150}
                                        autoComplete="email"
                                        placeholder="you@example.com"
                                        aria-invalid={bad("email")}
                                        value={data.email}
                                        onChange={(e) =>
                                            setData("email", e.target.value)
                                        }
                                    />
                                </Field>

                                <Field
                                    label="Position"
                                    htmlFor="position_title"
                                    icon={<Briefcase className={icon} />}
                                    error={err("position_title")}
                                >
                                    <input
                                        id="position_title"
                                        className={cls("position_title")}
                                        maxLength={120}
                                        autoComplete="organization-title"
                                        aria-invalid={bad("position_title")}
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
                                    icon={<Phone className={icon} />}
                                    error={err("contact_number")}
                                >
                                    <input
                                        id="contact_number"
                                        type="tel"
                                        inputMode="numeric"
                                        className={cls("contact_number")}
                                        maxLength={11}
                                        autoComplete="tel"
                                        placeholder="09XXXXXXXXX"
                                        aria-invalid={bad("contact_number")}
                                        value={data.contact_number}
                                        onChange={(e) =>
                                            setData(
                                                "contact_number",
                                                e.target.value
                                                    .replace(/\D/g, "")
                                                    .slice(0, 11),
                                            )
                                        }
                                    />
                                </Field>

                                {/* Honeypot */}
                                <div
                                    aria-hidden="true"
                                    className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
                                >
                                    <label htmlFor="website">Website</label>
                                    <input
                                        id="website"
                                        tabIndex={-1}
                                        autoComplete="off"
                                        value={data.website}
                                        onChange={(e) =>
                                            setData("website", e.target.value)
                                        }
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={form.processing}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-800 focus:ring-4 focus:ring-green-600/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {form.processing && (
                                        <svg
                                            className="h-4 w-4 animate-spin"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            />
                                            <path
                                                className="opacity-90"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                            />
                                        </svg>
                                    )}
                                    {form.processing
                                        ? "Submitting..."
                                        : "Submit request"}
                                </button>
                            </form>

                            <div className="mt-6 text-center text-sm">
                                <span className="text-gray-500">
                                    Already have an account?{" "}
                                </span>
                                <Link
                                    href="/login"
                                    className="font-semibold text-green-700 hover:underline"
                                >
                                    Sign in
                                </Link>
                            </div>
                        </>
                    )}

                    <p className="mt-8 text-center text-xs text-gray-400">
                        Having trouble? Contact your system administrator.
                    </p>
                </div>
            </main>
        </div>
    );
}
