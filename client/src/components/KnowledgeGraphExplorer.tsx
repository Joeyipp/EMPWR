import React, {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { KnowledgeGraph, Node, Link as SchemaLink } from "@shared/schema";
import GraphVisualization from "@/components/GraphVisualization";
import AnimatedGradientBackground from "@/components/AnimatedGradientBackground";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart4,
  Network,
  List,
  FileJson,
  Search,
  Download as DownloadIcon,
  Image,
  FileCode,
  Database,
  Edit,
  Trash2,
  Plus,
  Loader2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Map Wikidata property IDs to human-readable labels
// Define as a constant to avoid recreating the object on each call
const WIKIDATA_PROPERTY_LABELS: Record<string, string> = {
  P31: "instance of",
  P279: "subclass of",
  P131: "located in",
  P17: "country",
  P138: "named after",
  P36: "capital",
  P6: "head of government",
  P19: "place of birth",
  P20: "place of death",
  P27: "country of citizenship",
  P37: "official language",
  P39: "position held",
  P47: "shares border with",
  P54: "member of sports team",
  P101: "field of work",
  P106: "occupation",
  P108: "employer",
  P112: "founded by",
  P121: "item operated",
  P123: "publisher",
  P135: "movement",
  P136: "genre",
  P140: "religion",
  P150: "contains administrative unit",
  P159: "headquarters location",
  P166: "award received",
  P169: "chief executive officer",
  P176: "manufacturer",
  P180: "depicts",
  P190: "sister city",
  P205: "basin country",
  P241: "military branch",
  P264: "record label",
  P276: "location",
  P361: "part of",
  P366: "use",
  P400: "platform",
  P403: "mouth of the watercourse",
  P449: "original network",
  P460: "said to be the same as",
  P463: "member of",
  P495: "country of origin",
  P527: "has part",
  P551: "residence",
  P607: "conflict",
  P625: "coordinate location",
  P706: "located on terrain feature",
  P740: "location of formation",
  P750: "distributor",
  P793: "significant event",
  P800: "notable work",
  P856: "official website",
  P1001: "applies to jurisdiction",
  P1056: "product or material produced",
  P1196: "manner of death",
  P1343: "described by source",
  P1376: "capital of",
  P1412: "languages spoken, written or signed",
  P1441: "present in work",
  P1542: "has effect",
  P1552: "has quality",
  P1889: "different from",
  P2541: "operating area",
  P2670: "has parts of the class",
  P3373: "sibling",
  P3828: "armament",
  P4743: "animal breed"
};

// Export function for internal and external use
export function getWikidataPropertyLabels(): Record<string, string> {
  return WIKIDATA_PROPERTY_LABELS;
}

export interface Triple {
  subject: string;
  predicate: string;
  object: string;
  dataSource?: string;
  timestamp?: string;
  enriched?: boolean;
  properties?: {
    source?: string;
    timestamp?: string;
  };
}

// Extend the KnowledgeGraph interface to include an id property for CRUD operations
interface ExtendedKnowledgeGraph extends KnowledgeGraph {
  id?: number; // Make id optional but ensure it's included in the type
}

interface KnowledgeGraphExplorerProps {
  knowledgeGraph: ExtendedKnowledgeGraph | null;
  hideControls?: boolean; // Add this prop to optionally hide the tabs and search controls
  onGraphUpdated?: () => void; // Callback function to notify parent component of graph updates
  onRefreshRequested?: () => void; // Callback function to request data refresh from parent component
  onNodeClick?: (node: any) => void; // Callback function when a node is clicked
}

export interface GraphRef {
  highlightNode: (nodeId: number) => void;
  exportAsImage: () => void;
  exportAsJSON: () => void;
  exportAsRDF: () => void;
  exportAsCSV: () => void;
  // Add ForceGraph methods that we access directly
  zoom?: (value?: number, transitionDuration?: number) => number;
  centerAt?: (x?: number, y?: number, transitionDuration?: number) => void;
  // Additional internal methods that might be used
  refresh?: () => void;
  canvas?: () => HTMLCanvasElement | null;
}

// Define GraphRef interface to avoid reference before declaration

const KnowledgeGraphExplorer = forwardRef<GraphRef, KnowledgeGraphExplorerProps>((props, ref) => {
  const { knowledgeGraph: externalGraph, hideControls = false, onRefreshRequested, onGraphUpdated, onNodeClick } = props;
  
  // Create a local copy of the graph data to manage internal state properly
  // This allows us to refresh the component when we need to
  const [localGraphState, setLocalGraphState] = useState<ExtendedKnowledgeGraph | null>(externalGraph);
  
  // Force refresh counter - incrementing this will cause a complete component refresh
  const [refreshCounter, setRefreshCounter] = useState<number>(0);
  
  // We'll use refreshCounter for all refresh operations
  
  // Tab and search states
  const [activeTab, setActiveTab] = useState(hideControls ? "graph" : "graph");
  const [searchTerm, setSearchTerm] = useState("");
  
  // References
  const graphRef = useRef<GraphRef>(null);
  const { toast } = useToast();
  
  // Expose the actual graph data to use throughout the component
  // This will be the local state if available, otherwise fall back to props
  const knowledgeGraph = localGraphState || externalGraph;
  
  // Update local state when external graph changes
  useEffect(() => {
    // Removed console.log that was causing excessive logging
    setLocalGraphState(externalGraph);
  }, [externalGraph]);
  
  // CRUD operation states
  const [isEditNodeDialogOpen, setIsEditNodeDialogOpen] = useState(false);
  const [isEditLinkDialogOpen, setIsEditLinkDialogOpen] = useState(false);
  const [isAddNodeDialogOpen, setIsAddNodeDialogOpen] = useState(false);
  const [isAddLinkDialogOpen, setIsAddLinkDialogOpen] = useState(false);
  const [isDeleteConfirmDialogOpen, setIsDeleteConfirmDialogOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedLink, setSelectedLink] = useState<SchemaLink | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Triple editor state
  const [isAddTripleDialogOpen, setIsAddTripleDialogOpen] = useState(false);
  const [isEditTripleDialogOpen, setIsEditTripleDialogOpen] = useState(false);
  const [selectedTriple, setSelectedTriple] = useState<Triple | null>(null);
  
  // Pagination state for entities, relations, and triples
  const [entitiesPage, setEntitiesPage] = useState(1);
  const [relationsPage, setRelationsPage] = useState(1);
  const [triplesPage, setTriplesPage] = useState(1);
  
  // Page size state
  const [entitiesPageSize, setEntitiesPageSize] = useState(10);
  const [relationsPageSize, setRelationsPageSize] = useState(10);
  const [triplesPageSize, setTriplesPageSize] = useState(10);

  // Helper function to normalize data source
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

  // Forward the highlight and export methods to parent components
  useImperativeHandle(ref, () => ({
    highlightNode: (nodeId: number) => {
      if (graphRef.current) {
        // If we're not on the graph tab, switch to it first
        if (activeTab !== "graph") {
          setActiveTab("graph");
        }
        graphRef.current.highlightNode(nodeId);
      }
    },
    exportAsImage: () => {
      if (graphRef.current && graphRef.current.exportAsImage) {
        // If we're not on the graph tab, switch to it first
        if (activeTab !== "graph") {
          setActiveTab("graph");
        }
        // Give UI time to update if tab was changed
        setTimeout(() => {
          if (graphRef.current) {
            graphRef.current.exportAsImage();
          }
        }, 100);
      }
    },
    exportAsJSON: () => {
      if (graphRef.current && graphRef.current.exportAsJSON) {
        // If we're not on the graph tab, switch to it first
        if (activeTab !== "graph") {
          setActiveTab("graph");
        }
        // Give UI time to update if tab was changed
        setTimeout(() => {
          if (graphRef.current) {
            graphRef.current.exportAsJSON();
          }
        }, 100);
      }
    },
    exportAsRDF: () => {
      if (graphRef.current && graphRef.current.exportAsRDF) {
        // If we're not on the graph tab, switch to it first
        if (activeTab !== "graph") {
          setActiveTab("graph");
        }
        // Give UI time to update if tab was changed
        setTimeout(() => {
          if (graphRef.current) {
            graphRef.current.exportAsRDF();
          }
        }, 100);
      }
    },
    exportAsCSV: () => {
      if (graphRef.current && graphRef.current.exportAsCSV) {
        // If we're not on the graph tab, switch to it first
        if (activeTab !== "graph") {
          setActiveTab("graph");
        }
        // Give UI time to update if tab was changed
        setTimeout(() => {
          if (graphRef.current) {
            graphRef.current.exportAsCSV();
          }
        }, 100);
      }
    },
  }));

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

  // Get entity color based on group
  const getEntityColor = (group: number): string => {
    switch (group) {
      case 1:
        return "#3B82F6"; // Person - blue
      case 2:
        return "#F59E0B"; // Place - amber
      case 3:
        return "#10B981"; // Concept - green
      case 4:
        return "#8B5CF6"; // Organization - purple
      case 5:
        return "#EC4899"; // Date - pink
      default:
        return "#6B7280"; // Other - gray
    }
  };

  // Get entity categories
  const getEntityCategories = (): {
    name: string;
    count: number;
    group: number;
  }[] => {
    if (!knowledgeGraph?.nodes || !Array.isArray(knowledgeGraph.nodes)) return [];

    const categoryCounts: Record<
      number,
      { name: string; count: number; group: number }
    > = {};

    knowledgeGraph.nodes.forEach((node) => {
      if (!categoryCounts[node.group]) {
        categoryCounts[node.group] = {
          name: getEntityTypeName(node.group),
          count: 0,
          group: node.group,
        };
      }
      categoryCounts[node.group].count++;
    });

    return Object.values(categoryCounts).sort((a, b) => b.count - a.count);
  };

  // Get relationship types
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

    // Get Wikidata property labels
    const wikidataLabels = getWikidataPropertyLabels();

    knowledgeGraph.links.forEach((link) => {
      // Translate Wikidata property IDs to human-readable labels
      let relationLabel = link.label;

      if (link.enriched && link.wikidataId && wikidataLabels[link.wikidataId]) {
        relationLabel = wikidataLabels[link.wikidataId];
      }

      if (!relationCounts[relationLabel]) {
        relationCounts[relationLabel] = {
          label: relationLabel,
          count: 0,
          dataSources: {},
          firstTimestamp: link.timestamp,
        };
      }

      // Increment the count
      relationCounts[relationLabel].count++;

      // Track data sources
      const source = link.dataSource || "unknown";
      if (!relationCounts[relationLabel].dataSources[source]) {
        relationCounts[relationLabel].dataSources[source] = 0;
      }
      relationCounts[relationLabel].dataSources[source]++;

      // Track earliest timestamp
      if (link.timestamp && relationCounts[relationLabel]) {
        const count = relationCounts[relationLabel];
        if (!count.firstTimestamp || link.timestamp < count.firstTimestamp) {
          relationCounts[relationLabel].firstTimestamp = link.timestamp;
        }
      }
    });

    return Object.values(relationCounts).sort((a, b) => b.count - a.count);
  };

  // Create triples from nodes and links
  const getTriples = (): Triple[] => {
    if (!knowledgeGraph?.links || !knowledgeGraph?.nodes) return [];

    const nodeMap = new Map<number, string>();
    knowledgeGraph.nodes.forEach((node) => {
      nodeMap.set(node.id, node.name);
    });

    // Get Wikidata property labels
    const wikidataLabels = getWikidataPropertyLabels();

    // Safely handle knowledgeGraph.links with null/undefined check
    if (!knowledgeGraph || !knowledgeGraph.links || !Array.isArray(knowledgeGraph.links)) {
      return [];
    }

    return knowledgeGraph.links.map((link) => {
      // Translate Wikidata property IDs to human-readable labels
      let predicate = link.label;

      if (link.enriched && link.wikidataId && wikidataLabels[link.wikidataId]) {
        predicate = wikidataLabels[link.wikidataId];
      }

      return {
        subject: nodeMap.get(link.source) || `Entity ${link.source}`,
        predicate: predicate,
        object: nodeMap.get(link.target) || `Entity ${link.target}`,
        dataSource: link.dataSource,
        timestamp: link.timestamp,
        enriched: link.enriched,
        properties: {
          source: link.dataSource,
          timestamp: link.timestamp
        }
      };
    });
  };

  // Infer schema from the knowledge graph
  const inferSchema = (): {
    className: string;
    properties: Record<
      string,
      {
        type: string;
        count: number;
      }
    >;
    instances: number;
  }[] => {
    if (!knowledgeGraph?.nodes || !knowledgeGraph?.links) return [];

    // Map to store node types (classes)
    const nodeTypes = new Map<number, string>();

    // First, map all nodes to their types
    knowledgeGraph.nodes.forEach((node) => {
      nodeTypes.set(node.id, getEntityTypeName(node.group));
    });

    // Create schema map where each class has properties
    const schemaMap = new Map<
      string,
      {
        className: string;
        properties: Map<
          string,
          {
            type: string;
            count: number;
          }
        >;
        instances: number;
      }
    >();

    // Initialize classes based on entity categories
    getEntityCategories().forEach((category) => {
      schemaMap.set(category.name, {
        className: category.name,
        properties: new Map(),
        instances: category.count,
      });
    });

    // Process links to build property definitions
    knowledgeGraph.links.forEach((link) => {
      const sourceType = nodeTypes.get(link.source) || "Unknown";
      const targetType = nodeTypes.get(link.target) || "Unknown";

      // Get Wikidata property labels
      const wikidataLabels = getWikidataPropertyLabels();

      // Translate Wikidata property IDs to human-readable labels
      let propertyName = link.label;

      if (link.enriched && link.wikidataId && wikidataLabels[link.wikidataId]) {
        propertyName = wikidataLabels[link.wikidataId];
      }

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

  // CRUD handler functions
  // Helper function to ensure an entity exists, creating it if needed
  const ensureEntityExists = async (
    entityName: string, 
    graphId: number, 
    nodeNameMap: Map<string, number>
  ): Promise<number | undefined> => {
    // Check if entity already exists
    const existingId = nodeNameMap.get(entityName);
    if (existingId !== undefined) {
      return existingId;
    }
    
    // Entity doesn't exist, create it
    console.log(`Creating new entity: ${entityName}`);
    
    // Generate a new ID for the entity
    const maxId = knowledgeGraph?.nodes ? 
      Math.max(...knowledgeGraph.nodes.map(node => node.id), 0) : 0;
    const newEntityId = maxId + 1;
    
    // Create entity object
    const newEntity = {
      id: newEntityId,
      name: entityName,
      group: 3, // Default to Concept
      dataSource: "manual",
      timestamp: new Date().toISOString()
    };
    
    // Add entity to graph
    try {
      const response = await apiRequest(
        'POST',
        `/api/graphs/${graphId}/nodes`,
        newEntity
      );
      
      const responseData = await response.json();
      if (responseData.success) {
        console.log("Successfully created entity:", newEntity);
        return newEntityId;
      } else {
        console.error("Failed to create entity:", responseData);
        return undefined;
      }
    } catch (error) {
      console.error("Error creating entity:", error);
      return undefined;
    }
  };

  // Helper function to find the corresponding link object for a triple
  const findLinkFromTriple = (triple: Triple): SchemaLink | null => {
    if (!knowledgeGraph?.links || !knowledgeGraph.nodes) {
      console.error("Cannot find link: Knowledge graph is not available");
      return null;
    }
    
    // Create a map of node names to IDs
    const nodeNameToId = new Map<string, number>();
    knowledgeGraph.nodes.forEach(node => {
      nodeNameToId.set(node.name, node.id);
    });
    
    // Find the source and target IDs based on node names
    const sourceId = nodeNameToId.get(triple.subject);
    const targetId = nodeNameToId.get(triple.object);
    
    if (sourceId === undefined || targetId === undefined) {
      console.error("Cannot find node IDs for subject or object:", { triple, sourceId, targetId });
      return null;
    }
    
    // Find the link that matches source, target, and predicate
    const link = knowledgeGraph.links.find(link => {
      const isSourceMatch = link.source === sourceId;
      const isTargetMatch = link.target === targetId;
      
      // We need to handle wikidata property translation
      let linkLabel = link.label;
      // Get Wikidata property labels
      const wikidataLabels = getWikidataPropertyLabels();
      // Translate if needed
      if (link.enriched && link.wikidataId && wikidataLabels[link.wikidataId]) {
        linkLabel = wikidataLabels[link.wikidataId];
      }
      
      const isLabelMatch = linkLabel === triple.predicate;
      
      return isSourceMatch && isTargetMatch && isLabelMatch;
    });
    
    if (!link) {
      console.error("No matching link found for triple:", triple);
      return null;
    }
    
    return link;
  };

  // Helper function to reliably get graph ID
  const getGraphId = (): number | undefined => {
    try {
      // Check if knowledgeGraph exists and has an id property
      if (knowledgeGraph && typeof knowledgeGraph === 'object' && 'id' in knowledgeGraph && knowledgeGraph.id) {
        // If the ID is directly available on the knowledgeGraph object and is valid
        const graphId = Number(knowledgeGraph.id);
        if (!isNaN(graphId)) {
          console.log("Using graph ID from knowledgeGraph object:", graphId);
          return graphId;
        }
      }
      
      // Look for it in the URL if we're on a specific graph page
      const pathname = window.location.pathname;
      const matches = pathname.match(/\/graph\/(\d+)/);
      if (matches && matches[1]) {
        const urlGraphId = parseInt(matches[1], 10);
        console.log("Using graph ID from URL:", urlGraphId);
        return urlGraphId;
      }
      
      console.log("No valid graph ID found in component or URL");
      return undefined;
    } catch (error) {
      console.error("Error in getGraphId:", error);
      return undefined;
    }
  };
  
  // Helper function to reload graph data after CRUD operations
  const reloadGraph = async () => {
    try {
      const graphId = getGraphId();
      if (!graphId) {
        console.error("Cannot reload graph: No graph ID available");
        return false;
      }
      
      console.log("============ RELOADING GRAPH DATA ============");
      console.log("Graph ID:", graphId);
      
      // First approach: Call the parent component's onGraphUpdated callback
      // This is the most reliable method when properly implemented in the parent
      if (props.onGraphUpdated) {
        console.log("1. Triggering parent component update callback");
        await props.onGraphUpdated();
      }
      
      // Second approach: Force query invalidation and refetch
      console.log("2. Invalidating and refetching queries");
      await queryClient.invalidateQueries({ queryKey: [`/api/graphs/${graphId}`] });
      await queryClient.refetchQueries({ queryKey: [`/api/graphs/${graphId}`] });
      
      // Call refresh requested callback if provided
      if (onRefreshRequested) {
        onRefreshRequested();
      }
      
      // Third approach: Direct fetch and force re-render UI components
      console.log("3. Directly fetching fresh data and forcing UI updates");
      try {
        const response = await fetch(`/api/graphs/${graphId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch updated graph: ${response.status}`);
        }
        
        const result = await response.json();
        if (result.success && result.data) {
          console.log("Fresh data successfully retrieved");
          
          // Update local graph state with fresh data
          console.log("Updating local graph state with fresh data");
          setLocalGraphState(result.data);
          
          // Increment refresh counter to force re-render
          setRefreshCounter(prev => prev + 1);
          
          // Store the original tab for restoring later
          const originalTab = activeTab;
          
          // Create visual feedback through tab switching
          // The double tab switch forces React to re-render components
          console.log("4. Applying UI refresh with tab switching");
          if (originalTab === 'graph') {
            setActiveTab('entities');
            // Need enough delay to register the change in React's state
            setTimeout(() => setActiveTab('relations'), 50);
            setTimeout(() => setActiveTab(originalTab), 100);
          } else {
            setActiveTab('graph');
            setTimeout(() => setActiveTab('entities'), 50);
            setTimeout(() => setActiveTab(originalTab), 100);
          }
          
          // Reset search filtering to force table re-renders
          console.log("5. Resetting search filters to force table re-renders");
          if (searchTerm) {
            const currentSearch = searchTerm;
            setSearchTerm('');
            setTimeout(() => setSearchTerm(currentSearch), 150);
          } else {
            // If no search term, still trigger a re-render by setting and clearing a value
            setSearchTerm('_refresh_trigger_');
            setTimeout(() => setSearchTerm(''), 150);
          }
          
          // Apply visual feedback to the graph through zoom animation
          console.log("6. Applying visual feedback to graph visualization");
          if (graphRef.current && (originalTab === 'graph' || activeTab === 'graph')) {
            try {
              setTimeout(() => {
                if (graphRef.current?.zoom) {
                  console.log("Applying zoom animation effect");
                  const currentZoom = graphRef.current.zoom();
                  // Zoom out to 80% for visual feedback
                  graphRef.current.zoom(currentZoom * 0.8, 300);
                  // Then zoom back to original level
                  setTimeout(() => {
                    if (graphRef.current?.zoom) {
                      graphRef.current.zoom(currentZoom, 300);
                    }
                  }, 400);
                }
              }, 200);
            } catch (e) {
              console.error("Error during graph zoom animation:", e);
            }
          }
          
          console.log("Graph data and UI successfully refreshed");
        }
      } catch (fetchError) {
        console.error("Error during direct fetch:", fetchError);
      }
      
      console.log("============ GRAPH RELOAD COMPLETE ============");
      return true;
    } catch (error) {
      console.error("Error in reloadGraph:", error);
      // Last resort fallback - just invalidate queries
      try {
        const graphId = getGraphId();
        if (graphId) {
          await queryClient.invalidateQueries({ queryKey: [`/api/graphs/${graphId}`] });
          
          // Call refresh requested callback if provided
          if (onRefreshRequested) {
            onRefreshRequested();
          }
        }
      } catch (e) {
        console.error("Even fallback invalidation failed:", e);
      }
      return false;
    }
  };

  const handleUpdateNode = async () => {
    console.log("==================== HANDLE UPDATE NODE ====================");
    console.log("handleUpdateNode called - Initial state:", { 
      selectedNode, 
      graphId: knowledgeGraph?.id, 
      isEditNodeDialogOpen 
    });
    
    // Make sure we have a valid graphId using our reliable getter function
    const graphId = getGraphId();
    console.log("Retrieved graph ID:", graphId);
    
    if (!selectedNode || !graphId) {
      console.error("Missing required data:", { selectedNode, graphId });
      toast({
        variant: "destructive",
        title: "Cannot update entity",
        description: "Missing required data: node ID or graph ID"
      });
      setIsEditNodeDialogOpen(false);
      return;
    }
    
    setIsLoading(true);
    console.log("Loading state set to true");
    
    try {
      console.log("Updating node:", selectedNode);
      
      // Create a timestamp for the update
      const now = new Date().toISOString();
      const nodeToUpdate = {
        ...selectedNode,
        timestamp: now,
      };
      
      // Get graphId using our reliable function
      const safeGraphId = getGraphId();
      
      console.log("Node data to update:", nodeToUpdate);
      console.log("API URL:", `/api/graphs/${safeGraphId}/nodes/${selectedNode.id}`);
      
      const response = await apiRequest(
        'PUT',
        `/api/graphs/${safeGraphId}/nodes/${selectedNode.id}`,
        nodeToUpdate
      );
      
      // Parse the response to JSON
      const responseData = await response.json();
      console.log("Update node response:", responseData);
      
      if (responseData.success) {
        console.log("Update successful, reloading graph data");
        // Reload graph using our helper function
        await reloadGraph();
        
        // Close dialog and reset state before showing success message
        console.log("Closing dialog and resetting state");
        setIsEditNodeDialogOpen(false);
        setSelectedNode(null);
        
        toast({
          title: "Entity updated successfully",
          description: `The entity "${nodeToUpdate.name}" has been updated.`,
        });
        console.log("Success toast displayed");
      } else {
        console.error("Update failed with error from server:", responseData);
        throw new Error(responseData.message || "Failed to update entity");
      }
    } catch (error) {
      console.error("Error updating node:", error);
      console.error("Error details:", error instanceof Error ? error.message : "Unknown error");
      toast({
        variant: "destructive",
        title: "Failed to update entity",
        description: "There was an error updating the entity. Please try again."
      });
      console.log("Error toast displayed");
    } finally {
      console.log("Setting loading state to false");
      setIsLoading(false);
    }
  };
  
  const handleAddNode = async () => {
    console.log("==================== HANDLE ADD NODE ====================");
    console.log("handleAddNode called - Initial state:", { 
      selectedNode, 
      graphId: knowledgeGraph?.id, 
      isAddNodeDialogOpen 
    });
    
    // Make sure we have a valid graphId using our reliable getter function
    const graphId = getGraphId();
    console.log("Retrieved graph ID:", graphId);
    
    if (!selectedNode || !graphId) {
      console.error("Missing required data:", { selectedNode, graphId });
      toast({
        variant: "destructive",
        title: "Cannot add entity",
        description: "Missing required data: node data or graph ID"
      });
      setIsAddNodeDialogOpen(false);
      return;
    }
    
    setIsLoading(true);
    console.log("Loading state set to true");
    
    try {
      console.log("Adding new node:", selectedNode);
      
      // Create a timestamp for the new entity
      const now = new Date().toISOString();
      
      // Generate a proper ID if we have a placeholder (-1)
      let nodeId = selectedNode.id;
      if (nodeId === -1 && knowledgeGraph && knowledgeGraph.nodes) {
        // Find max ID and increment by 1 to avoid conflicts
        const maxId = Math.max(...knowledgeGraph.nodes.map(node => node.id), 0);
        nodeId = maxId + 1;
        console.log("Generated new ID:", nodeId, "from max ID:", maxId);
      } else if (nodeId === -1) {
        // Fallback if we don't have knowledgeGraph or nodes
        nodeId = Math.floor(Math.random() * 10000) + 1000; // Generate a random ID
        console.log("Generated fallback random ID:", nodeId);
      }
      
      const nodeToAdd = {
        ...selectedNode,
        id: nodeId,  // Use the generated ID
        dataSource: "manual",
        timestamp: now,
      };
      
      // Get graphId using our reliable function
      const safeGraphId = getGraphId();
      
      console.log("Node data to add:", nodeToAdd);
      console.log("API URL:", `/api/graphs/${safeGraphId}/nodes`);
      
      const response = await apiRequest(
        'POST',
        `/api/graphs/${safeGraphId}/nodes`,
        nodeToAdd
      );
      
      // Parse the response
      const responseData = await response.json();
      console.log("Add node response:", responseData);
      
      if (responseData.success) {
        console.log("Add successful, reloading graph data");
        // Reload graph using our helper function
        await reloadGraph();
        
        // Close dialog and reset state before showing success message
        console.log("Closing dialog and resetting state");
        setIsAddNodeDialogOpen(false);
        setSelectedNode(null);
        
        toast({
          title: "Entity added successfully",
          description: `The entity "${nodeToAdd.name}" has been added to the knowledge graph.`,
        });
        console.log("Success toast displayed");
      } else {
        console.error("Add failed with error from server:", responseData);
        throw new Error(responseData.message || "Failed to add entity");
      }
    } catch (error) {
      console.error("Error adding node:", error);
      console.error("Error details:", error instanceof Error ? error.message : "Unknown error");
      toast({
        variant: "destructive",
        title: "Failed to add entity",
        description: "There was an error adding the entity. Please try again."
      });
      console.log("Error toast displayed");
    } finally {
      console.log("Setting loading state to false");
      setIsLoading(false);
    }
  };
  
  const handleDeleteNode = async () => {
    console.log("==================== HANDLE DELETE NODE ====================");
    console.log("handleDeleteNode called - Initial state:", { 
      selectedNode, 
      graphId: knowledgeGraph?.id, 
      isDeleteConfirmDialogOpen 
    });
    
    // Make sure we have a valid graphId using our reliable getter function
    const graphId = getGraphId();
    console.log("Retrieved graph ID:", graphId);
    
    if (!selectedNode || !graphId) {
      console.error("Missing required data:", { selectedNode, graphId });
      toast({
        variant: "destructive",
        title: "Cannot delete entity",
        description: "Missing required data: node ID or graph ID"
      });
      setIsDeleteConfirmDialogOpen(false);
      return;
    }
    
    try {
      setIsLoading(true);
      console.log("Loading state set to true");
      
      // Get graphId using our reliable function
      const safeGraphId = getGraphId();
      
      console.log("About to delete node with ID:", selectedNode.id);
      console.log("Knowledge graph ID:", safeGraphId);
      console.log("Full node data:", JSON.stringify(selectedNode, null, 2));
      console.log("API URL:", `/api/graphs/${safeGraphId}/nodes/${selectedNode.id}`);
      
      // Make API call to delete the node
      const response = await apiRequest(
        'DELETE',
        `/api/graphs/${safeGraphId}/nodes/${selectedNode.id}`,
        undefined
      );
      
      console.log("DELETE request completed with status:", response.status);
      
      // Parse the response
      const responseData = await response.json();
      console.log("Delete node response data:", JSON.stringify(responseData, null, 2));
      
      if (responseData.success) {
        console.log("Delete successful, reloading graph data");
        
        // Store node name before resetting
        const deletedNodeName = selectedNode.name;
        
        // Close dialog and reset state
        console.log("Closing dialog and resetting state");
        setIsDeleteConfirmDialogOpen(false);
        setSelectedNode(null);
        
        // Reload graph using our helper function
        await reloadGraph();
        
        // Show success message
        toast({
          title: "Entity deleted successfully",
          description: `The entity "${deletedNodeName}" has been removed from the knowledge graph.`,
        });
        console.log("Success toast displayed for deleted node:", deletedNodeName);
      } else {
        console.error("Delete failed with error from server:", responseData);
        throw new Error(responseData.message || "Failed to delete entity");
      }
    } catch (error) {
      console.error("Error deleting node:", error);
      console.error("Error details:", error instanceof Error ? error.message : "Unknown error");
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace available");
      
      // Show error message to user
      toast({
        variant: "destructive",
        title: "Failed to delete entity",
        description: error instanceof Error 
          ? `Error: ${error.message}` 
          : "There was an error deleting the entity. Please try again."
      });
      console.log("Error toast displayed");
      
      // Still close the dialog even on error
      setIsDeleteConfirmDialogOpen(false);
    } finally {
      console.log("Setting loading state to false");
      console.log("==================== END HANDLE DELETE NODE ====================");
      setIsLoading(false);
    }
  };
  
  // Function to handle link/relation deletion
  const handleDeleteLink = async (link: SchemaLink) => {
    console.log("==================== HANDLE DELETE LINK ====================");
    console.log("handleDeleteLink called with link:", link);
    
    // Make sure we have a valid graphId using our reliable getter function
    const graphId = getGraphId();
    console.log("Retrieved graph ID:", graphId);
    
    if (!link || !graphId) {
      console.error("Missing required data:", { link, graphId });
      toast({
        variant: "destructive",
        title: "Cannot delete relation",
        description: "Missing required data: link source/target or graph ID"
      });
      return;
    }
    
    try {
      setIsLoading(true);
      console.log("Loading state set to true");
      
      // Get graphId using our reliable function
      const safeGraphId = getGraphId();
      
      console.log("About to delete link:", {
        source: link.source,
        target: link.target,
        label: link.label
      });
      console.log("Knowledge graph ID:", safeGraphId);
      
      // The API expects source and target as query parameters
      const queryParams = new URLSearchParams({
        source: link.source.toString(),
        target: link.target.toString()
      });
      
      // Make API call to delete the link
      const response = await apiRequest(
        'DELETE',
        `/api/graphs/${safeGraphId}/links?${queryParams.toString()}`,
        undefined
      );
      
      console.log("DELETE request completed with status:", response.status);
      
      // Parse the response
      const responseData = await response.json();
      console.log("Delete link response data:", JSON.stringify(responseData, null, 2));
      
      if (responseData.success) {
        console.log("Delete successful, reloading graph data");
        
        // Store link label before resetting
        const deletedLinkLabel = link.label;
        
        // Reset state
        setSelectedLink(null);
        
        // Reload graph using our helper function
        await reloadGraph();
        
        // Show success message
        toast({
          title: "Relation deleted successfully",
          description: `The relation "${deletedLinkLabel}" has been removed from the knowledge graph.`,
        });
        console.log("Success toast displayed for deleted link with label:", deletedLinkLabel);
      } else {
        console.error("Delete failed with error from server:", responseData);
        throw new Error(responseData.message || "Failed to delete relation");
      }
    } catch (error) {
      console.error("Error deleting link:", error);
      console.error("Error details:", error instanceof Error ? error.message : "Unknown error");
      
      // Show error message to user
      toast({
        variant: "destructive",
        title: "Failed to delete relation",
        description: error instanceof Error 
          ? `Error: ${error.message}` 
          : "There was an error deleting the relation. Please try again."
      });
      console.log("Error toast displayed");
    } finally {
      console.log("Setting loading state to false");
      console.log("==================== END HANDLE DELETE LINK ====================");
      setIsLoading(false);
    }
  };

  const handleUpdateLink = async () => {
    console.log("==================== HANDLE UPDATE LINK ====================");
    console.log("handleUpdateLink called - Initial state:", { 
      selectedLink, 
      graphId: knowledgeGraph?.id, 
      isEditLinkDialogOpen 
    });
    
    // Make sure we have a valid graphId using our reliable getter function
    const graphId = getGraphId();
    console.log("Retrieved graph ID:", graphId);
    
    if (!selectedLink || !graphId) {
      console.error("Missing required data:", { selectedLink, graphId });
      toast({
        variant: "destructive",
        title: "Cannot update relation",
        description: "Missing required data: relation data or graph ID"
      });
      setIsEditLinkDialogOpen(false);
      return;
    }
    
    setIsLoading(true);
    console.log("Loading state set to true");
    
    try {
      console.log("Updating link:", selectedLink);
      
      // Store the original source and target before any potential changes
      const originalSource = selectedLink.source;
      const originalTarget = selectedLink.target;
      
      // For updating a link, the server expects originalSource, originalTarget, and updatedLink
      const updateData = {
        originalSource,
        originalTarget,
        updatedLink: {
          ...selectedLink,
          // Ensure timestamp is updated
          timestamp: new Date().toISOString()
        }
      };
      
      // Get graphId using our reliable function
      const safeGraphId = getGraphId();
      
      console.log("Sending update data:", updateData);
      console.log("API URL:", `/api/graphs/${safeGraphId}/links`);
      
      const response = await apiRequest(
        'PUT',
        `/api/graphs/${safeGraphId}/links`,
        updateData
      );
      
      // Parse the response
      const responseData = await response.json();
      console.log("Update link response:", responseData);
      
      if (responseData.success) {
        console.log("Update successful, reloading graph data");
        // Reload graph using our helper function
        await reloadGraph();
        
        // Close dialog and reset state before showing success message
        console.log("Closing dialog and resetting state");
        setIsEditLinkDialogOpen(false);
        setSelectedLink(null);
        
        toast({
          title: "Relation updated successfully",
          description: `The relation has been updated.`,
        });
        console.log("Success toast displayed");
      } else {
        console.error("Update failed with error from server:", responseData);
        throw new Error(responseData.message || "Failed to update relation");
      }
    } catch (error) {
      console.error("Error updating link:", error);
      console.error("Error details:", error instanceof Error ? error.message : "Unknown error");
      toast({
        variant: "destructive",
        title: "Failed to update relation",
        description: "There was an error updating the relation. Please try again."
      });
      console.log("Error toast displayed");
    } finally {
      console.log("Setting loading state to false");
      setIsLoading(false);
    }
  };
  
  const handleAddLink = async () => {
    console.log("==================== HANDLE ADD LINK ====================");
    console.log("handleAddLink called - Initial state:", { 
      selectedLink, 
      graphId: knowledgeGraph?.id, 
      isAddLinkDialogOpen 
    });
    
    // Make sure we have a valid graphId using our reliable getter function
    const graphId = getGraphId();
    console.log("Retrieved graph ID:", graphId);
    
    if (!selectedLink || !graphId) {
      console.error("Missing required data:", { selectedLink, graphId });
      toast({
        variant: "destructive",
        title: "Cannot add relation",
        description: "Missing required data: relation data or graph ID"
      });
      setIsAddLinkDialogOpen(false);
      return;
    }
    
    setIsLoading(true);
    console.log("Loading state set to true");
    
    try {
      console.log("Adding new link:", selectedLink);
      
      // Create a timestamp for the new relation
      const now = new Date().toISOString();
      const linkToAdd = {
        ...selectedLink,
        dataSource: "manual",
        timestamp: now,
        value: 1,  // Default value for new links
      };
      
      // Get graphId using our reliable function
      const safeGraphId = getGraphId();
      
      console.log("Link data to add:", linkToAdd);
      console.log("API URL:", `/api/graphs/${safeGraphId}/links`);
      
      const response = await apiRequest(
        'POST',
        `/api/graphs/${safeGraphId}/links`,
        linkToAdd
      );
      
      // Parse the response
      const responseData = await response.json();
      console.log("Add link response:", responseData);
      
      if (responseData.success) {
        console.log("Add successful, reloading graph data");
        // Reload graph using our helper function
        await reloadGraph();
        
        // Close dialog and reset state before showing success message
        console.log("Closing dialog and resetting state");
        setIsAddLinkDialogOpen(false);
        setSelectedLink(null);
        
        toast({
          title: "Relation added successfully",
          description: `The relation has been added to the knowledge graph.`,
        });
        console.log("Success toast displayed");
      } else {
        console.error("Add failed with error from server:", responseData);
        throw new Error(responseData.message || "Failed to add relation");
      }
    } catch (error) {
      console.error("Error adding link:", error);
      console.error("Error details:", error instanceof Error ? error.message : "Unknown error");
      toast({
        variant: "destructive",
        title: "Failed to add relation",
        description: "There was an error adding the relation. Please try again."
      });
      console.log("Error toast displayed");
    } finally {
      console.log("Setting loading state to false");
      setIsLoading(false);
    }
  };

  // Filter functions for search
  // Get all filtered entities (without pagination)
  const getAllFilteredEntities = () => {
    // Remove the console.log statement that was causing excessive logging
    
    if (!knowledgeGraph?.nodes || !Array.isArray(knowledgeGraph.nodes)) return [];
    if (!searchTerm.trim()) return knowledgeGraph.nodes;

    return knowledgeGraph.nodes.filter((node) =>
      node.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  };
  
  // Get paginated entities for display
  const getFilteredEntities = () => {
    const allEntities = getAllFilteredEntities();
    const startIndex = (entitiesPage - 1) * entitiesPageSize;
    const endIndex = startIndex + entitiesPageSize;
    return allEntities.slice(startIndex, endIndex);
  };
  
  // Get total pages for entities
  const getEntitiesPageCount = () => {
    const allEntities = getAllFilteredEntities();
    return Math.ceil(allEntities.length / entitiesPageSize);
  };

  // Get all filtered relations (without pagination)
  const getAllFilteredRelations = () => {
    // Removed console.log that was causing excessive logging
    
    if (!knowledgeGraph?.links || !knowledgeGraph?.nodes) return [];
    if (!searchTerm.trim()) return getRelationshipTypes();

    const nodeMap = new Map<number, string>();
    knowledgeGraph.nodes.forEach((node) => {
      nodeMap.set(node.id, node.name);
    });

    const filteredLinks = knowledgeGraph.links.filter((link) => {
      const source = nodeMap.get(link.source) || "";
      const target = nodeMap.get(link.target) || "";
      return (
        source.toLowerCase().includes(searchTerm.toLowerCase()) ||
        target.toLowerCase().includes(searchTerm.toLowerCase()) ||
        link.label.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });

    // Count relationships in filtered links
    const relationCounts: Record<
      string,
      {
        label: string;
        count: number;
        dataSources: Record<string, number>;
        firstTimestamp?: string;
      }
    > = {};

    // Get Wikidata property labels
    const wikidataLabels = getWikidataPropertyLabels();

    filteredLinks.forEach((link) => {
      // Translate Wikidata property IDs to human-readable labels
      let relationLabel = link.label;

      if (link.enriched && link.wikidataId && wikidataLabels[link.wikidataId]) {
        relationLabel = wikidataLabels[link.wikidataId];
      }

      if (!relationCounts[relationLabel]) {
        relationCounts[relationLabel] = {
          label: relationLabel,
          count: 0,
          dataSources: {},
          firstTimestamp: link.timestamp,
        };
      }

      // Increment the count
      relationCounts[relationLabel].count++;

      // Track data sources
      const source = link.dataSource || "unknown";
      if (!relationCounts[relationLabel].dataSources[source]) {
        relationCounts[relationLabel].dataSources[source] = 0;
      }
      relationCounts[relationLabel].dataSources[source]++;

      // Track earliest timestamp
      if (link.timestamp) {
        const count = relationCounts[relationLabel];
        if (!count.firstTimestamp || link.timestamp < count.firstTimestamp) {
          relationCounts[relationLabel].firstTimestamp = link.timestamp;
        }
      }
    });

    return Object.values(relationCounts).sort((a, b) => b.count - a.count);
  };
  
  // Get paginated relations for display
  const getFilteredRelations = () => {
    const allRelations = getAllFilteredRelations();
    const startIndex = (relationsPage - 1) * relationsPageSize;
    const endIndex = startIndex + relationsPageSize;
    return allRelations.slice(startIndex, endIndex);
  };
  
  // Get total pages for relations
  const getRelationsPageCount = () => {
    const allRelations = getAllFilteredRelations();
    return Math.ceil(allRelations.length / relationsPageSize);
  };

  // Get all filtered triples (without pagination)
  const getAllFilteredTriples = (): Triple[] => {
    // Removed console.log that was causing excessive logging
    
    if (!knowledgeGraph?.links || !knowledgeGraph?.nodes) return [];
    if (!searchTerm.trim()) return getTriples();

    const nodeMap = new Map<number, string>();
    knowledgeGraph.nodes.forEach((node) => {
      nodeMap.set(node.id, node.name);
    });

    return knowledgeGraph.links
      .filter((link) => {
        const source = nodeMap.get(link.source) || "";
        const target = nodeMap.get(link.target) || "";
        return (
          source.toLowerCase().includes(searchTerm.toLowerCase()) ||
          target.toLowerCase().includes(searchTerm.toLowerCase()) ||
          link.label.toLowerCase().includes(searchTerm.toLowerCase())
        );
      })
      .map((link) => {
        // Get Wikidata property labels
        const wikidataLabels = getWikidataPropertyLabels();

        // Translate Wikidata property IDs to human-readable labels
        let predicate = link.label;

        if (
          link.enriched &&
          link.wikidataId &&
          wikidataLabels[link.wikidataId]
        ) {
          predicate = wikidataLabels[link.wikidataId];
        }

        return {
          subject: nodeMap.get(link.source) || `Entity ${link.source}`,
          predicate: predicate,
          object: nodeMap.get(link.target) || `Entity ${link.target}`,
          dataSource: link.dataSource,
          timestamp: link.timestamp,
          enriched: link.enriched,
          properties: {
            source: link.dataSource,
            timestamp: link.timestamp
          }
        };
      });
  };
  
  // Get paginated triples for display
  const getFilteredTriples = (): Triple[] => {
    const allTriples = getAllFilteredTriples();
    const startIndex = (triplesPage - 1) * triplesPageSize;
    const endIndex = startIndex + triplesPageSize;
    return allTriples.slice(startIndex, endIndex);
  };
  
  // Get total pages for triples
  const getTriplesPageCount = () => {
    const allTriples = getAllFilteredTriples();
    return Math.ceil(allTriples.length / triplesPageSize);
  };

  // Empty state render function
  const renderEmptyState = () => (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <Network className="h-12 w-12 text-gray-500 mb-4" />
      <h3 className="text-lg font-medium text-gray-400 mb-2">
        No Knowledge Graph Yet
      </h3>
      <p className="text-sm text-gray-500 max-w-sm">
        Enter some text in the input panel and click "Generate Knowledge Graph"
        to visualize entities and relationships.
      </p>
    </div>
  );

  // Search UI for the explorer
  const renderSearchBar = () => (
    <div className="mb-4">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
        <Input
          type="text"
          placeholder="Search entities, relations..."
          className="pl-9 bg-gray-800 border-gray-700 text-gray-200"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
    </div>
  );

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {!knowledgeGraph ? (
        renderEmptyState()
      ) : (
        <AnimatedGradientBackground
          className="h-full w-full px-4"
          speed={30}
          intensity={0.1}
        >
          {/* Only render search bar if controls are not hidden */}
          {!hideControls && renderSearchBar()}

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-grow flex flex-col"
          >
            {/* Only render tab controls if hideControls is false */}
            {!hideControls && (
              <div className="flex justify-between items-center mb-4">
                <TabsList className="grid grid-cols-2 sm:grid-cols-5 overflow-x-auto">
                  <TabsTrigger
                    value="graph"
                    className="flex items-center space-x-1"
                  >
                    <Network className="h-4 w-4 mr-1" />
                    <span>Graph</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="entities"
                    className="flex items-center space-x-1"
                  >
                    <List className="h-4 w-4 mr-1" />
                    <span>Entities</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="relations"
                    className="flex items-center space-x-1"
                  >
                    <BarChart4 className="h-4 w-4 mr-1" />
                    <span>Relations</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="triples"
                    className="flex items-center space-x-1"
                  >
                    <Database className="h-4 w-4 mr-1" />
                    <span>Triples</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="schema"
                    className="flex items-center space-x-1"
                  >
                    <FileJson className="h-4 w-4 mr-1" />
                    <span>Schema</span>
                  </TabsTrigger>
                </TabsList>
              </div>
            )}

            <TabsContent value="graph" className="flex-grow flex pt-0 kg-scrollbar">
              <div className="w-full relative h-full">
                <GraphVisualization
                  knowledgeGraph={knowledgeGraph}
                  ref={graphRef}
                  onNodeClick={onNodeClick}
                />
              </div>
            </TabsContent>

            <TabsContent
              value="entities"
              className="pt-0 h-full flex flex-col overflow-hidden kg-scrollbar"
            >
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-4">
                  <h3 className="text-xl font-semibold">Entities</h3>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="page-size" className="text-xs">Page size:</Label>
                    <Select 
                      value={entitiesPageSize.toString()} 
                      onValueChange={(value) => {
                        setEntitiesPageSize(parseInt(value));
                        setEntitiesPage(1); // Reset to first page when changing page size
                      }}
                    >
                      <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue placeholder="10" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    console.log("Add Entity button clicked");
                    setSelectedNode({ id: -1, name: "", group: 3 });
                    console.log("Selected node set to empty entity template");
                    setIsAddNodeDialogOpen(true);
                    console.log("Add node dialog opened");
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Entity
                </Button>
              </div>
              <div style={{ maxHeight: "calc(80vh - 200px)", overflowY: "scroll", overflowX: "auto" }} className="force-scrollbar kg-scrollbar flex-1 min-h-[300px] pb-16 border border-purple-400/10 hover:border-purple-400/20 transition-colors duration-300">
                <Table className="relative">
                  <TableHeader className="sticky top-0 bg-gray-900 z-10">
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getFilteredEntities().map((entity) => (
                      <TableRow key={entity.id}>
                        <TableCell className="font-medium">
                          {entity.name}
                        </TableCell>
                        <TableCell>
                          <span
                            className="px-2 py-1 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: `${getEntityColor(entity.group)}22`,
                              color: getEntityColor(entity.group),
                              border: `1px solid ${getEntityColor(entity.group)}44`,
                            }}
                          >
                            {getEntityTypeName(entity.group)}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {entity.description || "-"}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                              normalizeDataSource(
                                (entity.properties?.source || entity.dataSource),
                                entity.enriched,
                              ) === "wikidata"
                                ? "bg-indigo-900 text-indigo-200"
                                : "bg-gray-700 text-gray-200"
                            }`}
                          >
                            {normalizeDataSource(
                              (entity.properties?.source || entity.dataSource),
                              entity.enriched,
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-gray-400">
                          {entity.properties?.timestamp || entity.timestamp || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                console.log("Edit entity button clicked:", entity);
                                setSelectedNode(entity);
                                console.log("Selected node set:", entity);
                                setIsEditNodeDialogOpen(true);
                                console.log("Edit node dialog opened");
                              }}
                              title="Edit entity"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                console.log("Delete entity button clicked:", entity);
                                setSelectedNode(entity);
                                console.log("Selected node set:", entity);
                                setIsDeleteConfirmDialogOpen(true);
                                console.log("Delete confirm dialog opened");
                              }}
                              title="Delete entity"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {/* Pagination for entities */}
                {getEntitiesPageCount() > 1 && (
                  <div className="flex justify-center my-4">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => setEntitiesPage(prev => Math.max(prev - 1, 1))} 
                            className={entitiesPage <= 1 ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                        
                        {Array.from({ length: getEntitiesPageCount() }).map((_, i) => (
                          <PaginationItem key={i}>
                            <PaginationLink
                              onClick={() => setEntitiesPage(i + 1)}
                              isActive={entitiesPage === i + 1}
                            >
                              {i + 1}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        
                        <PaginationItem>
                          <PaginationNext 
                            onClick={() => setEntitiesPage(prev => Math.min(prev + 1, getEntitiesPageCount()))}
                            className={entitiesPage >= getEntitiesPageCount() ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent
              value="relations"
              className="pt-0 h-full flex flex-col overflow-hidden kg-scrollbar"
            >
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-4">
                  <h3 className="text-xl font-semibold">Relations</h3>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="relations-page-size" className="text-xs">Page size:</Label>
                    <Select 
                      value={relationsPageSize.toString()} 
                      onValueChange={(value) => {
                        setRelationsPageSize(parseInt(value));
                        setRelationsPage(1); // Reset to first page when changing page size
                      }}
                    >
                      <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue placeholder="10" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    console.log("Add Relation button clicked");
                    setSelectedLink({ source: -1, target: -1, value: 1, label: "" });
                    console.log("Selected link set to empty relation template");
                    setIsAddLinkDialogOpen(true);
                    console.log("Add link dialog opened");
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Relation
                </Button>
              </div>
              <div style={{ maxHeight: "calc(80vh - 200px)", overflowY: "scroll", overflowX: "auto" }} className="force-scrollbar kg-scrollbar flex-1 min-h-[300px] pb-16 border border-purple-400/10 hover:border-purple-400/20 transition-colors duration-300">
                <Table className="relative">
                  <TableHeader className="sticky top-0 bg-gray-900 z-10">
                    <TableRow>
                      <TableHead>Relation</TableHead>
                      <TableHead>Count</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getFilteredRelations().map((relation) => (
                      <TableRow key={relation.label}>
                        <TableCell className="font-medium">
                          {relation.label}
                        </TableCell>
                        <TableCell>{relation.count}</TableCell>
                        <TableCell>
                          {relation.dataSources &&
                            Object.entries(relation.dataSources).map(
                              ([source, count]) => (
                                <span
                                  key={source}
                                  className={`inline-block mr-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                                    source === "wikidata"
                                      ? "bg-indigo-900 text-indigo-200"
                                      : "bg-gray-700 text-gray-200"
                                  } capitalize`}
                                >
                                  {source} ({count})
                                </span>
                              ),
                            )}
                        </TableCell>
                        <TableCell className="text-xs text-gray-400">
                          {relation.firstTimestamp || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                console.log("Edit relation button clicked:", relation);
                                // Find a sample link with this relation to use as a template
                                const sampleLink = knowledgeGraph?.links.find(link => link.label === relation.label);
                                console.log("Found sample link for relation:", sampleLink);
                                if (sampleLink) {
                                  setSelectedLink(sampleLink);
                                  console.log("Selected link set:", sampleLink);
                                  setIsEditLinkDialogOpen(true);
                                  console.log("Edit link dialog opened");
                                } else {
                                  console.error("No sample link found for relation:", relation.label);
                                }
                              }}
                              title="Edit relation"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Delete relation"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Relation</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete all "{relation.label}" relations?
                                    This action cannot be undone and will remove {relation.count} connections from the graph.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => {
                                      console.log("Delete relation confirmed:", relation);
                                      // Find a sample link with this relation to use as a template
                                      const sampleLink = knowledgeGraph?.links.find(link => link.label === relation.label);
                                      console.log("Found sample link for relation:", sampleLink);
                                      if (sampleLink) {
                                        setSelectedLink(sampleLink);
                                        console.log("Selected link set for deletion:", sampleLink);
                                        // Use an async IIFE (Immediately Invoked Function Expression) to handle deletion
                                      (async () => {
                                        try {
                                          setIsLoading(true);
                                          console.log("About to delete link:", sampleLink);
                                          
                                          // Get graphId using our reliable function
                                          const safeGraphId = getGraphId();
                                          
                                          if (!safeGraphId) {
                                            console.error("Missing graph ID");
                                            toast({
                                              variant: "destructive",
                                              title: "Cannot delete relation",
                                              description: "Missing graph ID"
                                            });
                                            return;
                                          }
                                          
                                          // The API expects source and target as query parameters
                                          const queryParams = new URLSearchParams({
                                            source: sampleLink.source.toString(),
                                            target: sampleLink.target.toString()
                                          });
                                          
                                          // Make API call to delete the link
                                          const response = await apiRequest(
                                            'DELETE',
                                            `/api/graphs/${safeGraphId}/links?${queryParams.toString()}`,
                                            undefined
                                          );
                                          
                                          // Parse the response
                                          const responseData = await response.json();
                                          console.log("Delete link response data:", responseData);
                                          
                                          if (responseData.success) {
                                            // Store link label before resetting
                                            const deletedLinkLabel = sampleLink.label;
                                            
                                            // Reset state
                                            setSelectedLink(null);
                                            
                                            // Reload graph
                                            await reloadGraph();
                                            
                                            // Show success message
                                            toast({
                                              title: "Relation deleted successfully",
                                              description: `The relation "${deletedLinkLabel}" has been removed from the knowledge graph.`,
                                            });
                                          } else {
                                            throw new Error(responseData.message || "Failed to delete relation");
                                          }
                                        } catch (error) {
                                          console.error("Error deleting link:", error);
                                          
                                          // Show error message to user
                                          toast({
                                            variant: "destructive",
                                            title: "Failed to delete relation",
                                            description: error instanceof Error 
                                              ? `Error: ${error.message}` 
                                              : "There was an error deleting the relation. Please try again."
                                          });
                                        } finally {
                                          setIsLoading(false);
                                        }
                                      })();
                                      } else {
                                        console.error("No sample link found for relation:", relation.label);
                                        toast({
                                          variant: "destructive",
                                          title: "Cannot delete relation",
                                          description: "Could not find a relation with this label."
                                        });
                                      }
                                    }}
                                    className="bg-red-500 hover:bg-red-600"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {/* Pagination for relations */}
                {getRelationsPageCount() > 1 && (
                  <div className="flex justify-center my-4">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => setRelationsPage(prev => Math.max(prev - 1, 1))} 
                            className={relationsPage <= 1 ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                        
                        {Array.from({ length: getRelationsPageCount() }).map((_, i) => (
                          <PaginationItem key={i}>
                            <PaginationLink
                              onClick={() => setRelationsPage(i + 1)}
                              isActive={relationsPage === i + 1}
                            >
                              {i + 1}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        
                        <PaginationItem>
                          <PaginationNext 
                            onClick={() => setRelationsPage(prev => Math.min(prev + 1, getRelationsPageCount()))}
                            className={relationsPage >= getRelationsPageCount() ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent
              value="triples"
              className="pt-0 h-full flex flex-col overflow-hidden kg-scrollbar"
            >
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                  <h3 className="text-xl font-semibold">Triples</h3>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    console.log("Add Triple button clicked");
                    // Initialize a new empty triple for the add form
                    setSelectedTriple({
                      subject: "",
                      predicate: "",
                      object: "",
                      dataSource: "manual",
                      timestamp: new Date().toISOString()
                    });
                    console.log("Selected triple set to empty triple template");
                    setIsAddTripleDialogOpen(true);
                    console.log("Add triple dialog opened");
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Triple
                </Button>
              </div>
              <div style={{ maxHeight: "calc(80vh - 200px)", overflowY: "scroll", overflowX: "auto" }} className="force-scrollbar kg-scrollbar flex-1 min-h-[300px] pb-16 border border-purple-400/10 hover:border-purple-400/20 transition-colors duration-300">
                <Table className="relative">
                  <TableHeader className="sticky top-0 bg-gray-900 z-10">
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Predicate</TableHead>
                      <TableHead>Object</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {getFilteredTriples().map((triple, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {triple.subject}
                      </TableCell>
                      <TableCell className="font-medium">
                        {triple.predicate}
                      </TableCell>
                      <TableCell>{triple.object}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            normalizeDataSource(
                              triple.dataSource,
                              triple.enriched,
                            ) === "wikidata"
                              ? "bg-indigo-900 text-indigo-200"
                              : "bg-gray-700 text-gray-200"
                          } capitalize`}
                        >
                          {normalizeDataSource(
                            triple.dataSource,
                            triple.enriched,
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              console.log("Edit triple button clicked:", triple);
                              setSelectedTriple(triple);
                              console.log("Selected triple set:", triple);
                              setIsEditTripleDialogOpen(true);
                              console.log("Edit triple dialog opened");
                            }}
                            title="Edit triple"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Delete triple"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Triple</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this triple?<br/>
                                  <strong>Subject:</strong> {triple.subject}<br/>
                                  <strong>Predicate:</strong> {triple.predicate}<br/>
                                  <strong>Object:</strong> {triple.object}<br/><br/>
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => {
                                    console.log("Delete triple confirmed:", triple);
                                    // Get the link data from the triple
                                    (async () => {
                                      try {
                                        setIsLoading(true);
                                        
                                        // Get graphId using our reliable function
                                        const safeGraphId = getGraphId();
                                        
                                        if (!safeGraphId) {
                                          console.error("Missing graph ID");
                                          toast({
                                            variant: "destructive",
                                            title: "Cannot delete triple",
                                            description: "Missing graph ID"
                                          });
                                          return;
                                        }
                                        
                                        // Find the corresponding link by subject-predicate-object
                                        const linkToDelete = findLinkFromTriple(triple);
                                        
                                        if (!linkToDelete) {
                                          console.error("Could not find corresponding link for triple");
                                          toast({
                                            variant: "destructive",
                                            title: "Cannot delete triple",
                                            description: "Could not find corresponding link in the graph"
                                          });
                                          return;
                                        }
                                        
                                        // The API expects source and target as query parameters
                                        const queryParams = new URLSearchParams({
                                          source: linkToDelete.source.toString(),
                                          target: linkToDelete.target.toString()
                                        });
                                        
                                        // Make API call to delete the link
                                        const response = await apiRequest(
                                          'DELETE',
                                          `/api/graphs/${safeGraphId}/links?${queryParams.toString()}`,
                                          undefined
                                        );
                                        
                                        // Parse the response
                                        const responseData = await response.json();
                                        console.log("Delete triple response data:", responseData);
                                        
                                        if (responseData.success) {
                                          // Reload graph
                                          await reloadGraph();
                                          
                                          // Show success message
                                          toast({
                                            title: "Triple deleted successfully",
                                            description: `The triple has been removed from the knowledge graph.`,
                                          });
                                        } else {
                                          throw new Error(responseData.message || "Failed to delete triple");
                                        }
                                      } catch (error) {
                                        console.error("Error deleting triple:", error);
                                        
                                        // Show error message to user
                                        toast({
                                          variant: "destructive",
                                          title: "Failed to delete triple",
                                          description: error instanceof Error 
                                            ? `Error: ${error.message}` 
                                            : "There was an error deleting the triple. Please try again."
                                        });
                                      } finally {
                                        setIsLoading(false);
                                      }
                                    })();
                                  }}
                                  className="bg-red-500 hover:bg-red-600"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
                
                {/* Pagination for triples */}
                {getTriplesPageCount() > 1 && (
                  <div className="flex justify-center my-4">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => setTriplesPage(prev => Math.max(prev - 1, 1))} 
                            className={triplesPage <= 1 ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                        
                        {Array.from({ length: getTriplesPageCount() }).map((_, i) => (
                          <PaginationItem key={i}>
                            <PaginationLink
                              onClick={() => setTriplesPage(i + 1)}
                              isActive={triplesPage === i + 1}
                            >
                              {i + 1}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        
                        <PaginationItem>
                          <PaginationNext 
                            onClick={() => setTriplesPage(prev => Math.min(prev + 1, getTriplesPageCount()))}
                            className={triplesPage >= getTriplesPageCount() ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent
              value="schema"
              className="pt-0 h-full flex flex-col overflow-hidden kg-scrollbar"
            >
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                  <h3 className="text-xl font-semibold">Schema</h3>
                </div>
              </div>
              <div style={{ maxHeight: "calc(80vh - 200px)", overflowY: "scroll", overflowX: "auto" }} className="space-y-8 force-scrollbar kg-scrollbar flex-1 min-h-[300px] pb-16 border border-purple-400/10 hover:border-purple-400/20 transition-colors duration-300">
                {inferSchema().map((classInfo) => (
                  <div key={classInfo.className} className="bg-gray-800 rounded-lg p-4">
                    <h3 className="text-lg font-medium mb-2 flex items-center">
                      <span
                        className="inline-block w-3 h-3 rounded-full mr-2"
                        style={{
                          backgroundColor: getEntityColor(
                            getEntityCategories().find(
                              (cat) => cat.name === classInfo.className,
                            )?.group || 0,
                          ),
                        }}
                      ></span>
                      {classInfo.className}{" "}
                      <span className="ml-2 text-sm font-normal text-gray-400">
                        ({classInfo.instances} instances)
                      </span>
                    </h3>
                    <div className="border-t border-gray-700 mt-2 pt-2">
                      <h4 className="text-sm font-medium text-gray-300 mb-2">
                        Properties:
                      </h4>
                      {Object.entries(classInfo.properties).length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {Object.entries(classInfo.properties).map(
                            ([property, info]) => (
                              <div
                                key={property}
                                className="flex justify-between items-center bg-gray-700 bg-opacity-50 px-3 py-2 rounded"
                              >
                                <div>
                                  <span className="font-medium">{property}</span>
                                  <span className="text-xs text-gray-400 block">
                                    Type: {info.type}
                                  </span>
                                </div>
                                <span className="text-xs bg-gray-600 px-2 py-1 rounded-full">
                                  {info.count}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 italic">
                          No properties found for this class.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </AnimatedGradientBackground>
      )}

      {/* Entity Edit Dialog */}
      <Dialog open={isEditNodeDialogOpen} onOpenChange={setIsEditNodeDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Entity</DialogTitle>
            <DialogDescription>
              Make changes to the selected entity. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          {selectedNode && (
            <div className="space-y-4 py-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Entity Name</Label>
                  <Input 
                    id="name" 
                    value={selectedNode.name}
                    onChange={(e) => setSelectedNode({...selectedNode, name: e.target.value})}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="type">Entity Type</Label>
                  <Select 
                    value={selectedNode.group.toString()} 
                    onValueChange={(value) => setSelectedNode({...selectedNode, group: parseInt(value)})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Person</SelectItem>
                      <SelectItem value="2">Place</SelectItem>
                      <SelectItem value="3">Concept</SelectItem>
                      <SelectItem value="4">Organization</SelectItem>
                      <SelectItem value="5">Date</SelectItem>
                      <SelectItem value="6">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description" 
                    value={selectedNode.description || ""}
                    onChange={(e) => setSelectedNode({...selectedNode, description: e.target.value})}
                    placeholder="Describe this entity..."
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditNodeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateNode} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entity Add Dialog */}
      <Dialog open={isAddNodeDialogOpen} onOpenChange={setIsAddNodeDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Entity</DialogTitle>
            <DialogDescription>
              Create a new entity to add to your knowledge graph.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="add-name">Entity Name</Label>
                <Input 
                  id="add-name" 
                  value={selectedNode?.name || ""}
                  onChange={(e) => {
                    if (selectedNode) {
                      setSelectedNode({...selectedNode, name: e.target.value});
                    } else {
                      setSelectedNode({ id: -1, name: e.target.value, group: 3 });
                    }
                  }}
                  placeholder="Enter entity name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-type">Entity Type</Label>
                <Select 
                  value={selectedNode?.group?.toString() || "3"} 
                  onValueChange={(value) => {
                    if (selectedNode) {
                      setSelectedNode({...selectedNode, group: parseInt(value)});
                    } else {
                      setSelectedNode({ id: -1, name: "", group: parseInt(value) });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Person</SelectItem>
                    <SelectItem value="2">Place</SelectItem>
                    <SelectItem value="3">Concept</SelectItem>
                    <SelectItem value="4">Organization</SelectItem>
                    <SelectItem value="5">Date</SelectItem>
                    <SelectItem value="6">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-description">Description</Label>
                <Textarea 
                  id="add-description" 
                  value={selectedNode?.description || ""}
                  onChange={(e) => {
                    if (selectedNode) {
                      setSelectedNode({...selectedNode, description: e.target.value});
                    } else {
                      setSelectedNode({ id: -1, name: "", group: 3, description: e.target.value });
                    }
                  }}
                  placeholder="Describe this entity..."
                  rows={3}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsAddNodeDialogOpen(false);
              setSelectedNode(null);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddNode} 
              disabled={isLoading || !selectedNode?.name}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Entity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Edit Dialog */}
      <Dialog open={isEditLinkDialogOpen} onOpenChange={setIsEditLinkDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Relation</DialogTitle>
            <DialogDescription>
              Make changes to the selected relation. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          {selectedLink && knowledgeGraph?.nodes && (
            <div className="space-y-4 py-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="relation-name">Relation Label</Label>
                  <Input 
                    id="relation-name" 
                    value={selectedLink.label}
                    onChange={(e) => setSelectedLink({...selectedLink, label: e.target.value})}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="source-entity">Source Entity</Label>
                  <Select 
                    value={selectedLink.source.toString()} 
                    onValueChange={(value) => setSelectedLink({
                      ...selectedLink, 
                      source: parseInt(value)
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select source entity" />
                    </SelectTrigger>
                    <SelectContent>
                      {knowledgeGraph.nodes.map(node => (
                        <SelectItem key={node.id} value={node.id.toString()}>
                          {node.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="target-entity">Target Entity</Label>
                  <Select 
                    value={selectedLink.target.toString()} 
                    onValueChange={(value) => setSelectedLink({
                      ...selectedLink, 
                      target: parseInt(value)
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select target entity" />
                    </SelectTrigger>
                    <SelectContent>
                      {knowledgeGraph.nodes.map(node => (
                        <SelectItem key={node.id} value={node.id.toString()}>
                          {node.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateLink} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Triple Edit Dialog */}
      <Dialog open={isEditTripleDialogOpen} onOpenChange={setIsEditTripleDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Triple</DialogTitle>
            <DialogDescription>
              Make changes to the selected triple. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          {selectedTriple && (
            <div className="space-y-4 py-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input 
                    id="subject" 
                    value={selectedTriple.subject}
                    onChange={(e) => setSelectedTriple({...selectedTriple, subject: e.target.value})}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="predicate">Predicate (Relation)</Label>
                  <Input 
                    id="predicate" 
                    value={selectedTriple.predicate}
                    onChange={(e) => setSelectedTriple({...selectedTriple, predicate: e.target.value})}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="object">Object</Label>
                  <Input 
                    id="object" 
                    value={selectedTriple.object}
                    onChange={(e) => setSelectedTriple({...selectedTriple, object: e.target.value})}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditTripleDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                console.log("==================== HANDLE UPDATE TRIPLE ====================");
                console.log("Update triple button clicked with data:", selectedTriple);
                
                if (!selectedTriple) {
                  console.error("No triple selected for update");
                  toast({
                    variant: "destructive",
                    title: "Cannot update triple",
                    description: "No triple selected for update"
                  });
                  setIsEditTripleDialogOpen(false);
                  return;
                }
                
                try {
                  setIsLoading(true);
                  
                  // Get graphId using our reliable function
                  const safeGraphId = getGraphId();
                  
                  if (!safeGraphId) {
                    console.error("Missing graph ID");
                    toast({
                      variant: "destructive",
                      title: "Cannot update triple",
                      description: "Missing graph ID"
                    });
                    return;
                  }
                  
                  // Find the corresponding link for this triple
                  const originalLink = findLinkFromTriple(selectedTriple);
                  
                  if (!originalLink) {
                    console.error("Could not find corresponding link for triple");
                    toast({
                      variant: "destructive",
                      title: "Cannot update triple",
                      description: "Could not find corresponding link in the graph"
                    });
                    return;
                  }
                  
                  // Get node IDs for the updated subject and object
                  // First create a map of node names to IDs
                  const nodeNameToId = new Map<string, number>();
                  if (knowledgeGraph?.nodes) {
                    knowledgeGraph.nodes.forEach(node => {
                      nodeNameToId.set(node.name, node.id);
                    });
                  }
                  
                  // Get source and target IDs
                  const sourceId = nodeNameToId.get(selectedTriple.subject);
                  const targetId = nodeNameToId.get(selectedTriple.object);
                  
                  if (sourceId === undefined || targetId === undefined) {
                    toast({
                      variant: "destructive",
                      title: "Cannot update triple",
                      description: "The subject or object entities do not exist in the graph"
                    });
                    return;
                  }
                  
                  // Create the updated link object
                  const updatedLink = {
                    ...originalLink,
                    source: sourceId,
                    target: targetId,
                    label: selectedTriple.predicate,
                    timestamp: new Date().toISOString()
                  };
                  
                  // For updating a link, the server expects originalSource, originalTarget, and updatedLink
                  const updateData = {
                    originalSource: originalLink.source,
                    originalTarget: originalLink.target,
                    updatedLink
                  };
                  
                  console.log("Updating triple with link data:", updateData);
                  console.log("API URL:", `/api/graphs/${safeGraphId}/links`);
                  
                  const response = await apiRequest(
                    'PUT',
                    `/api/graphs/${safeGraphId}/links`,
                    updateData
                  );
                  
                  // Parse the response
                  const responseData = await response.json();
                  console.log("Update triple response:", responseData);
                  
                  if (responseData.success) {
                    // Reload graph
                    await reloadGraph();
                    
                    // Close dialog and reset state
                    setIsEditTripleDialogOpen(false);
                    setSelectedTriple(null);
                    
                    toast({
                      title: "Triple updated successfully",
                      description: `The triple has been updated.`,
                    });
                  } else {
                    throw new Error(responseData.message || "Failed to update triple");
                  }
                } catch (error) {
                  console.error("Error updating triple:", error);
                  
                  toast({
                    variant: "destructive",
                    title: "Failed to update triple",
                    description: error instanceof Error 
                      ? `Error: ${error.message}` 
                      : "There was an error updating the triple. Please try again."
                  });
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Triple Add Dialog */}
      <Dialog open={isAddTripleDialogOpen} onOpenChange={setIsAddTripleDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Triple</DialogTitle>
            <DialogDescription>
              Create a new triple to add to your knowledge graph.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="add-subject">Subject (Entity)</Label>
                <Input 
                  id="add-subject" 
                  value={selectedTriple?.subject || ""}
                  onChange={(e) => {
                    if (selectedTriple) {
                      setSelectedTriple({...selectedTriple, subject: e.target.value});
                    } else {
                      setSelectedTriple({
                        subject: e.target.value,
                        predicate: "",
                        object: "",
                        dataSource: "manual",
                        timestamp: new Date().toISOString()
                      });
                    }
                  }}
                  placeholder="Enter subject entity"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-predicate">Predicate (Relation)</Label>
                <Input 
                  id="add-predicate" 
                  value={selectedTriple?.predicate || ""}
                  onChange={(e) => {
                    if (selectedTriple) {
                      setSelectedTriple({...selectedTriple, predicate: e.target.value});
                    } else {
                      setSelectedTriple({
                        subject: "",
                        predicate: e.target.value,
                        object: "",
                        dataSource: "manual",
                        timestamp: new Date().toISOString()
                      });
                    }
                  }}
                  placeholder="Enter relation predicate"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-object">Object (Entity)</Label>
                <Input 
                  id="add-object" 
                  value={selectedTriple?.object || ""}
                  onChange={(e) => {
                    if (selectedTriple) {
                      setSelectedTriple({...selectedTriple, object: e.target.value});
                    } else {
                      setSelectedTriple({
                        subject: "",
                        predicate: "",
                        object: e.target.value,
                        dataSource: "manual",
                        timestamp: new Date().toISOString()
                      });
                    }
                  }}
                  placeholder="Enter object entity"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddTripleDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                console.log("==================== HANDLE ADD TRIPLE ====================");
                console.log("Add triple button clicked with data:", selectedTriple);
                
                if (!selectedTriple || !selectedTriple.subject || !selectedTriple.predicate || !selectedTriple.object) {
                  console.error("Incomplete triple data:", selectedTriple);
                  toast({
                    variant: "destructive",
                    title: "Cannot add triple",
                    description: "Please fill in all fields: subject, predicate, and object"
                  });
                  return;
                }
                
                try {
                  setIsLoading(true);
                  
                  // Get graphId using our reliable function
                  const safeGraphId = getGraphId();
                  
                  if (!safeGraphId) {
                    console.error("Missing graph ID");
                    toast({
                      variant: "destructive",
                      title: "Cannot add triple",
                      description: "Missing graph ID"
                    });
                    return;
                  }
                  
                  // First check if the entities (subject and object) exist
                  // Create a map of node names
                  const nodeNameMap = new Map<string, number>();
                  let subjectId: number | undefined;
                  let objectId: number | undefined;
                  // Track whether subject and object already exist for later reference
                  let existingSubject = false;
                  let existingObject = false;
                  
                  if (knowledgeGraph?.nodes) {
                    // Map existing nodes
                    knowledgeGraph.nodes.forEach(node => {
                      nodeNameMap.set(node.name, node.id);
                    });
                    
                    // Check if subject exists
                    subjectId = nodeNameMap.get(selectedTriple.subject);
                    existingSubject = subjectId !== undefined;
                    
                    // Check if object exists
                    objectId = nodeNameMap.get(selectedTriple.object);
                    existingObject = objectId !== undefined;
                  }
                  
                  // If subject doesn't exist, create it
                  if (subjectId === undefined) {
                    console.log(`Creating new entity for subject: ${selectedTriple.subject}`);
                    // Generate a new ID for the entity
                    const maxId = knowledgeGraph?.nodes ? 
                      Math.max(...knowledgeGraph.nodes.map(node => node.id), 0) : 0;
                    const newSubjectId = maxId + 1;
                    
                    // Create entity
                    const newSubject = {
                      id: newSubjectId,
                      name: selectedTriple.subject,
                      group: 3, // Default to Concept
                      dataSource: "manual",
                      timestamp: new Date().toISOString()
                    };
                    
                    // Add entity to graph
                    try {
                      const response = await apiRequest(
                        'POST',
                        `/api/graphs/${safeGraphId}/nodes`,
                        newSubject
                      );
                      
                      const responseData = await response.json();
                      if (responseData.success) {
                        console.log("Successfully created subject entity:", newSubject);
                        subjectId = newSubjectId;
                        
                        // Add the new entity to local state for immediate display
                        if (knowledgeGraph) {
                          // Update local graph state to include new subject entity
                          setLocalGraphState(prevState => {
                            if (!prevState) return prevState;
                            return {
                              ...prevState,
                              nodes: [...prevState.nodes, newSubject]
                            };
                          });
                          // Force a refresh to ensure the Entities tab updates
                          setRefreshCounter(prev => prev + 1);
                        }
                      } else {
                        throw new Error(`Failed to create subject entity: ${responseData.message || 'Unknown error'}`);
                      }
                    } catch (error) {
                      console.error("Error creating subject entity:", error);
                      throw new Error("Could not create subject entity");
                    }
                  }
                  
                  // If object doesn't exist, create it
                  if (objectId === undefined) {
                    console.log(`Creating new entity for object: ${selectedTriple.object}`);
                    // Generate a new ID for the entity - make sure it's different from subject ID
                    const maxId = knowledgeGraph?.nodes ? 
                      Math.max(...knowledgeGraph.nodes.map(node => node.id), 0) : 0;
                    // Ensure we have a unique ID even if a new subject was just created
                    const newObjectId = subjectId === maxId + 1 ? maxId + 2 : maxId + 1;
                    
                    // Create entity
                    const newObject = {
                      id: newObjectId,
                      name: selectedTriple.object,
                      group: 3, // Default to Concept
                      dataSource: "manual",
                      timestamp: new Date().toISOString()
                    };
                    
                    // Add entity to graph
                    try {
                      const response = await apiRequest(
                        'POST',
                        `/api/graphs/${safeGraphId}/nodes`,
                        newObject
                      );
                      
                      const responseData = await response.json();
                      if (responseData.success) {
                        console.log("Successfully created object entity:", newObject);
                        objectId = newObjectId;
                        
                        // Add the new entity to local state for immediate display
                        if (knowledgeGraph) {
                          // Update local graph state to include new object entity
                          setLocalGraphState(prevState => {
                            if (!prevState) return prevState;
                            return {
                              ...prevState,
                              nodes: [...prevState.nodes, newObject]
                            };
                          });
                          // Force a refresh to ensure the Entities tab updates
                          setRefreshCounter(prev => prev + 1);
                        }
                      } else {
                        throw new Error(`Failed to create object entity: ${responseData.message || 'Unknown error'}`);
                      }
                    } catch (error) {
                      console.error("Error creating object entity:", error);
                      throw new Error("Could not create object entity");
                    }
                  }
                  
                  // Create timestamp for new link
                  const now = new Date().toISOString();
                  
                  // Create the link object
                  const linkToAdd = {
                    source: subjectId,
                    target: objectId,
                    label: selectedTriple.predicate,
                    dataSource: "manual",
                    timestamp: now,
                    value: 1  // Default value for new links
                  };
                  
                  console.log("Adding new link/triple:", linkToAdd);
                  console.log("API URL:", `/api/graphs/${safeGraphId}/links`);
                  
                  const response = await apiRequest(
                    'POST',
                    `/api/graphs/${safeGraphId}/links`,
                    linkToAdd
                  );
                  
                  // Parse the response
                  const responseData = await response.json();
                  console.log("Add triple response:", responseData);
                  
                  if (responseData.success) {
                    // Reload graph
                    await reloadGraph();
                    
                    // Close dialog and reset state
                    setIsAddTripleDialogOpen(false);
                    setSelectedTriple(null);
                    
                    toast({
                      title: "Triple added successfully",
                      description: `The triple has been added to the knowledge graph.`,
                    });
                  } else {
                    throw new Error(responseData.message || "Failed to add triple");
                  }
                } catch (error) {
                  console.error("Error adding triple:", error);
                  
                  toast({
                    variant: "destructive",
                    title: "Failed to add triple",
                    description: error instanceof Error 
                      ? `Error: ${error.message}` 
                      : "There was an error adding the triple. Please try again."
                  });
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Triple
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Add Dialog */}
      <Dialog open={isAddLinkDialogOpen} onOpenChange={setIsAddLinkDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Relation</DialogTitle>
            <DialogDescription>
              Create a new relation between two entities in your graph.
            </DialogDescription>
          </DialogHeader>
          {knowledgeGraph?.nodes && (
            <div className="space-y-4 py-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="add-relation-label">Relation Label</Label>
                  <Input 
                    id="add-relation-label" 
                    value={selectedLink?.label || ""}
                    onChange={(e) => {
                      if (selectedLink) {
                        setSelectedLink({...selectedLink, label: e.target.value});
                      } else {
                        setSelectedLink({ source: -1, target: -1, value: 1, label: e.target.value });
                      }
                    }}
                    placeholder="e.g., 'works for', 'is part of', etc."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="add-source-entity">Source Entity</Label>
                  <Select 
                    value={selectedLink?.source?.toString() || ""} 
                    onValueChange={(value) => {
                      if (selectedLink) {
                        setSelectedLink({...selectedLink, source: parseInt(value)});
                      } else {
                        setSelectedLink({ source: parseInt(value), target: -1, value: 1, label: "" });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select source entity" />
                    </SelectTrigger>
                    <SelectContent>
                      {knowledgeGraph.nodes.map(node => (
                        <SelectItem key={node.id} value={node.id.toString()}>
                          {node.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="add-target-entity">Target Entity</Label>
                  <Select 
                    value={selectedLink?.target?.toString() || ""} 
                    onValueChange={(value) => {
                      if (selectedLink) {
                        setSelectedLink({...selectedLink, target: parseInt(value)});
                      } else {
                        setSelectedLink({ source: -1, target: parseInt(value), value: 1, label: "" });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select target entity" />
                    </SelectTrigger>
                    <SelectContent>
                      {knowledgeGraph.nodes.map(node => (
                        <SelectItem key={node.id} value={node.id.toString()}>
                          {node.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsAddLinkDialogOpen(false);
              setSelectedLink(null);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddLink} 
              disabled={isLoading || !selectedLink?.label || !selectedLink?.source || !selectedLink?.target}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Relation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteConfirmDialogOpen} onOpenChange={setIsDeleteConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedNode?.name} and all its relations from the graph.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteNode} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

export default KnowledgeGraphExplorer;