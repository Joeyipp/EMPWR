import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Tabs, 
  TabsList, 
  TabsTrigger, 
  TabsContent 
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { 
  Clipboard, 
  Key, 
  Plus, 
  RefreshCw, 
  Trash2, 
  AlertCircle, 
  DollarSign,
  CreditCard,
  CheckCircle,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import PageLayout from '../components/PageLayout';

interface ApiKey {
  id: number;
  provider: string;
  key: string;
  label: string | null;
  createdAt: string;
  lastUsed: string | null;
}

interface ApiKeyBalance {
  status?: string;
  message?: string;
  totalCredits?: number | string;
  usedCredits?: number | string;
  remainingCredits?: number | string;
}

const Settings = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('openai');
  const [newKeyData, setNewKeyData] = useState({
    key: '',
    label: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedKeyToDelete, setSelectedKeyToDelete] = useState<number | null>(null);
  
  // State to track which key's balance we're checking and loading state
  const [checkingBalanceForId, setCheckingBalanceForId] = useState<number | null>(null);
  
  // State to store the balances for each API key
  const [apiKeyBalances, setApiKeyBalances] = useState<Record<number, ApiKeyBalance>>({});

  // Fetch API keys for the active provider
  const { data: apiKeysData, error, isLoading } = useQuery({
    queryKey: [`/api/api-keys/${activeTab}`],
    staleTime: 60000,
    refetchOnWindowFocus: false
  });

  // Type guard to ensure data is properly processed
  const apiKeys: ApiKey[] = apiKeysData && typeof apiKeysData === 'object' && 'data' in apiKeysData ? 
    apiKeysData.data as ApiKey[] : [];
    
  // Automatically load balances when API keys are loaded
  useEffect(() => {
    const loadBalances = async () => {
      if (apiKeys.length > 0) {
        console.log('Auto-loading balances for API keys:', apiKeys);
        // Load balances for all keys of the current provider
        for (const apiKey of apiKeys) {
          await checkApiKeyBalance(apiKey.id, apiKey.provider);
        }
      }
    };
    
    loadBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKeys]);

  // Add API key mutation
  const addKeyMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(
        'POST',
        '/api/api-keys',
        {
          provider: activeTab,
          key: newKeyData.key,
          label: newKeyData.label || null
        }
      );
    },
    onSuccess: () => {
      // Clear form and refresh data
      setNewKeyData({ key: '', label: '' });
      queryClient.invalidateQueries({ queryKey: [`/api/api-keys/${activeTab}`] });
      
      toast({
        title: "Success",
        description: "API key added successfully",
      });
    },
    onError: (error) => {
      console.error('Error adding API key:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add API key",
        variant: "destructive",
      });
    }
  });

  // Delete API key mutation
  const deleteKeyMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(
        'DELETE',
        `/api/api-keys/${id}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/api-keys/${activeTab}`] });
      
      toast({
        title: "Success",
        description: "API key deleted successfully",
      });
      
      setIsDeleteConfirmOpen(false);
      setSelectedKeyToDelete(null);
    },
    onError: (error) => {
      console.error('Error deleting API key:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete API key",
        variant: "destructive",
      });
      
      setIsDeleteConfirmOpen(false);
      setSelectedKeyToDelete(null);
    }
  });

  const handleAddKey = async () => {
    if (!newKeyData.key.trim()) {
      toast({
        title: "Error",
        description: "API key is required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    await addKeyMutation.mutateAsync();
    setIsSubmitting(false);
  };

  const handleDeleteKey = async (id: number) => {
    setSelectedKeyToDelete(id);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteKey = async () => {
    if (selectedKeyToDelete === null) return;
    await deleteKeyMutation.mutateAsync(selectedKeyToDelete);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Check API key balance
  const checkApiKeyBalance = async (keyId: number, provider: string) => {
    setCheckingBalanceForId(keyId);
    try {
      const response = await apiRequest('GET', `/api/api-keys/${provider}/${keyId}/balance`);
      
      type BalanceResponse = {
        success: boolean;
        data: {
          provider: string;
          keyId: number;
          balance: ApiKeyBalance;
        }
      };
      
      // Type assertion for the response - first cast to unknown then to BalanceResponse
      const typedResponse = response as unknown as BalanceResponse;
      
      console.log('API balance response:', typedResponse);
      
      if (typedResponse.success && typedResponse.data) {
        const balanceData = typedResponse.data;
        
        console.log('Balance data to save:', balanceData.balance);
        
        setApiKeyBalances(prev => {
          const newBalances = {
            ...prev,
            [keyId]: balanceData.balance
          };
          console.log('Updated balances state:', newBalances);
          return newBalances;
        });
        
        toast({
          title: "Balance Check",
          description: balanceData.balance.status === "Active" 
            ? "API key validated successfully" 
            : "Retrieved balance information",
        });
      }
    } catch (error) {
      console.error('Error checking API key balance:', error);
      toast({
        title: "Error",
        description: "Failed to check API key balance",
        variant: "destructive",
      });
    } finally {
      setCheckingBalanceForId(null);
    }
  };
  
  // Format currency for display
  const formatCurrency = (value: number | string | undefined) => {
    if (value === undefined) return 'N/A';
    try {
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(numValue);
    } catch (e) {
      return value.toString();
    }
  };

  return (
    <PageLayout title="API Key Management">
      <div className="min-h-screen flex flex-col bg-gray-950">
        <div className="flex-grow container mx-auto px-4 py-6 text-gray-200">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="mb-4">
              <TabsTrigger value="openai">OpenAI</TabsTrigger>
              <TabsTrigger value="mistral">Mistral</TabsTrigger>
              <TabsTrigger value="anthropic">Anthropic</TabsTrigger>
              <TabsTrigger value="cohere">Cohere</TabsTrigger>
            </TabsList>

            {['openai', 'mistral', 'anthropic', 'cohere'].map((provider) => (
              <TabsContent key={provider} value={provider} className="space-y-4">
                <Card className="bg-gray-900 border-gray-800 shadow-lg">
                  <CardHeader>
                    <CardTitle>Add {provider === 'openai' ? 'OpenAI' : provider.charAt(0).toUpperCase() + provider.slice(1)} API Key</CardTitle>
                    <CardDescription>
                      {provider === 'openai' && 'Add your OpenAI API key to use GPT models for knowledge graph generation and analysis.'}
                      {provider === 'mistral' && 'Add your Mistral AI API key to use Mistral Large models for knowledge graph generation.'}
                      {provider === 'anthropic' && 'Add your Anthropic API key to use Claude models.'}
                      {provider === 'cohere' && 'Add your Cohere API key to use Cohere models.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="api-key">API Key</Label>
                          <div className="relative">
                            <Input
                              id="api-key"
                              type="password"
                              placeholder={`Enter your ${provider === 'openai' ? 'OpenAI' : provider} API key`}
                              value={newKeyData.key}
                              onChange={(e) => setNewKeyData({ ...newKeyData, key: e.target.value })}
                              className="bg-gray-800 border-gray-700"
                            />
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                              <Key className="h-4 w-4 text-gray-400" />
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="label">Label (Optional)</Label>
                          <Input
                            id="label"
                            placeholder="E.g., Production, Development"
                            value={newKeyData.label}
                            onChange={(e) => setNewKeyData({ ...newKeyData, label: e.target.value })}
                            className="bg-gray-800 border-gray-700"
                          />
                        </div>
                      </div>
                      <Button 
                        onClick={handleAddKey} 
                        disabled={isSubmitting || !newKeyData.key.trim()}
                        className="w-full sm:w-auto"
                      >
                        {isSubmitting ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          <>
                            <Plus className="mr-2 h-4 w-4" />
                            Add API Key
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-900 border-gray-800 shadow-lg">
                  <CardHeader>
                    <CardTitle>Saved {provider === 'openai' ? 'OpenAI' : provider.charAt(0).toUpperCase() + provider.slice(1)} API Keys</CardTitle>
                    <CardDescription>
                      View and manage your saved API keys
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="py-8 text-center">
                        <RefreshCw className="mx-auto h-8 w-8 animate-spin text-primary" />
                        <p className="mt-2 text-sm text-gray-500">Loading API keys...</p>
                      </div>
                    ) : error ? (
                      <Alert variant="destructive" className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>
                          Failed to load API keys. Please try again.
                        </AlertDescription>
                      </Alert>
                    ) : apiKeys.length === 0 ? (
                      <div className="py-8 text-center">
                        <p className="text-sm text-gray-500">
                          No API keys found. Add your first {provider === 'openai' ? 'OpenAI' : provider} API key above.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {apiKeys.map((apiKey) => (
                          <div
                            key={apiKey.id}
                            className="flex flex-col space-y-4 rounded-lg border border-gray-700 bg-gray-800 p-4"
                          >
                            {/* Key info and actions row */}
                            <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                              <div className="space-y-1">
                                <div className="flex items-center">
                                  <p className="font-medium">
                                    {apiKey.label || "Unnamed Key"}
                                  </p>
                                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                    {apiKey.provider === 'openai' ? 'OpenAI' : 
                                     apiKey.provider === 'mistral' ? 'Mistral AI' : 
                                     apiKey.provider.toUpperCase()}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <p className="text-sm text-gray-400">{apiKey.key}</p>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => {
                                      toast({
                                        title: "Info",
                                        description: "Only the full API key can be copied when added.",
                                      });
                                    }}
                                  >
                                    <Clipboard className="h-3 w-3" />
                                    <span className="sr-only">Copy API key</span>
                                  </Button>
                                </div>
                                <p className="text-xs text-gray-400">
                                  Added on {formatDate(apiKey.createdAt)}
                                </p>
                                {apiKey.lastUsed && (
                                  <p className="text-xs text-gray-400">
                                    Last used on {formatDate(apiKey.lastUsed)}
                                  </p>
                                )}
                              </div>
                              <div className="flex space-x-2">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteKey(apiKey.id)}
                                  className="sm:self-center"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                            
                            {/* API key balance section */}
                            {console.log('Balance for key', apiKey.id, ':', apiKeyBalances[apiKey.id])}
                            {apiKeyBalances[apiKey.id] && (
                              <div className="mt-2 rounded-md bg-gray-700/30 p-3">
                                <div className="mb-2 flex items-center">
                                  <CreditCard className="mr-2 h-4 w-4 text-primary" />
                                  <h4 className="text-sm font-medium">API Key Balance</h4>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="ml-auto h-6 w-6"
                                    onClick={() => checkApiKeyBalance(apiKey.id, apiKey.provider)}
                                    disabled={checkingBalanceForId === apiKey.id}
                                  >
                                    <RefreshCw className={`h-3 w-3 ${checkingBalanceForId === apiKey.id ? 'animate-spin' : ''}`} />
                                    <span className="sr-only">Refresh balance</span>
                                  </Button>
                                </div>
                                
                                <div className="space-y-1 text-sm">
                                  {/* Status indicator */}
                                  <div className="flex items-center">
                                    {apiKeyBalances[apiKey.id].status === "Active" ? (
                                      <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                                    ) : apiKeyBalances[apiKey.id].status === "Error" ? (
                                      <XCircle className="mr-2 h-4 w-4 text-red-500" />
                                    ) : (
                                      <HelpCircle className="mr-2 h-4 w-4 text-yellow-500" />
                                    )}
                                    <span className={`font-medium ${
                                      apiKeyBalances[apiKey.id].status === "Active" ? "text-green-500" : 
                                      apiKeyBalances[apiKey.id].status === "Error" ? "text-red-500" : "text-yellow-500"
                                    }`}>
                                      {apiKeyBalances[apiKey.id].status || "Unknown"}
                                    </span>
                                  </div>
                                  
                                  {/* Message */}
                                  {apiKeyBalances[apiKey.id].message && (
                                    <p className="text-xs text-gray-400">
                                      {apiKeyBalances[apiKey.id].message}
                                    </p>
                                  )}
                                  
                                  {/* Credits/Usage information (if available) */}
                                  {(apiKeyBalances[apiKey.id].totalCredits !== undefined || 
                                    apiKeyBalances[apiKey.id].usedCredits !== undefined || 
                                    apiKeyBalances[apiKey.id].remainingCredits !== undefined) && (
                                    <div className="mt-2 grid grid-cols-3 gap-2 rounded bg-gray-800 p-2 text-center">
                                      <div>
                                        <p className="text-xs text-gray-400">Total</p>
                                        <p className="font-medium">
                                          {formatCurrency(apiKeyBalances[apiKey.id].totalCredits)}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-400">Used</p>
                                        <p className="font-medium">
                                          {formatCurrency(apiKeyBalances[apiKey.id].usedCredits)}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-400">Remaining</p>
                                        <p className="font-medium">
                                          {formatCurrency(apiKeyBalances[apiKey.id].remainingCredits)}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this API key? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={confirmDeleteKey}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

export default Settings;