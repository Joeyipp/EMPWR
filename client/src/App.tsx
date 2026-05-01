import React, { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { Toaster } from '@/components/ui/toaster';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AuthProvider } from './contexts/AuthContext';
import { AppStateProvider } from './contexts/AppStateContext';
import { AppRoutes } from './routes';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  // Clear SES_UNCAUGHT_EXCEPTION on app initial load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('SES_UNCAUGHT_EXCEPTION');
    }
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppStateProvider>
            <SidebarProvider>
              <AppRoutes />
              <Toaster />
            </SidebarProvider>
          </AppStateProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;