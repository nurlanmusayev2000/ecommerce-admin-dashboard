import { beforeEach, describe, expect, it, vi } from 'vitest';

import seed from '../../db.json';

/** Re-imports the module so it re-reads localStorage, like a page reload. */
async function loadDb() {
  vi.resetModules();
  return (await import('./db')).mockDb;
}

describe('mockDb', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts from db.json', async () => {
    const db = await loadDb();
    expect(db.list('products')).toHaveLength(seed.products.length);
    expect(db.findById('products', '1')).toMatchObject({ id: '1' });
    expect(db.has('nope')).toBe(false);
  });

  it('keeps changes across a reload', async () => {
    const db = await loadDb();
    const created = db.create('products', { name: 'New' });
    db.update('products', '1', { price: 1 }, { patch: true });
    db.remove('products', '2');

    const reloaded = await loadDb();
    expect(reloaded.findById('products', created!.id as string)).toMatchObject({
      name: 'New',
    });
    expect(reloaded.findById('products', '1')).toMatchObject({
      price: 1,
      name: seed.products[0].name,
    });
    expect(reloaded.findById('products', '2')).toBeUndefined();
  });

  it('discards saved data made from an older db.json', async () => {
    localStorage.setItem(
      'admin_dashboard_mock_db',
      JSON.stringify({ seedVersion: 'old', collections: { products: [] } }),
    );
    const db = await loadDb();
    expect(db.list('products')).toHaveLength(seed.products.length);
  });

  it('reset restores the seed data', async () => {
    const db = await loadDb();
    db.remove('products', '1');
    db.reset();
    expect(db.findById('products', '1')).toBeDefined();
    expect(localStorage.getItem('admin_dashboard_mock_db')).toBeNull();
  });
});
