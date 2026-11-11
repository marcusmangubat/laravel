<?php

namespace App\Exports;

use Illuminate\Database\Eloquent\Builder;
use Maatwebsite\Excel\Concerns\Export;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithTitle;

class ComplaintsWorkbook implements WithMultipleSheets, Export
{
    public function __construct(
        private Builder $query,
        private array $labels,
        private string $generatedFor,
        private bool $withOffice = true,
    ) {}

    public function sheets(): array
    {
        return [
            new ComplaintsExport($this->query, $this->withOffice),
            new class($this->labels, $this->generatedFor) implements FromArray, WithTitle, ShouldAutoSize {
                public function __construct(private array $labels, private string $for) {}

                public function title(): string
                {
                    return 'Filters';
                }

                public function array(): array
                {
                    return array_merge(
                        [
                            ['Generated for', $this->for],
                            ['Generated at', now('Asia/Manila')->format('Y-m-d H:i')],
                            [],
                            ['Filters applied'],
                        ],
                        array_map(fn ($l) => [$l], $this->labels)
                    );
                }
            },
        ];
    }
}