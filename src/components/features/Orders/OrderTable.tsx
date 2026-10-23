import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { clsx } from 'clsx';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';

import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { Pagination } from '@/components/common/Pagination';
import { TableSkeleton } from '@/components/common/Skeletons/TableSkeleton';
import { OrderStatusBadge } from '@/components/common/StatusBadge';
import { useGetOrdersQuery } from '@/services/api/ordersApi';
import {
  setOrdersPage,
  setOrdersPageSize,
  setOrdersSort,
} from '@/store/slices/filterSlice';
import { formatCurrency, formatDate } from '@/utils/formatters';

const COLUMNS = [
  { field: 'orderNumber', label: 'Order #' },
  { field: 'customer', label: 'Customer' },
  { field: 'total', label: 'Total' },
  { field: 'date', label: 'Date' },
  { field: 'status', label: 'Status' },
];

export function OrderTable() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { page, pageSize, searchTerm, status, sortBy } = useAppSelector(
    (state) => state.filter.orders,
  );

  const { data, isLoading, isFetching, error } = useGetOrdersQuery({
    page,
    perPage: pageSize,
    sortField: sortBy.field,
    sortOrder: sortBy.order,
    search: searchTerm || undefined,
    status,
  });

  // If the list shrinks (e.g. after orders are removed elsewhere), move back to the new last page
  // instead of showing "Page 3 of 2" above the last page's rows.
  useEffect(() => {
    if (data && data.pages < page) {
      dispatch(setOrdersPage(data.pages));
    }
  }, [data, page, dispatch]);

  const handleSort = (field: string) => {
    dispatch(
      setOrdersSort({
        field,
        order:
          sortBy.field === field && sortBy.order === 'asc' ? 'desc' : 'asc',
      }),
    );
  };

  if (isLoading) return <TableSkeleton columns={5} />;
  if (error) return <ErrorMessage message="Failed to load orders." />;
  if (!data || data.data.length === 0) {
    return <EmptyState message="No orders match your filters." />;
  }

  return (
    <div
      className={clsx(
        'overflow-hidden rounded-md border border-gray-200 dark:border-gray-700',
        isFetching && 'opacity-60 transition-opacity',
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-150 border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
              {COLUMNS.map(({ field, label }) => (
                <th key={field} className="px-4 py-3 text-left">
                  <button
                    type="button"
                    onClick={() => handleSort(field)}
                    className="flex items-center gap-1 font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                  >
                    {label}
                    {sortBy.field === field &&
                      (sortBy.order === 'asc' ? (
                        <FiChevronUp size={14} />
                      ) : (
                        <FiChevronDown size={14} />
                      ))}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.data.map((order) => (
              <tr
                key={order.id}
                onClick={() => navigate(`/orders/${order.id}`)}
                className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60"
              >
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                  {order.orderNumber}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  {order.customer}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  {formatCurrency(order.total)}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  {formatDate(order.date)}
                </td>
                <td className="px-4 py-3">
                  <OrderStatusBadge status={order.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        pages={data.pages}
        pageSize={pageSize}
        totalItems={data.items}
        onPageChange={(p) => dispatch(setOrdersPage(p))}
        onPageSizeChange={(size) => dispatch(setOrdersPageSize(size))}
      />
    </div>
  );
}
