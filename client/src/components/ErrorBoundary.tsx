import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    
    // Check if this is the "Cannot read properties of undefined (reading 'isCheckout')" error
    if (error.message && error.message.includes("'isCheckout'")) {
      console.log("Detected isCheckout error, cleaning up related data");
      if (typeof window !== 'undefined') {
        try {
          // Clear checkout related data that causes the error
          localStorage.removeItem('checkout_data');
          localStorage.removeItem('checkout_session');
          sessionStorage.removeItem('checkout_data');
        } catch (storageError) {
          console.error("Failed to clean checkout data:", storageError);
        }
      }
    }
    
    // Clear SES_UNCAUGHT_EXCEPTION from sessionStorage
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('SES_UNCAUGHT_EXCEPTION');
        
        // Flag that we're handling an error to prevent other code from running
        sessionStorage.setItem('error_being_handled', 'true');
      } catch (storageError) {
        console.error("Failed to access sessionStorage:", storageError);
      }
    }
  }

  private handleReset = () => {
    // Clear all storage and reload the page
    if (typeof window !== 'undefined') {
      try {
        // First clear specific error flags
        sessionStorage.removeItem('SES_UNCAUGHT_EXCEPTION');
        sessionStorage.removeItem('error_being_handled');
        
        // Clear checkout data that might cause isCheckout errors
        localStorage.removeItem('checkout_data');
        localStorage.removeItem('checkout_session');
        sessionStorage.removeItem('checkout_data');
        
        // Clear authentication data
        localStorage.removeItem('user_data');
        sessionStorage.removeItem('authVerified');
        
        // Clear all remaining storage
        localStorage.clear();
        sessionStorage.clear();
        
        // Redirect to login page for a clean state
        window.location.href = '/login';
      } catch (error) {
        console.error("Failed to reset application state:", error);
        // Force reload as fallback
        window.location.reload();
      }
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
          <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="h-16 w-16 rounded-full bg-red-600/20 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-3">Something went wrong</h2>
            
            <p className="text-gray-400 mb-6">
              We encountered an error while loading this page. Please try refreshing or resetting the application.
            </p>
            
            {this.state.error && (
              <div className="bg-gray-900 p-3 rounded mb-6 text-left overflow-x-auto">
                <p className="text-red-400 text-sm font-mono">
                  {this.state.error.toString()}
                </p>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
                className="border-gray-700 hover:bg-gray-700"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Page
              </Button>
              
              <Button 
                variant="default"
                onClick={this.handleReset}
                className="bg-gradient-to-r from-purple-600 to-indigo-600"
              >
                Reset Application
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;