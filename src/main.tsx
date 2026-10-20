import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';

import { store } from '@/app/store';
import { USE_MOCK_API } from '@/utils/constants';

import App from './App.tsx';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

/** Starts the MSW service worker before the first request when the mock API is enabled. */
async function enableMocking(): Promise<void> {
  if (!USE_MOCK_API) return;
  const { worker } = await import('./mocks/browser');
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
  });
}

enableMocking()
  .catch((error: unknown) => {
    console.error('Failed to start the mock API', error);
  })
  .finally(() => {
    createRoot(rootElement).render(
      <StrictMode>
        <Provider store={store}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </Provider>
      </StrictMode>,
    );
  });
