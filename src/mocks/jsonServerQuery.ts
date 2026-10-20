/**
 * A browser port of the query features of json-server v1 (1.0.0-beta.15) that
 * the app relies on, so the MSW mock returns the same results as `npm run server`:
 *
 * - `_page` / `_per_page` pagination with json-server's response envelope
 * - `_sort=field`, `_sort=-field` and comma-separated multi-field sorts
 * - operator filters such as `price:gte=50`, `name:contains=pro`, `status=active`
 *
 * `_embed` and `_where` are not implemented because the app never sends them.
 */
import type { PaginatedResponse } from '@/types';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonRecord = Record<string, JsonValue>;

const WHERE_OPERATORS = [
  'lt',
  'lte',
  'gt',
  'gte',
  'eq',
  'ne',
  'in',
  'contains',
  'startsWith',
  'endsWith',
] as const;

type WhereOperator = (typeof WHERE_OPERATORS)[number];

type OperatorConditions = Partial<Record<WhereOperator, JsonValue>>;

/** Nested filter tree, e.g. `{ price: { gte: 50 } }` or `{ address: { city: { eq: 'Oslo' } } }`. */
export interface Where {
  [key: string]: Where | OperatorConditions;
}

const RESERVED_QUERY_KEYS = new Set([
  '_sort',
  '_page',
  '_per_page',
  '_embed',
  '_where',
]);

function isWhereOperator(value: string): value is WhereOperator {
  return (WHERE_OPERATORS as readonly string[]).includes(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getPath(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (current, key) => (isPlainObject(current) ? current[key] : undefined),
      obj,
    );
}

function splitKey(key: string): { path: string; op: WhereOperator | null } {
  const colonIdx = key.lastIndexOf(':');
  if (colonIdx !== -1) {
    const path = key.slice(0, colonIdx);
    const op = key.slice(colonIdx + 1);
    if (!op) return { path: key, op: 'eq' };
    return isWhereOperator(op) ? { path, op } : { path, op: null };
  }

  // json-server v0.17 style, e.g. `price_gte`
  const underscoreMatch = key.match(/^(.*)_([a-z]+)$/);
  if (underscoreMatch) {
    const [, path, op] = underscoreMatch;
    if (path && isWhereOperator(op)) return { path, op };
  }

  return { path: key, op: 'eq' };
}

/** Query strings are untyped, so `50` becomes a number and `true` a boolean, as in json-server. */
function coerceValue(value: string): JsonValue {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (value.trim() === '') return value;
  const num = Number(value);
  return Number.isFinite(num) ? num : value;
}

function setCondition(
  root: Where,
  path: string,
  op: WhereOperator,
  value: JsonValue,
): void {
  const keys = path.split('.');
  let node = root;
  for (const key of keys) {
    if (!isPlainObject(node[key])) node[key] = {};
    node = node[key] as Where;
  }
  (node as OperatorConditions)[op] = value;
}

export function parseWhere(params: URLSearchParams): Where {
  const where: Where = {};
  for (const [rawKey, rawValue] of params.entries()) {
    if (RESERVED_QUERY_KEYS.has(rawKey)) continue;
    const { path, op } = splitKey(rawKey);
    if (op === null) continue;
    const value =
      op === 'in'
        ? rawValue.split(',').map((part) => coerceValue(part.trim()))
        : coerceValue(rawValue);
    setCondition(where, path, op, value);
  }
  return where;
}

function compare(
  field: unknown,
  op: WhereOperator,
  expected: JsonValue | undefined,
): boolean {
  // Relational operators mirror JavaScript's `<`/`>` semantics, like json-server.
  const a = field as number;
  const b = expected as number;
  switch (op) {
    case 'lt':
      return a < b;
    case 'lte':
      return a <= b;
    case 'gt':
      return a > b;
    case 'gte':
      return a >= b;
    case 'eq':
      return field === expected;
    case 'ne':
      return field !== expected;
    case 'in':
      return (Array.isArray(expected) ? expected : [expected]).some(
        (value) => field === value,
      );
    case 'contains':
      return (
        typeof field === 'string' &&
        field.toLowerCase().includes(String(expected).toLowerCase())
      );
    case 'startsWith':
      return (
        typeof field === 'string' &&
        field.toLowerCase().startsWith(String(expected).toLowerCase())
      );
    case 'endsWith':
      return (
        typeof field === 'string' &&
        field.toLowerCase().endsWith(String(expected).toLowerCase())
      );
  }
}

export function matchesWhere(obj: unknown, where: Where): boolean {
  if (!isPlainObject(obj)) return false;

  for (const [key, condition] of Object.entries(where)) {
    const field = obj[key];
    const ops = WHERE_OPERATORS.filter((op) => op in condition);

    if (ops.length > 0) {
      if (field === undefined) return false;
      const conditions = condition as OperatorConditions;
      if (!ops.every((op) => compare(field, op, conditions[op]))) return false;
      continue;
    }

    // A nested path like `address.city:eq`, applied only when the field is an object.
    if (isPlainObject(field) && !matchesWhere(field, condition as Where)) {
      return false;
    }
  }
  return true;
}

/** Same ordering rules as the `sort-on` package json-server uses. */
export function sortOn<T>(items: T[], sort: string): T[] {
  const fields = sort.split(',');

  return [...items].sort((a, b) => {
    for (const rawField of fields) {
      const isDescending = rawField.startsWith('-');
      const field = isDescending ? rawField.slice(1) : rawField;
      const x = getPath(a, field);
      const y = getPath(b, field);

      if (x === y) continue;
      // Falsy values (except 0) sort after truthy ones when ascending.
      if (y !== 0 && !y) return isDescending ? 1 : -1;
      if (x !== 0 && !x) return isDescending ? -1 : 1;
      if (typeof x === 'string' && typeof y === 'string') {
        const result = isDescending ? y.localeCompare(x) : x.localeCompare(y);
        if (result !== 0) return result;
        continue;
      }
      const isLess = (x as number) < (y as number);
      return isDescending ? (isLess ? 1 : -1) : isLess ? -1 : 1;
    }
    return 0;
  });
}

export function paginate<T>(
  items: T[],
  page: number,
  perPage: number,
): PaginatedResponse<T> {
  const safePerPage =
    Number.isFinite(perPage) && perPage > 0 ? Math.floor(perPage) : 1;
  const pages = Math.max(1, Math.ceil(items.length / safePerPage));
  const safePage = Number.isFinite(page) ? Math.floor(page) : 1;
  const currentPage = Math.max(1, Math.min(safePage, pages));
  const start = (currentPage - 1) * safePerPage;

  return {
    first: 1,
    prev: currentPage > 1 ? currentPage - 1 : null,
    next: currentPage < pages ? currentPage + 1 : null,
    last: pages,
    pages,
    items: items.length,
    data: items.slice(start, start + safePerPage),
  };
}

function parseIntParam(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key);
  if (raw === null) return undefined;
  const value = Number.parseInt(raw, 10);
  return Number.isNaN(value) ? undefined : value;
}

/**
 * Applies filters, then sorting, then pagination, in json-server's order.
 * Returns a plain array when `_page` is absent, as json-server does.
 */
export function queryCollection<T>(
  items: T[],
  params: URLSearchParams,
): T[] | PaginatedResponse<T> {
  const where = parseWhere(params);
  let results = items.filter((item) => matchesWhere(item, where));

  const sort = params.get('_sort');
  if (sort) results = sortOn(results, sort);

  const page = parseIntParam(params, '_page');
  if (page === undefined) return results;
  return paginate(results, page, parseIntParam(params, '_per_page') ?? 10);
}
