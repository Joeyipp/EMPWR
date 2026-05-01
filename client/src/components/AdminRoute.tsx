import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '../contexts/AuthContext';

// Component to handle admin-only protected routes
const AdminRoute: React.FC<{component: React.ComponentType, path: string}> = ({
  component: Component,
  path
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  
  useEffect(() => {
    // Only redirect if loaded and either not authenticated or not admin
    if (!isLoading && (!isAuthenticated || !user?.isAdmin)) {
      console.log(`Redirecting from ${path} to /dashboard - Admin access required`);
      navigate('/dashboard');
    }
  }, [isLoading, isAuthenticated, user, navigate, path]);
  
  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="flex flex-col items-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-500 border-t-transparent mb-4"></div>
          <p className="text-gray-300">Verifying admin access...</p>
        </div>
      </div>
    );
  }
  
  // Render the component only if authenticated AND admin
  return (isAuthenticated && user?.isAdmin) ? (
    <Component />
  ) : null;
};

export default AdminRoute;