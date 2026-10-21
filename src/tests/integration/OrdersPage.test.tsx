import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import seed from '../../../db.json';
import { mockDb } from '@/mocks/db';
import { API_BASE_URL } from '@/utils/constants';

import { columnValues, renderApp, requests, setupMockApi } from './renderApp';

const server = setupMockApi();

type SeedOrder = (typeof seed.orders)[number];

/** Order numbers on the first page, using the table's default sort (newest first). */
const newestFirst = (orders: SeedOrder[]) =>
  [...orders].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map((o) => o.orderNumber);

const orderNumbers = () => columnValues(0);

async function openOrders() {
  const app = renderApp('/orders');
  await screen.findByRole('heading', { name: 'Orders' });
  await waitFor(() => expect(orderNumbers()).toEqual(newestFirst(seed.orders)));
  return app;
}

describe('Orders page', () => {
  it('filters orders by status', async () => {
    const { user } = await openOrders();

    await user.selectOptions(screen.getByLabelText('Filter by status'), 'Pending');

    const pending = seed.orders.filter((o) => o.status === 'pending');
    await waitFor(() => expect(orderNumbers()).toEqual(newestFirst(pending)));
    expect(columnValues(4).every((status) => status === 'Pending')).toBe(true);
    expect(screen.getByText(`Page 1 of 1 · ${pending.length} total`)).toBeInTheDocument();
    expect(requests.at(-1)?.url.searchParams.get('status:eq')).toBe('pending');

    await user.selectOptions(screen.getByLabelText('Filter by status'), 'All statuses');
    await waitFor(() => expect(orderNumbers()).toEqual(newestFirst(seed.orders)));
  });

  it("updates an order's status from its detail page", async () => {
    const { user, pathname } = await openOrders();
    const order = [...seed.orders].sort((a, b) => b.date.localeCompare(a.date))[0];
    const newStatus = order.status === 'delivered' ? 'Cancelled' : 'Delivered';

    await user.click(screen.getByRole('cell', { name: order.orderNumber }));
    expect(await screen.findByRole('heading', { name: order.orderNumber })).toBeInTheDocument();
    expect(pathname()).toBe(`/orders/${order.id}`);

    await user.selectOptions(screen.getByLabelText('Update order status'), newStatus);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      `Order ${order.orderNumber} marked as ${newStatus.toLowerCase()}`,
    );
    await waitFor(() => expect(screen.getByLabelText('Update order status')).toHaveValue(newStatus.toLowerCase()));
    expect(mockDb.findById('orders', order.id)).toMatchObject({ status: newStatus.toLowerCase() });

    // The list reflects the change: the order now appears under its new status.
    await user.click(screen.getByRole('button', { name: 'Back to orders' }));
    await user.selectOptions(await screen.findByLabelText('Filter by status'), newStatus);
    const expectedCount = seed.orders.filter((o) => o.status === newStatus.toLowerCase()).length + 1;
    await waitFor(() => expect(screen.getByText(`Page 1 of 1 · ${expectedCount} total`)).toBeInTheDocument());
    expect(orderNumbers()).toContain(order.orderNumber);
  });

  it('shows an error and keeps the old status when the update fails', async () => {
    const order = seed.orders[0];
    server.use(
      http.patch(`${API_BASE_URL}/orders/:id`, () => HttpResponse.json({ error: 'boom' }, { status: 500 })),
    );
    const { user } = renderApp(`/orders/${order.id}`);
    const select = await screen.findByLabelText('Update order status');
    const other = order.status === 'cancelled' ? 'Pending' : 'Cancelled';

    await user.selectOptions(select, other);

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to update order status');
    expect(screen.getByLabelText('Update order status')).toHaveValue(order.status);
    expect(mockDb.findById('orders', order.id)).toMatchObject({ status: order.status });
  });

  it('shows the order items on the detail page', async () => {
    const order = seed.orders[0];
    renderApp(`/orders/${order.id}`);
    await screen.findByRole('heading', { name: order.orderNumber });

    const itemsTable = screen.getAllByRole('table').at(-1)!;
    for (const item of order.items) {
      expect(within(itemsTable).getByText(item.productName)).toBeInTheDocument();
    }
  });
});
