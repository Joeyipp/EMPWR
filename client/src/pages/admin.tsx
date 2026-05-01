import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Checkbox } from "@/components/ui/checkbox";
import PageLayout from '../components/PageLayout';
import { useSidebar } from "@/components/ui/sidebar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  User,
  Users,
  BarChart3,
  Database,
  Activity,
  Pencil,
  Search,
  FileSpreadsheet,
  Trash2,
  PlusCircle,
  X,
  ExternalLink,
  RefreshCw,
  Filter,
  Download,
  AlertCircle,
  CheckCircle2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Link,
  Settings,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';

// Format date
const formatDate = (dateString: string) => {
  try {
    const date = parseISO(dateString);
    return format(date, 'PPP');
  } catch (e) {
    return 'Invalid date';
  }
};

// Signup toggle component
const SignupToggle: React.FC = () => {
  const { toast } = useToast();
  const [isEnabled, setIsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch the current setting
  const { data: settingData } = useQuery({
    queryKey: ['/api/admin/settings/signup-enabled'],
  });

  // Handle data changes
  useEffect(() => {
    if (settingData && (settingData as any).data !== undefined) {
      // Add debug logging
      console.log('Admin signup setting data:', settingData);
      setIsEnabled((settingData as any).data.value === 'true');
    }
    setIsLoading(false);
  }, [settingData]);

  // Toggle mutation
  const toggleSignupMutation = useMutation({
    mutationFn: (enabled: boolean) => 
      apiRequest('POST', '/api/admin/settings/signup-enabled', { value: enabled.toString() }),
    onSuccess: (_, enabled) => {
      toast({
        title: enabled ? "Signups enabled" : "Signups disabled",
        description: enabled ? 
          "New user registrations have been enabled." : 
          "New user registrations have been disabled.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings/signup-enabled'] });
    },
    onError: (error, enabled) => {
      // Roll back the state on error
      setIsEnabled(!enabled);
      toast({
        title: "Error",
        description: `Failed to update setting: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    },
  });

  // Handle toggle change
  const handleToggleChange = (newValue: boolean) => {
    setIsEnabled(newValue);
    toggleSignupMutation.mutate(newValue);
  };

  if (isLoading) {
    return <div className="flex items-center space-x-2">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div>
      <span className="text-gray-400 text-sm">Loading...</span>
    </div>;
  }

  return (
    <div className="flex items-center space-x-2">
      <Switch 
        checked={isEnabled} 
        onCheckedChange={handleToggleChange}
        disabled={toggleSignupMutation.isPending}
        className="data-[state=checked]:bg-green-600"
      />
      <span className={`text-sm font-medium ${isEnabled ? 'text-green-500' : 'text-red-500'}`}>
        {isEnabled ? 'Signups Enabled' : 'Signups Disabled'}
      </span>
    </div>
  );
};

// User edit form schema
const userFormSchema = z.object({
  username: z.string().min(3, { message: "Username must be at least 3 characters" }),
  email: z.string().email({ message: "Invalid email address" }),
  fullName: z.string().optional(),
  isAdmin: z.boolean().default(false),
});

// Graph rename form schema
const graphRenameSchema = z.object({
  name: z.string().min(1, { message: "Graph name is required" }),
});

const AdminDashboard: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [isDeleteUserDialogOpen, setIsDeleteUserDialogOpen] = useState(false);
  const [selectedGraph, setSelectedGraph] = useState<any>(null);
  const [isRenameGraphDialogOpen, setIsRenameGraphDialogOpen] = useState(false);
  const [isDeleteGraphDialogOpen, setIsDeleteGraphDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGraphs, setSelectedGraphs] = useState<number[]>([]);
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false);
  
  // Get sidebar width for proper spacing
  const { state, width: sidebarWidth } = useSidebar() as any;

  // Setup form for user edit
  const userForm = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: "",
      email: "",
      fullName: "",
      isAdmin: false,
    },
  });

  // Setup form for graph rename
  const graphRenameForm = useForm<z.infer<typeof graphRenameSchema>>({
    resolver: zodResolver(graphRenameSchema),
    defaultValues: {
      name: "",
    },
  });

  // Fetch admin data
  const { data: usersData, isLoading: isLoadingUsers, refetch: refetchUsers } = useQuery({
    queryKey: ['/api/admin/users'],
    retry: false,
    enabled: activeTab === 'users' || activeTab === 'overview',
  });

  const { data: graphsData, isLoading: isLoadingGraphs, refetch: refetchGraphs } = useQuery({
    queryKey: ['/api/admin/graphs'],
    retry: false,
    enabled: activeTab === 'graphs' || activeTab === 'overview',
  });

  const { data: statsData, isLoading: isLoadingStats, refetch: refetchStats } = useQuery({
    queryKey: ['/api/admin/stats'],
    retry: false,
    enabled: activeTab === 'overview',
  });

  // User mutations
  const updateUserMutation = useMutation({
    mutationFn: (userData: any) => 
      apiRequest('PATCH', `/api/admin/users/${userData.id}`, userData),
    onSuccess: () => {
      toast({
        title: "User updated",
        description: "User has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      setIsEditUserDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: number) => 
      apiRequest('DELETE', `/api/admin/users/${userId}`),
    onSuccess: () => {
      toast({
        title: "User deleted",
        description: "User has been successfully deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/graphs'] });
      setIsDeleteUserDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    },
  });

  // Graph mutations
  const renameGraphMutation = useMutation({
    mutationFn: (data: { id: number, name: string }) => 
      apiRequest('PATCH', `/api/admin/graphs/${data.id}`, { name: data.name }),
    onSuccess: () => {
      toast({
        title: "Graph renamed",
        description: "Graph has been successfully renamed.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/graphs'] });
      setIsRenameGraphDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to rename graph: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    },
  });

  const deleteGraphMutation = useMutation({
    mutationFn: (graphId: number) => 
      apiRequest('DELETE', `/api/admin/graphs/${graphId}`),
    onSuccess: () => {
      toast({
        title: "Graph deleted",
        description: "Graph has been successfully deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/graphs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      setIsDeleteGraphDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete graph: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    },
  });

  const deleteMultipleGraphsMutation = useMutation({
    mutationFn: (graphIds: number[]) => 
      apiRequest('POST', '/api/admin/graphs/delete-multiple', { ids: graphIds }),
    onSuccess: (response: any) => {
      const success = response?.data?.success || [];
      const failed = response?.data?.failed || [];
      toast({
        title: "Graphs deleted",
        description: `Successfully deleted ${success.length} graphs. ${failed.length > 0 ? `Failed to delete ${failed.length} graphs.` : ''}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/graphs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      setIsDeletingMultiple(false);
      setSelectedGraphs([]);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete graphs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
      setIsDeletingMultiple(false);
    },
  });

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchTerm("");
    setSelectedGraphs([]);
  };

  // Edit user handlers
  const openEditUserDialog = (user: any) => {
    setSelectedUser(user);
    userForm.reset({
      username: user.username,
      email: user.email,
      fullName: user.fullName || "",
      isAdmin: user.isAdmin,
    });
    setIsEditUserDialogOpen(true);
  };

  const handleUserSubmit = (data: z.infer<typeof userFormSchema>) => {
    if (!selectedUser) return;
    
    updateUserMutation.mutate({
      id: selectedUser.id,
      ...data,
    });
  };

  // Delete user handlers
  const openDeleteUserDialog = (user: any) => {
    setSelectedUser(user);
    setIsDeleteUserDialogOpen(true);
  };

  const confirmDeleteUser = () => {
    if (!selectedUser) return;
    deleteUserMutation.mutate(selectedUser.id);
  };

  // Rename graph handlers
  const openRenameGraphDialog = (graph: any) => {
    setSelectedGraph(graph);
    graphRenameForm.reset({
      name: graph.name || "",
    });
    setIsRenameGraphDialogOpen(true);
  };

  const handleGraphRenameSubmit = (data: z.infer<typeof graphRenameSchema>) => {
    if (!selectedGraph) return;
    
    renameGraphMutation.mutate({
      id: selectedGraph.id,
      name: data.name,
    });
  };

  // Delete graph handlers
  const openDeleteGraphDialog = (graph: any) => {
    setSelectedGraph(graph);
    setIsDeleteGraphDialogOpen(true);
  };

  const confirmDeleteGraph = () => {
    if (!selectedGraph) return;
    deleteGraphMutation.mutate(selectedGraph.id);
  };

  // Multiple graph selection handlers
  const toggleGraphSelection = (graphId: number) => {
    setSelectedGraphs(prev => 
      prev.includes(graphId) 
        ? prev.filter(id => id !== graphId)
        : [...prev, graphId]
    );
  };

  const confirmDeleteMultipleGraphs = () => {
    if (selectedGraphs.length === 0) return;
    deleteMultipleGraphsMutation.mutate(selectedGraphs);
  };

  // Filter functions for search
  const filteredUsers = usersData?.data ? usersData.data.filter((user: any) => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  const filteredGraphs = graphsData?.data ? graphsData.data.filter((graph: any) => 
    (graph.name || `Graph #${graph.id}`).toLowerCase().includes(searchTerm.toLowerCase()) ||
    graph.user.username.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  // Generate user initials for avatar
  const getInitials = (username: string) => {
    return username
      .split(' ')
      .map(name => name[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Count selected graphs
  const selectedGraphCount = selectedGraphs.length;

  // Refresh all data
  const refreshAllData = () => {
    refetchUsers();
    refetchGraphs();
    refetchStats();
    toast({
      title: "Data refreshed",
      description: "All admin data has been refreshed.",
    });
  };

  return (
    <PageLayout>
        <div className="bg-gray-950 text-white">
          <main className="max-w-7xl mx-auto px-4 py-8">
          {/* Admin Header */}
          <div className="mb-8 border border-gray-800 rounded-lg p-6 bg-gray-900 shadow-lg">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-semibold mb-2 flex items-center text-indigo-400">
                  <ShieldCheck className="mr-2 h-6 w-6" /> Admin Dashboard
                </h1>
                <p className="text-gray-400">
                  Manage users, knowledge graphs, and view system statistics
                </p>
              </div>
              <Button 
                variant="outline" 
                className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
                onClick={refreshAllData}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh Data
              </Button>
            </div>
          </div>
          
          {/* Tabs Container */}
          <Tabs defaultValue="overview" onValueChange={handleTabChange} className="space-y-6">
            <div className="border-b border-gray-800 pb-2">
              <TabsList className="bg-gray-900 border border-gray-800">
                <TabsTrigger value="overview" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="users" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                  <Users className="h-4 w-4 mr-2" />
                  Users
                </TabsTrigger>
                <TabsTrigger value="graphs" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                  <Database className="h-4 w-4 mr-2" />
                  Graphs
                </TabsTrigger>
                <TabsTrigger value="settings" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Overview Tab */}
            <TabsContent value="overview">
              {isLoadingStats ? (
                <div className="flex items-center justify-center mt-10">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
                </div>
              ) : statsData?.data ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <Card className="bg-gray-900 border-gray-800 shadow-lg">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-indigo-400 flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        User Stats
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <div className="text-3xl font-bold text-white">{statsData.data.totalUsers}</div>
                          <p className="text-sm text-gray-400">Total Users</p>
                        </div>
                        <div className="flex items-center text-green-500">
                          <Activity className="h-4 w-4 mr-1" />
                          <span className="text-sm">{statsData.data.newUsersLastMonth} new in the last month</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-900 border-gray-800 shadow-lg">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-blue-400 flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        Graph Stats
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <div className="text-3xl font-bold text-white">{statsData.data.totalGraphs}</div>
                          <p className="text-sm text-gray-400">Total Graphs</p>
                        </div>
                        <div className="flex items-center text-green-500">
                          <Activity className="h-4 w-4 mr-1" />
                          <span className="text-sm">{statsData.data.newGraphsLastMonth} new in the last month</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-900 border-gray-800 shadow-lg">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-cyan-400 flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5" />
                        Entity Stats
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <div className="text-3xl font-bold text-white">{statsData.data.totalEntities}</div>
                          <p className="text-sm text-gray-400">Total Entities</p>
                        </div>
                        <div className="flex items-center text-cyan-500">
                          <Link className="h-4 w-4 mr-1" />
                          <span className="text-sm">{statsData.data.totalRelations} relationships mapped</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="md:col-span-2 bg-gray-900 border-gray-800 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-indigo-400 flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Top Users by Graph Count
                      </CardTitle>
                      <CardDescription className="text-gray-400">
                        Users who have created the most knowledge graphs
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader className="bg-gray-800 border-gray-700 rounded-lg">
                          <TableRow className="border-gray-700 hover:bg-gray-800">
                            <TableHead className="text-gray-300">User</TableHead>
                            <TableHead className="text-gray-300">Email</TableHead>
                            <TableHead className="text-right text-gray-300">Graph Count</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {statsData.data.graphsByUser.length > 0 ? (
                            statsData.data.graphsByUser.map((userData: any) => (
                              <TableRow key={userData.userId} className="border-gray-800 hover:bg-gray-800">
                                <TableCell className="font-medium text-gray-200">
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-8 w-8 bg-indigo-700 text-white">
                                      <AvatarFallback>{getInitials(userData.username)}</AvatarFallback>
                                    </Avatar>
                                    {userData.username}
                                  </div>
                                </TableCell>
                                <TableCell className="text-gray-300">{userData.email}</TableCell>
                                <TableCell className="text-right text-gray-200">
                                  <Badge variant="outline" className="bg-gray-800 text-white border-indigo-500 px-2 py-0.5">
                                    {userData.graphCount}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow className="border-gray-800">
                              <TableCell colSpan={3} className="text-center py-4 text-gray-400">
                                No users with graphs found
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <Card className="lg:col-span-1 bg-gray-900 border-gray-800 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-indigo-400 flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        System Information
                      </CardTitle>
                      <CardDescription className="text-gray-400">
                        Technical details about your instance
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-sm font-medium text-gray-300 mb-1">Storage Type</h3>
                          <Badge variant="outline" className="text-sm font-mono bg-gray-800 border-gray-700 text-indigo-400">
                            {statsData.data.storageType}
                          </Badge>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-300 mb-1">System Status</h3>
                          <div className="flex items-center gap-1 text-green-500">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Operational</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="flex justify-center mt-10">
                  <Card className="max-w-md bg-gray-900 border-gray-800">
                    <CardHeader>
                      <CardTitle className="text-red-400 flex items-center">
                        <AlertCircle className="mr-2 h-5 w-5" />
                        Error Loading Stats
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-gray-300">
                      <p>Unable to load system statistics. Please try again later.</p>
                    </CardContent>
                    <CardFooter>
                      <Button onClick={() => refetchStats()} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                        <RefreshCw className="mr-2 h-4 w-4" /> Retry
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      type="search"
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 bg-gray-900 border-gray-700 text-white"
                    />
                  </div>
                </div>

                {isLoadingUsers ? (
                  <div className="flex items-center justify-center mt-10">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
                  </div>
                ) : usersData?.data ? (
                  <Card className="bg-gray-900 border-gray-800 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-indigo-400 flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        User Management
                      </CardTitle>
                      <CardDescription className="text-gray-400">
                        Manage user accounts and permissions
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader className="bg-gray-800 border-gray-700 rounded-lg">
                          <TableRow className="border-gray-700 hover:bg-gray-800">
                            <TableHead className="text-gray-300">User</TableHead>
                            <TableHead className="text-gray-300">Email</TableHead>
                            <TableHead className="text-gray-300">Role</TableHead>
                            <TableHead className="text-gray-300">Created</TableHead>
                            <TableHead className="text-gray-300">Last Login</TableHead>
                            <TableHead className="text-right text-gray-300">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredUsers.length > 0 ? (
                            filteredUsers.map((user: any) => (
                              <TableRow key={user.id} className="border-gray-800 hover:bg-gray-800">
                                <TableCell className="font-medium text-gray-200">
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-8 w-8 bg-indigo-700 text-white">
                                      <AvatarFallback>{getInitials(user.username)}</AvatarFallback>
                                    </Avatar>
                                    {user.username}
                                  </div>
                                </TableCell>
                                <TableCell className="text-gray-300">{user.email}</TableCell>
                                <TableCell>
                                  <Badge className={user.isAdmin ? "bg-indigo-600 hover:bg-indigo-700" : "bg-gray-700 hover:bg-gray-600"}>
                                    {user.isAdmin ? "Admin" : "User"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-gray-300">{formatDate(user.createdAt)}</TableCell>
                                <TableCell className="text-gray-300">{formatDate(user.lastLogin)}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="h-8 border-gray-700 hover:bg-gray-800 text-gray-300"
                                      onClick={() => openEditUserDialog(user)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button 
                                      variant="destructive" 
                                      size="sm" 
                                      className="h-8"
                                      onClick={() => openDeleteUserDialog(user)}
                                      disabled={user.isAdmin} // Prevent deleting admin users
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow className="border-gray-800">
                              <TableCell colSpan={6} className="text-center py-4 text-gray-400">
                                {searchTerm ? "No users matching search criteria" : "No users found"}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex justify-center mt-10">
                    <Card className="max-w-md bg-gray-900 border-gray-800">
                      <CardHeader>
                        <CardTitle className="text-red-400 flex items-center">
                          <AlertCircle className="mr-2 h-5 w-5" />
                          Error Loading Users
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-gray-300">
                        <p>Unable to load user data. Please try again later.</p>
                      </CardContent>
                      <CardFooter>
                        <Button onClick={() => refetchUsers()} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                          <RefreshCw className="mr-2 h-4 w-4" /> Retry
                        </Button>
                      </CardFooter>
                    </Card>
                  </div>
                )}
              </div>

              {/* Edit User Dialog */}
              <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
                <DialogContent className="bg-gray-900 border-gray-800 text-white">
                  <DialogHeader>
                    <DialogTitle className="text-indigo-400">Edit User</DialogTitle>
                    <DialogDescription className="text-gray-400">
                      Make changes to the user account.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...userForm}>
                    <form onSubmit={userForm.handleSubmit(handleUserSubmit)} className="space-y-4">
                      <FormField
                        control={userForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300">Username</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                className="bg-gray-800 border-gray-700 text-white" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={userForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300">Email</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                className="bg-gray-800 border-gray-700 text-white" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={userForm.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300">Full Name</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                className="bg-gray-800 border-gray-700 text-white"
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={userForm.control}
                        name="isAdmin"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border border-gray-800 p-3">
                            <div className="space-y-0.5">
                              <FormLabel className="text-gray-300">Admin Privileges</FormLabel>
                              <FormDescription className="text-gray-500">
                                Grant admin dashboard access
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setIsEditUserDialogOpen(false)}
                          className="border-gray-700 text-gray-300 hover:bg-gray-800"
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          className="bg-indigo-600 hover:bg-indigo-700"
                          disabled={updateUserMutation.isPending}
                        >
                          {updateUserMutation.isPending ? (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                              Updating...
                            </>
                          ) : "Save Changes"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              {/* Delete User Dialog */}
              <Dialog open={isDeleteUserDialogOpen} onOpenChange={setIsDeleteUserDialogOpen}>
                <DialogContent className="bg-gray-900 border-gray-800 text-white">
                  <DialogHeader>
                    <DialogTitle className="text-red-400 flex items-center">
                      <ShieldAlert className="mr-2 h-5 w-5" />
                      Delete User
                    </DialogTitle>
                    <DialogDescription className="text-gray-400">
                      This action cannot be undone. The user will be permanently deleted.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <p className="text-gray-300">
                      Are you sure you want to delete the user <span className="font-semibold text-white">{selectedUser?.username}</span>?
                    </p>
                    <p className="text-gray-400 mt-2">
                      Their graphs will remain in the system but will no longer be associated with this user.
                    </p>
                  </div>
                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsDeleteUserDialogOpen(false)}
                      className="border-gray-700 text-gray-300 hover:bg-gray-800"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="button" 
                      variant="destructive"
                      onClick={confirmDeleteUser}
                      disabled={deleteUserMutation.isPending}
                    >
                      {deleteUserMutation.isPending ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Deleting...
                        </>
                      ) : "Delete User"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* Graphs Tab */}
            <TabsContent value="graphs">
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      type="search"
                      placeholder="Search graphs by name or owner..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 bg-gray-900 border-gray-700 text-white"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    {selectedGraphCount > 0 && (
                      <Badge variant="outline" className="bg-gray-800 border-gray-700 text-white px-3 py-1">
                        {selectedGraphCount} graph{selectedGraphCount !== 1 ? 's' : ''} selected
                      </Badge>
                    )}
                    {selectedGraphCount > 0 && (
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => setIsDeletingMultiple(true)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Selected
                      </Button>
                    )}
                  </div>
                </div>

                {isLoadingGraphs ? (
                  <div className="flex items-center justify-center mt-10">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
                  </div>
                ) : graphsData?.data ? (
                  <Card className="bg-gray-900 border-gray-800 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-blue-400 flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        Knowledge Graph Management
                      </CardTitle>
                      <CardDescription className="text-gray-400">
                        View and manage all knowledge graphs in the system
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader className="bg-gray-800 border-gray-700 rounded-lg">
                          <TableRow className="border-gray-700 hover:bg-gray-800">
                            <TableHead className="w-[40px] text-gray-300">
                              <Checkbox 
                                checked={selectedGraphs.length > 0 && selectedGraphs.length === filteredGraphs.length}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedGraphs(filteredGraphs.map((graph: any) => graph.id));
                                  } else {
                                    setSelectedGraphs([]);
                                  }
                                }}
                                className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                              />
                            </TableHead>
                            <TableHead className="text-gray-300">Graph Name</TableHead>
                            <TableHead className="text-gray-300">Created</TableHead>
                            <TableHead className="text-gray-300">Owner</TableHead>
                            <TableHead className="text-gray-300">Entities</TableHead>
                            <TableHead className="text-gray-300">Relations</TableHead>
                            <TableHead className="text-right text-gray-300">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredGraphs.length > 0 ? (
                            filteredGraphs.map((graph: any) => (
                              <TableRow key={graph.id} className="border-gray-800 hover:bg-gray-800">
                                <TableCell>
                                  <Checkbox 
                                    checked={selectedGraphs.includes(graph.id)}
                                    onCheckedChange={() => toggleGraphSelection(graph.id)}
                                    className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                                  />
                                </TableCell>
                                <TableCell className="font-medium text-gray-200">
                                  {graph.name || `Graph #${graph.id}`}
                                </TableCell>
                                <TableCell className="text-gray-300">{formatDate(graph.createdAt)}</TableCell>
                                <TableCell>
                                  {graph.user.username !== 'Unknown' ? (
                                    <div className="flex items-center gap-1.5">
                                      <Avatar className="h-6 w-6 bg-blue-700 text-white">
                                        <AvatarFallback>
                                          {getInitials(graph.user.username)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="text-gray-300">{graph.user.username}</span>
                                    </div>
                                  ) : (
                                    <span className="text-gray-500">No owner</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-gray-800 border-blue-600 text-white">
                                    {graph.entityCount}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-gray-800 border-cyan-600 text-white">
                                    {graph.relationCount}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="h-8 border-gray-700 hover:bg-gray-800 text-gray-300"
                                      onClick={() => openRenameGraphDialog(graph)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button 
                                      variant="destructive" 
                                      size="sm" 
                                      className="h-8"
                                      onClick={() => openDeleteGraphDialog(graph)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow className="border-gray-800">
                              <TableCell colSpan={7} className="text-center py-4 text-gray-400">
                                {searchTerm ? "No graphs matching search criteria" : "No graphs found"}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex justify-center mt-10">
                    <Card className="max-w-md bg-gray-900 border-gray-800">
                      <CardHeader>
                        <CardTitle className="text-red-400 flex items-center">
                          <AlertCircle className="mr-2 h-5 w-5" />
                          Error Loading Graphs
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-gray-300">
                        <p>Unable to load graph data. Please try again later.</p>
                      </CardContent>
                      <CardFooter>
                        <Button onClick={() => refetchGraphs()} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                          <RefreshCw className="mr-2 h-4 w-4" /> Retry
                        </Button>
                      </CardFooter>
                    </Card>
                  </div>
                )}
              </div>

              {/* Rename Graph Dialog */}
              <Dialog open={isRenameGraphDialogOpen} onOpenChange={setIsRenameGraphDialogOpen}>
                <DialogContent className="bg-gray-900 border-gray-800 text-white">
                  <DialogHeader>
                    <DialogTitle className="text-blue-400">Rename Graph</DialogTitle>
                    <DialogDescription className="text-gray-400">
                      Provide a new name for the knowledge graph.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...graphRenameForm}>
                    <form onSubmit={graphRenameForm.handleSubmit(handleGraphRenameSubmit)} className="space-y-4">
                      <FormField
                        control={graphRenameForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300">Graph Name</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                className="bg-gray-800 border-gray-700 text-white" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setIsRenameGraphDialogOpen(false)}
                          className="border-gray-700 text-gray-300 hover:bg-gray-800"
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          className="bg-blue-600 hover:bg-blue-700"
                          disabled={renameGraphMutation.isPending}
                        >
                          {renameGraphMutation.isPending ? (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                              Renaming...
                            </>
                          ) : "Save Name"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              {/* Delete Graph Dialog */}
              <Dialog open={isDeleteGraphDialogOpen} onOpenChange={setIsDeleteGraphDialogOpen}>
                <DialogContent className="bg-gray-900 border-gray-800 text-white">
                  <DialogHeader>
                    <DialogTitle className="text-red-400 flex items-center">
                      <AlertCircle className="mr-2 h-5 w-5" />
                      Delete Graph
                    </DialogTitle>
                    <DialogDescription className="text-gray-400">
                      This action cannot be undone. The graph will be permanently deleted.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <p className="text-gray-300">
                      Are you sure you want to delete the graph <span className="font-semibold text-white">{selectedGraph?.name || `Graph #${selectedGraph?.id}`}</span>?
                    </p>
                    <p className="text-gray-400 mt-2">
                      All entities, relationships, and data associated with this graph will be lost.
                    </p>
                  </div>
                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsDeleteGraphDialogOpen(false)}
                      className="border-gray-700 text-gray-300 hover:bg-gray-800"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="button" 
                      variant="destructive"
                      onClick={confirmDeleteGraph}
                      disabled={deleteGraphMutation.isPending}
                    >
                      {deleteGraphMutation.isPending ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Deleting...
                        </>
                      ) : "Delete Graph"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Delete Multiple Graphs Dialog */}
              <Dialog open={isDeletingMultiple} onOpenChange={setIsDeletingMultiple}>
                <DialogContent className="bg-gray-900 border-gray-800 text-white">
                  <DialogHeader>
                    <DialogTitle className="text-red-400 flex items-center">
                      <AlertCircle className="mr-2 h-5 w-5" />
                      Delete Multiple Graphs
                    </DialogTitle>
                    <DialogDescription className="text-gray-400">
                      This action cannot be undone. The selected graphs will be permanently deleted.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <p className="text-gray-300">
                      Are you sure you want to delete {selectedGraphCount} selected graph{selectedGraphCount !== 1 ? 's' : ''}?
                    </p>
                    <p className="text-gray-400 mt-2">
                      All entities, relationships, and data associated with these graphs will be lost.
                    </p>
                  </div>
                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsDeletingMultiple(false)}
                      className="border-gray-700 text-gray-300 hover:bg-gray-800"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="button" 
                      variant="destructive"
                      onClick={confirmDeleteMultipleGraphs}
                      disabled={deleteMultipleGraphsMutation.isPending}
                    >
                      {deleteMultipleGraphsMutation.isPending ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Deleting...
                        </>
                      ) : `Delete ${selectedGraphCount} Graph${selectedGraphCount !== 1 ? 's' : ''}`}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings">
              <div className="space-y-6">
                <Card className="bg-gray-900 border-gray-800 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-indigo-400 flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5" />
                      System Settings
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      Configure global system settings and preferences
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Signup settings */}
                    <div className="flex items-center justify-between py-3 border-b border-gray-800">
                      <div className="space-y-0.5">
                        <h3 className="text-lg font-medium text-white">User Registration</h3>
                        <p className="text-sm text-gray-400">
                          Enable or disable new user registrations on the platform
                        </p>
                      </div>
                      <SignupToggle />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </PageLayout>
  );
};

export default AdminDashboard;