import { Head, Link, router, usePage } from "@inertiajs/react";
import { Field, Req, Select, fieldCls } from "@/Components/form-controls";
import {
    CornerLeftUp,
    Mail,
    MapPin,
    Phone,
    Search,
    SlidersHorizontal,
} from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import AdminLayout from "@/layouts/admin-layout";

//  Types (match what OfficeController sends)
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

//  Page
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
    const [showFilters, setShowFilters] = useState(false); // mobile only
    const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    );

    // Number of active dropdown filters (excluding search) for the mobile badge
    const activeFilters = (
        [
            "office_type",
            "province_id",
            "is_active",
            "can_receive",
        ] as (keyof Filters)[]
    ).filter((k) => f[k] !== "").length;

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
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
                <p className="text-sm text-slate-600">
                    DENR Region IV-A offices that can receive complaints, field
                    accounts, and assignments.
                </p>
                <div className="flex items-center gap-2">
                    <div className="relative min-w-0 flex-1 md:max-w-md">
                        <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
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

                    {/* Filter toggle (mobile only) */}
                    <button
                        type="button"
                        onClick={() => setShowFilters((v) => !v)}
                        aria-expanded={showFilters}
                        aria-controls="filterPanel"
                        aria-label="Toggle filters"
                        className="relative inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:ring-4 focus:ring-green-200 focus:outline-none md:hidden"
                    >
                        <SlidersHorizontal className="h-4 w-4" />
                        {activeFilters > 0 && (
                            <span className="rounded-full bg-[#15803d] px-1.5 py-0.5 text-[10px] leading-none font-semibold text-white">
                                {activeFilters}
                            </span>
                        )}
                    </button>
                </div>

                <div
                    id="filterPanel"
                    className={`${showFilters ? "grid" : "hidden"} grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid md:grid-cols-4`}
                >
                    <Field label="Type" htmlFor="f_type">
                        <Select
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
                        </Select>
                    </Field>
                    <Field label="Province" htmlFor="f_province">
                        <Select
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
                            <option value="0">Inactive</option>
                        </Select>
                    </Field>
                    <Field label="Assignments" htmlFor="f_assign">
                        <Select
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

            {errorMsg && (
                <div
                    role="alert"
                    className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:px-5"
                >
                    {errorMsg}
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
                                            <td className="px-4 py-3 whitespace-nowrap">
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
                                            <td className="max-w-[14rem] px-4 py-3 text-xs break-words text-slate-500 lg:max-w-xs">
                                                {contact}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span
                                                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${can ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}
                                                >
                                                    {can
                                                        ? "Can receive"
                                                        : "Cannot receive"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <Link
                                                    href={`/admin/users?office_id=${o.office_id}`}
                                                    className="font-semibold text-[#15803d] hover:underline"
                                                >
                                                    {o.account_count}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
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

                {/* Mobile: cards */}
                <ul
                    className={`divide-y divide-slate-100 transition-opacity md:hidden ${loading ? "opacity-50" : ""}`}
                    aria-busy={loading}
                >
                    {offices.data.length ? (
                        offices.data.map((o) => {
                            const active = o.is_active === 1;
                            const can = o.can_receive_assignments === 1;
                            return (
                                <li
                                    key={o.office_id}
                                    className={`px-4 py-4 ${active ? "" : "bg-slate-50/60"}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-800">
                                                {o.office_name}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                {o.office_code}
                                            </p>
                                        </div>
                                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                                            {o.type_label}
                                        </span>
                                    </div>

                                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${can ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}
                                        >
                                            {can
                                                ? "Can receive"
                                                : "Cannot receive"}
                                        </span>
                                        {!active && (
                                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                                                Inactive
                                            </span>
                                        )}
                                    </div>

                                    {o.remarks && (
                                        <p className="mt-2 text-xs text-slate-500">
                                            {o.remarks}
                                        </p>
                                    )}

                                    <dl className="mt-3 space-y-1.5 text-xs text-slate-500">
                                        <div className="flex items-center gap-1.5">
                                            <dt className="sr-only">
                                                Province
                                            </dt>
                                            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                            <dd>{o.province_name || "—"}</dd>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <dt className="sr-only">
                                                Reports to
                                            </dt>
                                            <CornerLeftUp className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                            <dd className="min-w-0">
                                                {o.parent_name || "—"}
                                            </dd>
                                        </div>
                                        {o.contact_number && (
                                            <div className="flex items-center gap-1.5">
                                                <dt className="sr-only">
                                                    Phone
                                                </dt>
                                                <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                                <dd>
                                                    <a
                                                        href={`tel:${o.contact_number}`}
                                                        className="hover:underline"
                                                    >
                                                        {o.contact_number}
                                                    </a>
                                                </dd>
                                            </div>
                                        )}
                                        {o.email && (
                                            <div className="flex items-center gap-1.5">
                                                <dt className="sr-only">
                                                    Email
                                                </dt>
                                                <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                                <dd className="min-w-0 break-all">
                                                    <a
                                                        href={`mailto:${o.email}`}
                                                        className="hover:underline"
                                                    >
                                                        {o.email}
                                                    </a>
                                                </dd>
                                            </div>
                                        )}
                                    </dl>

                                    {/* Big tap targets for the two drill-down links */}
                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        <Link
                                            href={`/admin/users?office_id=${o.office_id}`}
                                            className="rounded-xl border border-slate-200 px-3 py-2 text-center hover:bg-slate-50 active:bg-slate-100"
                                        >
                                            <span className="block text-base font-semibold text-[#15803d]">
                                                {o.account_count}
                                            </span>
                                            <span className="block text-xs text-slate-500">
                                                Accounts
                                            </span>
                                        </Link>
                                        <Link
                                            href={`/admin/complaints?office_id=${o.office_id}`}
                                            className="rounded-xl border border-slate-200 px-3 py-2 text-center hover:bg-slate-50 active:bg-slate-100"
                                        >
                                            <span className="block text-base font-semibold text-[#15803d]">
                                                {o.complaint_count}
                                            </span>
                                            <span className="block text-xs text-slate-500">
                                                Complaints
                                            </span>
                                        </Link>
                                    </div>
                                </li>
                            );
                        })
                    ) : (
                        <li className="px-4 py-12 text-center text-sm text-slate-400">
                            No offices match these filters.
                        </li>
                    )}
                </ul>

                {/* Pagination */}
                <div className="flex flex-col items-center gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:justify-between">
                    <p>
                        {offices.total
                            ? `Showing ${start}–${end} of ${offices.total.toLocaleString()} offices`
                            : "0 offices"}
                    </p>
                    <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
                        <button
                            type="button"
                            disabled={offices.current_page <= 1}
                            onClick={() => go(f, offices.current_page - 1)}
                            className="rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:py-1.5"
                        >
                            Previous
                        </button>
                        <span className="text-center">
                            Page {offices.current_page} of {offices.last_page}
                        </span>
                        <button
                            type="button"
                            disabled={offices.current_page >= offices.last_page}
                            onClick={() => go(f, offices.current_page + 1)}
                            className="rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:py-1.5"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </section>
        </AdminLayout>
    );
}
