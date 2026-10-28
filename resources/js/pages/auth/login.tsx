import { FormEvent, useState } from "react";
import { router, usePage } from "@inertiajs/react";

export default function Login() {
    const [login, setLogin] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const { errors } = usePage().props as {
        errors: Record<string, string>;
    };

    function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();

        router.post(
            "/login",
            { login, password },
            {
                onStart: () => setLoading(true),
                onFinish: () => setLoading(false),
            },
        );
    }

    const inputBase =
        "w-full rounded-lg border bg-white py-3 pl-11 pr-4 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:ring-4";
    const inputOk =
        "border-gray-300 focus:border-green-600 focus:ring-green-600/15";
    const inputErr =
        "border-red-400 focus:border-red-500 focus:ring-red-500/15";

    return (
        <div className="grid min-h-screen lg:grid-cols-2">
            {/* Brand panel */}
            <aside className="relative hidden overflow-hidden bg-gradient-to-br from-green-800 via-green-700 to-emerald-900 lg:flex lg:flex-col lg:justify-between lg:p-12">
                <div
                    aria-hidden
                    className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5"
                />
                <div
                    aria-hidden
                    className="absolute -bottom-32 -left-20 h-[28rem] w-[28rem] rounded-full bg-white/5"
                />

                <div className="relative flex items-center gap-3">
                    {/* Replace with your logo: <img src="/logo.png" className="h-12 w-12" /> */}
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-lg font-bold text-white ring-1 ring-white/30">
                        D
                    </div>
                    <span className="text-sm font-semibold uppercase tracking-widest text-green-100">
                        DENR
                    </span>
                </div>

                <div className="relative max-w-md">
                    <h2 className="text-4xl font-bold leading-tight text-white">
                        Welcome back.
                    </h2>
                    <p className="mt-4 text-base leading-relaxed text-green-100/90">
                        Sign in to access your dashboard, manage records, and
                        continue where you left off.
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
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-700 font-bold text-white">
                            D
                        </div>
                        <span className="text-sm font-semibold uppercase tracking-widest text-green-800">
                            DENR
                        </span>
                    </div>

                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                        Sign in
                    </h1>
                    <p className="mt-2 text-sm text-gray-500">
                        Enter your credentials to continue.
                    </p>

                    <form
                        onSubmit={handleSubmit}
                        className="mt-8 space-y-5"
                        noValidate
                    >
                        {errors.login && (
                            <div
                                role="alert"
                                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                            >
                                <svg
                                    className="mt-0.5 h-4 w-4 shrink-0"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1 3a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                                <span>{errors.login}</span>
                            </div>
                        )}

                        {/* Username */}
                        <div>
                            <label
                                htmlFor="login"
                                className="mb-1.5 block text-sm font-medium text-gray-700"
                            >
                                Username or email
                            </label>
                            <div className="relative">
                                <svg
                                    className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={1.8}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.1a7.5 7.5 0 0115 0"
                                    />
                                </svg>
                                <input
                                    id="login"
                                    type="text"
                                    value={login}
                                    onChange={(e) => setLogin(e.target.value)}
                                    autoComplete="username"
                                    autoFocus
                                    required
                                    placeholder="you@example.com"
                                    className={`${inputBase} ${errors.login ? inputErr : inputOk}`}
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label
                                htmlFor="password"
                                className="mb-1.5 block text-sm font-medium text-gray-700"
                            >
                                Password
                            </label>
                            <div className="relative">
                                <svg
                                    className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={1.8}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M16.5 10.5V7.5a4.5 4.5 0 10-9 0v3m-1.5 0h12a1.5 1.5 0 011.5 1.5v7.5A1.5 1.5 0 0118 21H6a1.5 1.5 0 01-1.5-1.5V12A1.5 1.5 0 016 10.5z"
                                    />
                                </svg>
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    autoComplete="current-password"
                                    required
                                    placeholder="••••••••"
                                    className={`${inputBase} pr-12 ${errors.password ? inputErr : inputOk}`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((s) => !s)}
                                    aria-label={
                                        showPassword
                                            ? "Hide password"
                                            : "Show password"
                                    }
                                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                                >
                                    {showPassword ? (
                                        <svg
                                            className="h-5 w-5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth={1.8}
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M3.98 8.22A10.5 10.5 0 001.93 12c1.4 4.1 5.3 7.5 10.07 7.5 1.9 0 3.66-.54 5.15-1.47M6.23 6.23A10.45 10.45 0 0112 4.5c4.77 0 8.67 3.4 10.07 7.5a10.5 10.5 0 01-4.29 5.28M6.23 6.23L3 3m3.23 3.23l3.65 3.65m7.9 7.9L21 21m-3.22-3.22l-3.65-3.65m0 0a3 3 0 10-4.24-4.24m4.24 4.24L9.88 9.88"
                                            />
                                        </svg>
                                    ) : (
                                        <svg
                                            className="h-5 w-5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth={1.8}
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M2.04 12.32a1 1 0 010-.64C3.42 7.51 7.36 4.5 12 4.5s8.58 3.01 9.96 7.18a1 1 0 010 .64C20.58 16.49 16.64 19.5 12 19.5s-8.58-3.01-9.96-7.18z"
                                            />
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                            />
                                        </svg>
                                    )}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="mt-1.5 text-sm text-red-600">
                                    {errors.password}
                                </p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-800 focus:outline-none focus:ring-4 focus:ring-green-600/30 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {loading && (
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
                            {loading ? "Signing in..." : "Sign in"}
                        </button>
                    </form>

                    <p className="mt-8 text-center text-xs text-gray-400">
                        Having trouble signing in? Contact your system
                        administrator.
                    </p>
                </div>
            </main>
        </div>
    );
}
