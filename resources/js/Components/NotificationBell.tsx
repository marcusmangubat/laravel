import { router, usePage } from "@inertiajs/react";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Item = {
    id: number;
    complaint_id: number | null;
    type: string;
    message: string;
    is_read: boolean;
    created_at: string;
};

// DB timestamps are stored in UTC; show them in the viewer's local time.
function ago(ts: string, now: number) {
    const normalized = ts.trim().replace(" ", "T");

    // Respect timestamps that already contain a timezone.
    const d = new Date(normalized);

    if (isNaN(d.getTime())) return "Invalid date";

    const seconds = Math.floor((now - d.getTime()) / 1000);

    if (seconds < 0) return "Time mismatch";

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;

    const days = Math.floor(seconds / 86400);

    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;

    return d.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

export default function NotificationBell({ readUrl }: { readUrl: string }) {
    const { notifications } = usePage<any>().props as {
        notifications: { unread: number; items: Item[] } | null;
    };
    const unread = notifications?.unread ?? 0;
    const items = notifications?.items ?? [];

    const [open, setOpen] = useState(false);
    const [now, setNow] = useState(() => Date.now());

    const ref = useRef<HTMLDivElement>(null);

    // Update relative timestamps every 30 seconds.
    useEffect(() => {
        const interval = setInterval(() => {
            if (document.visibilityState === "visible") {
                setNow(Date.now());
            }
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node))
                setOpen(false);
        };
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, []);

    // Light polling so new notifications appear without a page change
    useEffect(() => {
        const t = setInterval(() => {
            if (document.visibilityState === "visible") {
                router.reload({ only: ["notifications"] });
            }
        }, 30000);
        return () => clearInterval(t);
    }, []);

    const openItem = (n: Item) => {
        setOpen(false);
        router.post(
            `/notifications/${n.id}/open`,
            {},
            { preserveScroll: true },
        );
    };

    const markAll = () =>
        router.post(readUrl, {}, { preserveScroll: true, preserveState: true });

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                aria-label="Notifications"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
                className="relative h-10 w-10 rounded-xl border cursor-pointer border-slate-300 text-slate-600 hover:bg-slate-50 focus:ring-4 focus:ring-green-200 focus:outline-none"
            >
                <Bell className="mx-auto h-4 w-4" />
                {unread > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 h-5 min-w-[1.25rem] rounded-full bg-red-600 px-1 text-xs leading-5 font-semibold text-white">
                        {unread > 99 ? "99+" : unread}
                    </span>
                )}
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-label="Notifications"
                    className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white shadow-xl"
                >
                    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                        <p className="text-sm font-semibold text-slate-800">
                            Notifications
                        </p>
                        {unread > 0 && (
                            <button
                                type="button"
                                onClick={markAll}
                                className="text-xs font-semibold cursor-pointer text-[#15803d] hover:text-[#0f3d2e]"
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>

                    {items.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-slate-500">
                            You are all caught up.
                        </div>
                    ) : (
                        <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
                            {items.map((n) => (
                                <li key={n.id}>
                                    <button
                                        type="button"
                                        onClick={() => openItem(n)}
                                        className={`flex w-full gap-3 px-4 py-3 cursor-pointer text-left hover:bg-slate-50 ${
                                            n.is_read ? "" : "bg-green-50/60"
                                        }`}
                                    >
                                        <span
                                            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                                                n.is_read
                                                    ? "bg-transparent"
                                                    : "bg-red-600"
                                            }`}
                                        />
                                        <span className="min-w-0">
                                            <span
                                                className={`block text-sm ${
                                                    n.is_read
                                                        ? "text-slate-600"
                                                        : "font-semibold text-slate-800"
                                                }`}
                                            >
                                                {n.message}
                                            </span>
                                            <span className="mt-0.5 block text-xs text-slate-400">
                                                {ago(n.created_at, now)}
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
