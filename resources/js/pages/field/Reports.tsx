import { Head } from "@inertiajs/react";
import AdminLayout from "@/layouts/FieldLayouts";
import ReportView, { type Option } from "@/Components/ReportView";
import FieldLayout from "@/layouts/FieldLayouts";

interface Props {
    today: string;
    officeName: string;
    statuses: Option[];
    categories: Option[];
    dataUrl: string;
    exportUrl: string;
}

export default function Reports({ officeName, ...props }: Props) {
    return (
        <FieldLayout title="Reports">
            <Head title="Reports" />
            <ReportView
                {...props}
                admin={false}
                complaintBase="/field/complaints"
                description={
                    <>
                        Filter complaints assigned to{" "}
                        <span className="font-semibold">{officeName}</span>,
                        then export the listed complaints to an Excel file.
                    </>
                }
            />
        </FieldLayout>
    );
}
