import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import seed from '../../../db.json';
import { mockDb } from '@/mocks/db';
import { formatCurrency } from '@/utils/formatters';

import { columnValues, renderApp, requests, setupMockApi } from './renderApp';

setupMockApi();

type SeedProduct = (typeof seed.products)[number];

/** Product names on a page, using the table's default sort (newest first) and page size (10). */
function newestFirst(products: SeedProduct[], page = 1, perPage = 10) {
  return [...products]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice((page - 1) * perPage, page * perPage)
    .map((p) => p.name);
}

const names = () => columnValues(0);

async function openProducts() {
  const app = renderApp('/products');
  await screen.findByRole('heading', { name: 'Products' });
  await waitFor(() => expect(names()).toEqual(newestFirst(seed.products)));
  return app;
}

describe('Products page', () => {
  it('loads the first page of products, newest first', async () => {
    await openProducts();
    expect(screen.getByText(`Page 1 of 3 · ${seed.products.length} total`)).toBeInTheDocument();
  });

  it('searches by name after the debounce', async () => {
    const { user } = await openProducts();

    await user.type(screen.getByLabelText('Search products by name'), 'pro');

    const expected = newestFirst(seed.products.filter((p) => p.name.toLowerCase().includes('pro')));
    await waitFor(() => expect(names()).toEqual(expected));
    expect(expected).toHaveLength(2);
    expect(requests.at(-1)?.url.searchParams.get('name:contains')).toBe('pro');
  });

  it('filters by category and price range', async () => {
    const { user } = await openProducts();

    await user.selectOptions(screen.getByLabelText('Filter by category'), 'Electronics');
    await user.type(screen.getByLabelText('Minimum price'), '100');
    await user.type(screen.getByLabelText('Maximum price'), '600');

    const expected = newestFirst(
      seed.products.filter((p) => p.category === 'Electronics' && p.price >= 100 && p.price <= 600),
    );
    await waitFor(() => expect(names()).toEqual(expected));
    expect(columnValues(1).every((c) => c === 'Electronics')).toBe(true);
    expect(screen.getByText(`Page 1 of 1 · ${expected.length} total`)).toBeInTheDocument();

    const lastQuery = requests.at(-1)!.url.searchParams;
    expect(lastQuery.get('category:eq')).toBe('Electronics');
    expect(lastQuery.get('price:gte')).toBe('100');
    expect(lastQuery.get('price:lte')).toBe('600');
  });

  it('shows an empty state when nothing matches', async () => {
    const { user } = await openProducts();
    await user.type(screen.getByLabelText('Minimum price'), '100000');
    expect(await screen.findByText('No products match your filters.')).toBeInTheDocument();
  });

  it('sorts by price ascending, then descending', async () => {
    const { user } = await openProducts();
    const prices = (dir: 1 | -1) =>
      [...seed.products].sort((a, b) => dir * (a.price - b.price)).slice(0, 10).map((p) => formatCurrency(p.price));

    await user.click(screen.getByRole('button', { name: 'Price' }));
    await waitFor(() => expect(columnValues(2)).toEqual(prices(1)));

    await user.click(screen.getByRole('button', { name: 'Price' }));
    await waitFor(() => expect(columnValues(2)).toEqual(prices(-1)));
    expect(requests.at(-1)?.url.searchParams.get('_sort')).toBe('-price');
  });

  it('pages through results and changes the page size', async () => {
    const { user } = await openProducts();

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(names()).toEqual(newestFirst(seed.products, 2)));
    expect(screen.getByText(`Page 2 of 3 · ${seed.products.length} total`)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    await waitFor(() => expect(names()).toEqual(newestFirst(seed.products, 1)));

    await user.selectOptions(screen.getByLabelText('Rows per page'), '25');
    await waitFor(() => expect(names()).toHaveLength(seed.products.length));
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('moves back to the last page after deleting every product on it (BUG-003)', async () => {
    const { user } = await openProducts();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    const lastPage = newestFirst(seed.products, 3);
    await waitFor(() => expect(names()).toEqual(lastPage));
    expect(lastPage).toHaveLength(5);

    for (const name of lastPage) {
      await user.click(screen.getByRole('button', { name: `Delete ${name}` }));
      const dialog = await screen.findByRole('dialog', { name: 'Delete product' });
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    }

    const remaining = seed.products.filter((p) => !lastPage.includes(p.name));
    await waitFor(() => expect(screen.getByText(`Page 2 of 2 · ${remaining.length} total`)).toBeInTheDocument());
    expect(names()).toEqual(newestFirst(remaining, 2));
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('creates a product and shows it at the top of the list', async () => {
    const { user } = await openProducts();

    await user.click(screen.getByRole('button', { name: 'Add Product' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add Product' });
    await user.type(within(dialog).getByLabelText('Name'), 'Standing Desk');
    await user.selectOptions(within(dialog).getByLabelText('Category'), 'Home & Garden');
    await user.clear(within(dialog).getByLabelText('Price'));
    await user.type(within(dialog).getByLabelText('Price'), '349.5');
    await user.clear(within(dialog).getByLabelText('Stock'));
    await user.type(within(dialog).getByLabelText('Stock'), '12');
    await user.click(within(dialog).getByRole('button', { name: 'Create product' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('"Standing Desk" created');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(names()[0]).toBe('Standing Desk'));
    const row = screen.getAllByRole('row')[1];
    expect(within(row).getByText('Home & Garden')).toBeInTheDocument();
    expect(within(row).getByText('$349.50')).toBeInTheDocument();
    expect(screen.getByText(`Page 1 of 3 · ${seed.products.length + 1} total`)).toBeInTheDocument();
    expect(mockDb.list('products').find((p) => p.name === 'Standing Desk')).toMatchObject({ price: 349.5, stock: 12 });
  });

  it('validates the product form before saving', async () => {
    const { user } = await openProducts();

    await user.click(screen.getByRole('button', { name: 'Add Product' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add Product' });
    await user.click(within(dialog).getByRole('button', { name: 'Create product' }));

    expect(await within(dialog).findByText('Name is required')).toBeInTheDocument();
    expect(within(dialog).getByText('Price must be greater than 0')).toBeInTheDocument();
    expect(requests.filter((r) => r.method === 'POST')).toEqual([]);
  });

  it('rejects names that are only spaces or too short once trimmed, when adding (BUG-002)', async () => {
    const { user } = await openProducts();
    await user.click(screen.getByRole('button', { name: 'Add Product' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add Product' });
    const name = within(dialog).getByLabelText('Name');
    await user.clear(within(dialog).getByLabelText('Price'));
    await user.type(within(dialog).getByLabelText('Price'), '10');
    await user.clear(within(dialog).getByLabelText('Stock'));
    await user.type(within(dialog).getByLabelText('Stock'), '5');

    await user.type(name, '   ');
    await user.click(within(dialog).getByRole('button', { name: 'Create product' }));
    expect(await within(dialog).findByText('Name is required')).toBeInTheDocument();

    await user.clear(name);
    await user.type(name, '  ab  ');
    await user.click(within(dialog).getByRole('button', { name: 'Create product' }));
    expect(await within(dialog).findByText('Name must be at least 3 characters')).toBeInTheDocument();

    expect(requests.filter((r) => r.method === 'POST')).toEqual([]);
    expect(mockDb.list('products')).toHaveLength(seed.products.length);

    // A valid name with surrounding spaces is saved trimmed.
    await user.clear(name);
    await user.type(name, '  Desk Lamp  ');
    await user.click(within(dialog).getByRole('button', { name: 'Create product' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('"Desk Lamp" created');
    expect(mockDb.list('products').some((p) => p.name === 'Desk Lamp')).toBe(true);
  });

  it('rejects a name that is only spaces when editing, and trims a valid one (BUG-002)', async () => {
    const { user } = await openProducts();
    const target = newestFirst(seed.products)[0];
    const id = seed.products.find((p) => p.name === target)!.id;

    await user.click(screen.getByRole('button', { name: `Edit ${target}` }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Product' });
    const name = within(dialog).getByLabelText('Name');

    await user.clear(name);
    await user.type(name, '   ');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await within(dialog).findByText('Name is required')).toBeInTheDocument();
    expect(requests.filter((r) => r.method === 'PATCH')).toEqual([]);
    expect(mockDb.findById('products', id)).toMatchObject({ name: target });

    await user.clear(name);
    await user.type(name, '  Renamed Laptop  ');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('"Renamed Laptop" updated');
    expect(mockDb.findById('products', id)).toMatchObject({ name: 'Renamed Laptop' });
  });

  it('edits a product and updates its row', async () => {
    const { user } = await openProducts();
    const target = newestFirst(seed.products)[0];

    await user.click(screen.getByRole('button', { name: `Edit ${target}` }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Product' });
    expect(within(dialog).getByLabelText('Name')).toHaveValue(target);
    await user.clear(within(dialog).getByLabelText('Price'));
    await user.type(within(dialog).getByLabelText('Price'), '19.99');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(`"${target}" updated`);
    await waitFor(() => expect(columnValues(2)[0]).toBe('$19.99'));
    expect(names()[0]).toBe(target);
  });

  it('deletes a product after confirmation and removes it from the list', async () => {
    const { user } = await openProducts();
    const target = newestFirst(seed.products)[1];

    await user.click(screen.getByRole('button', { name: `Delete ${target}` }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete product' });
    expect(dialog).toHaveTextContent(`Are you sure you want to delete "${target}"?`);
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(`"${target}" deleted`);
    const remaining = seed.products.filter((p) => p.name !== target);
    await waitFor(() => expect(names()).toEqual(newestFirst(remaining)));
    expect(screen.getByText(`Page 1 of 3 · ${remaining.length} total`)).toBeInTheDocument();
  });

  it('keeps the product when the delete is cancelled', async () => {
    const { user } = await openProducts();
    const target = newestFirst(seed.products)[0];

    await user.click(screen.getByRole('button', { name: `Delete ${target}` }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete product' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(names()).toContain(target);
    expect(requests.filter((r) => r.method === 'DELETE')).toEqual([]);
  });
});
