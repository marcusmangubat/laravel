<?php

namespace App\Exports;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class ComplaintsExport implements FromQuery, WithHeadings, WithMapping, ShouldAutoSize, WithStyles, WithTitle
{
    public function __construct(private Builder $query, private bool $withOffice = true) {}

    public function query(): QueryBuilder|Builder|Relation
    {
        return $this->query;
    }

    public function title(): string
    {
        return 'Complaints';
    }

    public function headings(): array
    {
        $head = ['Reference', 'Subject', 'Category', 'Location'];
        if ($this->withOffice) {
            $head[] = 'Office';
        }

        return array_merge($head, ['Status', 'Priority', 'Received', 'Target date', 'Overdue']);
    }

    public function map(mixed $row): array
    {
        $cells = [
            $row->reference_no,
            $row->title,
            $row->category_name ?? 'Uncategorized',
            implode(', ', array_filter([$row->barangay, $row->municipality, $row->province_name])) ?: '—',
        ];
        if ($this->withOffice) {
            $cells[] = $row->office_name ?? 'Not yet assigned';
        }

        return array_merge($cells, [
            $row->status_name,
            ucfirst($row->priority),
            optional($row->received_at)->format('Y-m-d H:i'),
            optional($row->target_date)->format('Y-m-d'),
            $row->is_overdue ? 'Yes' : 'No',
        ]);
    }

    public function styles(Worksheet $sheet): ?array
    {
        return [1 => ['font' => ['bold' => true]]];
    }
}