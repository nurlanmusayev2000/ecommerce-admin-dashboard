import { describe, expect, it } from 'vitest';

import type { PaginatedResponse } from '@/types';

import { parseWhere, queryCollection, sortOn } from './jsonServerQuery';

interface Item {
  id: string;
  name: string;
  price: number;
  status: string;
}

const items: Item[] = [
  { id: '1', name: 'Laptop Pro', price: 1299, status: 'active' },
  { id: '2', name: 'Headphones', price: 249, status: 'active' },
  { id: '3', name: 'Desk Lamp', price: 35, status: 'inactive' },
  { id: '4', name: 'Pro Mouse', price: 50, status: 'active' },
  { id: '5', name: 'Cable', price: 9, status: 'inactive' },
];

function query(search: string) {
  return queryCollection(items, new URLSearchParams(search));
}

function ids(result: Item[] | PaginatedResponse<Item>): string[] {
  return (Array.isArray(result) ? result : result.data).map((item) => item.id);
}

describe('parseWhere', () => {
  it('parses operators, coerces values and skips reserved keys', () => {
    const params = new URLSearchParams(
      'price:gte=50&status=active&name:contains=pro&_page=1&_sort=-price',
    );
    expect(parseWhere(params)).toEqual({
      price: { gte: 50 },
      status: { eq: 'active' },
      name: { contains: 'pro' },
    });
  });

  it('ignores unknown operators and splits `in` lists', () => {
    const params = new URLSearchParams('price:between=1&id:in=1, 3');
    expect(parseWhere(params)).toEqual({ id: { in: [1, 3] } });
  });
});

describe('queryCollection filters', () => {
  it('applies numeric range operators', () => {
    expect(ids(query('price:gte=50&price:lte=300'))).toEqual(['2', '4']);
  });

  it('matches `contains` case-insensitively', () => {
    expect(ids(query('name:contains=PRO'))).toEqual(['1', '4']);
  });

  it('combines filters with AND, including the legacy `_gte` style', () => {
    expect(ids(query('status:eq=active&price_gte=100'))).toEqual(['1', '2']);
  });
});

describe('queryCollection sorting', () => {
  it('sorts ascending and descending', () => {
    expect(ids(query('_sort=price'))).toEqual(['5', '3', '4', '2', '1']);
    expect(ids(query('_sort=-price'))).toEqual(['1', '2', '4', '3', '5']);
  });

  it('sorts strings by locale and supports multiple fields', () => {
    expect(ids(query('_sort=status,-price'))).toEqual(['1', '2', '4', '3', '5']);
  });

  it('places missing values last when ascending', () => {
    const rows = [{ v: undefined }, { v: 2 }, { v: 0 }];
    expect(sortOn(rows, 'v').map((row) => row.v)).toEqual([0, 2, undefined]);
  });
});

describe('queryCollection pagination', () => {
  it('returns a plain array without `_page`', () => {
    expect(Array.isArray(query('_per_page=2'))).toBe(true);
  });

  it("returns json-server's pagination envelope", () => {
    expect(query('_sort=price&_page=2&_per_page=2')).toEqual({
      first: 1,
      prev: 1,
      next: 3,
      last: 3,
      pages: 3,
      items: 5,
      data: [items[3], items[1]],
    });
  });

  it('clamps out-of-range pages and paginates after filtering', () => {
    const result = query('status=inactive&_page=9&_per_page=10');
    expect(result).toMatchObject({ pages: 1, items: 2, prev: null, next: null });
    expect(ids(result)).toEqual(['3', '5']);
  });
});
