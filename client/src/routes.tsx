import React from 'react';
import { Route, Switch } from 'wouter';
import Login from './pages/login';
import Signup from './pages/signup';
import Home from './pages/home';
import Generate from './pages/generate';
import Hybrid from './pages/hybrid';
import Extract from './pages/extract';
import Merge from './pages/merge';
import Align from './pages/align';
import Load from './pages/load';
import Insights from './pages/insights';
import Settings from './pages/settings';
import Subgraphs from './pages/subgraphs';
import SchemaOrgPage from './pages/SchemaOrgPage';
import MultimodalPage from './pages/MultimodalPage';
import OntoMaker from './pages/ontomaker';
import GoogleScholar from './pages/google-scholar';
import Bulk from './pages/bulk';
import Graph from './pages/graph';
import Dashboard from './pages/dashboard';
import AdminDashboard from './pages/admin';
import Tutorials from './pages/tutorials';
import GraphDemo from './pages/graph-demo';
import NotFound from './pages/not-found';
import { useAuth } from './contexts/AuthContext';
import { useLocation } from 'wouter';
import { useEffect } from 'react';
import AdminRoute from './components/AdminRoute';

// Route components defined below

// Component to handle protected routes with improved auth persistence
const ProtectedRoute: React.FC<{component: React.ComponentType, path: string}> = ({
  component: Component,
  path
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  
  // Maintain a flag in sessionStorage to prevent unnecessary redirects
  // This helps when navigating between pages after authentication
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (isAuthenticated && user) {
        // User is authenticated, set the flag
        sessionStorage.setItem('authVerified', 'true');
      }
    }
  }, [isAuthenticated, user]);
  
  // Check if previously verified in this session
  const wasAuthenticated = typeof window !== 'undefined' && sessionStorage.getItem('authVerified') === 'true';
  
  useEffect(() => {
    // Only redirect if explicitly not authenticated, not loading, and not previously verified
    if (!isLoading && !isAuthenticated && !wasAuthenticated) {
      console.log(`Redirecting from ${path} to /login due to no authentication`);
      navigate('/login');
    }
  }, [isLoading, isAuthenticated, navigate, path, wasAuthenticated]);
  
  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="flex flex-col items-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-500 border-t-transparent mb-4"></div>
          <p className="text-gray-300">Verifying authentication...</p>
        </div>
      </div>
    );
  }
  
  // Render the component if authenticated OR previously verified
  return (isAuthenticated || wasAuthenticated) ? (
    <Route path={path} component={Component as any} />
  ) : null;
};

export const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  // Define home component here directly
  const HomeRouteComponent = () => {
    const { isAuthenticated } = useAuth();
    const [, navigate] = useLocation();
    
    // Use effect for redirection
    useEffect(() => {
      if (isAuthenticated) {
        navigate('/dashboard');
      }
    }, [isAuthenticated, navigate]);
    
    // Show loading or home based on auth status
    return isAuthenticated ? (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="flex flex-col items-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-500 border-t-transparent mb-4"></div>
          <p className="text-gray-300">Redirecting to dashboard...</p>
        </div>
      </div>
    ) : (
      <Home />
    );
  };

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/graph-demo" component={GraphDemo} />
      
      {/* Home page with redirect for authenticated users */}
      <Route path="/" component={HomeRouteComponent} />
      
      {/* Protected routes */}
      <ProtectedRoute path="/generate" component={Generate} />
      <ProtectedRoute path="/hybrid" component={Hybrid} />
      <ProtectedRoute path="/extract" component={Extract} />
      <ProtectedRoute path="/merge" component={Merge} />
      <ProtectedRoute path="/align" component={Align} />
      <ProtectedRoute path="/load" component={Load} />
      <ProtectedRoute path="/insights" component={Insights} />
      <ProtectedRoute path="/settings" component={Settings} />
      <ProtectedRoute path="/subgraphs" component={Subgraphs} />
      <ProtectedRoute path="/graph/:id" component={Graph} />
      <ProtectedRoute path="/schema-org" component={SchemaOrgPage} />
      <ProtectedRoute path="/multimodal" component={MultimodalPage} />
      <ProtectedRoute path="/ontomaker" component={OntoMaker} />
      <ProtectedRoute path="/google-scholar" component={GoogleScholar} />
      <ProtectedRoute path="/bulk" component={Bulk} />
      <ProtectedRoute path="/tutorials" component={Tutorials} />
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      
      {/* Admin routes */}
      <AdminRoute path="/admin" component={AdminDashboard} />
      
      <Route component={NotFound} />
    </Switch>
  );
};