import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAppState } from "@/contexts/AppStateContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  KnowledgeGraph,
  Node,
  Link as SchemaLink,
  EntitySchema,
} from "@shared/schema";
import Sidebar from "@/components/Sidebar";
import HelpModal from "@/components/HelpModal";
import { useSidebar } from "@/components/ui/sidebar";
import {
  DatabaseIcon,
  SearchIcon,
  NetworkIcon,
  BarChart4,
  List,
  FileJson,
  Layers,
  Calendar,
  RefreshCwIcon,
  ExternalLinkIcon,
  TrashIcon,
  Download,
  Info,
  PencilIcon,
  CheckIcon,
  XIcon,
  User,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import AnimatedGradientBackground from "@/components/AnimatedGradientBackground";
import GraphVisualization from "@/components/GraphVisualization";
import KnowledgeGraphExplorer from "@/components/KnowledgeGraphExplorer";
import { useLocation } from "wouter";

export interface GraphRef {
  highlightNode: (nodeId: number) => void;
  exportAsImage: () => void;
  exportAsJSON: () => void;
  exportAsRDF: () => void;
  exportAsCSV: () => void;
}

interface SavedGraph {
  id: number;
  name: string | null;
  entityCount: number;
  relationCount: number;
  createdAt: string;
  userId?: number;
  ownerName?: string;
}

export default function Load() {
  // Get app state context
  const { appState, updateLoadPage } = useAppState();
  
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
  const [savedGraphs, setSavedGraphs] = useState<SavedGraph[]>([]);
  
  // Initialize state from app state
  const [selectedGraph, setSelectedGraph] = useState<SavedGraph | null>(
    appState?.loadPage?.selectedGraph as SavedGraph | null
  );
  const [knowledgeGraph, setKnowledgeGraph] = useState<KnowledgeGraph | null>(
    appState?.loadPage?.selectedGraph?.id ? {
      id: appState.loadPage.selectedGraph.id,
      nodes: [],
      links: []
    } as KnowledgeGraph : null
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGraphLoading, setIsGraphLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>(appState?.loadPage?.searchTerm || "");
  const [activeTab, setActiveTab] = useState<string>("graph");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState<boolean>(false);
  const [graphToDelete, setGraphToDelete] = useState<number | null>(null);
  const [selectedGraphIds, setSelectedGraphIds] = useState<Set<number>>(new Set());
  const [isRenameMode, setIsRenameMode] = useState<{ [key: number]: boolean }>({});
  const [newNames, setNewNames] = useState<{ [key: number]: string }>({});
  const [isExportDialogOpen, setIsExportDialogOpen] = useState<boolean>(false);
  const graphRef = useRef<GraphRef>(null);
  // Get sidebar context for layout
  const sidebar = useSidebar();
  const { state, isMobile, openMobile } = sidebar;
  
  // Calculate sidebar width for proper spacing
  const sidebarWidth = (sidebar as any).width || (state === 'expanded' ? 256 : 80);
  const { toast } = useToast();

  // Toggle help modal
  const toggleHelpModal = () => {
    setIsHelpModalOpen(!isHelpModalOpen);
  };

  // We'll use inline style for margins instead of classes for more consistent layout

  // Get location to read URL parameters
  const [location] = useLocation();
  
  // Get graph ID from URL query parameter
  const getGraphIdFromUrl = useCallback(() => {
    try {
      const url = new URL(window.location.href);
      const graphId = url.searchParams.get('graphId');
      return graphId ? parseInt(graphId, 10) : null;
    } catch (e) {
      console.error('Error parsing URL parameters:', e);
      return null;
    }
  }, [location]);

  // Fetch saved graphs on component mount and load graph if ID is in URL
  useEffect(() => {
    const loadGraphsAndInitialize = async () => {
      await fetchSavedGraphs();
      
      // Check if we need to load a specific graph from URL
      const graphIdParam = getGraphIdFromUrl();
      if (graphIdParam) {
        loadGraph(graphIdParam);
      }
    };
    
    loadGraphsAndInitialize();
  }, [getGraphIdFromUrl]);
  
  // Update app state when page state changes
  useEffect(() => {
    // Make sure appState.loadPage exists and check if values have actually changed
    if (appState?.loadPage && (
      appState.loadPage.selectedGraphId !== (selectedGraph?.id || null) ||
      appState.loadPage.searchTerm !== searchTerm ||
      appState.loadPage.selectedGraph !== selectedGraph
    )) {
      updateLoadPage({
        selectedGraph: selectedGraph as any, // Using any to avoid type conflicts between SavedGraph and KnowledgeGraph
        selectedGraphId: selectedGraph?.id || null,
        searchTerm: searchTerm
      });
    }
  }, [selectedGraph, searchTerm, updateLoadPage, appState?.loadPage]);

  // Fetch all saved graphs
  const fetchSavedGraphs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/graphs");
      
      // Check for non-JSON responses
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Invalid response format. Expected JSON but received HTML or other format.");
      }
      
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to fetch saved graphs");
      }

      setSavedGraphs(result.data);
    } catch (error) {
      console.error("Error fetching saved graphs:", error);
      toast({
        title: "Failed to Load Saved Graphs",
        description:
          error instanceof Error
            ? error.message
            : "An error occurred while loading saved graphs.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load a graph by ID
  const loadGraph = async (id: number) => {
    setIsGraphLoading(true);
    try {
      const response = await fetch(`/api/graphs/${id}`);
      
      // Check for non-JSON responses
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Invalid response format. Expected JSON but received HTML or other format.");
      }
      
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to load graph");
      }

      // Set the knowledge graph from the loaded data, including the graph ID for CRUD operations
      setKnowledgeGraph({
        id: result.data.id, // Include the graphId for CRUD operations
        nodes: result.data.nodes,
        links: result.data.links,
      } as KnowledgeGraph);

      // Find and set the selected graph
      const graph = savedGraphs.find((g) => g.id === id) || null;
      setSelectedGraph(graph);

      toast({
        title: "Graph Loaded",
        description: `Successfully loaded graph: ${result.data.name || "Unnamed Graph"}`,
      });

      // Reset to graph tab for visualization
      setActiveTab("graph");
    } catch (error) {
      console.error("Error loading graph:", error);
      toast({
        title: "Failed to Load Graph",
        description:
          error instanceof Error
            ? error.message
            : "An error occurred while loading the graph.",
        variant: "destructive",
      });
    } finally {
      setIsGraphLoading(false);
    }
  };

  // Delete a graph by ID
  const deleteGraph = async (id: number) => {
    try {
      const response = await fetch(`/api/graphs/${id}`, {
        method: "DELETE",
      });
      
      // Check for non-JSON responses
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Invalid response format. Expected JSON but received HTML or other format.");
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to delete graph");
      }

      // Remove the deleted graph from the list
      setSavedGraphs(savedGraphs.filter((graph) => graph.id !== id));

      // If the deleted graph was selected, clear the selection
      if (selectedGraph && selectedGraph.id === id) {
        setSelectedGraph(null);
        setKnowledgeGraph(null);
      }

      toast({
        title: "Graph Deleted",
        description: "Successfully deleted the knowledge graph.",
      });

      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error("Error deleting graph:", error);
      toast({
        title: "Failed to Delete Graph",
        description:
          error instanceof Error
            ? error.message
            : "An error occurred while deleting the graph.",
        variant: "destructive",
      });
    }
  };

  // Rename a graph
  const renameGraph = async (id: number, newName: string) => {
    try {
      const response = await fetch(`/api/graphs/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newName }),
      });
      
      // Check for non-JSON responses
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Invalid response format. Expected JSON but received HTML or other format.");
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to rename graph');
      }

      // Update the graph in the list
      setSavedGraphs(savedGraphs.map(graph => 
        graph.id === id ? { ...graph, name: newName } : graph
      ));

      // If this is the selected graph, update its name
      if (selectedGraph && selectedGraph.id === id) {
        setSelectedGraph({ ...selectedGraph, name: newName });
      }

      // Exit rename mode
      const updatedRenameMode = { ...isRenameMode };
      delete updatedRenameMode[id];
      setIsRenameMode(updatedRenameMode);

      toast({
        title: 'Graph Renamed',
        description: 'Successfully renamed the knowledge graph.',
      });
    } catch (error) {
      console.error('Error renaming graph:', error);
      toast({
        title: 'Failed to Rename Graph',
        description: error instanceof Error 
          ? error.message 
          : 'An error occurred while renaming the graph.',
        variant: 'destructive',
      });
    }
  };

  // Delete multiple graphs
  const deleteMultipleGraphs = async () => {
    if (selectedGraphIds.size === 0) return;

    try {
      const response = await fetch('/api/graphs/delete-multiple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: Array.from(selectedGraphIds) }),
      });
      
      // Check for non-JSON responses
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Invalid response format. Expected JSON but received HTML or other format.");
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to delete graphs');
      }

      // Remove the deleted graphs from the list
      setSavedGraphs(savedGraphs.filter(graph => !selectedGraphIds.has(graph.id)));

      // If the selected graph was deleted, clear the selection
      if (selectedGraph && selectedGraphIds.has(selectedGraph.id)) {
        setSelectedGraph(null);
        setKnowledgeGraph(null);
      }

      // Clear selection
      setSelectedGraphIds(new Set());
      setIsBulkDeleteDialogOpen(false);

      toast({
        title: 'Graphs Deleted',
        description: `Successfully deleted ${result.deleted?.length || 0} knowledge graph(s).`,
      });

      if (result.failed?.length) {
        toast({
          title: 'Some Graphs Failed to Delete',
          description: `${result.failed.length} graph(s) could not be deleted.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting multiple graphs:', error);
      toast({
        title: 'Failed to Delete Graphs',
        description: error instanceof Error 
          ? error.message 
          : 'An error occurred while deleting the graphs.',
        variant: 'destructive',
      });
    }
  };

  // Open delete confirmation dialog
  const openDeleteDialog = (id: number) => {
    setGraphToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  // Export functions
  const exportAsJSON = () => {
    if (!knowledgeGraph) {
      toast({
        title: "No Graph to Export",
        description: "Please load a graph first.",
        variant: "destructive"
      });
      return;
    }

    if (graphRef.current?.exportAsJSON) {
      setIsExportDialogOpen(false);
      graphRef.current.exportAsJSON();
      toast({
        title: "JSON Export",
        description: "Graph exported as JSON file.",
      });
    }
  };

  const exportAsCSV = () => {
    if (!knowledgeGraph) {
      toast({
        title: "No Graph to Export",
        description: "Please load a graph first.",
        variant: "destructive"
      });
      return;
    }

    if (graphRef.current?.exportAsCSV) {
      setIsExportDialogOpen(false);
      graphRef.current.exportAsCSV();
      toast({
        title: "CSV Export",
        description: "Graph exported as CSV files.",
      });
    }
  };

  const exportAsRDF = () => {
    if (!knowledgeGraph) {
      toast({
        title: "No Graph to Export",
        description: "Please load a graph first.",
        variant: "destructive"
      });
      return;
    }

    if (graphRef.current?.exportAsRDF) {
      setIsExportDialogOpen(false);
      graphRef.current.exportAsRDF();
      toast({
        title: "RDF Export",
        description: "Graph exported as RDF file.",
      });
    }
  };

  const exportAsImage = () => {
    if (!knowledgeGraph) {
      toast({
        title: "No Graph to Export",
        description: "Please load a graph first.",
        variant: "destructive"
      });
      return;
    }

    if (graphRef.current?.exportAsImage) {
      setIsExportDialogOpen(false);
      graphRef.current.exportAsImage();
      toast({
        title: "Image Export",
        description: "Graph exported as PNG image.",
      });
    }
  };

  // Filter saved graphs based on search term
  const filteredGraphs = savedGraphs.filter((graph) =>
    (graph.name || "").toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Format date string
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric', 
        minute: 'numeric'
      });
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
    if (!knowledgeGraph?.links) return [];

    const relationCounts: Record<
      string,
      {
        label: string;
        count: number;
        dataSources: Record<string, number>;
        firstTimestamp?: string;
      }
    > = {};

    knowledgeGraph.links.forEach((link) => {
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

  // Infer schema from the knowledge graph
  const inferSchema = () => {
    if (!knowledgeGraph?.nodes || !knowledgeGraph?.links) return [];

    // Map to store node types (classes)
    const nodeTypes = new Map<number, string>();

    // First, map all nodes to their types
    knowledgeGraph.nodes.forEach((node) => {
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
    knowledgeGraph.links.forEach((link) => {
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

    // Convert to array format for easier rendering
    return Array.from(schemaMap.values())
      .map((entry) => ({
        className: entry.className,
        properties: Object.fromEntries(
          Array.from(entry.properties.entries()).map(([key, value]) => [
            key,
            value,
          ]),
        ),
        instances: entry.instances,
      }))
      .sort((a, b) => b.instances - a.instances); // Sort by number of instances
  };

  // Create triples from nodes and links
  const getTriples = (): {
    subject: string;
    predicate: string;
    object: string;
    dataSource: string;
    timestamp?: string;
    wikidataId?: string;
  }[] => {
    if (!knowledgeGraph?.links || !knowledgeGraph?.nodes) return [];

    const nodeMap = new Map<number, string>();

    knowledgeGraph.nodes.forEach((node) => {
      nodeMap.set(node.id, node.name);
    });

    return knowledgeGraph.links.map((link) => {
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
                Load Knowledge Graphs
              </h1>
              <div className="flex items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchSavedGraphs}
                  className="text-xs mr-2"
                >
                  <RefreshCwIcon className="h-3 w-3 mr-1" />
                  Refresh
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-grow container mx-auto px-4 py-6 text-gray-200 h-[calc(100vh-5rem)]">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-full">
              {/* Saved Graphs List */}
              <div className="col-span-1 h-full">
                <Card className="bg-gray-900 border-gray-800 shadow-lg h-full flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-bold text-white flex items-center">
                      <DatabaseIcon className="w-5 h-5 mr-2 text-primary" />
                      Saved Graphs
                    </CardTitle>
                    <CardDescription className="text-gray-400 flex items-center">
                      <span>
                        Found {savedGraphs.length} graph
                        {savedGraphs.length !== 1 ? "s" : ""}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col flex-grow">
                    {/* Search input */}
                    <div className="relative mb-4">
                      <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                      <Input
                        type="text"
                        placeholder="Search saved graphs..."
                        className="pl-9 bg-gray-800 border-gray-700 text-gray-200"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>

                    {/* Graph list */}
                    {isLoading ? (
                      <div className="space-y-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="flex flex-col space-y-2">
                            <Skeleton className="h-5 w-3/4 bg-gray-800" />
                            <Skeleton className="h-4 w-1/2 bg-gray-800" />
                            <Skeleton className="h-4 w-1/4 bg-gray-800" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2 overflow-y-auto pr-2 flex-grow">
                        {filteredGraphs.length === 0 ? (
                          <div className="text-center py-8">
                            <DatabaseIcon className="h-12 w-12 mx-auto text-gray-600 mb-4" />
                            <p className="text-gray-400">
                              No saved graphs found
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                              Generate a knowledge graph and use the Save button
                              to store it for later use.
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="mb-3 flex justify-between items-center">
                              <div className="text-sm text-gray-400">
                                {selectedGraphIds.size > 0 ? 
                                  `${selectedGraphIds.size} graph${selectedGraphIds.size !== 1 ? 's' : ''} selected` : 
                                  'Select graphs for bulk actions'}
                              </div>
                              <div className="flex space-x-2">
                                {selectedGraphIds.size === 0 && filteredGraphs.length > 0 && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-xs"
                                    onClick={() => {
                                      // Select all graphs
                                      const allIds = new Set(filteredGraphs.map(graph => graph.id));
                                      setSelectedGraphIds(allIds);
                                    }}
                                  >
                                    <CheckIcon className="h-3 w-3 mr-1" />
                                    Select All
                                  </Button>
                                )}
                                {selectedGraphIds.size > 0 && (
                                  <>
                                    <Button 
                                      variant="destructive" 
                                      size="sm" 
                                      className="text-xs"
                                      onClick={() => setIsBulkDeleteDialogOpen(true)}
                                    >
                                      <TrashIcon className="h-3 w-3 mr-1" />
                                      Delete Selected
                                    </Button>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="text-xs"
                                      onClick={() => setSelectedGraphIds(new Set())}
                                    >
                                      Clear
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                            
                            {filteredGraphs.map((graph) => (
                              <div
                                key={graph.id}
                                className={`p-3 rounded-md border cursor-pointer transition-colors ${
                                  selectedGraph?.id === graph.id
                                    ? "bg-gray-800 border-primary"
                                    : "bg-gray-800/50 border-gray-700/50 hover:border-gray-600"
                                }`}
                                onClick={() => loadGraph(graph.id)}
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex items-start flex-1 min-w-0">
                                    <div 
                                      className="mr-2 mt-1 flex-shrink-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Toggle selection
                                        const newSelection = new Set(selectedGraphIds);
                                        if (newSelection.has(graph.id)) {
                                          newSelection.delete(graph.id);
                                        } else {
                                          newSelection.add(graph.id);
                                        }
                                        setSelectedGraphIds(newSelection);
                                      }}
                                    >
                                      <Checkbox 
                                        checked={selectedGraphIds.has(graph.id)}
                                        className="mt-0.5"
                                      />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      {isRenameMode[graph.id] ? (
                                        <div className="flex items-center mb-1">
                                          <Input
                                            value={newNames[graph.id] || graph.name || ''}
                                            onChange={(e) => {
                                              setNewNames({
                                                ...newNames,
                                                [graph.id]: e.target.value
                                              });
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-7 text-sm bg-gray-700 border-gray-600"
                                            autoFocus
                                          />
                                          <div className="flex ml-1 flex-shrink-0">
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7 text-green-500"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                renameGraph(graph.id, newNames[graph.id] || '');
                                              }}
                                            >
                                              <CheckIcon className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7 text-gray-400"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const updatedRenameMode = { ...isRenameMode };
                                                delete updatedRenameMode[graph.id];
                                                setIsRenameMode(updatedRenameMode);
                                              }}
                                            >
                                              <XIcon className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <h3 className="font-medium text-gray-200 truncate">
                                          {graph.name || "Unnamed Graph"}
                                        </h3>
                                      )}
                                      <div className="flex items-center text-xs text-gray-400 mt-1">
                                        <Calendar className="h-3 w-3 mr-1 flex-shrink-0" />
                                        <span className="truncate">{formatDate(graph.createdAt)}</span>
                                      </div>
                                      <div className="flex items-center text-xs text-gray-400 mt-1">
                                        <User className="h-3 w-3 mr-1 flex-shrink-0" />
                                        <span className="truncate">Owner: {graph.ownerName || 'Unknown'}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex flex-shrink-0 ml-2">
                                    {!isRenameMode[graph.id] && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-gray-400 hover:text-blue-500"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setNewNames({ 
                                            ...newNames, 
                                            [graph.id]: graph.name || '' 
                                          });
                                          setIsRenameMode({ 
                                            ...isRenameMode, 
                                            [graph.id]: true 
                                          });
                                        }}
                                      >
                                        <PencilIcon className="h-4 w-4" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-gray-400 hover:text-red-500"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openDeleteDialog(graph.id);
                                      }}
                                    >
                                      <TrashIcon className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))
                          }
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Graph Visualization */}
              <div className="col-span-1 md:col-span-3 h-full">
                <Card className="bg-gray-900 border-gray-800 shadow-lg h-full flex flex-col">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg font-bold text-white flex items-center">
                        <NetworkIcon className="w-5 h-5 mr-2 text-primary" />
                        {selectedGraph ? (
                          <span>{selectedGraph.name || "Unnamed Graph"}</span>
                        ) : (
                          <span>Knowledge Graph Viewer</span>
                        )}
                      </CardTitle>
                      {knowledgeGraph && (
                        <Button
                          variant="outline"
                          className="gap-2"
                          onClick={() => setIsExportDialogOpen(true)}
                        >
                          <Download className="h-4 w-4" />
                          <span className="hidden sm:inline">Export Graph</span>
                          <span className="sm:hidden">Export</span>
                        </Button>
                      )}
                    </div>
                    <CardDescription className="text-gray-400">
                      {selectedGraph ? (
                        <span>
                          {selectedGraph.entityCount} entities and{" "}
                          {selectedGraph.relationCount} relationships
                        </span>
                      ) : (
                        <span>
                          Select a graph from the list to view and analyze
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 flex-grow overflow-hidden">
                    {isGraphLoading ? (
                      <div className="h-full w-full flex items-center justify-center">
                        <div className="text-center">
                          <RefreshCwIcon className="h-10 w-10 mx-auto text-gray-500 animate-spin" />
                          <p className="mt-4 text-gray-400">
                            Loading knowledge graph...
                          </p>
                        </div>
                      </div>
                    ) : knowledgeGraph ? (
                      <KnowledgeGraphExplorer
                        knowledgeGraph={knowledgeGraph}
                        ref={graphRef}
                        hideControls={false}
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <div className="text-center">
                          <DatabaseIcon className="h-16 w-16 mx-auto text-gray-700 mb-4" />
                          <h3 className="text-lg font-medium text-gray-400 mb-2">
                            No Graph Selected
                          </h3>
                          <p className="text-sm text-gray-500 max-w-sm">
                            Select a saved knowledge graph from the list to
                            visualize and explore its data.
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">
              Delete Knowledge Graph
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this knowledge graph? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                graphToDelete !== null && deleteGraph(graphToDelete)
              }
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">
              Bulk Delete Knowledge Graphs
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedGraphIds.size} selected knowledge graph{selectedGraphIds.size !== 1 ? 's' : ''}? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsBulkDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteMultipleGraphs}
            >
              Delete {selectedGraphIds.size} Graph{selectedGraphIds.size !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Export Knowledge Graph</DialogTitle>
            <DialogDescription>
              Choose the format you want to export your knowledge graph in.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            <Card 
              className="cursor-pointer transition-all border border-gray-800 bg-gray-900/40 hover:border-primary"
              onClick={exportAsJSON}
            >
              <CardHeader className="p-4 text-center">
                <FileJson className="h-12 w-12 mx-auto text-primary" />
              </CardHeader>
              <CardContent className="p-4 pt-0 text-center">
                <h3 className="font-medium">JSON</h3>
                <p className="text-xs text-gray-400 mt-1">Export as JSON format</p>
              </CardContent>
            </Card>
            
            <Card 
              className="cursor-pointer transition-all border border-gray-800 bg-gray-900/40 hover:border-primary"
              onClick={exportAsCSV}
            >
              <CardHeader className="p-4 text-center">
                <List className="h-12 w-12 mx-auto text-primary" />
              </CardHeader>
              <CardContent className="p-4 pt-0 text-center">
                <h3 className="font-medium">CSV</h3>
                <p className="text-xs text-gray-400 mt-1">Export as CSV files</p>
              </CardContent>
            </Card>
            
            <Card 
              className="cursor-pointer transition-all border border-gray-800 bg-gray-900/40 hover:border-primary"
              onClick={exportAsRDF}
            >
              <CardHeader className="p-4 text-center">
                <FileJson className="h-12 w-12 mx-auto text-primary" />
              </CardHeader>
              <CardContent className="p-4 pt-0 text-center">
                <h3 className="font-medium">RDF</h3>
                <p className="text-xs text-gray-400 mt-1">Export as Turtle RDF format</p>
              </CardContent>
            </Card>
            
            <Card 
              className="cursor-pointer transition-all border border-gray-800 bg-gray-900/40 hover:border-primary"
              onClick={exportAsImage}
            >
              <CardHeader className="p-4 text-center">
                <Download className="h-12 w-12 mx-auto text-primary" />
              </CardHeader>
              <CardContent className="p-4 pt-0 text-center">
                <h3 className="font-medium">Image</h3>
                <p className="text-xs text-gray-400 mt-1">Export as PNG image</p>
              </CardContent>
            </Card>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isHelpModalOpen && <HelpModal onClose={toggleHelpModal} />}
    </div>
  );
}
