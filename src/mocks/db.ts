/**
 * In-memory database for the MSW mock API, seeded from the same db.json that
 * json-server uses. Writes are saved to localStorage so created, edited and
 * deleted records survive a page reload.
 */
import seed from '../../db.json';

import type { JsonRecord } from './jsonServerQuery';

type Collections = Record<string, JsonRecord[]>;

interface StoredDb {
  seedVersion: string;
  collections: Collections;
}

const STORAGE_KEY = 'admin_dashboard_mock_db';

/** Changes whenever db.json changes, so a redeploy with new seed data replaces stale saved data. */
const SEED_VERSION = hash(JSON.stringify(seed));

function hash(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (Math.imul(31, h) + value.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function freshCollections(): Collections {
  return structuredClone(seed) as unknown as Collections;
}

// localStorage can be missing or throw (private mode, blocked storage, Node),
// in which case the data simply lives in memory for the session.
function load(): Collections {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as StoredDb;
      if (stored.seedVersion === SEED_VERSION) return stored.collections;
    }
  } catch {
    // Fall back to the seed data.
  }
  return freshCollections();
}

function persist(): void {
  try {
    const stored: StoredDb = { seedVersion: SEED_VERSION, collections };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Keep working in memory only.
  }
}

/** Same format as json-server's ids: 8 random bytes, base64url-encoded. */
function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

let collections = load();

export const mockDb = {
  has(name: string): boolean {
    return Object.prototype.hasOwnProperty.call(collections, name);
  },

  list(name: string): JsonRecord[] {
    return collections[name] ?? [];
  },

  findById(name: string, id: string): JsonRecord | undefined {
    return collections[name]?.find((item) => item.id === id);
  },

  create(name: string, data: JsonRecord): JsonRecord | undefined {
    const items = collections[name];
    if (!items) return undefined;
    const item = { ...data, id: randomId() };
    items.push(item);
    persist();
    return item;
  },

  /** PUT replaces the record, PATCH merges into it; the id never changes. */
  update(
    name: string,
    id: string,
    body: JsonRecord,
    { patch }: { patch: boolean },
  ): JsonRecord | undefined {
    const items = collections[name];
    const index = items?.findIndex((item) => item.id === id) ?? -1;
    if (!items || index === -1) return undefined;
    const next = patch ? { ...items[index], ...body, id } : { ...body, id };
    items.splice(index, 1, next);
    persist();
    return next;
  },

  remove(name: string, id: string): JsonRecord | undefined {
    const items = collections[name];
    const index = items?.findIndex((item) => item.id === id) ?? -1;
    if (!items || index === -1) return undefined;
    const [removed] = items.splice(index, 1);
    persist();
    return removed;
  },

  /** Restores db.json and clears saved changes. */
  reset(): void {
    collections = freshCollections();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing saved to clear.
    }
  },
};
