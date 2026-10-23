import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import seed from '../../../db.json';
import { mockDb } from '@/mocks/db';
import { baseApi } from '@/services/api/baseApi';

import { columnValues, renderApp, setupMockApi } from './renderApp';

setupMockApi();

describe('Customers page', () => {
  it('moves back to the last page when customers disappear from the page being viewed (BUG-003)', async () => {
    // Five extra customers make a second page (names sort after the seeded ones).
    const extra = ['Zara', 'Zeke', 'Zia', 'Zoe', 'Zuri'].map(
      (name, i) => mockDb.create('customers', { name, email: `${name.toLowerCase()}@example.com`, phone: '', totalOrders: 0, totalSpent: 0, joinedAt: `2026-01-0${i + 1}T00:00:00.000Z` })!,
    );
    const { user, store } = renderApp('/customers');
    await screen.findByRole('heading', { name: 'Customers' });
    await user.click(await screen.findByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(screen.getByText(`Page 2 of 2 · ${seed.customers.length + 5} total`)).toBeInTheDocument());

    // Another admin removes them, then the list refetches.
    extra.forEach((c) => mockDb.remove('customers', String(c.id)));
    store.dispatch(baseApi.util.invalidateTags([{ type: 'Customer', id: 'LIST' }]));

    await waitFor(() => expect(screen.getByText(`Page 1 of 1 · ${seed.customers.length} total`)).toBeInTheDocument());
    const byName = [...seed.customers].sort((a, b) => a.name.localeCompare(b.name)).map((c) => c.name);
    expect(columnValues(0)).toEqual(byName);
  });
});
