import { forwardRef, useState, useCallback, useRef, useEffect, useImperativeHandle } from 'react';
import { ForceGraph2D } from 'react-force-graph';
import { KnowledgeGraph, Node as SchemaNode, Link as SchemaLink } from '@shared/schema';
import { getWikidataPropertyLabels, Triple } from './KnowledgeGraphExplorer';
import { 
  Settings, 
  Share2, 
  HelpCircle, 
  PlayCircle, 
  PauseCircle,
  Copy,
  Twitter,
  Facebook,
  Linkedin,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

// Define custom node type that extends schema node with visualization properties
interface Node extends SchemaNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  index?: number;
  highlighted?: boolean;
}

// Define custom link type that extends schema link with visualization properties
interface GraphLink extends SchemaLink {
  source: any;
  target: any;
}

// Define sentiment types for relationships
export type RelationSentiment = 'positive' | 'negative' | 'neutral' | 'unknown';

// Enhanced graph link with sentiment information
interface EnhancedGraphLink extends GraphLink {
  sentiment?: RelationSentiment;
  highlighted?: boolean;
}

// Define appearance options for graph customization
interface GraphAppearanceOptions {
  nodeSize: number;
  linkWidth: number;
  animationEnabled: boolean;
  animationSpeed: number;
  labelSize: number;
  backgroundColor: string;
  complexity: number; // 0-100 scale for graph complexity
}

// Props for the component
interface GraphVisualizationProps {
  knowledgeGraph?: KnowledgeGraph | null;
  graph?: { nodes: Node[], links: EnhancedGraphLink[] } | null;
  width?: string;
  height?: string;
  is3D?: boolean;
  nodeColor?: (node: Node) => string;
  nodeLabel?: (node: Node) => string;
  linkLabel?: (link: GraphLink) => string;
  onNodeClick?: (node: Node) => void;
  onLinkClick?: (link: GraphLink) => void;
}

// Define the ref API for external control of the graph
export interface GraphRef {
  highlightNode: (nodeId: number) => void;
  exportAsImage: () => void;
  exportAsJSON: () => void;
  exportAsRDF: () => void;
  exportAsCSV: () => void;
}

