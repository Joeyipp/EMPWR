import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
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
import { AtSignIcon, KeyIcon, LogInIcon } from "lucide-react";

// Form validation schema
const loginSchema = z.object({
  email: z
    .string()
    .min(1, { message: "Username or email is required" }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const { login, isAuthenticated, user } = useAuth(); // Use the AuthContext login method
  
  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, user, navigate]);

  // Set up form with validation
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Login mutation with AuthContext integration
  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormValues) => {
      // First clear any previous session data
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem('authVerified');
        } catch (e) {
          console.error('Error clearing session storage', e);
        }
      }
      
      // Use the AuthContext login method which will update the global auth state
      return await login(data.email, data.password);
    },
    onSuccess: () => {
      // Set auth verification flag
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('authVerified', 'true');
      }
      
      toast({
        title: "Login successful",
        description: "Welcome back to Knowledge Graph Platform!",
      });
      
      // Add a small delay to ensure the auth state is updated before navigation
      setTimeout(() => {
        // Use wouter navigation instead of direct location change
        navigate("/dashboard");
      }, 100);
    },
    onError: (error: any) => {
      console.error("Login error:", error);
      toast({
        title: "Login failed",
        description: error.message || "Invalid username/email or password",
        variant: "destructive",
      });
    },
  });

  function onSubmit(data: LoginFormValues) {
    loginMutation.mutate(data, {
      onSettled: () => {
        // This ensures any loading states are properly reset
        setTimeout(() => {
          navigate("/dashboard");
        }, 100);
      }
    });
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
                <LogInIcon className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-center text-white">Welcome Back</CardTitle>
            <CardDescription className="text-center text-white/80">
              Sign in to access your knowledge graphs
            </CardDescription>
          </CardHeader>
          
          <CardContent className="px-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Username or Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <AtSignIcon className="absolute left-3 top-3 h-5 w-5 text-white/60" />
                          <Input 
                            placeholder="username or email" 
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
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold py-2 h-12 mt-2 rounded-xl transition-all duration-300 shadow-lg hover:shadow-violet-600/30" 
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-5 w-5 animate-spin rounded-full border-3 border-white border-t-transparent" />
                      Signing in...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <LogInIcon className="h-5 w-5" />
                      Sign In
                    </span>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
          
          <CardFooter className="flex flex-col space-y-4 pb-8 px-8">
            <div className="text-center text-white/80">
              Don't have an account?{" "}
              <Link href="/signup" className="text-violet-300 hover:text-white font-medium transition-colors">
                Create Account
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}