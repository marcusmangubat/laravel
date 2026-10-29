import { Head, Link, router, usePage } from "@inertiajs/react";
import { Search } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import AdminLayout from "@/layouts/admin-layout";

// ───────── Types (match what OfficeController sends) ─────────
type Office = {
    office_id: number;
    office_code: string;
    office_name: string;
    type_label: string;
    province_name: string | null;
    parent_name: string | null;
    contact_number: string | null;
    email: string | null;
    can_receive_assignments: number;
    is_active: number;
    remarks: string | null;
    account_count: number;
    complaint_count: number;
};
type Paginated = {
    data: Office[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
};
type Filters = {
    q: string;
    office_type: string;
    province_id: string;
    is_active: string;
    can_receive: string;
};

const fieldCls =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-green-200";
const lblCls = "mb-1 block text-xs font-semibold text-slate-500";

function Field({
    label,
    htmlFor,
    children,
}: {
    label: string;
    htmlFor: string;
    children: ReactNode;
}) {
    return (
        <div>
            <label htmlFor={htmlFor} className={lblCls}>
                {label}
            </label>
            {children}
        </div>
    );
}

// ───────── Page ─────────
export default function Offices({
    offices,
    filters,
    office_types,
    provinces,
}: {
    offices: Paginated;
    filters: Filters;
    office_types: Record<string, string>;
    provinces: { province_id: number; province_name: string }[];
}) {
    const page = usePage<any>();
    const [f, setF] = useState<Filters>(filters);
    const [loading, setLoading] = useState(false);
    const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    );

    // Send the filters to the server as URL parameters
    const go = (next: Filters, pageNo = 1) => {
        const params: Record<string, string | number> = {};
        (Object.keys(next) as (keyof Filters)[]).forEach((k) => {
            if (next[k] !== "") params[k] = next[k];
        });
        if (pageNo > 1) params.page = pageNo;
        router.get("/admin/offices", params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: ["offices", "filters", "errors"],
            onStart: () => setLoading(true),
            onFinish: () => setLoading(false),
        });
    };

    const setFilter = (key: keyof Filters, value: string) => {
        const next = { ...f, [key]: value };
        setF(next);
        if (key === "q") {
            clearTimeout(debounce.current);
            debounce.current = setTimeout(() => go(next), 350); // wait until typing pauses
            return;
        }
        go(next);
    };

    const clearFilters = () => {
        const empty: Filters = {
            q: "",
            office_type: "",
            province_id: "",
            is_active: "",
            can_receive: "",
        };
        setF(empty);
        go(empty);
    };

    const errorMsg = Object.values(page.props.errors ?? {})[0] as
        | string
        | undefined;
    const start = offices.total
        ? (offices.current_page - 1) * offices.per_page + 1
        : 0;
    const end = Math.min(
        offices.current_page * offices.per_page,
        offices.total,
    );

    return (
        <AdminLayout title="Office Directory">
            <Head title="DENR RDAC IV-A – Office Directory" />

            {/* Filters */}
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm text-slate-600">
                    DENR Region IV-A offices that can receive complaints, field
                    accounts, and assignments.
                </p>
                <div className="relative max-w-md">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <label htmlFor="q" className="sr-only">
                        Search offices
                    </label>
                    <input
                        id="q"
                        type="search"
                        className={`${fieldCls} pl-10`}
                        placeholder="Search name, code, province, or parent office"
                        value={f.q}
                        onChange={(e) => setFilter("q", e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Field label="Type" htmlFor="f_type">
                        <select
                            id="f_type"
                            className={fieldCls}
                            value={f.office_type}
                            onChange={(e) =>
                                setFilter("office_type", e.target.value)
                            }
                        >
                            <option value="">All types</option>
                            {Object.entries(office_types).map(
                                ([code, label]) => (
                                    <option key={code} value={code}>
                                        {label}
                                    </option>
                                ),
                            )}
                        </select>
                    </Field>
                    <Field label="Province" htmlFor="f_province">
                        <select
                            id="f_province"
                            className={fieldCls}
                            value={f.province_id}
                            onChange={(e) =>
                                setFilter("province_id", e.target.value)
                            }
                        >
                            <option value="">All provinces</option>
                            {provinces.map((p) => (
                                <option
                                    key={p.province_id}
                                    value={p.province_id}
                                >
                                    {p.province_name}
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
                            <option value="0">Inactive</option>
                        </select>
                    </Field>
                    <Field label="Assignments" htmlFor="f_assign">
                        <select
                            id="f_assign"
                            className={fieldCls}
                            value={f.can_receive}
                            onChange={(e) =>
                                setFilter("can_receive", e.target.value)
                            }
                        >
                            <option value="">All</option>
                            <option value="1">Can receive</option>
                            <option value="0">Cannot receive</option>
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

            {errorMsg && (
                <div
                    role="alert"
                    className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700"
                >
                    {errorMsg}
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
                                    "Office",
                                    "Type",
                                    "Province",
                                    "Reports to",
                                    "Contact",
                                    "Assignments",
                                    "Accounts",
                                    "Complaints",
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
                            {offices.data.length ? (
                                offices.data.map((o) => {
                                    const active = o.is_active === 1;
                                    const can = o.can_receive_assignments === 1;
                                    const contact =
                                        [o.contact_number, o.email]
                                            .filter(Boolean)
                                            .join(" · ") || "—";
                                    return (
                                        <tr
                                            key={o.office_id}
                                            className="border-b border-slate-100 align-top hover:bg-slate-50"
                                        >
                                            <td className="px-4 py-3">
                                                <p className="font-semibold">
                                                    {o.office_name}
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    {o.office_code}
                                                </p>
                                                {o.remarks && (
                                                    <p className="mt-0.5 text-xs text-slate-500">
                                                        {o.remarks}
                                                    </p>
                                                )}
                                                {!active && (
                                                    <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                                        Inactive
                                                    </span>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3">
                                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                                                    {o.type_label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">
                                                {o.province_name || "—"}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">
                                                {o.parent_name || "—"}
                                            </td>
                                            <td className="max-w-xs break-words px-4 py-3 text-xs text-slate-500">
                                                {contact}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3">
                                                <span
                                                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${can ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}
                                                >
                                                    {can
                                                        ? "Can receive"
                                                        : "Cannot receive"}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3">
                                                <Link
                                                    href={`/admin/users?office_id=${o.office_id}`}
                                                    className="font-semibold text-[#15803d] hover:underline"
                                                >
                                                    {o.account_count}
                                                </Link>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3">
                                                <Link
                                                    href={`/admin/complaints?office_id=${o.office_id}`}
                                                    className="font-semibold text-[#15803d] hover:underline"
                                                >
                                                    {o.complaint_count}
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="py-12 text-center text-slate-400"
                                    >
                                        No offices match these filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
                    <p>
                        {offices.total
                            ? `Showing ${start}–${end} of ${offices.total.toLocaleString()} offices`
                            : "0 offices"}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={offices.current_page <= 1}
                            onClick={() => go(f, offices.current_page - 1)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Previous
                        </button>
                        <span>
                            Page {offices.current_page} of {offices.last_page}
                        </span>
                        <button
                            type="button"
                            disabled={offices.current_page >= offices.last_page}
                            onClick={() => go(f, offices.current_page + 1)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </section>
        </AdminLayout>
    );
}