// Component implementation with forwardRef
const GraphVisualization = forwardRef<GraphRef, GraphVisualizationProps>(
  function GraphVisualizationComponent(props, ref) {
    const { 
      knowledgeGraph, 
      graph, 
      width, 
      height, 
      is3D, 
      nodeColor, 
      nodeLabel, 
      linkLabel, 
      onNodeClick, 
      onLinkClick 
    } = props;
    const graphRef = useRef<any>();
    const hasWarnedAboutContainer = useRef<boolean>(false);
    const [graphData, setGraphData] = useState<{ nodes: Node[], links: EnhancedGraphLink[] } | null>(
      graph || null
    );
    const [highlightedNode, setHighlightedNode] = useState<number | null>(null);
    const [highlightTimeout, setHighlightTimeout] = useState<NodeJS.Timeout | null>(null);
    const [isSharePopoverOpen, setIsSharePopoverOpen] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);
    const [animationEnabled, setAnimationEnabled] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [graphSize, setGraphSize] = useState({ width: 600, height: 400 });
    const [appearanceOptions, setAppearanceOptions] = useState<GraphAppearanceOptions>({
      nodeSize: 6,
      linkWidth: 1.5,
      animationEnabled: false,
      animationSpeed: 0.01,
      labelSize: 12,
      backgroundColor: '#111827', // bg-gray-900
      complexity: 100, // Default to full complexity (0-100)
    });
  
    // Expose the highlight function and export functions through the ref
    useImperativeHandle(ref, () => ({
      highlightNode: (nodeId: number) => {
        highlightNodeAndConnections(nodeId);
        
        // Also center and zoom on the node
        if (graphRef.current && graphData) {
          const node = graphData.nodes.find(n => n.id === nodeId);
          if (node && node.x !== undefined && node.y !== undefined) {
            graphRef.current.centerAt(node.x, node.y, 1000);
            graphRef.current.zoom(2.5, 1000);
          }
        }
      },
      exportAsImage: () => {
        if (!graphRef.current) {
          toast({
            title: "Export Failed",
            description: "Unable to export graph as image.",
            variant: "destructive"
          });
          return;
        }
        
        try {
          // Temporarily pause animation for a clean screenshot
          const wasAnimating = animationEnabled;
          if (wasAnimating) {
            graphRef.current.pauseAnimation();
          }
          
          setTimeout(() => {
            try {
              // Access the canvas directly from the ref
              // This is a more reliable way to get the canvas than using querySelector
              if (!graphRef.current || !graphRef.current.canvas) {
                throw new Error('Graph canvas not found');
              }
              
              const canvasElement = graphRef.current.canvas();
              if (!canvasElement) {
                throw new Error('Canvas element not found');
              }
              
              // Create a new canvas for the export
              const exportCanvas = document.createElement('canvas');
              const ctx = exportCanvas.getContext('2d');
              if (!ctx) {
                throw new Error('Could not get export canvas context');
              }
              
              // Set dimensions to match the original canvas
              exportCanvas.width = canvasElement.width;
              exportCanvas.height = canvasElement.height;
              
              // Draw a background
              ctx.fillStyle = '#111827'; // Match the graph background
              ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
              
              // Draw the original canvas content on top
              ctx.drawImage(canvasElement, 0, 0);
              
              // Convert canvas to image URL
              const imageUrl = exportCanvas.toDataURL('image/png');
              
              // Create a temporary link element and trigger download
              const downloadLink = document.createElement('a');
              downloadLink.href = imageUrl;
              downloadLink.download = 'knowledge_graph.png';
              document.body.appendChild(downloadLink);
              downloadLink.click();
              document.body.removeChild(downloadLink);
              
              // Resume animation if it was active
              if (wasAnimating) {
                setTimeout(() => {
                  graphRef.current.resumeAnimation();
                }, 100);
              }
              
              toast({
                title: "Export Complete",
                description: "Knowledge graph exported as image successfully!",
              });
            } catch (error) {
              console.error('Error exporting graph as image:', error);
              toast({
                title: "Export Failed",
                description: "Unable to export graph as image. Please try again.",
                variant: "destructive"
              });
              
              // Resume animation if it was active
              if (wasAnimating && graphRef.current) {
                graphRef.current.resumeAnimation();
              }
            }
          }, 300); // Give the graph a moment to stabilize
        } catch (error) {
          console.error('Error exporting graph as image:', error);
          toast({
            title: "Export Failed",
            description: "Unable to export graph as image. Please try again.",
            variant: "destructive"
          });
        }
      },
      exportAsJSON: () => {
        if (!knowledgeGraph) {
          toast({
            title: "Export Failed",
            description: "No knowledge graph data available to export.",
            variant: "destructive"
          });
          return;
        }
        
        try {
          // Create a JSON string with proper formatting
          const jsonData = JSON.stringify(knowledgeGraph, null, 2);
          
          // Convert to Blob
          const blob = new Blob([jsonData], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          
          // Create and trigger download link
          const downloadLink = document.createElement('a');
          downloadLink.href = url;
          downloadLink.download = 'knowledge_graph.json';
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          
          // Clean up URL object
          URL.revokeObjectURL(url);
          
          toast({
            title: "Export Complete",
            description: "Knowledge graph exported as JSON successfully!",
          });
        } catch (error) {
          console.error('Error exporting graph as JSON:', error);
          toast({
            title: "Export Failed",
            description: "Unable to export graph as JSON. Please try again.",
            variant: "destructive"
          });
        }
      },
      exportAsRDF: () => {
        if (!knowledgeGraph) {
          toast({
            title: "Export Failed",
            description: "No knowledge graph data available to export.",
            variant: "destructive"
          });
          return;
        }
        
        try {
          // Create RDF Turtle format
          let turtleData = '@prefix : <http://empwr.ai/entity/> .\n';
          turtleData += '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n';
          turtleData += '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n\n';
          
          // Add entity definitions
          knowledgeGraph.nodes.forEach(node => {
            const entityType = (() => {
              switch (node.group) {
                case 1: return "Person";
                case 2: return "Place";
                case 3: return "Concept";
                case 4: return "Organization";
                case 5: return "Date";
                default: return "Entity";
              }
            })();
            
            turtleData += `:entity${node.id} rdf:type :${entityType} ;\n`;
            turtleData += `  rdfs:label "${node.name}" .\n\n`;
          });
          
          // Add relationships
          knowledgeGraph.links.forEach(link => {
            turtleData += `:entity${link.source} :${link.label.replace(/\s+/g, '_')} :entity${link.target} .\n`;
          });
          
          // Convert to Blob
          const blob = new Blob([turtleData], { type: 'text/turtle' });
          const url = URL.createObjectURL(blob);
          
          // Create and trigger download link
          const downloadLink = document.createElement('a');
          downloadLink.href = url;
          downloadLink.download = 'knowledge_graph.ttl';
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          
          // Clean up URL object
          URL.revokeObjectURL(url);
          
          toast({
            title: "Export Complete",
            description: "Knowledge graph exported as RDF/Turtle successfully!",
          });
        } catch (error) {
          console.error('Error exporting graph as RDF:', error);
          toast({
            title: "Export Failed",
            description: "Unable to export graph as RDF. Please try again.",
            variant: "destructive"
          });
        }
      },
      exportAsCSV: () => {
        if (!knowledgeGraph) {
          toast({
            title: "Export Failed",
            description: "No knowledge graph data available to export.",
            variant: "destructive"
          });
          return;
        }
        
        try {
          // Create a map of node IDs to names for easier lookups
          const nodeMap = new Map<number, string>();
          knowledgeGraph.nodes.forEach(node => {
            nodeMap.set(node.id, node.name);
          });
          
          // Generate CSV header
          let csvData = 'Subject,Predicate,Object\n';
          
          // Generate CSV rows for each triple
          knowledgeGraph.links.forEach(link => {
            const subjectName = nodeMap.get(link.source) || `Entity ${link.source}`;
            const predicateName = link.label;
            const objectName = nodeMap.get(link.target) || `Entity ${link.target}`;
            
            // Properly escape values that might contain commas
            const escapeCsvValue = (value: string) => {
              const needsEscaping = value.includes(',') || value.includes('"') || value.includes('\n');
              if (needsEscaping) {
                return `"${value.replace(/"/g, '""')}"`;
              }
              return value;
            };
            
            csvData += `${escapeCsvValue(subjectName)},${escapeCsvValue(predicateName)},${escapeCsvValue(objectName)}\n`;
          });
          
          // Convert to Blob
          const blob = new Blob([csvData], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          
          // Create and trigger download link
          const downloadLink = document.createElement('a');
          downloadLink.href = url;
          downloadLink.download = 'knowledge_graph_triples.csv';
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          
          // Clean up URL object
          URL.revokeObjectURL(url);
          
          toast({
            title: "Export Complete",
            description: "Knowledge graph triples exported as CSV successfully!",
          });
        } catch (error) {
          console.error('Error exporting graph as CSV:', error);
          toast({
            title: "Export Failed",
            description: "Unable to export graph as CSV. Please try again.",
            variant: "destructive"
          });
        }
      }
    }));
  
    // Enhanced node highlight function with prominent visual effects
    const highlightNodeAndConnections = (nodeId: number) => {
      // Clear any existing highlight timeout
      if (highlightTimeout) {
        clearTimeout(highlightTimeout);
      }

      // Set the highlighted node
      setHighlightedNode(nodeId);
      
      // Update graph data to mark the highlighted node and its connections
      // IMPORTANT: Modify nodes in-place to preserve references used by force graph
      if (graphData) {
        // Update nodes in-place to preserve force graph references
        graphData.nodes.forEach(node => {
          node.highlighted = node.id === nodeId;
        });
        
        // Update links in-place to preserve force graph references
        graphData.links.forEach(link => {
          const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
          const targetId = typeof link.target === 'object' ? link.target.id : link.target;
          link.highlighted = sourceId === nodeId || targetId === nodeId;
        });
        
        // Force a graph update to apply visual changes immediately
        if (graphRef.current) {
          graphRef.current.refresh && graphRef.current.refresh();
        }
      }
      
      // Auto-clear highlight after 5 seconds
      const timeout = setTimeout(() => {
        setHighlightedNode(null);
        if (graphData) {
          // Clear highlights in-place to preserve references
          graphData.nodes.forEach(node => {
            node.highlighted = false;
          });
          
          graphData.links.forEach(link => {
            link.highlighted = false;
          });
        }
      }, 5000);
      
      setHighlightTimeout(timeout);
    };
  
    // Get random sentiment for demo purposes
    const getRandomSentiment = (): RelationSentiment => {
      const sentiments: RelationSentiment[] = ['positive', 'negative', 'neutral', 'unknown'];
      return sentiments[Math.floor(Math.random() * sentiments.length)];
    };
  
    // Generate random sentiments for demo purposes
    const assignSentimentsToLinks = (links: SchemaLink[]): EnhancedGraphLink[] => {
      return links.map(link => ({
        ...link,
        sentiment: getRandomSentiment()
      }));
    };
  
    // Apply complexity settings to filter the graph
    const applyGraphComplexity = useCallback((complexityValue: number) => {
      // Safety check: ensure knowledgeGraph and its properties exist
      if (!knowledgeGraph) {
        console.log("No knowledge graph data available");
        setGraphData(null);
        return;
      }
      
      // Safely extract nodes and links with additional validation
      const nodes = Array.isArray(knowledgeGraph.nodes) ? knowledgeGraph.nodes : [];
      const links = Array.isArray(knowledgeGraph.links) ? knowledgeGraph.links : [];
      
      if (nodes.length === 0) {
        console.log("Knowledge graph has no nodes");
        setGraphData({ nodes: [], links: [] });
        return;
      }
      
      // Define maximum number of nodes to display for performance
      const MAX_NODES_TO_DISPLAY = 50;
      const shouldLimitNodes = nodes.length > MAX_NODES_TO_DISPLAY;
      
      // Store a toast message to inform the user about what's happening
      let complexityMessage = complexityValue < 40 
        ? "Showing simplified graph with key entities and relationships"
        : complexityValue < 70
          ? "Showing balanced graph with moderate detail"
          : "Showing detailed graph with all entities and relationships";
          
      // Add additional message if limiting nodes due to size
      if (shouldLimitNodes) {
        complexityMessage += ` (limited to ${MAX_NODES_TO_DISPLAY} most connected entities for visualization)`;
      }
      
      toast({
        description: complexityMessage
      });
      
      console.log("Processing knowledge graph with:", nodes.length, "nodes and", links.length, "links");
      
      // Calculate which nodes and links to keep based on complexity
      let filteredNodes: Node[] = [...nodes];
      let filteredLinks: SchemaLink[] = [...links];
      
      // We need to filter if complexity is less than 100% OR we have too many nodes
      if (complexityValue < 100 || shouldLimitNodes) {
        // Assign importance scores to nodes based on their connectedness
        const nodeDegrees = new Map<number, number>();
        
        // Calculate degree (number of connections) for each node
        // Add additional validation for source and target properties
        links.forEach(link => {
          if (typeof link.source === 'number' && typeof link.target === 'number') {
            nodeDegrees.set(link.source, (nodeDegrees.get(link.source) || 0) + 1);
            nodeDegrees.set(link.target, (nodeDegrees.get(link.target) || 0) + 1);
          }
        });
        
        // Determine threshold for node retention based on complexity
        // Sort nodes by degree (importance)
        // Manually convert entries to array to avoid MapIterator issues
        const entriesArray: [number, number][] = [];
        nodeDegrees.forEach((value, key) => {
          entriesArray.push([key, value]);
        });
        
        const sortedNodeIds = entriesArray
          .sort((a, b) => b[1] - a[1]) // Sort by degree (descending)
          .map(entry => entry[0]); // Get just the node IDs
        
        // Calculate how many nodes to keep based on complexity and max limit
        let nodesToKeep;
        if (shouldLimitNodes) {
          // Limit to MAX_NODES_TO_DISPLAY (50) if the graph is too large
          nodesToKeep = MAX_NODES_TO_DISPLAY;
          // If user also specified complexity, apply that limit if it's stricter
          if (complexityValue < 100) {
            const complexityLimit = Math.max(2, Math.floor((complexityValue / 100) * sortedNodeIds.length));
            nodesToKeep = Math.min(nodesToKeep, complexityLimit);
          }
        } else {
          // Normal complexity calculation for smaller graphs
          nodesToKeep = Math.max(2, Math.floor((complexityValue / 100) * sortedNodeIds.length));
        }
        
        // Get the IDs of nodes to keep
        const nodeIdsToKeep = new Set(sortedNodeIds.slice(0, nodesToKeep));
        
        // Filter nodes based on selected IDs
        filteredNodes = nodes.filter(node => {
          return node && typeof node.id === 'number' && nodeIdsToKeep.has(node.id);
        });
        
        // Filter links to only include those between kept nodes
        filteredLinks = links.filter(link => {
          return link && 
                 typeof link.source === 'number' && 
                 typeof link.target === 'number' && 
                 nodeIdsToKeep.has(link.source) && 
                 nodeIdsToKeep.has(link.target);
        });
        
        // If we're limiting nodes, add a note in the console
        if (shouldLimitNodes) {
          console.log(`Graph visualization limited to ${nodesToKeep} most connected entities out of ${nodes.length} total. All data is preserved for export and query operations.`);
        }
      }
      
      // Update the graph data with filtered nodes and links
      const enhancedLinks = assignSentimentsToLinks(filteredLinks);
      setGraphData({
        nodes: filteredNodes.map(node => ({ ...node, highlighted: false })),
        links: enhancedLinks.map(link => ({ ...link, highlighted: false })),
      });
    }, [knowledgeGraph, toast]);
    
    // Process graph data when knowledgeGraph changes
    useEffect(() => {
      if (knowledgeGraph) {
        // Apply complexity settings to the initial graph load
        applyGraphComplexity(appearanceOptions.complexity);
      } else {
        setGraphData(null);
      }
    }, [knowledgeGraph, applyGraphComplexity, appearanceOptions.complexity]);
  
    // Toggle animation
    const toggleAnimation = () => {
      setAnimationEnabled(!animationEnabled);
      setAppearanceOptions({
        ...appearanceOptions,
        animationEnabled: !animationEnabled
      });
      
      if (graphRef.current) {
        if (animationEnabled) {
          graphRef.current.pauseAnimation();
        } else {
          graphRef.current.resumeAnimation();
        }
      }
    };
    
    // Toggle fullscreen mode
    const toggleFullScreen = () => {
      const newFullScreenState = !isFullScreen;
      setIsFullScreen(newFullScreenState);
      
      if (newFullScreenState) {
        // Going to fullscreen
        setGraphSize({
          width: window.innerWidth,
          height: window.innerHeight - 50 // Leave space for controls
        });
        
        toast({
          description: "Fullscreen mode enabled. Press ESC or click the minimize button to exit.",
        });
      } else {
        // When exiting fullscreen, use a small timeout to ensure the DOM updates first
        setTimeout(() => {
          // Let the resize handler determine the proper size based on the container
          const container = document.querySelector('.graph-container');
          if (container) {
            const containerRect = container.getBoundingClientRect();
            setGraphSize({
              width: containerRect.width || 600,
              height: containerRect.height || 550
            });
          } else {
            // Fallback if container not found
            setGraphSize({ width: 600, height: 550 });
          }
        }, 100);
      }
    };
  
    // Share graph functionality
    const shareGraph = (platform: 'copy' | 'twitter' | 'facebook' | 'linkedin') => {
      const shareUrl = window.location.href;
      const shareText = 'Check out this knowledge graph I created with EMPWR!';
      
      switch (platform) {
        case 'copy':
          navigator.clipboard.writeText(shareUrl);
          toast({
            title: "Link copied",
            description: "Graph URL copied to clipboard"
          });
          break;
        case 'twitter':
          window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`, '_blank');
          break;
        case 'facebook':
          window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
          break;
        case 'linkedin':
          window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank');
          break;
      }
      
      setIsSharePopoverOpen(false);
    };
  
    // Get sentiment color
    const getSentimentColor = (sentiment: RelationSentiment = 'neutral') => {
      switch (sentiment) {
        case 'positive': return '#22c55e'; // green-500
        case 'negative': return '#ef4444'; // red-500
        case 'neutral': return '#94a3b8';  // slate-400
        case 'unknown': 
        default: return '#6b7280';         // gray-500
      }
    };
  
    // Paint node with color based on entity type and highlight state
    const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const { id, name, group, x, y, highlighted, enriched } = node;
      const defaultSize = appearanceOptions.nodeSize / globalScale;
      // Make highlighted nodes bigger
      const size = highlighted ? defaultSize * 1.5 : defaultSize;
      
      // Choose color based on group (entity type)
      let color = '#6B7280'; // Default gray for unknown types
      switch (group) {
        case 1: color = '#3B82F6'; break; // Person - blue
        case 2: color = '#F59E0B'; break; // Place - amber
        case 3: color = '#10B981'; break; // Concept - green
        case 4: color = '#8B5CF6'; break; // Organization - purple
        case 5: color = '#EC4899'; break; // Date - pink
      }
      
      // Draw enhanced glowing effect for highlighted nodes (from text clicks)
      if (highlighted) {
        const time = Date.now() / 1000;
        const pulseFactor = 1 + 0.3 * Math.sin(time * 4); // Stronger pulsing
        
        // Draw multiple glow layers for enhanced visibility
        const outerGlowRadius = size * 2.5 * pulseFactor;
        const innerGlowRadius = size * 1.8;
        
        // Outer golden glow
        const outerGlowGradient = ctx.createRadialGradient(
          x || 0, y || 0, size,
          x || 0, y || 0, outerGlowRadius
        );
        outerGlowGradient.addColorStop(0, '#FBBF2480'); // Golden with transparency
        outerGlowGradient.addColorStop(0.7, '#F59E0B40'); // Amber fade
        outerGlowGradient.addColorStop(1, '#F59E0B00'); // Transparent
        
        ctx.beginPath();
        ctx.arc(x || 0, y || 0, outerGlowRadius, 0, 2 * Math.PI);
        ctx.fillStyle = outerGlowGradient;
        ctx.fill();
        
        // Inner colored glow
        const innerGlowGradient = ctx.createRadialGradient(
          x || 0, y || 0, size,
          x || 0, y || 0, innerGlowRadius
        );
        innerGlowGradient.addColorStop(0, `${color}A0`);
        innerGlowGradient.addColorStop(1, `${color}00`);
        
        ctx.beginPath();
        ctx.arc(x || 0, y || 0, innerGlowRadius, 0, 2 * Math.PI);
        ctx.fillStyle = innerGlowGradient;
        ctx.fill();
        
        // Pulsing outline rings
        const ringRadius1 = size * (1.3 + 0.15 * Math.sin(time * 6));
        const ringRadius2 = size * (1.6 + 0.1 * Math.sin(time * 4));
        
        // Inner ring
        ctx.beginPath();
        ctx.arc(x || 0, y || 0, ringRadius1, 0, 2 * Math.PI);
        ctx.strokeStyle = '#FBBF24'; // Golden color
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
        
        // Outer ring
        ctx.beginPath();
        ctx.arc(x || 0, y || 0, ringRadius2, 0, 2 * Math.PI);
        ctx.strokeStyle = '#F59E0B80'; // Amber with transparency
        ctx.lineWidth = 1 / globalScale;
        ctx.stroke();
      }
      
      // Draw circular node with a bit of transparency and 3D effect
      const nodeGradient = ctx.createRadialGradient(
        (x || 0) - size/3, (y || 0) - size/3, 0,
        x || 0, y || 0, size
      );
      nodeGradient.addColorStop(0, `${color}ff`);
      nodeGradient.addColorStop(1, `${color}cc`);
      
      ctx.beginPath();
      ctx.arc(x || 0, y || 0, size, 0, 2 * Math.PI);
      ctx.fillStyle = nodeGradient;
      ctx.fill();
      
      // Draw outline - special styling for enriched nodes
      if (enriched) {
        // Draw a sparkly/thicker outline for enriched nodes
        ctx.strokeStyle = '#9333EA'; // Purple outline for Wikidata enriched nodes
        ctx.lineWidth = 1.5 / globalScale;
        ctx.setLineDash([2, 2]); // Dashed line for enriched nodes
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash pattern
      } else {
        // Regular node outline
        ctx.strokeStyle = '#ffffff30';
        ctx.lineWidth = 0.8 / globalScale;
        ctx.stroke();
      }
      
      // Always draw label for highlighted nodes, otherwise only if zoomed in enough
      if (highlighted || globalScale > 1) {
        const label = name;
        if (label) {
          const fontSize = highlighted 
            ? (appearanceOptions.labelSize + 2) / globalScale 
            : appearanceOptions.labelSize / globalScale;
            
          ctx.font = `${fontSize}px Sans-Serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Draw text background for better readability
          const textWidth = ctx.measureText(label).width;
          const padding = 3 / globalScale;
          const textHeight = fontSize;
          
          if (highlighted) {
            ctx.fillStyle = '#111827dd'; // Semi-transparent gray-900
            ctx.fillRect(
              (x || 0) - textWidth / 2 - padding,
              (y || 0) + size + 5 / globalScale - textHeight / 2,
              textWidth + padding * 2,
              textHeight + padding
            );
          }
          
          // Draw text with a light glow for highlighted nodes
          if (highlighted) {
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = color;
            ctx.shadowBlur = 3 / globalScale;
          } else {
            ctx.fillStyle = '#f8fafc'; // slate-50
            ctx.shadowBlur = 0;
          }
          
          ctx.fillText(label, x || 0, (y || 0) + size + (7 / globalScale));
          ctx.shadowBlur = 0; // Reset shadow
        }
      }
    }, [appearanceOptions.nodeSize, appearanceOptions.labelSize]);
  
    // Paint link with color based on sentiment and highlight state
    const paintLink = useCallback((link: GraphLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const enhancedLink = link as EnhancedGraphLink;
      const sentiment = enhancedLink.sentiment || 'neutral';
      const sentimentColor = getSentimentColor(sentiment);
      const isHighlighted = enhancedLink.highlighted;
      const isEnriched = enhancedLink.enriched;
      
      // Get start and end points - safely handle source/target that could be objects or IDs
      let sourceX = 0, sourceY = 0, targetX = 0, targetY = 0;
      
      // Handle source coordinates
      if (link.source !== undefined) {
        if (typeof link.source === 'object' && link.source !== null) {
          sourceX = link.source.x || 0;
          sourceY = link.source.y || 0;
        }
      }
      
      // Handle target coordinates
      if (link.target !== undefined) {
        if (typeof link.target === 'object' && link.target !== null) {
          targetX = link.target.x || 0;
          targetY = link.target.y || 0;
        }
      }
      
      const sourcePos = { x: sourceX, y: sourceY };
      const targetPos = { x: targetX, y: targetY };
      
      // Calculate the direction and distance
      const dx = targetPos.x - sourcePos.x;
      const dy = targetPos.y - sourcePos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      
      if (isHighlighted) {
        // Draw a glow effect for highlighted links
        ctx.beginPath();
        ctx.moveTo(sourcePos.x, sourcePos.y);
        ctx.lineTo(targetPos.x, targetPos.y);
        ctx.strokeStyle = `${sentimentColor}60`;
        ctx.lineWidth = (appearanceOptions.linkWidth + 3) / globalScale;
        ctx.stroke();
        
        // Create a dashed animated flow for highlighted links
        const dashLength = 5 / globalScale;
        const gapLength = 3 / globalScale;
        const time = Date.now() / 1000;
        const speed = 10; // Speed of flow animation
        const offset = (time * speed) % (dashLength + gapLength);
        
        // Draw highlighted links with dashed flow animation
        ctx.beginPath();
        ctx.setLineDash([dashLength, gapLength]);
        ctx.lineDashOffset = -offset;
        ctx.moveTo(sourcePos.x, sourcePos.y);
        ctx.lineTo(targetPos.x, targetPos.y);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = appearanceOptions.linkWidth / globalScale;
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        // Draw regular link with sentiment color, special style for enriched links
        ctx.beginPath();
        ctx.moveTo(sourcePos.x, sourcePos.y);
        ctx.lineTo(targetPos.x, targetPos.y);
        
        if (isEnriched) {
          // Special styling for Wikidata links
          ctx.strokeStyle = '#9333EA'; // Purple for Wikidata enriched links
          ctx.lineWidth = (appearanceOptions.linkWidth + 0.5) / globalScale;
          // Add a dash pattern for enriched links
          ctx.setLineDash([4, 2]);
          ctx.stroke();
          ctx.setLineDash([]); // Reset dash pattern
        } else {
          // Normal links
          ctx.strokeStyle = sentimentColor;
          ctx.lineWidth = appearanceOptions.linkWidth / globalScale;
          ctx.stroke();
        }
      }
      
      // Draw directional arrow
      const nodeSize = appearanceOptions.nodeSize / globalScale;
      const arrowLength = isHighlighted ? 8 / globalScale : 6 / globalScale;
      const arrowWidth = isHighlighted ? 4 / globalScale : 3 / globalScale;
      
      // Calculate arrow position (slightly before the target node)
      const arrowPos = {
        x: targetPos.x - (dx / distance) * (nodeSize + 2 / globalScale),
        y: targetPos.y - (dy / distance) * (nodeSize + 2 / globalScale)
      };
      
      // Draw arrow head
      ctx.beginPath();
      ctx.moveTo(
        arrowPos.x - arrowLength * Math.cos(angle - Math.PI / 7),
        arrowPos.y - arrowLength * Math.sin(angle - Math.PI / 7)
      );
      ctx.lineTo(arrowPos.x, arrowPos.y);
      ctx.lineTo(
        arrowPos.x - arrowLength * Math.cos(angle + Math.PI / 7),
        arrowPos.y - arrowLength * Math.sin(angle + Math.PI / 7)
      );
      ctx.fillStyle = isHighlighted ? '#ffffff' : sentimentColor;
      ctx.fill();
      
      // Draw relationship label if zoomed in enough or if highlighted
      if (isHighlighted || globalScale > 1.5) {
        // Position the text in the middle of the link
        const textPos = {
          x: (sourcePos.x + targetPos.x) / 2,
          y: (sourcePos.y + targetPos.y) / 2
        };
        
        // Get label text - translate Wikidata property IDs to readable labels
        let labelText = link.label || '';
        
        // Map Wikidata property IDs to human-readable labels if the link has a wikidataId
        const enhancedLink = link as EnhancedGraphLink;
        if (enhancedLink.enriched && enhancedLink.wikidataId) {
          // Get the Wikidata property labels from the shared utility function
          const wikidataLabels = getWikidataPropertyLabels();
          
          // Replace the property ID with a readable label if available
          if (wikidataLabels[enhancedLink.wikidataId]) {
            labelText = wikidataLabels[enhancedLink.wikidataId];
          }
        }
        
        // Draw background for text
        const fontSize = isHighlighted 
          ? (appearanceOptions.labelSize) / globalScale 
          : (appearanceOptions.labelSize - 2) / globalScale;
        
        ctx.font = `${fontSize}px Sans-Serif`;
        const textWidth = ctx.measureText(labelText).width;
        const padding = 4 / globalScale;
        
        // Draw a more distinguished background for highlighted link labels
        if (isHighlighted) {
          // Draw a more distinct background
          ctx.fillStyle = '#111827ee'; // More opaque gray-900
          ctx.fillRect(
            textPos.x - textWidth / 2 - padding,
            textPos.y - (fontSize / 2) - padding,
            textWidth + padding * 2,
            fontSize + padding * 2
          );
          // Add a border
          ctx.strokeStyle = sentimentColor;
          ctx.lineWidth = 1 / globalScale;
          ctx.strokeRect(
            textPos.x - textWidth / 2 - padding,
            textPos.y - (fontSize / 2) - padding,
            textWidth + padding * 2,
            fontSize + padding * 2
          );
        } else {
          // Regular background
          ctx.fillStyle = 'rgba(17, 24, 39, 0.85)'; // Semi-transparent gray-900
          ctx.fillRect(
            textPos.x - textWidth / 2 - padding,
            textPos.y - (fontSize / 2) - padding,
            textWidth + padding * 2,
            fontSize + padding * 2
          );
        }
        
        // Draw text
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        if (isHighlighted) {
          // Add text glow for highlighted links
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = sentimentColor;
          ctx.shadowBlur = 3 / globalScale;
        } else {
          ctx.fillStyle = '#f8fafc'; // slate-50
        }
        
        ctx.fillText(labelText, textPos.x, textPos.y);
        ctx.shadowBlur = 0; // Reset shadow
      }
    }, [appearanceOptions.linkWidth, appearanceOptions.nodeSize, appearanceOptions.labelSize]);
    
    // Handle window resize and dynamically adjust to container size
    useEffect(() => {
      const handleResize = () => {
        // Wait for container to be available in the DOM
        setTimeout(() => {
          const container = document.querySelector('.graph-container');
          
          // If container is not found, use fallback dimensions
          if (!container) {
            // Only log warning once per component instance to avoid console spam
            if (!hasWarnedAboutContainer.current) {
              console.warn('Graph container not found, using fallback dimensions');
              hasWarnedAboutContainer.current = true;
            }
            
            if (isFullScreen) {
              setGraphSize({
                width: window.innerWidth,
                height: window.innerHeight - 50
              });
            } else {
              setGraphSize({
                width: 600,
                height: 550
              });
            }
            return;
          }
          
          // Get the actual container dimensions
          const containerRect = container.getBoundingClientRect();
          let width = containerRect.width || 600;
          let height = containerRect.height || 550;
          
          // If the container is too small, set reasonable minimums
          width = Math.max(width, 300);
          height = Math.max(height, 500); // Increased minimum height to better use the 700px container
          
          if (isFullScreen) {
            // If in fullscreen, set size to window dimensions
            setGraphSize({
              width: window.innerWidth,
              height: window.innerHeight - 50 // Leave space for controls
            });
          } else {
            // Set graph size to match container
            setGraphSize({ width, height });
          }
        }, 100);
      };
      
      // Set initial size
      handleResize();
      
      // Create a ResizeObserver to watch for container size changes
      let resizeObserver: ResizeObserver | null = null;
      setTimeout(() => {
        const container = document.querySelector('.graph-container');
        if (container) {
          resizeObserver = new ResizeObserver(() => {
            handleResize();
          });
          resizeObserver.observe(container);
        } else if (!hasWarnedAboutContainer.current) {
          // Only log this once per component instance
          console.warn('Graph container not found for ResizeObserver');
          hasWarnedAboutContainer.current = true;
        }
      }, 200);
      
      // Add resize listener
      window.addEventListener('resize', handleResize);
      
      // Cleanup
      return () => {
        if (resizeObserver) {
          const container = document.querySelector('.graph-container');
          if (container) {
            try {
              resizeObserver.unobserve(container);
            } catch (error) {
              // Silently handle any errors during cleanup
            }
          }
          try {
            resizeObserver.disconnect();
          } catch (error) {
            // Silently handle any errors during cleanup
          }
        }
        window.removeEventListener('resize', handleResize);
      };
    }, [isFullScreen]);
  
    // Update animation settings when they change
    useEffect(() => {
      if (graphRef.current) {
        graphRef.current.d3Force('charge').strength(-50 * appearanceOptions.animationSpeed * 100);
        
        if (!appearanceOptions.animationEnabled) {
          graphRef.current.pauseAnimation();
        } else {
          graphRef.current.resumeAnimation();
        }
      }
    }, [appearanceOptions.animationEnabled, appearanceOptions.animationSpeed]);
  
    // Add node click handler
    const handleNodeClick = (node: Node) => {
      highlightNodeAndConnections(node.id);
      if (onNodeClick) {
        onNodeClick(node);
      }
    };
    
    // Add link click handler
    const handleLinkClick = (link: GraphLink) => {
      if (onLinkClick) {
        onLinkClick(link);
      }
    };
  
    return (
      <div className={`h-full flex flex-col ${isFullScreen ? 'fixed inset-0 z-50 bg-gray-900' : ''}`}>
        <div className={`flex-grow relative w-full ${isFullScreen ? 'p-4' : ''}`}>
          {graphData ? (
            <div className="h-full w-full graph-container">
              <ForceGraph2D
                width={graphSize.width}
                height={graphSize.height}
                ref={graphRef}
                graphData={graphData as any}
                nodeRelSize={appearanceOptions.nodeSize}
                linkWidth={appearanceOptions.linkWidth}
                backgroundColor={appearanceOptions.backgroundColor}
                nodeCanvasObject={paintNode}
                linkCanvasObject={paintLink}
                linkDirectionalArrowLength={3}
                linkDirectionalArrowRelPos={1}
                cooldownTicks={100}
                // Add enhanced properties for better connections
                d3AlphaMin={0.001}
                cooldownTime={3000}
                linkDirectionalParticles={2}
                linkDirectionalParticleWidth={appearanceOptions.linkWidth}
                nodeLabel={(node: any) => {
                  const typeLabel = (() => {
                    switch (node.group) {
                      case 1: return "Person";
                      case 2: return "Place";
                      case 3: return "Concept";
                      case 4: return "Organization";
                      case 5: return "Date";
                      default: return "Other";
                    }
                  })();
                  
                  // For enriched nodes with descriptions, show more info
                  if (node.enriched && node.description) {
                    return `${node.name} (${typeLabel})\n${node.description}\n${node.wikidataId ? `Wikidata: ${node.wikidataId}` : ''}`;
                  }
                  
                  // For enriched nodes without descriptions
                  if (node.enriched) {
                    return `${node.name} (${typeLabel})\n${node.wikidataId ? `Wikidata: ${node.wikidataId}` : ''}`;
                  }
                  
                  // Standard nodes
                  return `${node.name} (${typeLabel})`;
                }}
                linkCurvature={0.15} // Slightly increase curve to better visualize relationships
                d3AlphaDecay={0.01}
                d3VelocityDecay={0.3} // Reduced to allow more movement
                warmupTicks={100} // Add warmup ticks to ensure proper layout
                onNodeClick={handleNodeClick}
                onLinkClick={handleLinkClick}
                onEngineStop={() => {
                  if (!appearanceOptions.animationEnabled && graphRef.current) {
                    graphRef.current.pauseAnimation();
                  }
                }}
              />
              
              {/* Quick controls - top-right */}
              <div className="absolute top-4 right-4 flex flex-col space-y-2">
                <Button 
                  variant="secondary" 
                  size="icon" 
                  className="h-8 w-8 rounded-full bg-gray-800/80 backdrop-blur-sm shadow-lg"
                  onClick={() => graphRef.current?.zoom(graphRef.current.zoom() * 1.5, 400)}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button 
                  variant="secondary" 
                  size="icon" 
                  className="h-8 w-8 rounded-full bg-gray-800/80 backdrop-blur-sm shadow-lg"
                  onClick={() => graphRef.current?.zoom(graphRef.current.zoom() / 1.5, 400)}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button 
                  variant="secondary" 
                  size="icon" 
                  className="h-8 w-8 rounded-full bg-gray-800/80 backdrop-blur-sm shadow-lg"
                  onClick={toggleFullScreen}
                >
                  {isFullScreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <Settings className="h-12 w-12 text-gray-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-400 mb-2">No Knowledge Graph Yet</h3>
              <p className="text-sm text-gray-500 max-w-sm">
                Enter some text in the input panel and click "Generate Knowledge Graph" to visualize entities and relationships.
              </p>
            </div>
          )}
          
          {/* Graph Actions Bar - Only shown when graph exists */}
          {knowledgeGraph && (
            <div className="mt-4 mb-2 flex justify-center sm:justify-end">
              {/* Action buttons */}
              <div className="flex items-center flex-wrap justify-center sm:justify-end gap-2 px-1">
                {/* Animation Toggle */}
                <Button 
                  id="animation-button"
                  variant="outline" 
                  size="sm"
                  onClick={toggleAnimation}
                  className="text-xs"
                >
                  {animationEnabled ? (
                    <>
                      <PauseCircle className="h-4 w-4 mr-1" />
                      Pause
                    </>
                  ) : (
                    <>
                      <PlayCircle className="h-4 w-4 mr-1" />
                      Animate
                    </>
                  )}
                </Button>
                
                {/* Share Button & Popover */}
                <Popover open={isSharePopoverOpen} onOpenChange={setIsSharePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button 
                      id="share-button"
                      variant="outline" 
                      size="sm"
                      className="text-xs"
                    >
                      <Share2 className="h-4 w-4 mr-1" />
                      Share
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3" align="center" sideOffset={5} alignOffset={0}>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="ghost" size="sm" onClick={() => shareGraph('copy')} className="flex items-center justify-start">
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Link
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => shareGraph('twitter')} className="flex items-center justify-start">
                        <Twitter className="h-4 w-4 mr-2" />
                        Twitter
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => shareGraph('facebook')} className="flex items-center justify-start">
                        <Facebook className="h-4 w-4 mr-2" />
                        Facebook
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => shareGraph('linkedin')} className="flex items-center justify-start">
                        <Linkedin className="h-4 w-4 mr-2" />
                        LinkedIn
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
                
                {/* Graph Settings Dialog */}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      id="customize-button"
                      variant="outline" 
                      size="sm"
                      className="text-xs"
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Customize
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md w-full mx-auto">
                    <DialogHeader>
                      <DialogTitle>Graph Appearance</DialogTitle>
                      <DialogDescription>
                        Customize how your knowledge graph looks and behaves.
                      </DialogDescription>
                    </DialogHeader>
                    
                    <Tabs defaultValue="nodes">
                      <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="nodes">Nodes</TabsTrigger>
                        <TabsTrigger value="edges">Edges</TabsTrigger>
                        <TabsTrigger value="animation">Animation</TabsTrigger>
                        <TabsTrigger value="complexity">Complexity</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="nodes" className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="nodeSize">Node Size</Label>
                            <span className="text-sm text-gray-500">{appearanceOptions.nodeSize}</span>
                          </div>
                          <Slider 
                            id="nodeSize" 
                            min={2} 
                            max={15} 
                            step={1} 
                            value={[appearanceOptions.nodeSize]}
                            onValueChange={(value) => {
                              setAppearanceOptions({
                                ...appearanceOptions,
                                nodeSize: value[0]
                              });
                            }}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="labelSize">Label Size</Label>
                            <span className="text-sm text-gray-500">{appearanceOptions.labelSize}</span>
                          </div>
                          <Slider 
                            id="labelSize" 
                            min={8} 
                            max={20} 
                            step={1} 
                            value={[appearanceOptions.labelSize]}
                            onValueChange={(value) => {
                              setAppearanceOptions({
                                ...appearanceOptions,
                                labelSize: value[0]
                              });
                            }}
                          />
                        </div>
                        
                        {/* Entity Type Legend */}
                        <div className="pt-4 border-t border-gray-100">
                          <h4 className="text-sm font-medium mb-2">Entity Types</h4>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center text-sm">
                              <span className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: "#3B82F6" }}></span>
                              Person
                            </div>
                            <div className="flex items-center text-sm">
                              <span className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: "#F59E0B" }}></span>
                              Place
                            </div>
                            <div className="flex items-center text-sm">
                              <span className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: "#10B981" }}></span>
                              Concept
                            </div>
                            <div className="flex items-center text-sm">
                              <span className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: "#8B5CF6" }}></span>
                              Organization
                            </div>
                            <div className="flex items-center text-sm">
                              <span className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: "#EC4899" }}></span>
                              Date
                            </div>
                            <div className="flex items-center text-sm">
                              <span className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: "#6B7280" }}></span>
                              Other
                            </div>
                          </div>
                          
                          {/* Enriched nodes legend */}
                          <h4 className="text-sm font-medium mt-4 mb-2">Node Enrichment</h4>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center text-sm">
                              <span className="w-3 h-3 rounded-full mr-1 border border-dashed border-purple-500"></span>
                              Original
                            </div>
                            <div className="flex items-center text-sm">
                              <span className="w-3 h-3 rounded-full mr-1 border-2 border-purple-500"></span>
                              Enriched
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="edges" className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="linkWidth">Edge Width</Label>
                            <span className="text-sm text-gray-500">{appearanceOptions.linkWidth}</span>
                          </div>
                          <Slider 
                            id="linkWidth" 
                            min={0.5} 
                            max={5} 
                            step={0.5} 
                            value={[appearanceOptions.linkWidth]}
                            onValueChange={(value) => {
                              setAppearanceOptions({
                                ...appearanceOptions,
                                linkWidth: value[0]
                              });
                            }}
                          />
                        </div>
                        
                        {/* Relationship Sentiment Legend */}
                        <div className="pt-4 border-t border-gray-100">
                          <h4 className="text-sm font-medium mb-2">Relationship Sentiment</h4>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center text-sm">
                              <span className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: "#22c55e" }}></span>
                              Positive
                            </div>
                            <div className="flex items-center text-sm">
                              <span className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: "#ef4444" }}></span>
                              Negative
                            </div>
                            <div className="flex items-center text-sm">
                              <span className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: "#94a3b8" }}></span>
                              Neutral
                            </div>
                            <div className="flex items-center text-sm">
                              <span className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: "#6b7280" }}></span>
                              Unknown
                            </div>
                          </div>
                          
                          {/* Enriched links legend */}
                          <h4 className="text-sm font-medium mt-4 mb-2">Edge Enrichment</h4>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center text-sm">
                              <span className="w-6 h-1 mr-1 bg-blue-500"></span>
                              Original
                            </div>
                            <div className="flex items-center text-sm">
                              <span className="w-6 h-1 mr-1 bg-purple-500 border-t border-dashed border-purple-300"></span>
                              Enriched
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="animation" className="space-y-4 pt-4">
                        <div className="flex items-center space-x-2 mb-4">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={toggleAnimation}
                            className={animationEnabled ? 'bg-blue-100 dark:bg-blue-900' : ''}
                          >
                            {animationEnabled ? (
                              <>
                                <PauseCircle className="h-4 w-4 mr-1" />
                                Pause Animation
                              </>
                            ) : (
                              <>
                                <PlayCircle className="h-4 w-4 mr-1" />
                                Start Animation
                              </>
                            )}
                          </Button>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="animationSpeed">Animation Speed</Label>
                            <span className="text-sm text-gray-500">{appearanceOptions.animationSpeed.toFixed(2)}</span>
                          </div>
                          <Slider 
                            id="animationSpeed" 
                            min={0.01} 
                            max={0.1} 
                            step={0.01} 
                            value={[appearanceOptions.animationSpeed]}
                            onValueChange={(value) => {
                              setAppearanceOptions({
                                ...appearanceOptions,
                                animationSpeed: value[0]
                              });
                            }}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Higher values will result in faster and more energetic animations.
                          </p>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="complexity" className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="graphComplexity">Graph Complexity</Label>
                            <span className="text-sm text-gray-500">{appearanceOptions.complexity}%</span>
                          </div>
                          <Slider 
                            id="graphComplexity" 
                            min={10} 
                            max={100} 
                            step={10} 
                            value={[appearanceOptions.complexity]}
                            onValueChange={(value) => {
                              const newComplexity = value[0];
                              setAppearanceOptions({
                                ...appearanceOptions,
                                complexity: newComplexity
                              });
                              
                              // Apply the new complexity setting immediately
                              if (knowledgeGraph) {
                                applyGraphComplexity(newComplexity);
                              }
                            }}
                          />
                          <div className="text-xs text-gray-500 mt-1">
                            <p className="mb-1">Lower complexity shows fewer nodes but improves performance.</p>
                            <ul className="list-disc list-inside space-y-1">
                              <li>10-30%: Simplified view with only key entities</li>
                              <li>40-70%: Balanced view with moderate detail</li>
                              <li>80-100%: Complete view with all entities and relationships</li>
                            </ul>
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </DialogContent>
                </Dialog>
                
                {/* Help button */}
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-xs"
                  onClick={() => setShowTutorial(true)}
                >
                  <HelpCircle className="h-4 w-4 mr-1" />
                  Help
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

GraphVisualization.displayName = "GraphVisualization";

export default GraphVisualization;