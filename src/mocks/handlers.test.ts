import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { PaginatedResponse, Product } from '@/types';
import { API_BASE_URL } from '@/utils/constants';

import { mockDb } from './db';
import { handlers } from './handlers';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => mockDb.reset());
afterAll(() => server.close());

function api(path: string, init?: RequestInit) {
  return fetch(`${API_BASE_URL}${path}`, init);
}

function send(method: string, path: string, body: unknown) {
  return api(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('mock API handlers', () => {
  it('lists a filtered, sorted page like json-server', async () => {
    const res = await api(
      '/products?_page=1&_per_page=5&_sort=-price&price:gte=50',
    );
    const body = (await res.json()) as PaginatedResponse<Product>;

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(5);
    expect(body.data.every((p) => p.price >= 50)).toBe(true);
    const prices = body.data.map((p) => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });

  it('returns a single record or 404', async () => {
    expect((await api('/products/1')).status).toBe(200);
    expect((await api('/products/missing')).status).toBe(404);
    expect((await api('/unknown')).status).toBe(404);
  });

  it('creates, updates and deletes records', async () => {
    const created = await send('POST', '/products', { name: 'Mock Item' });
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as Product;

    const patched = await send('PATCH', `/products/${id}`, { price: 5 });
    expect(await patched.json()).toMatchObject({ id, name: 'Mock Item', price: 5 });

    const replaced = await send('PUT', `/products/${id}`, { name: 'Replaced' });
    expect(await replaced.json()).toEqual({ id, name: 'Replaced' });

    expect((await api(`/products/${id}`, { method: 'DELETE' })).status).toBe(200);
    expect((await api(`/products/${id}`)).status).toBe(404);
  });

  it('rejects bodies that are not JSON objects', async () => {
    expect((await send('POST', '/products', [1, 2])).status).toBe(400);
  });
});
