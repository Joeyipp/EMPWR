import React, { useEffect } from 'react';
import { Route, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';

interface PrivateRouteProps {
  component: React.ComponentType<any>;
  path: string;
}

export function PrivateRoute({ component: Component, path }: PrivateRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Store authentication state in sessionStorage to persist across page refreshes
  useEffect(() => {
    if (user) {
      sessionStorage.setItem('isAuthenticated', 'true');
      sessionStorage.setItem('userId', user.userId.toString());
      sessionStorage.setItem('username', user.username);
    }
  }, [user]);
  
  // Check if user was previously authenticated in this session
  const wasAuthenticated = sessionStorage.getItem('isAuthenticated') === 'true';
  
  // Only redirect if definitely not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !wasAuthenticated) {
      setLocation(`/login?redirect=${encodeURIComponent(path)}`);
    }
  }, [isAuthenticated, isLoading, wasAuthenticated, path, setLocation]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }
  
  // If authenticated or was authenticated in this session, render the component
  if (isAuthenticated || wasAuthenticated) {
    return <Route path={path} component={Component} />;
  }
  
  // Otherwise return null while redirect happens
  return null;
}