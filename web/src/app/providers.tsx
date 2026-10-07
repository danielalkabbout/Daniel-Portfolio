import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ApiError } from '../api/client';
import { logout } from '../features/admin/auth';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
  queryCache: new QueryCache({
    // An expired admin token: sign out so the studio shows the login form again.
    onError: (error, query) => {
      if (error instanceof ApiError && error.status === 401 && query.queryKey[0] === 'admin') logout();
    },
  }),
});

export function Providers({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
