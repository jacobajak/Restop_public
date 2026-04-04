/**
 * Table Component
 * 
 * Flexible table component for orders, menu management, and analytics.
 * Supports sorting, responsive design, and hover effects.
 */

import React from 'react';

interface TableProps {
  children: React.ReactNode;
  className?: string;
  responsive?: boolean;
}

export const Table: React.FC<TableProps> = ({
  children,
  className = '',
  responsive = true,
}) => {
  return (
    <div
      className={`
        overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700
        ${className}
      `}
    >
      <table className="w-full text-left text-sm">
        {children}
      </table>
    </div>
  );
};

interface TableHeadProps {
  children: React.ReactNode;
  className?: string;
}

export const TableHead: React.FC<TableHeadProps> = ({
  children,
  className = '',
}) => {
  return (
    <thead
      className={`
        bg-neutral-50 dark:bg-neutral-900
        border-b border-neutral-200 dark:border-neutral-700
        ${className}
      `}
    >
      {children}
    </thead>
  );
};

interface TableBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const TableBody: React.FC<TableBodyProps> = ({
  children,
  className = '',
}) => {
  return (
    <tbody className={`divide-y divide-neutral-200 dark:divide-neutral-700 ${className}`}>
      {children}
    </tbody>
  );
};

interface TableRowProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  onClick?: () => void;
}

export const TableRow: React.FC<TableRowProps> = ({
  children,
  className = '',
  hoverable = false,
  onClick,
}) => {
  return (
    <tr
      className={`
        transition-colors duration-150
        ${hoverable ? 'hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </tr>
  );
};

interface TableHeaderCellProps {
  children: React.ReactNode;
  className?: string;
  sortable?: boolean;
  sorted?: 'asc' | 'desc' | null;
  onSort?: () => void;
  align?: 'left' | 'center' | 'right';
}

export const TableHeaderCell: React.FC<TableHeaderCellProps> = ({
  children,
  className = '',
  sortable = false,
  sorted = null,
  onSort,
  align = 'left',
}) => {
  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }[align];

  return (
    <th
      className={`
        px-4 py-3
        font-semibold text-neutral-700 dark:text-neutral-300
        uppercase tracking-wider text-xs
        ${alignClass}
        ${sortable ? 'cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800' : ''}
        ${className}
      `}
      onClick={sortable ? onSort : undefined}
    >
      <div className="flex items-center gap-2">
        <span>{children}</span>
        {sortable && (
          <span className="text-neutral-400">
            {sorted === 'asc' ? '↑' : sorted === 'desc' ? '↓' : '↕'}
          </span>
        )}
      </div>
    </th>
  );
};

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
  colSpan?: number;
  rowSpan?: number;
}

export const TableCell: React.FC<TableCellProps> = ({
  children,
  className = '',
  align = 'left',
  ...props
}) => {
  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }[align];

  return (
    <td
      className={`
        px-4 py-3
        text-neutral-700 dark:text-neutral-300
        ${alignClass}
        ${className}
      `}
      {...props}
    >
      {children}
    </td>
  );
};

/**
 * Table with data binding - simplified table for common use cases
 */
interface DataTableProps<T extends Record<string, any>> {
  data: T[];
  columns: {
    key: keyof T;
    label: string;
    render?: (value: T[keyof T], row: T) => React.ReactNode;
    align?: 'left' | 'center' | 'right';
    sortable?: boolean;
  }[];
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export const DataTable = React.forwardRef<HTMLDivElement, DataTableProps<any>>(
  (
    {
      data,
      columns,
      onRowClick,
      loading = false,
      emptyMessage = 'No data available',
      className = '',
    },
    ref
  ) => {
    const [sortConfig, setSortConfig] = React.useState<{
      key: string;
      direction: 'asc' | 'desc';
    } | null>(null);

    const handleSort = (key: string) => {
      setSortConfig(prev =>
        prev?.key === key
          ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
          : { key, direction: 'asc' }
      );
    };

    const sortedData = React.useMemo(() => {
      if (!sortConfig) return data;

      return [...data].sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }, [data, sortConfig]);

    return (
      <div ref={ref} className={className}>
        <Table>
          <TableHead>
            <TableRow>
              {columns.map(column => (
                <TableHeaderCell
                  key={String(column.key)}
                  sortable={column.sortable}
                  sorted={
                    sortConfig?.key === String(column.key) ? sortConfig.direction : null
                  }
                  onSort={() => handleSort(String(column.key))}
                  align={column.align}
                >
                  {column.label}
                </TableHeaderCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8">
                  <span className="text-neutral-500">Loading...</span>
                </TableCell>
              </TableRow>
            ) : sortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8">
                  <span className="text-neutral-500">{emptyMessage}</span>
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((row, idx) => (
                <TableRow
                  key={idx}
                  hoverable={!!onRowClick}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map(column => (
                    <TableCell
                      key={String(column.key)}
                      align={column.align}
                    >
                      {column.render
                        ? column.render(row[column.key], row)
                        : String(row[column.key])}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    );
  }
);

DataTable.displayName = 'DataTable';
