import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Modal } from '@/components/common/Modal';
import { Select } from '@/components/common/Select';
import { useToast } from '@/hooks/useToast';
import {
  useCreateProductMutation,
  useUpdateProductMutation,
} from '@/services/api/productsApi';
import type { CreateProductInput, Product } from '@/types';
import { PRODUCT_CATEGORIES, PRODUCT_STATUSES } from '@/utils/constants';

interface ProductFormProps {
  readonly isOpen: boolean;
  readonly product: Product | null;
  readonly onClose: () => void;
}

type ProductFormValues = CreateProductInput;

const EMPTY_VALUES: ProductFormValues = {
  name: '',
  category: PRODUCT_CATEGORIES[0],
  price: 0,
  stock: 0,
  description: '',
  image: 'https://via.placeholder.com/200',
  status: 'active',
};

export function ProductForm({ isOpen, product, onClose }: ProductFormProps) {
  const { showToast } = useToast();
  const [createProduct, { isLoading: isCreating }] = useCreateProductMutation();
  const [updateProduct, { isLoading: isUpdating }] = useUpdateProductMutation();
  const isSaving = isCreating || isUpdating;
  const isEditing = product !== null;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductFormValues>({ defaultValues: EMPTY_VALUES });

  useEffect(() => {
    if (isOpen) {
      reset(product ? { ...product } : EMPTY_VALUES);
    }
  }, [isOpen, product, reset]);

  const onSubmit = async (data: ProductFormValues) => {
    try {
      const payload = {
        ...data,
        price: Number(data.price),
        stock: Number(data.stock),
      };

      if (isEditing) {
        await updateProduct({ id: product.id, body: payload }).unwrap();
        showToast(`"${payload.name}" updated`, 'success');
      } else {
        await createProduct(payload).unwrap();
        showToast(`"${payload.name}" created`, 'success');
      }
      onClose();
    } catch {
      showToast('Failed to save product', 'error');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Product' : 'Add Product'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label="Name"
          error={errors.name?.message}
          {...register('name', {
            // Trim before validating and saving, so a name of only spaces fails "required"
            // and minLength counts real characters.
            setValueAs: (value: string) => value.trim(),
            required: 'Name is required',
            minLength: { value: 3, message: 'Name must be at least 3 characters' },
          })}
        />

        <Select
          label="Category"
          error={errors.category?.message}
          {...register('category', { required: 'Category is required' })}
        >
          {PRODUCT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-4">
          <Input
            type="number"
            step="0.01"
            label="Price"
            error={errors.price?.message}
            {...register('price', {
              required: 'Price is required',
              valueAsNumber: true,
              validate: (value) => value > 0 || 'Price must be greater than 0',
            })}
          />
          <Input
            type="number"
            label="Stock"
            error={errors.stock?.message}
            {...register('stock', {
              required: 'Stock is required',
              valueAsNumber: true,
              validate: (value) => value >= 0 || 'Stock cannot be negative',
            })}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="description"
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Description
          </label>
          <textarea
            id="description"
            rows={3}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            {...register('description')}
          />
        </div>

        <Select label="Status" {...register('status')}>
          {PRODUCT_STATUSES.map((status) => (
            <option key={status} value={status} className="capitalize">
              {status}
            </option>
          ))}
        </Select>

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            {isEditing ? 'Save changes' : 'Create product'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
