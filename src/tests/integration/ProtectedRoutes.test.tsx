import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderApp, requests, setupMockApi } from './renderApp';

setupMockApi();

describe('protected routes', () => {
  it.each(['/products', '/orders/1', '/dashboard', '/customers'])(
    'redirects %s to /login when not logged in',
    async (route) => {
      const { pathname } = renderApp(route, { authenticated: false });

      expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
      expect(pathname()).toBe('/login');
      expect(requests).toEqual([]);
    },
  );

  it('opens /products directly when logged in', async () => {
    const { pathname } = renderApp('/products');
    expect(await screen.findByRole('heading', { name: 'Products' })).toBeInTheDocument();
    expect(pathname()).toBe('/products');
  });

  it('returns to the page you tried to open after logging in', async () => {
    const { user, pathname } = renderApp('/products', { authenticated: false });

    await user.type(await screen.findByLabelText('Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'admin123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Products' })).toBeInTheDocument();
    await waitFor(() => expect(pathname()).toBe('/products'));
  });

  it('goes to /login after logging out', async () => {
    const { user, pathname } = renderApp('/products');
    await screen.findByRole('heading', { name: 'Products' });

    await user.click(screen.getByRole('button', { name: /admin user/i }));
    await user.click(await screen.findByRole('menuitem', { name: 'Logout' }));

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(pathname()).toBe('/login');
  });
});
