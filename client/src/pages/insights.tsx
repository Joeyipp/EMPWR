import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  NetworkIcon, 
  HelpCircleIcon, 
  Loader2, 
  BrainCircuitIcon, 
  FileTextIcon, 
  LightbulbIcon, 
  GitBranchIcon, 
  LinkIcon, 
  SearchIcon, 
  BookOpenIcon, 
  AlertCircleIcon,
  SearchXIcon,
  SendIcon,
  MessagesSquareIcon,
  BotIcon,
  UserIcon,
  RefreshCwIcon,
  Settings
} from 'lucide-react';
import { useAppState } from '@/contexts/AppStateContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import HelpModal from '@/components/HelpModal';
import GraphSelector from '@/components/ui/GraphSelector';
import KnowledgeGraphExplorer, { GraphRef } from '@/components/KnowledgeGraphExplorer';
import PageLayout from '@/components/PageLayout';
import AnimatedGradientBackground from '@/components/AnimatedGradientBackground';
import GraphMetricsPanel from '@/components/GraphMetricsPanel';

// Types for graph metrics
interface GraphMetrics {
  entityCount: number;
  relationCount: number;
  mostConnectedEntities: Array<{
    id: number;
    name: string;
    connectionCount: number;
  }>;
  connectedComponentsCount: number;
  averageConnections: number;
  isolatedEntities: Array<{
    id: number;
    name: string;
  }>;
  centrality: Array<{
    id: number;
    name: string;
    score: number;
  }>;
  relationshipTypes: Array<{
    type: string;
    count: number;
  }>;
  entityTypes: Array<{
    type: string;
    count: number;
  }>;
  density: number;
}

// Types for AI insights
interface AIInsights {
  summary: string;
  keyInsights: string[];
  patterns: Array<{
    description: string;
    confidence: number;
  }>;
  hypotheses: Array<{
    statement: string;
    reasoning: string;
  }>;
  potentialRelationships: Array<{
    source: string;
    relationship: string;
    target: string;
    confidence: number;
    explanation: string;
  }>;
  knowledgeGaps: string[];
  narrative: string;
}

// Types for Assistant
interface Assistant {
  assistantId: string;
  threadId: string;
}

