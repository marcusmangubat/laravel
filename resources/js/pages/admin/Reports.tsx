import { Head } from "@inertiajs/react";
import AdminLayout from "@/layouts/admin-layout";
import ReportView, { type Option } from "@/Components/ReportView";

interface Props {
    today: string;
    statuses: Option[];
    categories: Option[];
    provinces: Option[];
    offices: Option[];
    dataUrl: string;
    exportUrl: string;
}

export default function Reports(props: Props) {
    return (
        <AdminLayout title="Reports">
            <Head title="Reports" />
            <ReportView
                {...props}
                admin
                complaintBase="/admin/complaints"
                description="Filter the complaint report, then export the listed complaints to an Excel file."
            />
        </AdminLayout>
    );
}
