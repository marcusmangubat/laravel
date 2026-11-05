import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Bell,
    Building2,
    ClipboardList,
    FileText,
    Gauge,
    LogOut,
    Mail,
    ShieldCheck,
    Users,
} from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';

const serif = { fontFamily: "'DM Serif Display', serif" };

const NAV = [
    {
        href: '/admin/dashboard',
        label: 'Dashboard',
        short: 'Dashboard',
        icon: Gauge,
    },
    {
        href: '/admin/complaints',
        label: 'Complaints',
        short: 'Complaints',
        icon: ClipboardList,
    },
    {
        href: '/admin/offices',
        label: 'Office Directory',
        short: 'Offices',
        icon: Building2,
    },
    {
        href: '/admin/users',
        label: 'Field Office Accounts',
        short: 'Accounts',
        icon: Users,
    },
    {
        href: '/admin/reports',
        label: 'Reports',
        short: 'Reports',
        icon: FileText,
    },
    {
        href: '/admin/audit',
        label: 'Audit Trail',
        short: 'Audit',
        icon: ShieldCheck,
    },
    {
        href: '/admin/email-settings',
        label: 'Email Settings',
        short: 'Email',
        icon: Mail,
    },
];

type Props = {
    title: string;
    unread?: number;
    actions?: ReactNode;
    children: ReactNode;
};

export default function AdminLayout({
    title,
    unread = 0,
    actions,
    children,
}: Props) {
    const page = usePage<any>();
    const current = page.url.split('?')[0];
    const fullName: string =
        page.props.auth?.user?.full_name ?? 'Administrator';

    const [bellOpen, setBellOpen] = useState(false);
    const bellRef = useRef<HTMLDivElement>(null);

    // Close the notification panel when clicking elsewhere
    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (bellRef.current && !bellRef.current.contains(e.target as Node))
                setBellOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    const markRead = () =>
        router.post(
            '/admin/notifications/read',
            {},
            { preserveScroll: true, preserveState: true },
        );

    return (
        <div
            className="min-h-screen bg-slate-100 text-slate-800"
            style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
        >
            <Head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link
                    href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Serif+Display&display=swap"
                    rel="stylesheet"
                />
            </Head>

            {/* ───── Sidebar (desktop) ───── */}
            <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-[#0f3d2e] text-green-100 lg:flex">
                <div className="border-b border-white/10 px-6 py-6">
                    <div className="flex items-center gap-3">
                        <img
                            src="/pictures/logo.jpg"
                            alt="DENR logo"
                            className="h-10 w-auto"
                        />
                        <p
                            className="text-lg leading-tight text-white"
                            style={serif}
                        >
                            Regional DENR
                            <br />
                            Action Center
                        </p>
                    </div>
                    <p className="mt-3 text-xs text-green-300">
                        DENR Region IV-A CALABARZON
                    </p>
                </div>

                <nav
                    className="flex-1 space-y-1 px-3 py-4 text-sm"
                    aria-label="Main"
                >
                    {NAV.map(({ href, label, icon: Icon }) => {
                        const active = current === href;
                        return (
                            <Link
                                key={href}
                                href={href}
                                aria-current={active ? 'page' : undefined}
                                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                                    active
                                        ? 'bg-white/10 font-semibold text-white'
                                        : 'hover:bg-white/5'
                                }`}
                            >
                                <Icon className="h-4 w-4 shrink-0" />
                                {label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="border-t border-white/10 px-6 py-4 text-xs">
                    <p className="truncate font-semibold text-white">
                        {fullName}
                    </p>
                    <Link
                        href="/logout"
                        method="post"
                        as="button"
                        className="text-green-300 hover:text-white"
                    >
                        Sign out
                    </Link>
                </div>
            </aside>

            <div className="lg:pl-64">
                {/* ───── Top bar ───── */}
                <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
                    <div className="flex items-center justify-between px-4 py-3 lg:px-8">
                        <div>
                            <h1
                                className="text-xl text-[#0f3d2e]"
                                style={serif}
                            >
                                {title}
                            </h1>
                            <p className="text-xs text-slate-500">
                                Welcome, {fullName}
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            {actions}

                            <div className="relative" ref={bellRef}>
                                <button
                                    type="button"
                                    aria-label="Notifications"
                                    aria-expanded={bellOpen}
                                    onClick={() => setBellOpen((o) => !o)}
                                    className="relative h-10 w-10 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 focus:ring-4 focus:ring-green-200 focus:outline-none"
                                >
                                    <Bell className="mx-auto h-4 w-4" />
                                    {unread > 0 && (
                                        <span className="absolute -top-1.5 -right-1.5 h-5 min-w-[1.25rem] rounded-full bg-red-600 px-1 text-xs leading-5 font-semibold text-white">
                                            {unread > 99 ? '99+' : unread}
                                        </span>
                                    )}
                                </button>

                                {bellOpen && (
                                    <div
                                        role="dialog"
                                        aria-label="Notifications"
                                        className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white shadow-xl"
                                    >
                                        <div className="border-b border-slate-200 px-4 py-3">
                                            <p className="text-sm font-semibold text-slate-800">
                                                Notifications
                                            </p>
                                        </div>
                                        <div className="px-4 py-6 text-center text-sm text-slate-600">
                                            {unread > 0
                                                ? `You have ${unread} unread notification${unread === 1 ? '' : 's'}.`
                                                : 'You are all caught up.'}
                                        </div>
                                        {unread > 0 && (
                                            <div className="border-t border-slate-200 px-4 py-3">
                                                <button
                                                    type="button"
                                                    onClick={markRead}
                                                    className="w-full rounded-xl bg-[#15803d] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0f3d2e]"
                                                >
                                                    Mark all as read
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <Link
                                href="/logout"
                                method="post"
                                as="button"
                                aria-label="Sign out"
                                className="grid h-10 w-10 place-items-center rounded-xl border border-slate-300 text-slate-600 lg:hidden"
                            >
                                <LogOut className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>

                    {/* Mobile nav */}
                    <nav
                        className="flex gap-2 overflow-x-auto px-4 pb-3 text-xs lg:hidden"
                        aria-label="Main (mobile)"
                    >
                        {NAV.map(({ href, short }) => (
                            <Link
                                key={href}
                                href={href}
                                className={`shrink-0 rounded-full px-3 py-1.5 ${
                                    current === href
                                        ? 'bg-[#0f3d2e] text-white'
                                        : 'bg-slate-200'
                                }`}
                            >
                                {short}
                            </Link>
                        ))}
                    </nav>
                </header>

                <main className="space-y-6 px-4 py-6 lg:px-8">{children}</main>
            </div>
        </div>
    );
}
