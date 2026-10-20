import type { OrderStatus, ProductStatus } from '@/types';

const configuredApiUrl = import.meta.env.VITE_API_BASE_URL as
  | string
  | undefined;
const mockApiFlag = import.meta.env.VITE_USE_MOCK_API as string | undefined;

/**
 * Serve the API from MSW in the browser instead of json-server. On by default
 * in production builds with no VITE_API_BASE_URL (e.g. static hosting), off in dev.
 * VITE_USE_MOCK_API=true|false overrides the default.
 */
export const USE_MOCK_API = mockApiFlag
  ? mockApiFlag === 'true'
  : import.meta.env.PROD && !configuredApiUrl;

// The mock uses a same-origin path so an HTTPS deployment never requests http://localhost.
export const API_BASE_URL = USE_MOCK_API
  ? '/api'
  : (configuredApiUrl ?? 'http://localhost:3001');

export const AUTH_TOKEN_KEY = 'admin_dashboard_token';
export const AUTH_USER_KEY = 'admin_dashboard_user';

export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
export const DEFAULT_PAGE_SIZE = 10;

export const PRODUCT_CATEGORIES = [
  'Electronics',
  'Clothing',
  'Home & Garden',
  'Sports & Outdoors',
  'Books',
  'Toys & Games',
  'Beauty & Health',
] as const;

export const PRODUCT_STATUSES: ProductStatus[] = ['active', 'inactive'];

export const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};
