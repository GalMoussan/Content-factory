interface Column {
  key: string;
  label: string;
}

interface DataTableProps {
  columns: Column[];
  rows: Record<string, unknown>[];
  totalRows?: number;
  pageSize?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  onRowClick?: (row: Record<string, unknown>) => void;
}

export function DataTable({
  columns,
  rows,
  totalRows,
  pageSize,
  currentPage = 1,
  onPageChange,
  onRowClick,
}: DataTableProps) {
  const totalPages = totalRows && pageSize ? Math.ceil(totalRows / pageSize) : 1;
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            {columns.map((col) => (
              <th key={col.key} className="px-3 py-2 font-medium text-gray-400">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer"
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-3 py-2">
                  {String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {onPageChange && (
        <div className="flex items-center justify-between px-3 py-2">
          <button
            disabled={!hasPrev}
            onClick={() => onPageChange(currentPage - 1)}
            className="rounded px-3 py-1 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-400">
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={!hasNext}
            onClick={() => onPageChange(currentPage + 1)}
            className="rounded px-3 py-1 text-sm disabled:opacity-50"
            aria-label="Next"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
