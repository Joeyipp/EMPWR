import { useEffect, useState, useRef } from 'react';
import { useParams } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PageLayout from '../components/PageLayout';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Network, 
  ArrowLeft, 
  Loader2, 
  AlertTriangle, 
  Database, 
  Box, 
  Maximize, 
  Minimize,
  Save
} from 'lucide-react';
import KnowledgeGraphExplorer, { GraphRef } from '../components/KnowledgeGraphExplorer';
import GraphMetricsPanel from '../components/GraphMetricsPanel';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

export default function GraphPage() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState<string>('view');
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const graphId = parseInt(id as string, 10);
  const graphRef = useRef<GraphRef>(null);

  // Create a query client instance to manage cache
  const queryClient = useQueryClient();

  // Function to handle graph updates by forcing a refetch
  const handleGraphUpdated = async () => {
    console.log("Forcing refetch in GraphPage after CRUD operation");
    // Invalidate and refetch the data to ensure UI is in sync with database
    await queryClient.invalidateQueries({ queryKey: [`/api/graphs/${graphId}`] });
    await queryClient.refetchQueries({ queryKey: [`/api/graphs/${graphId}`] });
    
    // Now force a direct fetch as well to be extra sure
    try {
      const response = await fetch(`/api/graphs/${graphId}`);
      if (response.ok) {
        const result = await response.json();
        // Force update the cache with the fresh data
        queryClient.setQueryData([`/api/graphs/${graphId}`], result);
        console.log("Successfully updated graph data cache");
      }
    } catch (error) {
      console.error("Error during forced fetch:", error);
    }
  };

  // Get graph data
  const { 
    data: graphData, 
    isLoading: isLoadingGraph,
    error: graphError,
    refetch: refetchGraph // Expose refetch function
  } = useQuery<{data: any}>({
    queryKey: [`/api/graphs/${graphId}`],
    enabled: !!graphId && !isNaN(graphId),
    staleTime: 0, // Consider data stale immediately to ensure fresh data on focus
    refetchOnWindowFocus: true // Refetch when window regains focus
  });
  
  // Graph metrics for analysis tab
  const { 
    data: metricsData, 
    isLoading: isLoadingMetrics
  } = useQuery<{data: any}>({
    queryKey: [`/api/graphs/analyze/${graphId}`],
    enabled: !!graphId && !isNaN(graphId) && activeTab === 'analyze'
  });

  // Extract the graph from the response data
  const graph = graphData?.data;
  const graphMetrics = metricsData?.data;
  
  // Create graph data structure for visualization
  const graphForVisualization = graph ? {
    id: graph.id, // Include the graph ID for CRUD operations
    nodes: graph.nodes || [],
    links: graph.links || []
  } : { 
    id: graphId, // Always pass the graphId from the URL, even if graph data is not loaded yet
    nodes: [], 
    links: [] 
  };

  // Function to toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Return to graphs list
  const goToGraphsList = () => {
    setLocation('/load');
  };

  // Handle errors
  useEffect(() => {
    if (graphError) {
      toast({
        title: "Error Loading Graph",
        description: "Could not load the requested graph. It may not exist or has been deleted.",
        variant: "destructive"
      });
    }
  }, [graphError, toast]);

  return (
    <PageLayout title={graph ? `Graph: ${graph.name}` : "Loading Graph..."}>
      <div className="min-h-screen flex flex-col bg-gray-950">
        <div className="flex-grow container mx-auto px-4 py-6 text-gray-200">
          <div className="flex items-center mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToGraphsList}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Graphs
            </Button>
            
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleFullscreen}
                className="text-gray-400 hover:text-white"
              >
                {isFullscreen ? (
                  <>
                    <Minimize className="h-4 w-4 mr-1" />
                    Exit Fullscreen
                  </>
                ) : (
                  <>
                    <Maximize className="h-4 w-4 mr-1" />
                    Fullscreen
                  </>
                )}
              </Button>
            </div>
          </div>

          {isLoadingGraph ? (
            // Loading state
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-1">
                <Card className="bg-gray-900 border-gray-800 shadow-lg">
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4 bg-gray-800" />
                    <Skeleton className="h-4 w-1/2 bg-gray-800 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-full bg-gray-800" />
                      <Skeleton className="h-4 w-full bg-gray-800" />
                      <Skeleton className="h-4 w-3/4 bg-gray-800" />
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="md:col-span-3">
                <Card className="bg-gray-900 border-gray-800 shadow-lg h-[70vh]">
                  <CardHeader>
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className="ml-2 text-lg">Loading graph data...</span>
                    </div>
                  </CardHeader>
                </Card>
              </div>
            </div>
          ) : graphError ? (
            // Error state
            <Card className="bg-gray-900 border-gray-800 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center text-red-400">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  Error Loading Graph
                </CardTitle>
                <CardDescription>
                  Could not load the requested graph
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center py-10">
                <p className="mb-4">The graph you're looking for might have been deleted or never existed.</p>
                <Button variant="default" onClick={goToGraphsList}>
                  Go to Graph List
                </Button>
              </CardContent>
            </Card>
          ) : (
            // Graph visualization and information
            <div className={`grid ${isFullscreen ? '' : 'grid-cols-1 md:grid-cols-4'} gap-6`}>
              {!isFullscreen && (
                <div className="md:col-span-1">
                  <Card className="bg-gray-900 border-gray-800 shadow-lg h-auto">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Database className="h-5 w-5 mr-2 text-primary" />
                        Graph Information
                      </CardTitle>
                      <CardDescription>
                        Details about this knowledge graph
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-sm font-medium text-gray-400">Name</h3>
                          <p className="font-mono">{graph?.name || "Unnamed Graph"}</p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-400">ID</h3>
                          <p className="font-mono">#{graphId}</p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-400">Created</h3>
                          <p className="font-mono">
                            {graph?.createdAt ? new Date(graph.createdAt).toLocaleString() : "Unknown"}
                          </p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-400">Entities</h3>
                          <p className="font-mono">{graph?.entityCount || 0}</p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-400">Relationships</h3>
                          <p className="font-mono">{graph?.relationCount || 0}</p>
                        </div>

                        <div className="pt-4">
                          <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="grid grid-cols-2">
                              <TabsTrigger value="view">View</TabsTrigger>
                              <TabsTrigger value="analyze">Analyze</TabsTrigger>
                            </TabsList>
                          </Tabs>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className={`${isFullscreen ? 'col-span-full' : 'md:col-span-3'}`}>
                <Card className="bg-gray-900 border-gray-800 shadow-lg h-auto">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                      <CardTitle className="flex items-center">
                        <Network className="h-5 w-5 mr-2 text-primary" />
                        {graph?.name || "Knowledge Graph Viewer"}
                      </CardTitle>
                    </div>
                    <CardDescription>
                      {graph ? (
                        <span>
                          {graph.entityCount} entities and {graph.relationCount} relationships
                        </span>
                      ) : (
                        <span>Interactive knowledge graph visualization</span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className={`p-0 ${isFullscreen ? 'h-[85vh]' : 'min-h-[600px] h-auto'}`}>
                    <div className="h-full flex relative overflow-hidden">
                      <div className={`${activeTab === 'analyze' ? 'flex-grow' : 'w-full'} h-full`}>
                        {/* Use only the graph visualization for analyze tab */}
                        <KnowledgeGraphExplorer 
                          knowledgeGraph={graphForVisualization} 
                          ref={graphRef}
                          hideControls={activeTab === 'analyze'}
                          onGraphUpdated={handleGraphUpdated}
                        />
                      </div>
                      
                      {activeTab === 'analyze' && (
                        <div className="border-l border-gray-800">
                          {isLoadingMetrics ? (
                            <div className="flex items-center justify-center h-full w-80 pl-4 pr-4 pt-4">
                              <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                              <span>Loading metrics...</span>
                            </div>
                          ) : graphMetrics ? (
                            <GraphMetricsPanel graphMetrics={graphMetrics} />
                          ) : (
                            <div className="flex items-center justify-center h-full w-80 pl-4 pr-4 pt-4 text-gray-400">
                              <Box className="h-8 w-8 mb-2" />
                              <span>No metrics available</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}