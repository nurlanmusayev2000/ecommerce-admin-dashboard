import { configure, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterAll, afterEach, beforeAll } from 'vitest';

import App from '@/App';
import { makeStore } from '@/app/store';
import { mockDb } from '@/mocks/db';
import { handlers } from '@/mocks/handlers';

// Lazy routes, debounced search (400 ms) and the mock API's delay all add up.
configure({ asyncUtilTimeout: 3000 });

/** Every API request the app made in the current test, so tests can check methods and query strings. */
export const requests: { method: string; url: URL }[] = [];

/**
 * Serves the API with the app's own MSW handlers (json-server behaviour over
 * db.json) and restores the seed data after each test.
 */
export function setupMockApi() {
  const server = setupServer(...handlers);
  server.events.on('request:start', ({ request }) => {
    requests.push({ method: request.method, url: new URL(request.url) });
  });

  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => {
    server.resetHandlers();
    mockDb.reset();
    requests.length = 0;
    localStorage.clear();
  });
  afterAll(() => server.close());
  return server;
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

const ADMIN = { id: '1', email: 'admin@example.com', name: 'Admin User' };

/** Renders the whole app at `route` with a fresh store, logged in unless told otherwise. */
export function renderApp(route: string, { authenticated = true } = {}) {
  const store = makeStore({
    auth: authenticated
      ? { user: ADMIN, token: 'test-token' }
      : { user: null, token: null },
  });
  const user = userEvent.setup();
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[route]}>
        <App />
        <LocationProbe />
      </MemoryRouter>
    </Provider>,
  );
  return {
    store,
    user,
    pathname: () => screen.getByTestId('location').textContent,
  };
}

/** Text of one column for every body row of the first table on the page. */
export function columnValues(columnIndex: number): string[] {
  const table = screen.getByRole('table');
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[columnIndex].textContent ?? '');
}
