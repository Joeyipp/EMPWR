import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface User {
  userId: number;
  username: string;
  isAdmin: boolean;
  email?: string;
  fullName?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (userData: SignupData) => Promise<User>;
  logout: () => Promise<void>;
}

interface SignupData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
}

const USER_LOCAL_STORAGE_KEY = 'user_data';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialize user from localStorage if available
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedUser = localStorage.getItem(USER_LOCAL_STORAGE_KEY);
        return savedUser ? JSON.parse(savedUser) : null;
      } catch (error) {
        console.error("Failed to parse user from localStorage:", error);
        return null;
      }
    }
    return null;
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const verifyUser = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/auth/user', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setUser(data.data);
            // Update localStorage
            if (typeof window !== 'undefined') {
              localStorage.setItem(USER_LOCAL_STORAGE_KEY, JSON.stringify(data.data));
              
              // Also set a session verification flag
              sessionStorage.setItem('authVerified', 'true');
            }
          } else {
            // Server returned success: false
            setUser(null);
            if (typeof window !== 'undefined') {
              localStorage.removeItem(USER_LOCAL_STORAGE_KEY);
              sessionStorage.removeItem('authVerified');
              
              // Show friendly message
              toast({
                title: "Session expired",
                description: "Please log in to continue",
                variant: "default"
              });
            }
          }
        } else if (response.status === 401) {
          // Unauthorized
          setUser(null);
          if (typeof window !== 'undefined') {
            localStorage.removeItem(USER_LOCAL_STORAGE_KEY);
            sessionStorage.removeItem('authVerified');
            
            // Only show notification if we had a token before
            const hadToken = localStorage.getItem(USER_LOCAL_STORAGE_KEY);
            if (hadToken) {
              toast({
                title: "Authentication required",
                description: "Your session has expired. Please log in again.",
                variant: "default"
              });
            }
          }
        }
        // For other error codes, keep existing user data
      } catch (error) {
        console.error("Error verifying user:", error);
        // Network error, keep existing user data for offline access
      } finally {
        setIsLoading(false);
      }
    };

    verifyUser();
  }, []);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Login failed");
      }
      
      return data.data;
    },
    onSuccess: (userData: User) => {
      setUser(userData);
      // Store in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(USER_LOCAL_STORAGE_KEY, JSON.stringify(userData));
      }
      
      toast({
        title: "Login successful",
        description: "Welcome back!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    },
  });

  // Signup mutation
  const signupMutation = useMutation({
    mutationFn: async (userData: SignupData) => {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Signup failed");
      }
      
      return data.data;
    },
    onSuccess: (userData: User) => {
      setUser(userData);
      // Store in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(USER_LOCAL_STORAGE_KEY, JSON.stringify(userData));
      }
      
      toast({
        title: "Account created",
        description: "Your account has been created successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Signup failed",
        description: error.message || "Failed to create account",
        variant: "destructive",
      });
    },
  });

  // Logout mutation with enhanced error handling
  const logoutMutation = useMutation({
    mutationFn: async () => {
      // First, let's clean up any potential sources of errors before making the API call
      if (typeof window !== 'undefined') {
        try {
          // Clear checkout related data (fixes the isCheckout error)
          localStorage.removeItem('checkout_data');
          localStorage.removeItem('checkout_session');
          sessionStorage.removeItem('checkout_data');
          
          // Clear any runtime errors
          sessionStorage.removeItem('SES_UNCAUGHT_EXCEPTION');
          
          // Set a flag to indicate logout is in progress
          sessionStorage.setItem('logout_in_progress', 'true');
        } catch (e) {
          console.error('Error clearing data before logout:', e);
        }
      }
      
      try {
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
          throw new Error(data.message || "Logout failed");
        }
        
        return data;
      } catch (error) {
        console.error('Error during logout API call:', error);
        // Even if API call fails, we want to clean up the client-side session
        // So we return a mock success to trigger the onSuccess handler
        return { success: true, message: "Forced client-side logout" };
      }
    },
    onSuccess: () => {
      // Clear user from state first
      setUser(null);
      
      // Clear from localStorage and sessionStorage safely
      if (typeof window !== 'undefined') {
        try {
          // Important: remove auth data first
          localStorage.removeItem(USER_LOCAL_STORAGE_KEY);
          sessionStorage.removeItem('authVerified');
          
          // Remove the logout flag
          sessionStorage.removeItem('logout_in_progress');
          
          // Clear all remaining storage to be safe
          localStorage.clear();
          sessionStorage.clear();
        } catch (e) {
          console.error('Error clearing storage during logout:', e);
        }
      }
      
      // Invalidate all queries to prevent stale data
      queryClient.clear();
      
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
    },
    onError: (error: any) => {
      // Even on error, ensure the user is logged out client-side
      setUser(null);
      
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(USER_LOCAL_STORAGE_KEY);
          sessionStorage.removeItem('authVerified');
          localStorage.clear();
          sessionStorage.clear();
        } catch (e) {
          console.error('Error clearing storage on logout error:', e);
        }
      }
      
      toast({
        title: "Logout completed with warnings",
        description: "You've been logged out, but there were some issues.",
        variant: "default",
      });
    },
  });

  // Authentication methods
  const login = async (email: string, password: string): Promise<User> => {
    return loginMutation.mutateAsync({ email, password });
  };

  const signup = async (userData: SignupData): Promise<User> => {
    return signupMutation.mutateAsync(userData);
  };

  const logout = async (): Promise<void> => {
    await logoutMutation.mutateAsync();
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}