// Message type for the chat
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Main Insights component
export default function Insights() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { appState, updateInsightsPage } = useAppState();
  
  // State variables - initialize from app state
  const [selectedGraphId, setSelectedGraphId] = useState<number | null>(
    appState.insightsPage?.selectedGraphId || null
  );
  // No longer storing API keys in client-side state
  // API keys are now managed securely on the server
  // Removed tabs - keeping single view for graph visualization
  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([
    { id: 'welcome', role: 'system', content: 'Welcome to the Knowledge Graph Assistant. Select a graph and start asking questions!' }
  ]);
  const [userMessage, setUserMessage] = useState('');
  const [loading, setLoading] = useState<boolean>(false);
  const [assistantLoading, setAssistantLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>(appState.insightsPage?.searchTerm || '');
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
  
  // Graph visualization reference
  const graphRef = useRef<GraphRef>(null);

  // Toggle help modal
  const toggleHelpModal = () => {
    setIsHelpModalOpen(!isHelpModalOpen);
  };
  
  // Queries for data fetching
  const { 
    data: graphsData, 
    isLoading: isLoadingGraphs,
    refetch: refetchGraphs 
  } = useQuery<{ data: any[] }>({
    queryKey: ['/api/graphs'],
    retry: 1
  });
  
  // Function to handle the refresh button click
  const handleRefreshGraphs = useCallback(() => {
    // Show a loading toast
    toast({
      title: "Refreshing data",
      description: "Loading the latest data from the database...",
    });
    
    // Create a promise array for all the refreshes we want to perform
    const refreshPromises: Promise<any>[] = [];
    
    // Add the graphs refresh promise
    refreshPromises.push(refetchGraphs());
    
    // Always refresh the specific graph data if a graph ID is selected
    if (selectedGraphId !== null) {
      // Refetch the selected graph data
      refreshPromises.push(
        queryClient.refetchQueries({ 
          queryKey: ['/api/graphs', selectedGraphId] 
        })
      );
      
      // Refetch the graph metrics
      refreshPromises.push(
        queryClient.refetchQueries({ 
          queryKey: ['/api/graphs/analyze', selectedGraphId] 
        })
      );
      
      // Refetch the graph insights
      refreshPromises.push(
        queryClient.refetchQueries({ 
          queryKey: ['/api/graphs/insights', selectedGraphId] 
        })
      );
    }
    
    // Wait for all promises to resolve
    Promise.all(refreshPromises)
      .then(() => {
        toast({
          title: "Data refreshed",
          description: selectedGraphId 
            ? "Successfully refreshed all graph data and analyses." 
            : "Successfully loaded the latest graphs from the database.",
          variant: "default"
        });
      })
      .catch((error) => {
        console.error("Error refreshing data:", error);
        toast({
          title: "Refresh failed",
          description: "Failed to refresh data. Please try again.",
          variant: "destructive"
        });
      });
  }, [refetchGraphs, selectedGraphId, queryClient, toast]);
  
  // Extract graphs from the wrapper response
  const graphs = graphsData?.data || [];
  
  // Filter graphs based on search term
  const filteredGraphs = searchTerm.trim() 
    ? graphs.filter(graph => 
        graph.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : graphs;
    
  // Removed auto-selection of the latest graph as per user request
  // Users will now need to explicitly select a graph from the dropdown
  
  const { data: selectedGraphData, isLoading: isLoadingGraph } = useQuery<{ data: any }>({
    queryKey: ['/api/graphs', selectedGraphId],
    enabled: !!selectedGraphId,
    retry: 1,
    queryFn: async () => {
      try {
        const response = await fetch(`/api/graphs/${selectedGraphId}`);
        return await response.json();
      } catch (error) {
        console.error('Error fetching graph data:', error);
        throw error;
      }
    }
  });
  
  // Extract selected graph from the wrapper response
  const selectedGraph = selectedGraphData?.data;
  
  // Debug logging for selected graph data
  useEffect(() => {
    if (selectedGraphId) {
      console.log('Selected Graph ID:', selectedGraphId);
      console.log('Selected Graph Data:', selectedGraphData);
      console.log('Extracted Graph:', selectedGraph);
    }
  }, [selectedGraphId, selectedGraphData, selectedGraph]);
  
  const { data: graphMetricsResponse, isLoading: isLoadingMetrics } = useQuery<{ data: any }>({
    queryKey: ['/api/graphs/analyze', selectedGraphId],
    enabled: !!selectedGraphId,
    queryFn: async () => {
      try {
        const response = await fetch(`/api/graphs/analyze/${selectedGraphId}`);
        return await response.json();
      } catch (error) {
        console.error('Error fetching graph metrics:', error);
        throw error;
      }
    }
  });
  
  // Extract metrics from the wrapper response
  const graphMetrics = graphMetricsResponse?.data;
  
  // State for selected AI model - initialize from app state
  const [selectedModel, setSelectedModel] = useState<string>(
    appState.insightsPage?.selectedModel || 'openai'
  );
  
  // Update app state when page state changes
  useEffect(() => {
    // Check if values have actually changed before updating to prevent infinite loop
    if (
      appState.insightsPage.selectedGraphId !== selectedGraphId ||
      appState.insightsPage.selectedModel !== selectedModel ||
      appState.insightsPage.searchTerm !== searchTerm
    ) {
      updateInsightsPage({
        selectedGraphId,
        selectedModel,
        searchTerm
      });
    }
  }, [selectedGraphId, selectedModel, searchTerm, updateInsightsPage, appState.insightsPage]);
  // API keys are now managed exclusively on the server side, improving security
  const { data: aiInsightsResponse } = useQuery<{ data: any }>({
    queryKey: ['/api/graphs/insights', selectedGraphId],
    enabled: !!selectedGraphId,
    queryFn: async () => {
      try {
        if (!selectedGraphId) throw new Error("No graph selected");
        const response = await fetch(`/api/graphs/insights/${selectedGraphId}`);
        return await response.json();
      } catch (error) {
        console.error('Error fetching insights:', error);
        return { success: true, data: null };
      }
    }
  });
  
  // Extract AI insights from the wrapper response
  const aiInsights = aiInsightsResponse?.data;
  
  // Mutations for AI operations
  const generateInsightsMutation = useMutation({
    mutationFn: async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/graphs/generate-insights/${selectedGraphId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            model: selectedModel
          })
        });
        return await response.json();
      } catch (error: any) {
        throw error;
      } finally {
        setLoading(false);
      }
    },
    onSuccess: (response) => {
      // Store only the data part of the response
      queryClient.setQueryData(['/api/graphs/insights', selectedGraphId], response.data ? response : { data: response });
      // No longer using tabs
    },
    onError: (error: any) => {
      console.error('Error generating insights:', error);
      
      // Check for specific error types
      let errorMessage = error.response?.data?.message || 'Failed to generate insights';
      
      // If the error indicates missing API key
      if (errorMessage.includes('No active API key found') || 
          errorMessage.includes('API key is required')) {
        errorMessage = 'You need to set up an API key in Settings before generating insights. Please go to Settings and add your OpenAI or Mistral API key.';
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  });
  
  const createAssistantMutation = useMutation({
    mutationFn: async () => {
      setAssistantLoading(true);
      try {
        // Create assistant using server-side API key (authenticated user's key)
        const provider = selectedModel === 'openai' ? 'openai' : 'mistral';
        const response = await fetch(`/api/graphs/create-assistant/${selectedGraphId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            provider: provider,
            model: selectedModel 
          })
        });
        return await response.json();
      } catch (error: any) {
        throw error;
      } finally {
        setAssistantLoading(false);
      }
    },
    onSuccess: (response) => {
      // Extract the assistant data from the response
      const assistantData = response.data ? response.data : response;
      setAssistant(assistantData);
      setChatMessages([
        ...chatMessages,
        { 
          id: 'welcome-assistant', 
          role: 'system', 
          content: `Assistant initialized for graph "${selectedGraph?.name}". You can now ask questions about this knowledge graph.` 
        }
      ]);
      // No longer using tabs
    },
    onError: (error: any) => {
      console.error('Error creating assistant:', error);
      
      // Check for specific error types
      let errorMessage = error.response?.data?.message || 'Failed to create assistant';
      
      // If the error indicates missing API key
      if (errorMessage.includes('No active API key found') || 
          errorMessage.includes('API key is required')) {
        errorMessage = 'You need to set up an API key in Settings before using the Knowledge Assistant. Please go to Settings and add your OpenAI or Mistral API key.';
        
        // Also update the chat messages to make it clear to the user
        setChatMessages(prevMessages => [
          ...prevMessages,
          { 
            id: `error-${Date.now()}`, 
            role: 'system', 
            content: errorMessage
          }
        ]);
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  });
  
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!assistant) throw new Error('No active assistant');
      
      // Add user message to chat
      const userMessageId = `user-${Date.now()}`;
      setChatMessages(prev => [
        ...prev, 
        { id: userMessageId, role: 'user', content: message }
      ]);
      
      try {
        // Send the message to the server - the server will use the authenticated user's API key
        const response = await fetch('/api/graphs/assistant-message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message,
            assistantId: assistant.assistantId,
            threadId: assistant.threadId,
            model: selectedModel
          })
        });
        const data = await response.json();
        console.log('Assistant response:', data);
        
        // Check if the response was successful
        if (!data.success) {
          throw new Error(data.message || 'Failed to get assistant response');
        }
        
        return { data: data.data, userMessageId };
      } catch (error) {
        // If message fails, add an error message instead of modifying the user's message
        let errorContent = '';
        if (error instanceof Error && error.message.includes('Message, assistantId, and threadId are required')) {
          errorContent = 'You need to set up an API key in the Settings page before using the Knowledge Assistant. Please go to Settings and add your OpenAI or Mistral API key.';
        } else if (error instanceof Error) {
          errorContent = `Error: ${error.message}`;
        } else {
          errorContent = 'Failed to send message. Please try again later.';
        }
        
        setChatMessages(prev => [
          ...prev,
          { 
            id: `error-${Date.now()}`, 
            role: 'assistant', 
            content: errorContent
          }
        ]);
        throw error;
      }
    },
    onSuccess: (result: { data: { content: string, messageId: string }, userMessageId: string }) => {
      console.log('OnSuccess received:', result);
      
      // Check if the response has the expected structure
      if (!result.data || !result.data.content || !result.data.messageId) {
        console.error('Invalid response structure:', result);
        // Add an error message
        setChatMessages(prev => [...prev, 
          { id: `error-${Date.now()}`, role: 'assistant', content: 'Sorry, I received an invalid response. Please try again.' }
        ]);
        return;
      }
      
      // Add the actual response
      setChatMessages(prev => [...prev,
        { id: result.data.messageId, role: 'assistant', content: result.data.content }
      ]);
      setUserMessage('');
    },
    onError: (error: any) => {
      console.error('Error sending message to assistant:', error);
      
      // Check for specific error types
      let errorMessage = error.response?.data?.message || 'Failed to send message';
      
      // If the error indicates missing API key
      if (errorMessage.includes('No active API key found') || 
          errorMessage.includes('API key is required')) {
        errorMessage = 'You need to set up an API key in Settings before using the Knowledge Assistant. Please go to Settings and add your OpenAI or Mistral API key.';
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  });
  
  // Format date string
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch (e) {
      return dateString;
    }
  };

  // Get entity type name based on group
  const getEntityTypeName = (group: number): string => {
    switch (group) {
      case 1:
        return "Person";
      case 2:
        return "Place";
      case 3:
        return "Concept";
      case 4:
        return "Organization";
      case 5:
        return "Date";
      default:
        return "Other";
    }
  };

  // Helper function to normalize the data source
  const normalizeDataSource = (
    dataSource?: string,
    enriched?: boolean,
  ): string => {
    // If this is from Wikidata enrichment, always show as "wikidata"
    if (enriched) {
      return "wikidata";
    }
    // Otherwise return the original source or unknown
    return dataSource || "unknown";
  };

  // Get relationship types with counts, sources and timestamps
  const getRelationshipTypes = (): {
    label: string;
    count: number;
    dataSources?: Record<string, number>;
    firstTimestamp?: string;
  }[] => {
    if (!selectedGraph?.links) return [];

    const relationCounts: Record<
      string,
      {
        label: string;
        count: number;
        dataSources: Record<string, number>;
        firstTimestamp?: string;
      }
    > = {};

    selectedGraph.links.forEach((link: any) => {
      if (!relationCounts[link.label]) {
        relationCounts[link.label] = {
          label: link.label,
          count: 0,
          dataSources: {},
          firstTimestamp: link.timestamp,
        };
      }

      // Increment the count
      relationCounts[link.label].count++;

      // Track data sources
      const source = normalizeDataSource(link.dataSource, link.enriched);
      if (!relationCounts[link.label].dataSources[source]) {
        relationCounts[link.label].dataSources[source] = 0;
      }
      relationCounts[link.label].dataSources[source]++;

      // Track earliest timestamp
      if (link.timestamp && relationCounts[link.label]) {
        const count = relationCounts[link.label];
        if (!count.firstTimestamp || link.timestamp < count.firstTimestamp) {
          relationCounts[link.label].firstTimestamp = link.timestamp;
        }
      }
    });

    return Object.values(relationCounts).sort((a, b) => b.count - a.count);
  };

  // Get triples from graph
  const getTriples = (): {
    subject: string;
    predicate: string;
    object: string;
    dataSource: string;
    timestamp?: string;
    wikidataId?: string;
  }[] => {
    if (!selectedGraph?.links || !selectedGraph?.nodes) return [];

    const nodeMap = new Map<number, string>();

    selectedGraph.nodes.forEach((node: any) => {
      nodeMap.set(node.id, node.name);
    });

    return selectedGraph.links.map((link: any) => {
      return {
        subject: nodeMap.get(link.source) || `Entity ${link.source}`,
        predicate: link.label,
        object: nodeMap.get(link.target) || `Entity ${link.target}`,
        dataSource: normalizeDataSource(link.dataSource, link.enriched),
        timestamp: link.timestamp,
        wikidataId: link.wikidataId,
      };
    });
  };

  // Infer schema from the knowledge graph
  const inferSchema = () => {
    if (!selectedGraph?.nodes || !selectedGraph?.links) return [];

    // Map to store node types (classes)
    const nodeTypes = new Map<number, string>();

    // First, map all nodes to their types
    selectedGraph.nodes.forEach((node: any) => {
      nodeTypes.set(node.id, getEntityTypeName(node.group));
    });

    // Create a map to store schema information
    const schemaMap = new Map<
      string,
      {
        className: string;
        properties: Map<string, { type: string; count: number }>;
        instances: number;
      }
    >();

    // Initialize schema classes based on node types
    Array.from(new Set(nodeTypes.values())).forEach((typeName) => {
      schemaMap.set(typeName, {
        className: typeName,
        properties: new Map(),
        instances: 0,
      });
    });

    // Count instances of each class
    nodeTypes.forEach((typeName) => {
      const classInfo = schemaMap.get(typeName);
      if (classInfo) {
        classInfo.instances++;
      }
    });

    // Define relations between classes
    selectedGraph.links.forEach((link: any) => {
      const sourceType = nodeTypes.get(link.source) || "Entity";
      const targetType = nodeTypes.get(link.target) || "Entity";
      const propertyName = link.label;

      // Add property to source class
      const classInfo = schemaMap.get(sourceType);

      if (classInfo) {
        if (!classInfo.properties.has(propertyName)) {
          classInfo.properties.set(propertyName, {
            type: targetType,
            count: 0,
          });
        }

        const property = classInfo.properties.get(propertyName);
        if (property) {
          property.count++;
        }
      }
    });

    // Convert the map to an array of objects
    return Array.from(schemaMap.entries()).map(([className, info]) => ({
      className,
      instances: info.instances,
      properties: Object.fromEntries(info.properties.entries()),
    }));
  };

  // Handle graph selection
  const handleSelectGraph = (graphId: number) => {
    setSelectedGraphId(graphId);
    // No longer using tabs
    setAssistant(null);
    setChatMessages([
      { id: 'welcome', role: 'system', content: 'Welcome to the Knowledge Graph Assistant.\nSelect a graph and start asking questions!' }
    ]);
  };
  
  // Handle generating AI insights
  const handleGenerateInsights = () => {
    // Generate insights using the server's authenticated user API key
    generateInsightsMutation.mutate();
  };
  
  // Render loading state
  if (isLoadingGraphs) {
    return (
      <PageLayout title="Knowledge Graph Insights">
        <div className="flex-grow container mx-auto px-4 py-6 text-gray-200">
          <div className="flex flex-col items-center justify-center pt-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p>Loading graphs...</p>
          </div>
        </div>
      </PageLayout>
    );
  }



  // Graph selector component for header
  const graphSelectorHeader = (
    <div className="flex items-center gap-2">
      {/* Graph selector dropdown in header */}
      <div className="w-64">
        <GraphSelector 
          graphs={graphs} 
          selectedGraphId={selectedGraphId} 
          onSelectGraph={handleSelectGraph} 
        />
      </div>
      
      {/* Refresh button */}
      <Button 
        variant="outline" 
        size="icon"
        onClick={handleRefreshGraphs}
        title="Refresh graphs from database"
      >
        <RefreshCwIcon className="h-4 w-4" />
      </Button>
    </div>
  );
  
  // Error icon with pulse animation
  const ErrorIconWithPulse = ({ color = "red" }: { color?: "blue" | "yellow" | "green" | "purple" | "orange" | "rose" | "red" }) => {
    const colorMap: Record<string, string> = {
      red: "text-red-400",
      blue: "text-blue-400",
      yellow: "text-yellow-400",
      green: "text-green-400",
      purple: "text-purple-400",
      orange: "text-orange-400",
      rose: "text-rose-400"
    };
    
    const bgColorMap: Record<string, string> = {
      red: "bg-red-500",
      blue: "bg-blue-500",
      yellow: "bg-yellow-500",
      green: "bg-green-500",
      purple: "bg-purple-500",
      orange: "bg-orange-500",
      rose: "bg-rose-500"
    };
    
    return (
      <div className="relative inline-block">
        <AlertCircleIcon className={`h-5 w-5 ${colorMap[color]}`} />
        <span className={`absolute -top-1 -right-1 h-2 w-2 rounded-full ${bgColorMap[color]} animate-ping opacity-75`}></span>
        <span className={`absolute -top-1 -right-1 h-2 w-2 rounded-full ${bgColorMap[color]}`}></span>
      </div>
    );
  };

  // AI Insight Card component
  const InsightCard = ({ 
    title, 
    icon, 
    children, 
    errorState = false,
    errorMessage = "No data available",
    cardColor = "blue"
  }: { 
    title: string, 
    icon: React.ReactNode, 
    children: React.ReactNode,
    errorState?: boolean,
    errorMessage?: string,
    cardColor?: "blue" | "yellow" | "green" | "purple" | "orange" | "rose"
  }) => {
    // Define color theme based on cardColor
    const colorMap = {
      blue: {
        icon: "text-blue-400",
        headerBg: "bg-blue-500/10",
        border: "border-blue-500/20",
        hover: "hover:border-blue-500/40",
        gradient: "from-blue-600/20 to-blue-800/10",
        glow: "from-blue-500/50 to-blue-600/50"
      },
      yellow: {
        icon: "text-yellow-400",
        headerBg: "bg-yellow-500/10",
        border: "border-yellow-500/20",
        hover: "hover:border-yellow-500/40",
        gradient: "from-yellow-600/20 to-yellow-800/10",
        glow: "from-yellow-500/50 to-amber-600/50"
      },
      green: {
        icon: "text-green-400",
        headerBg: "bg-green-500/10",
        border: "border-green-500/20", 
        hover: "hover:border-green-500/40",
        gradient: "from-green-600/20 to-green-800/10",
        glow: "from-green-500/50 to-emerald-600/50"
      },
      purple: {
        icon: "text-purple-400",
        headerBg: "bg-purple-500/10",
        border: "border-purple-500/20",
        hover: "hover:border-purple-500/40",
        gradient: "from-purple-600/20 to-purple-800/10",
        glow: "from-purple-500/50 to-violet-600/50"
      },
      orange: {
        icon: "text-orange-400",
        headerBg: "bg-orange-500/10",
        border: "border-orange-500/20",
        hover: "hover:border-orange-500/40",
        gradient: "from-orange-600/20 to-orange-800/10",
        glow: "from-orange-500/50 to-amber-600/50"
      },
      rose: {
        icon: "text-rose-400",
        headerBg: "bg-rose-500/10",
        border: "border-rose-500/20",
        hover: "hover:border-rose-500/40",
        gradient: "from-rose-600/20 to-rose-800/10",
        glow: "from-rose-500/50 to-pink-600/50"
      }
    };
    
    const colors = colorMap[cardColor];
    
    return (
      <Card className={`bg-gradient-to-br from-gray-800 to-gray-900 border ${colors.border} ${colors.hover} shadow-lg transition-colors overflow-hidden mb-4`}>
        <CardHeader className={`pb-2 border-b border-gray-800 bg-gradient-to-r ${colors.gradient}`}>
          <CardTitle className="text-md font-medium flex items-center justify-center text-gray-100">
            <div className="relative">
              <div className={`absolute -inset-0.5 bg-gradient-to-r ${colors.glow} rounded-full blur-sm opacity-70`}></div>
              <div className="relative bg-gray-900 p-1.5 rounded-full">
                <div className={`${colors.icon}`}>
                  {icon}
                </div>
              </div>
            </div>
            <span className="ml-2">{title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 backdrop-blur-sm">
          {errorState ? (
            <div className={`rounded-md p-3 flex items-center justify-center text-sm text-gray-300 bg-gradient-to-br ${colors.gradient} border ${colors.border} shadow-inner`}>
              <ErrorIconWithPulse color={cardColor} />
              <span className="ml-2">{errorMessage}</span>
            </div>
          ) : (
            children
          )}
        </CardContent>
      </Card>
    );
  };
  
  // Check if insights have an error
  const hasInsightsError = (aiInsights: any) => {
    return aiInsights && (
      aiInsights.summary?.toLowerCase().includes('fail') ||
      aiInsights.summary?.toLowerCase().includes('error') ||
      (aiInsights.keyInsights && aiInsights.keyInsights[0]?.toLowerCase().includes('error'))
    );
  };
  
  // Render AI insights panel
  const renderAIInsightsPanel = () => {
    if (!aiInsights) {
      return (
        <div className="p-8 text-center">
          <div className="rounded-lg bg-yellow-900/30 p-4 border border-yellow-800/50 text-center backdrop-blur-sm mb-6 max-w-md mx-auto">
            <div className="flex flex-col items-center">
              <div className="relative mb-2">
                <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500/50 to-amber-600/50 rounded-full blur-sm opacity-70"></div>
                <div className="relative bg-gray-900 p-2 rounded-full">
                  <AlertCircleIcon className="h-5 w-5 text-yellow-400" />
                </div>
              </div>
              <p className="text-sm text-yellow-200 font-medium mb-1">Generate AI-powered insights</p>
              <p className="text-xs text-yellow-100/70">Uses {selectedModel === 'openai' ? 'OpenAI' : 'Mistral AI'} to analyze patterns and relationships in your graph</p>
            </div>
          </div>
          <Button 
            onClick={handleGenerateInsights} 
            disabled={loading}
            className="mx-auto bg-primary/80 hover:bg-primary transition-colors shadow-md"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Insights...
              </>
            ) : (
              <>Generate Insights</>
            )}
          </Button>
        </div>
      );
    }

    const isError = hasInsightsError(aiInsights);
    
    // API key error UI
    if (isError) {
      return (
        <div className="p-6">
          <div className="bg-gradient-to-br from-red-900/30 to-red-800/10 border border-red-800/50 rounded-lg p-5 mb-6 shadow-md backdrop-blur-sm">
            <div className="flex flex-col items-center text-center mb-4">
              <div className="relative mb-3">
                <div className="absolute -inset-1 bg-gradient-to-r from-red-500/50 to-rose-600/50 rounded-full blur-sm opacity-70"></div>
                <div className="relative bg-gray-900 p-2 rounded-full">
                  <AlertCircleIcon className="h-6 w-6 text-red-400" />
                </div>
              </div>
              <h3 className="text-red-300 font-medium text-lg">Error Generating Insights</h3>
              <p className="text-sm text-gray-300 mt-2 max-w-md">
                There was an issue processing your request with the {selectedModel === 'openai' ? 'OpenAI' : 'Mistral AI'} model. Please try again later or contact your administrator if the problem persists.
              </p>
              <div className="mt-5 flex space-x-4">
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={handleGenerateInsights}
                  disabled={loading}
                  className="shadow-md"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Try Again
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    window.location.href = '/settings';
                  }}
                  className="border-red-800/50 hover:border-red-700 shadow-md"
                >
                  Go to Settings
                </Button>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InsightCard 
              title="Summary" 
              icon={<FileTextIcon className="h-4 w-4" />}
              cardColor="blue"
              errorState={true}
              errorMessage="Failed to generate summary"
            >
              <></>
            </InsightCard>
            
            <InsightCard 
              title="Key Insights" 
              icon={<LightbulbIcon className="h-4 w-4" />}
              cardColor="yellow"
              errorState={true}
              errorMessage="Error processing graph data"
            >
              <></>
            </InsightCard>
            
            <InsightCard 
              title="Identified Patterns" 
              icon={<GitBranchIcon className="h-4 w-4" />}
              cardColor="green"
              errorState={true}
              errorMessage="No patterns could be identified"
            >
              <></>
            </InsightCard>
            
            <InsightCard 
              title="Suggested Relationships" 
              icon={<LinkIcon className="h-4 w-4" />}
              cardColor="purple"
              errorState={true}
              errorMessage="No relationship suggestions available"
            >
              <></>
            </InsightCard>
            
            <InsightCard 
              title="Knowledge Gaps" 
              icon={<SearchIcon className="h-4 w-4" />}
              cardColor="orange"
              errorState={true}
              errorMessage="Unable to identify knowledge gaps due to processing error"
            >
              <></>
            </InsightCard>
            
            <InsightCard 
              title="Narrative" 
              icon={<BookOpenIcon className="h-4 w-4" />}
              cardColor="rose"
              errorState={true}
              errorMessage="Could not generate narrative due to an error in AI processing"
            >
              <></>
            </InsightCard>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Summary Card */}
          <div className="md:col-span-2">
            <InsightCard 
              title="Summary" 
              icon={<FileTextIcon className="h-4 w-4" />}
              cardColor="blue"
            >
              <p className="text-gray-200">{
                aiInsights.summary && aiInsights.summary !== "###" 
                  ? aiInsights.summary.replace(/###/g, "").replace(/\*\*/g, "")
                  : "No summary available"
              }</p>
            </InsightCard>
          </div>
          
          {/* Key Insights Card */}
          <InsightCard 
            title="Key Insights" 
            icon={<LightbulbIcon className="h-4 w-4" />}
            cardColor="yellow"
            errorState={!aiInsights.keyInsights || aiInsights.keyInsights.length === 0}
          >
            <div className="space-y-2">
              {aiInsights.keyInsights?.map((insight: string, i: number) => (
                <div key={i} className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-2">
                  <div className="flex items-start">
                    <span className="text-yellow-400 mr-2 mt-0.5 font-bold text-lg">•</span>
                    <span className="text-sm text-gray-200">{insight.replace(/\*\*/g, "")}</span>
                  </div>
                </div>
              ))}
            </div>
          </InsightCard>
          
          {/* Patterns Card */}
          <InsightCard 
            title="Identified Patterns" 
            icon={<GitBranchIcon className="h-4 w-4" />}
            cardColor="green"
            errorState={!aiInsights.patterns || aiInsights.patterns.length === 0}
          >
            <div className="space-y-3">
              {aiInsights.patterns?.map((pattern: { description: string; confidence: number }, i: number) => (
                <div key={i} className="bg-green-500/10 border border-green-500/20 rounded-md p-2">
                  <div className="flex-grow">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-gray-200">{pattern.description.replace(/\*\*/g, "")}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
                      <div 
                        className="bg-green-400 h-1.5 rounded-full" 
                        style={{ width: `${Math.round(pattern.confidence * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-end mt-1">
                      <span className="text-xs text-green-400">{Math.round(pattern.confidence * 100)}% confidence</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </InsightCard>
          
          {/* Potential Relationships Card */}
          <InsightCard 
            title="Suggested Relationships" 
            icon={<LinkIcon className="h-4 w-4" />}
            cardColor="purple"
            errorState={!aiInsights.potentialRelationships || aiInsights.potentialRelationships.length === 0}
          >
            <div className="space-y-3">
              {aiInsights.potentialRelationships?.map((rel: { 
                  source: string;
                  relationship: string;
                  target: string;
                  confidence: number;
                  explanation: string;
                }, i: number) => (
                <div key={i} className="bg-purple-500/10 border border-purple-500/20 rounded-md p-2">
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center flex-wrap">
                        <span className="text-purple-400 font-medium text-sm">{rel.source.replace(/\*\*/g, "")}</span>
                        <span className="mx-1 text-gray-400">→</span>
                        <span className="text-indigo-400 italic text-sm">{rel.relationship.replace(/\*\*/g, "")}</span>
                        <span className="mx-1 text-gray-400">→</span>
                        <span className="text-purple-400 font-medium text-sm">{rel.target.replace(/\*\*/g, "")}</span>
                      </div>
                      <span className="ml-2 text-xs bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full">
                        {Math.round(rel.confidence * 100)}%
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 border-t border-gray-700 pt-1">{rel.explanation.replace(/\*\*/g, "")}</p>
                  </div>
                </div>
              ))}
            </div>
          </InsightCard>
          
          {/* Knowledge Gaps Card */}
          <InsightCard 
            title="Knowledge Gaps" 
            icon={<SearchIcon className="h-4 w-4" />}
            cardColor="orange"
            errorState={!aiInsights.knowledgeGaps || aiInsights.knowledgeGaps.length === 0}
          >
            <div className="space-y-2">
              {aiInsights.knowledgeGaps?.map((gap: string, i: number) => (
                <div key={i} className="bg-orange-500/10 border border-orange-500/20 rounded-md p-2">
                  <div className="flex items-start">
                    <SearchXIcon className="h-4 w-4 text-orange-400 mt-0.5 mr-2 flex-shrink-0" />
                    <span className="text-sm text-gray-200">{gap.replace(/\*\*/g, "")}</span>
                  </div>
                </div>
              ))}
            </div>
          </InsightCard>
          
          {/* Narrative Card */}
          <InsightCard 
            title="Narrative" 
            icon={<BookOpenIcon className="h-4 w-4" />}
            cardColor="rose"
            errorState={!aiInsights.narrative}
          >
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-md p-3">
              <p className="text-sm text-gray-200 whitespace-pre-line">{
                aiInsights.narrative 
                  ? aiInsights.narrative.replace(/\*\*/g, "") 
                  : "No narrative available"
              }</p>
            </div>
          </InsightCard>
        </div>
      </div>
    );
  };
  
  return (
    <PageLayout title="Knowledge Graph Insights" header={graphSelectorHeader}>
      <div className="container mx-auto px-4 py-6 text-gray-200">
        {selectedGraphId ? (
          <div className="space-y-6">
            {/* Graph Visualization Card with Tabs */}
            <Card className="bg-gray-900 border-gray-800 shadow-lg overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center">
                  <NetworkIcon className="mr-2 h-5 w-5 text-primary" />
                  Knowledge Graph: {selectedGraph?.name}
                </CardTitle>
                <CardDescription>
                  {selectedGraph?.entityCount || 0} entities and {selectedGraph?.relationCount || 0} relations
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-full flex flex-col">
                  <div className="flex-grow overflow-hidden h-[600px] p-4">
                    <div className="flex h-full">
                      {/* Graph visualization on the left */}
                      <div className="flex-grow h-full overflow-hidden">
                        <AnimatedGradientBackground
                          className="h-full rounded-md overflow-hidden"
                          speed={30}
                          intensity={0.05}
                        >
                          <div className="h-full">
                            {selectedGraph && (
                              <KnowledgeGraphExplorer
                                knowledgeGraph={selectedGraph}
                                ref={graphRef}
                                hideControls={false}
                              />
                            )}
                          </div>
                        </AnimatedGradientBackground>
                      </div>
                      
                      {/* Graph metrics on the right as a separate component */}
                      {graphMetrics && (
                        <GraphMetricsPanel 
                          graphMetrics={graphMetrics}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Use a grid container to layout the insights and assistant side-by-side with 70:30 ratio */}
            <div className="grid grid-cols-1 md:grid-cols-10 gap-6">
              {/* AI Insights Card - Takes 7/10 of the space */}
              <Card className="bg-gray-900 border-gray-800 shadow-lg overflow-hidden md:col-span-7 bg-gradient-to-br from-gray-900 to-gray-800">
                <CardHeader className="pb-3 text-center border-b border-gray-800">
                  <div className="flex justify-center mb-2">
                    <div className="relative">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-purple-600/50 rounded-full blur-sm"></div>
                      <div className="relative bg-gray-900 p-2 rounded-full">
                        <BrainCircuitIcon className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                  </div>
                  <CardTitle className="text-lg text-center">
                    AI Insights for {selectedGraph?.name}
                  </CardTitle>
                  <div className="flex justify-center mt-2 mb-1">
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-1 inline-flex">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setSelectedModel('openai')}
                        className={`px-3 py-1 text-xs font-medium ${selectedModel === 'openai' 
                          ? 'bg-primary/20 text-primary' 
                          : 'text-gray-400 hover:text-gray-300'}`}
                      >
                        OpenAI
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setSelectedModel('mistral')}
                        className={`px-3 py-1 text-xs font-medium ${selectedModel === 'mistral' 
                          ? 'bg-primary/20 text-primary' 
                          : 'text-gray-400 hover:text-gray-300'}`}
                      >
                        Mistral AI
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="text-center">
                    AI-powered analysis and insights using {selectedModel === 'openai' ? 'OpenAI' : 'Mistral AI'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {loading && generateInsightsMutation.isPending ? (
                    <div className="flex flex-col items-center justify-center p-20">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                      <p className="text-lg">Generating AI insights...</p>
                      <p className="text-sm text-gray-400 mt-2">
                        This may take a few moments
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[600px]">
                      <div className="p-4">
                        {renderAIInsightsPanel()}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
              
              {/* Assistant Card - Takes 3/10 of the space */}
              <Card className="bg-gray-900 border-gray-800 shadow-lg overflow-hidden md:col-span-3 bg-gradient-to-br from-gray-900 to-gray-800">
                <CardHeader className="pb-3 text-center border-b border-gray-800">
                  <div className="flex justify-center mb-2">
                    <div className="relative">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-blue-600/50 rounded-full blur-sm"></div>
                      <div className="relative bg-gray-900 p-2 rounded-full">
                        <MessagesSquareIcon className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                  </div>
                  <CardTitle className="text-lg text-center">
                    Knowledge Assistant
                  </CardTitle>
                  <div className="flex justify-center mt-2 mb-1">
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-1 inline-flex">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setSelectedModel('openai')}
                        className={`px-3 py-1 text-xs font-medium ${selectedModel === 'openai' 
                          ? 'bg-primary/20 text-primary' 
                          : 'text-gray-400 hover:text-gray-300'}`}
                      >
                        OpenAI
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setSelectedModel('mistral')}
                        className={`px-3 py-1 text-xs font-medium ${selectedModel === 'mistral' 
                          ? 'bg-primary/20 text-primary' 
                          : 'text-gray-400 hover:text-gray-300'}`}
                      >
                        Mistral AI
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="text-center flex flex-col space-y-2">
                    <span>Ask questions about your knowledge graph using {selectedModel === 'openai' ? 'OpenAI' : 'Mistral AI'}</span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        window.location.href = '/settings';
                      }}
                      // Using direct href for simplicity, could also use Link from wouter
                      className="mx-auto mt-1 text-xs border-gray-700 hover:border-primary"
                    >
                      <Settings className="h-3 w-3 mr-1" />
                      API Key Settings
                    </Button>
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="flex flex-col h-[600px]">
                    {/* Chat messages area */}
                    <ScrollArea className="flex-grow p-4 h-[520px]">
                      <div className="space-y-4">
                        {chatMessages.map((message, index) => (
                          <div 
                            key={message.id} 
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div 
                              className={`max-w-[85%] rounded-lg p-3 shadow-md ${
                                message.role === 'user' 
                                  ? 'bg-primary/30 text-primary-foreground backdrop-blur-sm' 
                                  : message.role === 'system'
                                    ? 'bg-blue-900/30 text-blue-100 border border-blue-700/50 backdrop-blur-sm'
                                    : 'bg-gray-800/80 text-gray-100 border border-gray-700/70 backdrop-blur-sm'
                              }`}
                            >
                              {/* Icon based on message type */}
                              <div className="flex items-start">
                                {message.role === 'user' ? (
                                  <UserIcon className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                                ) : message.role === 'system' ? (
                                  <div className="relative mr-2 flex-shrink-0">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/50 to-primary/50 rounded-full blur-sm opacity-70"></div>
                                    <AlertCircleIcon className="h-5 w-5 text-blue-400 relative" />
                                  </div>
                                ) : (
                                  <BotIcon className="h-5 w-5 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                                )}
                                <div className="text-sm whitespace-pre-line text-left">{message.content}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                        {sendMessageMutation.isPending && (
                          <div className="flex justify-start">
                            <div className="max-w-[85%] rounded-lg p-3 bg-gray-800/80 border border-gray-700/70 backdrop-blur-sm shadow-md">
                              <div className="flex items-center space-x-2">
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                <span className="text-sm text-gray-300">Thinking...</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                    
                    {/* Input area */}
                    <div className="border-t border-gray-700/50 p-4 bg-gray-800/50">
                      {assistant ? (
                        <form 
                          className="flex space-x-2" 
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (userMessage.trim() && !sendMessageMutation.isPending) {
                              sendMessageMutation.mutate(userMessage.trim());
                            }
                          }}
                        >
                          <Input
                            placeholder="Ask a question about this graph..."
                            className="flex-grow bg-gray-700/70 border-gray-600 text-gray-100"
                            value={userMessage}
                            onChange={(e) => setUserMessage(e.target.value)}
                            disabled={sendMessageMutation.isPending}
                          />
                          <Button 
                            type="submit" 
                            className="bg-primary/90 hover:bg-primary"
                            disabled={!userMessage.trim() || sendMessageMutation.isPending}
                          >
                            {sendMessageMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <SendIcon className="h-4 w-4" />
                            )}
                          </Button>
                        </form>
                      ) : (
                        <div className="space-y-4">
                          <div className="rounded-lg bg-yellow-900/30 p-4 border border-yellow-800/50 text-center backdrop-blur-sm">
                            <div className="flex flex-col items-center">
                              <div className="relative mb-2">
                                <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500/50 to-amber-600/50 rounded-full blur-sm opacity-70"></div>
                                <div className="relative bg-gray-900 p-2 rounded-full">
                                  <AlertCircleIcon className="h-5 w-5 text-yellow-400" />
                                </div>
                              </div>
                              <p className="text-sm text-yellow-200 font-medium mb-1">Initialize Knowledge Assistant</p>
                              <p className="text-xs text-yellow-100/70">
                                Using the Assistant will consume your {selectedModel === 'openai' ? 'OpenAI' : 'Mistral AI'} API credits.
                              </p>
                            </div>
                          </div>
                          <Button 
                            className="w-full bg-primary/80 hover:bg-primary transition-colors" 
                            onClick={() => createAssistantMutation.mutate()}
                            disabled={assistantLoading || !selectedGraphId}
                          >
                            {assistantLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating Assistant...
                              </>
                            ) : (
                              <>Initialize Knowledge Assistant</>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <Card className="p-8 bg-gray-900 border-gray-800 shadow-lg h-full flex flex-col items-center justify-center text-center">
            <div className="max-w-md">
              <NetworkIcon className="h-16 w-16 mx-auto mb-6 text-primary/30" />
              <h3 className="text-xl font-medium mb-3">Select a Graph to Analyze</h3>
              <p className="text-gray-400 mb-6">
                Choose a knowledge graph from the dropdown menu to view visualizations and generate AI insights.
              </p>
              <div className="flex justify-center space-x-4">
                <Button variant="outline" onClick={() => refetchGraphs()}>
                  Refresh Graph List
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
      
      {isHelpModalOpen && (
        <HelpModal onClose={toggleHelpModal} />
      )}
    </PageLayout>
  );
}