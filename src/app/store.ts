import { combineReducers, configureStore } from '@reduxjs/toolkit';

import { baseApi } from '@/services/api/baseApi';
import authReducer from '@/store/slices/authSlice';
import filterReducer from '@/store/slices/filterSlice';
import uiReducer from '@/store/slices/uiSlice';

const rootReducer = combineReducers({
  auth: authReducer,
  ui: uiReducer,
  filter: filterReducer,
  [baseApi.reducerPath]: baseApi.reducer,
});

export type RootState = ReturnType<typeof rootReducer>;

/** Creates a store. Tests call this for a fresh store, optionally with preloaded state. */
export function makeStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(baseApi.middleware),
  });
}

export const store = makeStore();

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore['dispatch'];
