import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { AtSignIcon, KeyIcon, UserIcon, UserPlusIcon } from "lucide-react";

// Form validation schema
const signupSchema = z.object({
  username: z
    .string()
    .min(3, { message: "Username must be at least 3 characters" })
    .max(20, { message: "Username must be at most 20 characters" })
    .regex(/^[a-zA-Z0-9_-]+$/, { message: "Username can only contain letters, numbers, underscores, and dashes" }),
  email: z
    .string()
    .min(1, { message: "Email is required" })
    .email({ message: "Invalid email address" }),
  fullName: z
    .string()
    .min(1, { message: "Full name is required" }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" }),
  confirmPassword: z
    .string()
    .min(1, { message: "Please confirm your password" }),
}).refine((data) => data.password === data.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match",
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const { signup, isAuthenticated, user } = useAuth(); // Use the AuthContext signup method instead
  
  // Query to check if signup is enabled
  const { data: signupEnabledData, isLoading: isLoadingSignupEnabled } = useQuery({
    queryKey: ['/api/auth/signup-enabled'],
    queryFn: async () => {
      const response = await fetch('/api/auth/signup-enabled');
      if (!response.ok) {
        throw new Error('Failed to check if signups are enabled');
      }
      return response.json();
    }
  });
  
  // Extract signup enabled status
  // Default to false (disabled) if data is unavailable to avoid showing signup form prematurely
  const isSignupEnabled = signupEnabledData?.data?.enabled ?? false;
  
  // Add debug logging
  useEffect(() => {
    console.log('Signup Data:', signupEnabledData);
    console.log('Is Signup Enabled:', isSignupEnabled);
  }, [signupEnabledData, isSignupEnabled]);
  
  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, user, navigate]);

  // Set up form with validation
  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: "",
      email: "",
      fullName: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Signup mutation with optimized handling and AuthContext integration
  const signupMutation = useMutation({
    mutationFn: async (data: SignupFormValues) => {
      // Clear any previous session data before signup
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem('authVerified');
        } catch (e) {
          console.error('Error clearing session storage', e);
        }
      }
      
      // Use the AuthContext signup method which will update the global auth state
      return await signup(data);
    },
    onSuccess: () => {
      // Set auth verification flag
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('authVerified', 'true');
      }
      
      toast({
        title: "Account created",
        description: "Your account has been created successfully!",
      });
      
      // Add a small delay to ensure the auth state is updated before navigation
      setTimeout(() => {
        // Use wouter navigation instead of direct location change
        navigate("/dashboard");
      }, 100);
    },
    onError: (error: any) => {
      console.error("Signup error:", error);
      toast({
        title: "Signup failed",
        description: error.message || "There was an error creating your account",
        variant: "destructive",
      });
    },
  });

  function onSubmit(data: SignupFormValues) {
    // Handle loading state explicitly for better control
    signupMutation.mutate(data, {
      onSettled: () => {
        // This ensures any loading states are properly reset
        setTimeout(() => {
          navigate("/dashboard");
        }, 100);
      }
    });
  }

  // Show loading state while checking if signups are enabled
  if (isLoadingSignupEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply opacity-20 animate-blob"></div>
          <div className="absolute top-48 -right-24 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-24 left-48 w-96 h-96 bg-purple-800 rounded-full mix-blend-multiply opacity-20 animate-blob animation-delay-4000"></div>
        </div>
        
        <div className="relative z-10 flex flex-col items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white border-t-transparent mb-4"></div>
          <p className="text-white text-xl">Loading...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply opacity-20 animate-blob"></div>
        <div className="absolute top-48 -right-24 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-24 left-48 w-96 h-96 bg-purple-800 rounded-full mix-blend-multiply opacity-20 animate-blob animation-delay-4000"></div>
      </div>
      
      {/* Glass card effect */}
      <div className="relative z-10 w-full max-w-md backdrop-blur-sm bg-white/10 rounded-2xl shadow-2xl overflow-hidden border border-white/20">
        <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-white/5 pointer-events-none"></div>
        
        <Card className="bg-transparent border-none shadow-none">
          <CardHeader className="space-y-1 pt-8">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg">
                <UserPlusIcon className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-center text-white">
              {isSignupEnabled ? "Create Account" : "Coming Soon"}
            </CardTitle>
            <CardDescription className="text-center text-white/80">
              {isSignupEnabled 
                ? "Sign up to start building knowledge graphs" 
                : "Registration is currently disabled"}
            </CardDescription>
          </CardHeader>
          
          {isSignupEnabled ? (
            <>
              <CardContent className="px-8">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Username</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <UserIcon className="absolute left-3 top-3 h-5 w-5 text-white/60" />
                              <Input 
                                placeholder="johndoe" 
                                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white focus:ring-white/30" 
                                {...field} 
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-pink-300" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Email</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <AtSignIcon className="absolute left-3 top-3 h-5 w-5 text-white/60" />
                              <Input 
                                placeholder="you@example.com" 
                                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white focus:ring-white/30" 
                                {...field} 
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-pink-300" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Full Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <UserIcon className="absolute left-3 top-3 h-5 w-5 text-white/60" />
                              <Input 
                                placeholder="John Doe" 
                                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white focus:ring-white/30" 
                                {...field} 
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-pink-300" />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">Password</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <KeyIcon className="absolute left-3 top-3 h-5 w-5 text-white/60" />
                                <Input 
                                  type="password" 
                                  placeholder="••••••••" 
                                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white focus:ring-white/30" 
                                  {...field} 
                                />
                              </div>
                            </FormControl>
                            <FormMessage className="text-pink-300" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">Confirm</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <KeyIcon className="absolute left-3 top-3 h-5 w-5 text-white/60" />
                                <Input 
                                  type="password" 
                                  placeholder="••••••••" 
                                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white focus:ring-white/30" 
                                  {...field} 
                                />
                              </div>
                            </FormControl>
                            <FormMessage className="text-pink-300" />
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold py-2 h-12 mt-2 rounded-xl transition-all duration-300 shadow-lg hover:shadow-violet-600/30" 
                      disabled={signupMutation.isPending}
                    >
                      {signupMutation.isPending ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="h-5 w-5 animate-spin rounded-full border-3 border-white border-t-transparent" />
                          Creating account...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <UserPlusIcon className="h-5 w-5" />
                          Create Account
                        </span>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
              
              <CardFooter className="flex flex-col space-y-4 pb-8 px-8">
                <div className="text-center text-white/80">
                  Already have an account?{" "}
                  <Link href="/login" className="text-violet-300 hover:text-white font-medium transition-colors">
                    Sign In
                  </Link>
                </div>
              </CardFooter>
            </>
          ) : (
            <>
              <CardContent className="px-8 py-6">
                <div className="text-center space-y-6">
                  <p className="text-white/90 text-lg">
                    We're working on something exciting! User registration is temporarily disabled.
                  </p>
                  <p className="text-white/80">
                    Please check back soon or contact us for more information.
                  </p>
                </div>
              </CardContent>
              
              <CardFooter className="flex flex-col space-y-4 pb-8 px-8">
                <Button 
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold py-2 h-12 mt-2 rounded-xl transition-all duration-300 shadow-lg hover:shadow-violet-600/30"
                  onClick={() => navigate('/login')}
                >
                  Go to Login
                </Button>
                <div className="text-center text-white/80 mt-2">
                  Already have an account?{" "}
                  <Link href="/login" className="text-violet-300 hover:text-white font-medium transition-colors">
                    Sign In
                  </Link>
                </div>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}