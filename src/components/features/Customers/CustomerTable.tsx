import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { clsx } from 'clsx';
import { FiChevronDown, FiChevronUp, FiSearch } from 'react-icons/fi';

import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { Pagination } from '@/components/common/Pagination';
import { TableSkeleton } from '@/components/common/Skeletons/TableSkeleton';
import { useDebounce } from '@/hooks/useDebounce';
import { useGetCustomersQuery } from '@/services/api/customersApi';
import {
  setCustomersPage,
  setCustomersPageSize,
  setCustomersSearch,
  setCustomersSort,
} from '@/store/slices/filterSlice';
import { formatCurrency } from '@/utils/formatters';

const COLUMNS = [
  { field: 'name', label: 'Name' },
  { field: 'email', label: 'Email' },
  { field: 'phone', label: 'Phone' },
  { field: 'totalOrders', label: 'Total Orders' },
  { field: 'totalSpent', label: 'Total Spent' },
];

export function CustomerTable() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { page, pageSize, searchTerm, sortBy } = useAppSelector(
    (state) => state.filter.customers,
  );
  const [searchInput, setSearchInput] = useState(searchTerm);
  const debouncedSearch = useDebounce(searchInput);

  useEffect(() => {
    dispatch(setCustomersSearch(debouncedSearch));
  }, [debouncedSearch, dispatch]);

  const { data, isLoading, isFetching, error } = useGetCustomersQuery({
    page,
    perPage: pageSize,
    sortField: sortBy.field,
    sortOrder: sortBy.order,
    search: searchTerm || undefined,
  });

  // If the list shrinks (e.g. after customers are removed elsewhere), move back to the new last page
  // instead of showing "Page 3 of 2" above the last page's rows.
  useEffect(() => {
    if (data && data.pages < page) {
      dispatch(setCustomersPage(data.pages));
    }
  }, [data, page, dispatch]);

  const handleSort = (field: string) => {
    dispatch(
      setCustomersSort({
        field,
        order:
          sortBy.field === field && sortBy.order === 'asc' ? 'desc' : 'asc',
      }),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative sm:max-w-sm">
        <FiSearch
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          size={16}
        />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name or email..."
          aria-label="Search customers"
          className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>

      {isLoading ? (
        <TableSkeleton columns={5} />
      ) : error ? (
        <ErrorMessage message="Failed to load customers." />
      ) : !data || data.data.length === 0 ? (
        <EmptyState message="No customers match your search." />
      ) : (
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
                {data.data.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => navigate(`/customers/${customer.id}`)}
                    className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {customer.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {customer.email}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {customer.phone}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {customer.totalOrders}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {formatCurrency(customer.totalSpent)}
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
            onPageChange={(p) => dispatch(setCustomersPage(p))}
            onPageSizeChange={(size) => dispatch(setCustomersPageSize(size))}
          />
        </div>
      )}
    </div>
  );
}
