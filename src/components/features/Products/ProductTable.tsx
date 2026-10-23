import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { clsx } from 'clsx';
import { FiChevronDown, FiChevronUp, FiEdit2, FiTrash2 } from 'react-icons/fi';

import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { Pagination } from '@/components/common/Pagination';
import { TableSkeleton } from '@/components/common/Skeletons/TableSkeleton';
import { ProductStatusBadge } from '@/components/common/StatusBadge';
import { useToast } from '@/hooks/useToast';
import {
  useDeleteProductMutation,
  useGetProductsQuery,
} from '@/services/api/productsApi';
import {
  setProductsPage,
  setProductsPageSize,
  setProductsSort,
} from '@/store/slices/filterSlice';
import type { Product } from '@/types';
import { formatCurrency } from '@/utils/formatters';

interface SortableColumn {
  field: string;
  label: string;
}

const COLUMNS: SortableColumn[] = [
  { field: 'name', label: 'Name' },
  { field: 'category', label: 'Category' },
  { field: 'price', label: 'Price' },
  { field: 'stock', label: 'Stock' },
  { field: 'status', label: 'Status' },
];

interface ProductTableProps {
  readonly onEdit: (product: Product) => void;
}

export function ProductTable({ onEdit }: ProductTableProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { page, pageSize, searchTerm, filters, sortBy } = useAppSelector(
    (state) => state.filter.products,
  );
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [deleteProduct, { isLoading: isDeleting }] = useDeleteProductMutation();

  const { data, isLoading, isFetching, error } = useGetProductsQuery({
    page,
    perPage: pageSize,
    sortField: sortBy.field,
    sortOrder: sortBy.order,
    search: searchTerm || undefined,
    category: filters.category,
    status: filters.status,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
  });

  // If the list shrinks (e.g. after deleting the last items on the last page), move back to the new last page
  // instead of showing "Page 3 of 2" above the last page's rows.
  useEffect(() => {
    if (data && data.pages < page) {
      dispatch(setProductsPage(data.pages));
    }
  }, [data, page, dispatch]);

  const handleSort = (field: string) => {
    dispatch(
      setProductsSort({
        field,
        order:
          sortBy.field === field && sortBy.order === 'asc' ? 'desc' : 'asc',
      }),
    );
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return;
    try {
      await deleteProduct(pendingDelete.id).unwrap();
      showToast(`"${pendingDelete.name}" deleted`, 'success');
      setPendingDelete(null);
    } catch {
      showToast('Failed to delete product', 'error');
    }
  };

  if (isLoading) return <TableSkeleton columns={6} />;
  if (error) return <ErrorMessage message="Failed to load products." />;
  if (!data || data.data.length === 0) {
    return <EmptyState message="No products match your filters." />;
  }

  return (
    <div
      className={clsx(
        'overflow-hidden rounded-md border border-gray-200 dark:border-gray-700',
        isFetching && 'opacity-60 transition-opacity',
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-180 border-collapse text-sm">
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
              <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-300">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {data.data.map((product) => (
              <tr
                key={product.id}
                onClick={() => navigate(`/products/${product.id}`)}
                className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60"
              >
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                  {product.name}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  {product.category}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  {formatCurrency(product.price)}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  {product.stock}
                </td>
                <td className="px-4 py-3">
                  <ProductStatusBadge status={product.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(product);
                      }}
                      aria-label={`Edit ${product.name}`}
                      className="text-primary-600 hover:text-primary-800 dark:text-primary-400"
                    >
                      <FiEdit2 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDelete(product);
                      }}
                      aria-label={`Delete ${product.name}`}
                      className="text-red-500 hover:text-red-700"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
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
        onPageChange={(p) => dispatch(setProductsPage(p))}
        onPageSizeChange={(size) => dispatch(setProductsPageSize(size))}
      />

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Delete product"
        message={`Are you sure you want to delete "${pendingDelete?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
