import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import HelpModal from '@/components/HelpModal';
import { useSidebar } from '@/components/ui/sidebar';
import KnowledgeGraphExplorer from '@/components/KnowledgeGraphExplorer';
import { KnowledgeGraph, Node, Link } from '@shared/schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { SearchIcon, RefreshCw, Network, Filter, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { useAppState } from '@/contexts/AppStateContext';
import { apiRequest } from '@/lib/queryClient';
import { Slider } from '@/components/ui/slider';
// Removed pagination imports as we no longer need them
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

export default function Subgraphs() {
  // Get app state context
  const { appState, updateSubgraphsPage } = useAppState();
  
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
  // Get sidebar context for layout
  const sidebar = useSidebar();
  const { state, isMobile, openMobile } = sidebar;
  
  // Calculate sidebar width for proper spacing
  const sidebarWidth = (sidebar as any).width || (state === 'expanded' ? 256 : 80);
  const { toast } = useToast();
  
  // State for graph selection - initialize from app state
  const [selectedGraphId, setSelectedGraphId] = useState<number | null>(
    appState.subgraphsPage.selectedGraphId
  );
  const [selectedGraph, setSelectedGraph] = useState<KnowledgeGraph | null>(
    appState.subgraphsPage.selectedGraph
  );
  
  // State for subgraph extraction
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedEntities, setSelectedEntities] = useState<Node[]>([]);
  const [hopCount, setHopCount] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [subgraph, setSubgraph] = useState<KnowledgeGraph | null>(null);
  
  // Filter entities state
  const [filteredEntities, setFilteredEntities] = useState<Node[]>([]);
  const [entitySelectOpen, setEntitySelectOpen] = useState<boolean>(false);
  
  // We've removed pagination for entity selection as requested

  // Define response type for graph API
  interface GraphApiResponse {
    success: boolean;
    data: any[];
    message?: string;
  }

  // Fetch all graphs
  const { data: graphsResponse, isLoading, refetch } = useQuery<GraphApiResponse>({
    queryKey: ['/api/graphs'],
    // Let the default queryFn handle this request instead of custom implementation
    retry: 1,
    // Adding a refetchOnMount to ensure we always get fresh data
    refetchOnMount: true
  });
  
  // Function to refresh graphs data
  const fetchGraphs = () => {
    console.log("Refreshing graphs list...");
    refetch();
    toast({
      title: "Refreshing",
      description: "Fetching latest graph data",
    });
  };
  
  // Extract actual graph data from response
  const graphs = graphsResponse?.data || [];

  // Define response type for single graph API
  interface SingleGraphApiResponse {
    success: boolean;
    data: KnowledgeGraph;
    message?: string;
  }

  // Fetch specific graph when selected
  const { data: graphResponse, isLoading: isLoadingGraph, refetch: refetchGraph } = useQuery<SingleGraphApiResponse>({
    queryKey: [`/api/graphs/${selectedGraphId}`],
    // Let the default queryFn handle this request
    enabled: !!selectedGraphId,
    retry: 1,
    refetchOnMount: true
  });
  
  // Extract actual graph data from response
  const graphData = graphResponse?.data;

  // Update selected graph when graph data changes
  useEffect(() => {
    if (graphData) {
      console.log("Graph data received:", graphData);
      
      // Convert the response to the expected format
      // The data can be directly on the graphData object, or in a nested data property
      const graphToUse = graphData && typeof graphData === 'object' ? graphData : null;
      
      if (graphToUse && graphToUse.nodes && Array.isArray(graphToUse.nodes)) {
        // We have a valid graph with nodes
        setSelectedGraph(graphToUse);
        
        // Reset subgraph and selected entities when graph changes
        setSubgraph(null);
        setSelectedEntities([]);
        setSearchTerm('');
        
        // Initialize filtered entities 
        setFilteredEntities([...graphToUse.nodes]);
      } else {
        console.error("Invalid graph format received:", graphToUse);
      }
    }
  }, [graphData]);
  
  // Update app state when selected graph changes
  useEffect(() => {
    // Remove console.log to prevent excessive logging
    // Only update state if values have actually changed to prevent infinite loop
    if (
      appState.subgraphsPage.selectedGraphId !== selectedGraphId || 
      appState.subgraphsPage.selectedGraph !== selectedGraph
    ) {
      updateSubgraphsPage({
        selectedGraph,
        selectedGraphId
      });
    }
  }, [selectedGraph, selectedGraphId, updateSubgraphsPage, appState.subgraphsPage]);

  // Filter entities based on search term
  useEffect(() => {
    if (selectedGraph?.nodes && searchTerm) {
      const filtered = selectedGraph.nodes.filter(node => 
        node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (node.description && node.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredEntities(filtered);
    } else if (selectedGraph?.nodes) {
      setFilteredEntities([...selectedGraph.nodes]);
    }
  }, [searchTerm, selectedGraph]);
  
  // Pagination has been removed
  
  // Function to manually refresh graph data after CRUD operations
  const refreshGraphData = async () => {
    if (!selectedGraphId) return;
    
    try {
      // Refresh the data using the API request
      const response = await apiRequest("GET", `/api/graphs/${selectedGraphId}`);
      const data = await response.json();
      
      if (data && data.success && data.data) {
        // Update the selectedGraph with fresh data
        setSelectedGraph(data.data);
        
        // If a subgraph exists, update it with fresh entity and relationship data
        if (subgraph && subgraph.nodes.length > 0) {
          // Create updated subgraph nodes preserving positions
          const updatedNodes = subgraph.nodes.map(node => {
            const freshNode = data.data.nodes.find((n: any) => n.id === node.id);
            if (freshNode) {
              // Preserve x, y position data if it exists
              return {
                ...freshNode,
                x: (node as any).x,
                y: (node as any).y
              };
            }
            return node;
          });
          
          // Update links in the subgraph with fresh data
          const updatedLinks = subgraph.links.map(link => {
            const freshLink = data.data.links.find((l: any) => 
              (l as any).id === (link as any).id && 
              l.source === link.source && 
              l.target === link.target
            );
            return freshLink || link;
          });
          
          // Update the subgraph with fresh data while preserving visualization state
          setSubgraph({
            nodes: updatedNodes,
            links: updatedLinks
          });
        }
      }
    } catch (error) {
      console.error("Error refreshing graph data:", error);
    }
  };

  // Toggle help modal
  const toggleHelpModal = () => {
    setIsHelpModalOpen(!isHelpModalOpen);
  };

  // We'll use inline style for margins instead of classes for more consistent layout

  // Toggle entity selection
  const toggleEntitySelection = (entity: Node) => {
    if (selectedEntities.some(e => e.id === entity.id)) {
      setSelectedEntities(selectedEntities.filter(e => e.id !== entity.id));
    } else {
      setSelectedEntities([...selectedEntities, entity]);
    }
  };
  
  // Now we display all entities without pagination
  


  // Extract subgraph based on selected entities and hop count
  // State for save subgraph dialog
  const [saveDialogOpen, setSaveDialogOpen] = useState<boolean>(false);
  const [newSubgraphName, setNewSubgraphName] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  
  // Function to save the current subgraph as a new graph
  const saveSubgraphAsNewGraph = async () => {
    if (!subgraph || !newSubgraphName.trim()) return;
    
    setIsSaving(true);
    
    try {
      // Make sure we have proper data format for the graph
      // Create a clean copy of the nodes and links to avoid circular references
      // Only include properties that exist in the Node interface
      const cleanNodes = subgraph.nodes.map(node => ({
        id: node.id,
        name: node.name,
        group: node.group || 1,
        description: node.description,
        properties: node.properties,
        enriched: node.enriched,
        wikidataId: node.wikidataId,
        dataSource: node.dataSource || 'subgraph',
        timestamp: node.timestamp || new Date().toISOString()
      }));
      
      // Only include properties that exist in the Link interface
      const cleanLinks = subgraph.links.map(link => ({
        source: link.source,
        target: link.target,
        label: link.label,
        value: link.value || 1,
        enriched: link.enriched,
        wikidataId: link.wikidataId,
        dataSource: link.dataSource || 'subgraph',
        timestamp: link.timestamp || new Date().toISOString()
      }));
      
      // Create a new graph with the subgraph data
      // Add all required fields according to insertGraphSchema
      const payload = {
        name: newSubgraphName.trim(),
        nodes: cleanNodes,
        links: cleanLinks,
        inputText: `Subgraph created from Graph #${selectedGraphId}`,
        entityCount: cleanNodes.length,
        relationCount: cleanLinks.length,
        createdAt: new Date().toISOString()
      };
      
      const response = await apiRequest('POST', '/api/save-graph', payload);
      
      // Safely parse response
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error("Error parsing response:", parseError);
        throw new Error("Invalid response from server");
      }
      
      if (data && data.success) {
        toast({
          title: "Subgraph Saved",
          description: `Saved as new graph: ${newSubgraphName}`
        });
        
        // Close dialog and reset name
        setSaveDialogOpen(false);
        setNewSubgraphName('');
        
        // Refresh both the list of graphs and current graph data
        refetch();
        refreshGraphData();
      } else {
        throw new Error(data?.message || 'Failed to save subgraph');
      }
    } catch (error) {
      console.error("Error saving subgraph:", error);
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "An error occurred while saving the subgraph",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const extractSubgraph = () => {
    if (!selectedGraph || selectedEntities.length === 0) {
      toast({
        title: "Missing Selection",
        description: "Please select a graph and at least one entity",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Create node map for quick lookups
      const nodeMap = new Map<number, Node>();
      selectedGraph.nodes.forEach(node => nodeMap.set(node.id, node));

      // Starting with our selected entity IDs
      const selectedIds = selectedEntities.map(e => e.id);
      const includedNodeIds = new Set<number>(selectedIds);
      
      // For each hop, expand our node selection
      for (let hop = 0; hop < hopCount; hop++) {
        // Get all current nodes to expand from in this hop
        const currentNodeIds = Array.from(includedNodeIds);
        
        // For each node in current selection, find connected nodes
        currentNodeIds.forEach(nodeId => {
          selectedGraph.links.forEach(link => {
            // If this link connects to our current node, add the other end
            if (link.source === nodeId && !includedNodeIds.has(link.target)) {
              includedNodeIds.add(link.target);
            }
            if (link.target === nodeId && !includedNodeIds.has(link.source)) {
              includedNodeIds.add(link.source);
            }
          });
        });
      }

      // Extract the subgraph using the included node IDs
      const subgraphNodes = selectedGraph.nodes.filter(node => includedNodeIds.has(node.id));
      const subgraphLinks = selectedGraph.links.filter(
        link => includedNodeIds.has(link.source) && includedNodeIds.has(link.target)
      );

      // Create subgraph
      const newSubgraph: KnowledgeGraph = {
        nodes: subgraphNodes,
        links: subgraphLinks
      };
      
      // Add the ID only if it's available and valid
      if (selectedGraphId !== null && selectedGraphId !== undefined) {
        (newSubgraph as any).id = selectedGraphId;
      }

      setSubgraph(newSubgraph);
      
      toast({
        title: "Subgraph Extracted",
        description: `Created subgraph with ${subgraphNodes.length} entities and ${subgraphLinks.length} relationships`
      });
      
    } catch (error) {
      console.error("Error extracting subgraph:", error);
      toast({
        title: "Extraction Failed",
        description: "An error occurred while extracting the subgraph",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      <Sidebar onToggleHelp={toggleHelpModal} />
      
      <div 
        className="flex-1 transition-all duration-300 ease-in-out"
        style={{ marginLeft: isMobile ? 0 : `${sidebarWidth}px` }}>
        <div className="min-h-screen flex flex-col">
          <header className="bg-gray-900 border-b border-gray-800">
            <div className="container mx-auto px-4 py-4 flex justify-between items-center">
              <h1 className="text-xl font-semibold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                Subgraphs
              </h1>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={fetchGraphs}
                  className="bg-gray-800 hover:bg-gray-700"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refresh Graphs
                </Button>
                {selectedGraphId && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={refreshGraphData}
                    className="bg-gray-800 hover:bg-gray-700"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh Data
                  </Button>
                )}
              </div>
            </div>
          </header>
          
          <main className="flex-grow container mx-auto px-4 py-3 text-gray-200">
            <div className="h-[calc(100vh-4.5rem)] grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
              {/* Left column with graph selection and entity selection stacked */}
              <div className="flex flex-col gap-4 overflow-hidden">
                {/* Graph selection panel */}
                <Card className="bg-gray-900/80 border-gray-800 shadow-lg flex flex-col h-[40%]">
                  <CardHeader className="pb-1">
                    <CardTitle className="text-lg font-semibold text-white flex items-center">
                      <Network className="w-5 h-5 mr-2 text-primary" />
                      Available Graphs
                    </CardTitle>
                    <CardDescription className="text-sm text-gray-400">
                      Select a graph to analyze
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-800 py-2">
                    {isLoading ? (
                      <div className="flex items-center justify-center h-32">
                        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : !graphs || !Array.isArray(graphs) || graphs.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Network className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No graphs available</p>
                        <p className="text-sm mt-2">Generate or extract a knowledge graph first</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {Array.isArray(graphs) && graphs.map((graph: any) => (
                          <div 
                            key={graph.id}
                            className={`p-3 rounded-lg cursor-pointer transition-colors ${
                              selectedGraphId === graph.id 
                                ? 'bg-primary/20 border border-primary/50' 
                                : 'bg-gray-800 hover:bg-gray-800/80 border border-gray-800'
                            }`}
                            onClick={() => setSelectedGraphId(graph.id)}
                          >
                            <div className="flex justify-between items-start">
                              <div className="font-medium truncate">
                                {graph.name || `Graph #${graph.id}`}
                              </div>
                              <Badge variant="outline" className="ml-2 text-xs">
                                ID: {graph.id}
                              </Badge>
                            </div>
                            <div className="mt-2 flex text-xs text-gray-400 gap-3">
                              <span>{graph.entityCount} entities</span>
                              <span>{graph.relationCount} relations</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {/* Entity selection panel */}
                <Card className="bg-gray-900/80 border-gray-800 shadow-lg flex flex-col h-[60%]">
                  <CardHeader className="pb-1">
                    <CardTitle className="text-lg font-semibold text-white flex items-center justify-between">
                      <div className="flex items-center">
                        <Filter className="w-5 h-5 mr-2 text-primary" />
                        Select Entities
                      </div>
                      {selectedEntities.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {selectedEntities.length} selected
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-sm text-gray-400">
                      Choose entities for subgraph extraction
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col gap-4 overflow-hidden">
                    {!selectedGraph ? (
                      <div className="flex items-center justify-center h-full text-center text-gray-500">
                        <div>
                          <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>Select a graph first</p>
                        </div>
                      </div>
                    ) : isLoadingGraph ? (
                      <div className="flex items-center justify-center h-32">
                        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="relative flex-grow">
                            <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                            <Input
                              type="text"
                              placeholder="Search entities..."
                              className="pl-9 bg-gray-800/80 border-gray-700/50 text-gray-200 rounded-md"
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                            />
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              if (filteredEntities.length > 0) {
                                if (filteredEntities.length === selectedEntities.length) {
                                  // If all are selected, deselect all
                                  setSelectedEntities([]);
                                } else {
                                  // Otherwise, select all
                                  setSelectedEntities(filteredEntities);
                                }
                              }
                            }}
                            disabled={!filteredEntities.length}
                            className="whitespace-nowrap bg-gray-800/80 border-gray-700/50 text-gray-200 hover:bg-gray-700/80 hover:text-white"
                          >
                            {filteredEntities.length === selectedEntities.length && selectedEntities.length > 0 
                              ? "Deselect All" 
                              : "Select All"}
                          </Button>
                        </div>
                        
                        <div className="flex-grow overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-800">
                          <div className="space-y-2">
                            {filteredEntities.map((entity) => (
                              <div 
                                key={entity.id}
                                className="flex items-center p-2 rounded-md hover:bg-gray-800/50"
                              >
                                <Checkbox 
                                  id={`entity-${entity.id}`}
                                  checked={selectedEntities.some(e => e.id === entity.id)}
                                  onCheckedChange={() => toggleEntitySelection(entity)}
                                  className="mr-3"
                                />
                                <Label 
                                  htmlFor={`entity-${entity.id}`}
                                  className="flex-grow cursor-pointer"
                                >
                                  <div className="font-medium text-sm">{entity.name}</div>
                                  {entity.description && (
                                    <div className="text-xs text-gray-400 truncate">
                                      {entity.description.length > 60 
                                        ? entity.description.substring(0, 60) + '...'
                                        : entity.description
                                      }
                                    </div>
                                  )}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                  <CardFooter className="border-t border-gray-800 pt-3">
                    <div className="w-full">
                      <div className="flex flex-col space-y-4">
                        <div>
                          <Label className="mb-2 flex justify-between">
                            <span>Traversal Depth (Hops): {hopCount}</span>
                          </Label>
                          <Slider
                            defaultValue={[1]}
                            max={3}
                            min={1}
                            step={1}
                            value={[hopCount]}
                            onValueChange={(values) => setHopCount(values[0])}
                            className="py-2"
                          />
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>1 Hop</span>
                            <span>2 Hops</span>
                            <span>3 Hops</span>
                          </div>
                        </div>
                        <Button 
                          onClick={extractSubgraph} 
                          disabled={!selectedGraph || selectedEntities.length === 0 || isProcessing}
                          className="w-full bg-primary hover:bg-primary/90"
                        >
                          {isProcessing ? (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Share2 className="mr-2 h-4 w-4" />
                              Extract Subgraph
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardFooter>
                </Card>
              </div>
              
              {/* Right column - Visualization panel */}
              <div className="overflow-hidden">
                <Card className="bg-gray-900/80 border-gray-800 shadow-lg h-full flex flex-col">
                  <CardHeader className="pb-1">
                    <CardTitle className="text-lg font-semibold text-white flex items-center">
                      <Network className="w-5 h-5 mr-2 text-primary" />
                      Subgraph Visualization
                    </CardTitle>
                    <CardDescription className="text-sm text-gray-400">
                      {subgraph ? (
                        `${subgraph.nodes.length} entities, ${subgraph.links.length} connections`
                      ) : (
                        'Extract a subgraph to visualize'
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow relative px-4">
                    {!subgraph ? (
                      <div className="flex items-center justify-center h-full text-center text-gray-500">
                        <div>
                          <Network className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>No subgraph extracted yet</p>
                          <p className="text-sm mt-2">Select entities and extract a subgraph to visualize</p>
                        </div>
                      </div>
                    ) : (
                      <div className="absolute inset-0">
                        <KnowledgeGraphExplorer 
                          knowledgeGraph={subgraph}
                          hideControls={false}
                          onRefreshRequested={refreshGraphData}
                        />
                      </div>
                    )}
                  </CardContent>
                  {subgraph && (
                    <CardFooter className="border-t border-gray-800 pt-3">
                      <Button 
                        onClick={() => setSaveDialogOpen(true)} 
                        className="ml-auto bg-primary hover:bg-primary/90"
                      >
                        <Network className="mr-2 h-4 w-4" />
                        Save Subgraph
                      </Button>
                    </CardFooter>
                  )}
                </Card>
              </div>
            </div>
          </main>
        </div>
      </div>
      
      {isHelpModalOpen && <HelpModal onClose={toggleHelpModal} />}
      
      {/* Save Subgraph Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-gray-900 text-gray-100">
          <DialogHeader>
            <DialogTitle>Save Subgraph</DialogTitle>
            <DialogDescription className="text-gray-400">
              Save the current subgraph as a new knowledge graph.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                placeholder="Enter graph name"
                className="col-span-3 bg-gray-800 border-gray-700"
                value={newSubgraphName}
                onChange={(e) => setNewSubgraphName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={saveSubgraphAsNewGraph} 
              disabled={!newSubgraphName.trim() || isSaving}
              className="bg-primary hover:bg-primary/90"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}