import { FC, useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import Sidebar from '@/components/Sidebar';
import { useSidebar } from '@/components/ui/sidebar';
import { useAppState } from '@/contexts/AppStateContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Menu, Brain, Database, Plus, Network, Save, PlusCircle, Sparkles, ZoomIn, ZoomOut, 
  AlertCircle, RefreshCw, Trash2, Upload, ChevronDown, Loader2, BookOpen, 
  Maximize, Minimize, Code, Clock, Share2, Download, Settings, LayoutGrid, Eye,
  FileText, Globe, Image, FileVideo, Command, RotateCcw, ListFilter, BarChart3,
  Lightbulb, Zap, Search, ArrowUpRight, SlidersHorizontal, PanelLeft, Wand2, X
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from '@/lib/api';
import ProcessingLogNext from '@/components/multimodal/ProcessingLogNext';
import GraphVisualizer from '@/components/multimodal/GraphVisualizer';
import SourceCardNext from '@/components/multimodal/SourceCardNext';

// Types
export type SourceType = 'text' | 'website' | 'image' | 'pdf' | 'youtube';

export interface Source {
  id: string;
  type: SourceType;
  title: string;
  content: string;
  isProcessed: boolean;
  isProcessing: boolean;
  processingTime?: number;
  error?: string;
}

export interface Message {
  role: 'system' | 'assistant' | 'user';
  content: string;
  timestamp: Date;
}

export interface Node {
  id: number;
  label: string;
  group?: number;
  type?: string;
  source?: string;
  properties?: Record<string, any>;
}

export interface Link {
  source: number;
  target: number;
  label?: string;
  value?: number;
  source_type?: string;
}

export interface KnowledgeGraph {
  nodes: Node[];
  links: Link[];
}

// Generate unique ID
const generateId = () => Math.random().toString(36).substr(2, 9);

// Main component
const Multimodal: FC = () => {
  // Get app state context
  const { appState, updateMultimodalPage } = useAppState();
  
  // State
  const [activeTab, setActiveTab] = useState('sources');
  const [sourceType, setSourceType] = useState<SourceType>('text');
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceContent, setSourceContent] = useState('');
  const [activeSourceId, setActiveSourceId] = useState<string | null>(
    appState.multimodalPage.activeSource || null
  );
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);
  
  const [multimodalState, setMultimodalState] = useState<{
    sources: Source[];
    isProcessing: boolean;
    messages: Message[];
    streamingContent: string;
    graph: KnowledgeGraph;
  }>({
    sources: appState.multimodalPage.sources || [],
    isProcessing: false,
    messages: [],
    streamingContent: '',
    graph: appState.multimodalPage.combinedGraph || { nodes: [], links: [] }
  });
  
  // Refs
  const logsRef = useRef<HTMLDivElement>(null);
  
  // Hooks
  const { toast } = useToast();
  
  // Get sidebar context for layout
  const sidebar = useSidebar();
  const { state, isMobile, openMobile: isSidebarOpenMobile } = sidebar;
  
  // Calculate sidebar width for proper spacing
  const sidebarWidth = (sidebar as any).width || (state === 'expanded' ? 256 : 80);
  
  // Effects
  useEffect(() => {
    if (logsRef.current && multimodalState.messages.length > 0) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [multimodalState.messages]);
  
  // Update app state when local state changes
  useEffect(() => {
    updateMultimodalPage({
      sources: multimodalState.sources,
      combinedGraph: multimodalState.graph,
      activeSource: activeSourceId || ''
    });
  }, [multimodalState.sources, multimodalState.graph, activeSourceId, updateMultimodalPage]);
  
  // Handlers
  const handleSaveGraph = async () => {
    try {
      if (multimodalState.graph.nodes.length === 0) {
        toast({
          title: 'No graph to save',
          description: 'Process your sources first to generate a graph',
          variant: 'destructive'
        });
        return;
      }
      
      const graphName = prompt('Enter a name for this graph:');
      if (!graphName) return;
      
      setMultimodalState(prev => ({
        ...prev,
        isProcessing: true
      }));
      
      const sourceNames = multimodalState.sources.map(s => s.title).join(', ');
      
      const response = await apiRequest('/api/knowledge-graphs', {
        method: 'POST',
        data: {
          name: graphName,
          description: `Generated from multimodal sources: ${sourceNames}`,
          graph: multimodalState.graph
        }
      });
      
      setMultimodalState(prev => ({
        ...prev,
        isProcessing: false
      }));
      
      toast({
        title: 'Graph Saved',
        description: `Graph "${graphName}" saved successfully with ${multimodalState.graph.nodes.length} nodes and ${multimodalState.graph.links.length} links`
      });
    } catch (error: any) {
      setMultimodalState(prev => ({
        ...prev,
        isProcessing: false
      }));
      
      toast({
        title: 'Error',
        description: 'Failed to save graph: ' + (error.message || 'Unknown error'),
        variant: 'destructive'
      });
    }
  };
  
  const handleAddSource = () => {
    if (!sourceTitle || !sourceContent) {
      toast({
        title: 'Missing information',
        description: 'Please provide both title and content for the source',
        variant: 'destructive'
      });
      return;
    }
    
    const newSource: Source = {
      id: generateId(),
      type: sourceType,
      title: sourceTitle,
      content: sourceContent,
      isProcessed: false,
      isProcessing: false
    };
    
    setMultimodalState(prev => ({
      ...prev,
      sources: [...prev.sources, newSource]
    }));
    
    setSourceTitle('');
    setSourceContent('');
    setIsAddSourceModalOpen(false);
    
    toast({
      title: 'Source Added',
      description: `${sourceType.charAt(0).toUpperCase() + sourceType.slice(1)} source "${sourceTitle}" has been added`
    });
  };
  
  const handleDeleteSource = (id: string) => {
    const sourceToDelete = multimodalState.sources.find(s => s.id === id);
    
    setMultimodalState(prev => ({
      ...prev,
      sources: prev.sources.filter(source => source.id !== id)
    }));
    
    if (activeSourceId === id) {
      setActiveSourceId(null);
    }
    
    toast({
      title: 'Source Removed',
      description: `${sourceToDelete?.title} has been removed`
    });
  };
  
  const handleEditSource = (id: string, updatedSource: Partial<Source>) => {
    setMultimodalState(prev => ({
      ...prev,
      sources: prev.sources.map(source => 
        source.id === id ? { ...source, ...updatedSource } : source
      )
    }));
    
    toast({
      title: 'Source Updated',
      description: 'Source information has been updated'
    });
  };
  
  const handleClearMessages = () => {
    setMultimodalState(prev => ({
      ...prev,
      messages: []
    }));
  };
  
  const handleDragStart = (e: React.DragEvent, id: string, index: number) => {
    setDragSourceId(id);
  };
  
  const handleDragOver = (e: React.DragEvent, id: string, index: number) => {
    e.preventDefault();
    if (id === dragSourceId) return;
  };
  
  const handleDrop = (e: React.DragEvent, targetId: string, index: number) => {
    if (!dragSourceId || targetId === dragSourceId) {
      setDragSourceId(null);
      return;
    }
    
    setMultimodalState(prev => {
      const sources = [...prev.sources];
      const dragSourceIndex = sources.findIndex(s => s.id === dragSourceId);
      const targetSourceIndex = sources.findIndex(s => s.id === targetId);
      
      if (dragSourceIndex !== -1 && targetSourceIndex !== -1) {
        const [draggedSource] = sources.splice(dragSourceIndex, 1);
        sources.splice(targetSourceIndex, 0, draggedSource);
      }
      
      return {
        ...prev,
        sources
      };
    });
    
    setDragSourceId(null);
  };
  
  // AI processing
  const processSource = async (source: Source): Promise<{
    success: boolean;
    nodes: Node[];
    links: Link[];
    messages: Message[];
    processingTime: number;
  }> => {
    try {
      // Create system message
      const systemMessage: Message = {
        role: 'system',
        content: `Processing source: "${source.title}" (${source.type})...`,
        timestamp: new Date()
      };
      
      // Add to messages
      let messages = [systemMessage];
      
      // Start timer
      const startTime = Date.now();
      
      // Make API request based on source type
      let response;
      if (source.type === 'text') {
        response = await apiRequest('/api/extract/text', {
          method: 'POST',
          data: {
            text: source.content,
            title: source.title
          }
        });
      } else if (source.type === 'website') {
        response = await apiRequest('/api/extract/url', {
          method: 'POST',
          data: {
            url: source.content,
            sourceSystem: 'general'
          }
        });
      } else {
        // Not implemented yet - create placeholder message
        const notImplementedMessage: Message = {
          role: 'system',
          content: `Processing ${source.type} sources is not fully implemented yet. Using sample data for demonstration.`,
          timestamp: new Date()
        };
        
        messages.push(notImplementedMessage);
        
        // Create sample data
        response = {
          graph: {
            nodes: [
              { id: Math.floor(Math.random() * 1000), label: source.title, group: 1, source: source.title },
              { id: Math.floor(Math.random() * 1000), label: 'Entity 1', group: 2, source: source.title },
              { id: Math.floor(Math.random() * 1000), label: 'Entity 2', group: 3, source: source.title }
            ],
            links: [
              { source: 0, target: 1, label: 'related to' },
              { source: 0, target: 2, label: 'contains' }
            ]
          }
        };
        
        // Add artificial delay
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // End timer
      const endTime = Date.now();
      const processingTime = (endTime - startTime) / 1000;
      
      // Create completion message
      const completionMessage: Message = {
        role: 'system',
        content: `Completed processing "${source.title}" in ${processingTime.toFixed(2)} seconds. Extracted ${response.graph.nodes.length} entities and ${response.graph.links.length} relationships.`,
        timestamp: new Date()
      };
      
      // Add to messages
      messages.push(completionMessage);
      
      // Return results
      return {
        success: true,
        nodes: response.graph.nodes,
        links: response.graph.links,
        messages: messages,
        processingTime
      };
    } catch (error: any) {
      // Create error message
      const errorMessage: Message = {
        role: 'system',
        content: `Error processing "${source.title}": ${error.message || 'Unknown error'}`,
        timestamp: new Date()
      };
      
      // Return error
      return {
        success: false,
        nodes: [],
        links: [],
        messages: [errorMessage],
        processingTime: 0
      };
    }
  };
  
  const mergeGraphs = (existingGraph: KnowledgeGraph, newNodes: Node[], newLinks: Link[]): KnowledgeGraph => {
    // Create a copy of the existing graph
    const mergedGraph: KnowledgeGraph = {
      nodes: [...existingGraph.nodes],
      links: [...existingGraph.links]
    };
    
    // Process new nodes
    for (const node of newNodes) {
      // Check if a similar node already exists
      const existingNode = mergedGraph.nodes.find(n => 
        n.label && node.label && n.label.toLowerCase() === node.label.toLowerCase()
      );
      
      if (!existingNode) {
        // If no similar node exists, add this one
        const newNodeId = mergedGraph.nodes.length > 0 
          ? Math.max(...mergedGraph.nodes.map(n => n.id)) + 1 
          : 0;
        
        mergedGraph.nodes.push({
          ...node,
          id: newNodeId
        });
      }
    }
    
    // Process new links
    for (const link of newLinks) {
      // Map source and target IDs to their corresponding nodes in the merged graph
      const sourceNode = newNodes.find(n => n.id === link.source);
      const targetNode = newNodes.find(n => n.id === link.target);
      
      if (sourceNode && targetNode) {
        // Find corresponding nodes in merged graph
        const mergedSourceNode = mergedGraph.nodes.find(
          n => n.label && sourceNode.label && n.label.toLowerCase() === sourceNode.label.toLowerCase()
        );
        const mergedTargetNode = mergedGraph.nodes.find(
          n => n.label && targetNode.label && n.label.toLowerCase() === targetNode.label.toLowerCase()
        );
        
        if (mergedSourceNode && mergedTargetNode) {
          // Check if a similar link already exists
          const existingLink = mergedGraph.links.find(l => 
            l.source === mergedSourceNode.id && 
            l.target === mergedTargetNode.id &&
            l.label === link.label
          );
          
          if (!existingLink) {
            // Add new link
            mergedGraph.links.push({
              source: mergedSourceNode.id,
              target: mergedTargetNode.id,
              label: link.label
            });
          }
        }
      }
    }
    
    return mergedGraph;
  };
  
  const handleProcessSource = async (id: string) => {
    const source = multimodalState.sources.find(s => s.id === id);
    if (!source) return;
    
    setMultimodalState(prev => ({
      ...prev,
      isProcessing: true,
      sources: prev.sources.map(s => 
        s.id === id ? { ...s, isProcessing: true } : s
      )
    }));
    
    try {
      const result = await processSource(source);
      
      // Update multimodal state with new messages
      setMultimodalState(prev => ({
        ...prev,
        messages: [...prev.messages, ...result.messages],
        isProcessing: false,
        sources: prev.sources.map(s => 
          s.id === id 
            ? { 
                ...s, 
                isProcessed: result.success, 
                processingTime: result.processingTime,
                isProcessing: false,
                error: result.success ? undefined : 'Processing failed'
              } 
            : s
        ),
        // Merge the new graph with the existing one
        graph: mergeGraphs(prev.graph, result.nodes, result.links)
      }));
      
      toast({
        title: result.success ? 'Processing Complete' : 'Processing Failed',
        description: result.success 
          ? `Extracted ${result.nodes.length} entities and ${result.links.length} relationships` 
          : 'Failed to process source. Check logs for details.',
        variant: result.success ? 'default' : 'destructive'
      });
    } catch (error: any) {
      setMultimodalState(prev => ({
        ...prev,
        isProcessing: false,
        sources: prev.sources.map(s => 
          s.id === id 
            ? { 
                ...s, 
                isProcessed: false, 
                isProcessing: false,
                error: error.message || 'Unknown error'
              } 
            : s
        ),
        messages: [...prev.messages, {
          role: 'system',
          content: `Error processing "${source.title}": ${error.message || 'Unknown error'}`,
          timestamp: new Date()
        }]
      }));
      
      toast({
        title: 'Processing Error',
        description: error.message || 'An unknown error occurred',
        variant: 'destructive'
      });
    }
  };
  
  const handleProcessAllSources = async () => {
    const unprocessedSources = multimodalState.sources.filter(s => !s.isProcessed && !s.isProcessing);
    
    if (unprocessedSources.length === 0) {
      toast({
        title: 'No sources to process',
        description: 'All sources have already been processed',
        variant: 'default'
      });
      return;
    }
    
    setMultimodalState(prev => ({
      ...prev,
      isProcessing: true,
      messages: [...prev.messages, {
        role: 'system',
        content: `Starting batch processing of ${unprocessedSources.length} sources...`,
        timestamp: new Date()
      }]
    }));
    
    // Process each source sequentially
    for (const source of unprocessedSources) {
      await handleProcessSource(source.id);
    }
    
    setMultimodalState(prev => ({
      ...prev,
      isProcessing: false,
      messages: [...prev.messages, {
        role: 'system',
        content: `Completed batch processing of ${unprocessedSources.length} sources.`,
        timestamp: new Date()
      }]
    }));
    
    toast({
      title: 'Batch Processing Complete',
      description: `Processed ${unprocessedSources.length} sources`,
      variant: 'default'
    });
  };
  
  // Format source type label
  const getSourceTypeLabel = (type: SourceType) => {
    switch (type) {
      case 'text': return 'Text';
      case 'website': return 'Website';
      case 'image': return 'Image';
      case 'pdf': return 'PDF';
      case 'youtube': return 'YouTube';
      default: return type;
    }
  };
  
  // Get source type color
  const getSourceTypeColor = (type: SourceType) => {
    switch (type) {
      case 'text': return 'bg-blue-600';
      case 'website': return 'bg-purple-600';
      case 'image': return 'bg-green-600';
      case 'pdf': return 'bg-red-600';
      case 'youtube': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };
  
  // Additional state for the modern UI
  const [sidePanel, setSidePanel] = useState<'settings' | 'info' | null>(null);
  const [graphViewMode, setGraphViewMode] = useState<'2d' | '3d'>('2d');
  const [layoutType, setLayoutType] = useState<'force' | 'radial' | 'hierarchical'>('force');
  const [showGraphControls, setShowGraphControls] = useState(false);
  const [highlightedEntities, setHighlightedEntities] = useState<{[key: string]: boolean}>({});
  
  // Placeholder function for the required onConnect prop in SourceCardNext
  const handleConnectSource = (id: string) => {
    toast({
      title: 'Connection Feature',
      description: 'This feature will be implemented in a future update.',
    });
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-gray-100">
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 relative overflow-hidden">
          {/* Main Content */}
          <main
            style={{ 
              marginLeft: isMobile ? (isSidebarOpenMobile ? sidebarWidth : 0) : sidebarWidth,
              width: isMobile ? '100%' : `calc(100% - ${sidebarWidth}px)`,
              transition: 'margin-left 0.3s, width 0.3s'
            }}
            className="h-full overflow-auto bg-gradient-to-b from-[#091426] to-[#070b14]"
          >
            <div className="container mx-auto pb-8">
              {/* Modern Sleek Header with Glassmorphism */}
              <div className="sticky top-0 z-10 backdrop-blur-md bg-gradient-to-r from-[#0f1629]/90 to-[#0f182f]/90 border-b border-blue-900/20 mb-6">
                <div className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-2 rounded-lg mr-3 shadow-lg shadow-blue-900/20">
                        <Network className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h1 className="text-xl font-semibold text-white">Knowledge Explorer</h1>
                          <Badge className="bg-gradient-to-r from-blue-600/20 to-indigo-600/20 text-blue-300 border-blue-500/20 font-semibold text-xs">
                            BETA
                          </Badge>
                        </div>
                        <p className="text-blue-300/70 text-sm">Transform unstructured data into visual insights</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              size="sm"
                              variant="ghost" 
                              className="rounded-full w-8 h-8 p-0 text-gray-400 hover:text-white hover:bg-gray-800/50"
                              onClick={() => setSidePanel(sidePanel === 'info' ? null : 'info')}
                            >
                              <BookOpen className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Documentation & Tips</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              size="sm"
                              variant="ghost" 
                              className="rounded-full w-8 h-8 p-0 text-gray-400 hover:text-white hover:bg-gray-800/50"
                              onClick={() => setSidePanel(sidePanel === 'settings' ? null : 'settings')}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Settings & Configuration</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      {multimodalState.graph.nodes.length > 0 && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                size="sm"
                                variant="ghost" 
                                className="rounded-full w-8 h-8 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-900/30"
                                onClick={handleSaveGraph}
                                disabled={multimodalState.isProcessing}
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Save Knowledge Graph</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      
                      <Button 
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md"
                        size="sm"
                        onClick={() => setIsAddSourceModalOpen(true)}
                      >
                        <Plus className="h-4 w-4 mr-1.5" />
                        Add Source
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
          
              <div className="flex-grow container mx-auto px-4 py-3 text-gray-200">
                <div className="h-[calc(100vh-4.5rem)] overflow-hidden">
                  <Tabs 
                    value={activeTab} 
                    onValueChange={setActiveTab} 
                    className="w-full h-full"
                  >
                    <TabsList className="bg-gray-800/50 border border-gray-700/50 w-full justify-start p-1">
                      <TabsTrigger 
                        value="sources" 
                        className="data-[state=active]:bg-gray-900 data-[state=active]:text-primary"
                      >
                        <Database className="h-4 w-4 mr-1.5" />
                        Sources
                        {multimodalState.sources.length > 0 && (
                          <Badge className="ml-1.5 bg-gray-800 text-primary border-primary text-xs">
                            {multimodalState.sources.length}
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger 
                        value="processing" 
                        className="data-[state=active]:bg-gray-900 data-[state=active]:text-primary"
                      >
                        <Brain className="h-4 w-4 mr-1.5" />
                        Processing & Visualization
                      </TabsTrigger>
                    </TabsList>
                    
                    <div className="mt-4">
                      {/* Sources Tab */}
                      <TabsContent value="sources" className="mt-0">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                          {/* Sources List */}
                          <div className="lg:col-span-12 space-y-6">
                            <div className="bg-gray-900/80 border-gray-800 rounded-lg border overflow-hidden shadow-lg">
                              <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex justify-between items-center">
                                <div className="flex items-center">
                                  <Database className="h-4 w-4 mr-2 text-primary" />
                                  <h2 className="text-base font-medium">Information Sources</h2>
                                </div>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => setIsAddSourceModalOpen(true)}
                                  className="h-8 text-xs bg-gray-800 hover:bg-gray-700"
                                >
                                  <PlusCircle className="h-3 w-3 mr-1.5" />
                                  Add
                                </Button>
                              </div>
                              
                              <div className="p-4">
                                {multimodalState.sources.length === 0 ? (
                                  <div className="bg-gray-900/60 border border-dashed border-gray-800 rounded-lg p-8 text-center">
                                    <Database className="h-12 w-12 mx-auto mb-3 text-primary opacity-40" />
                                    <p className="text-gray-500 mb-4">No information sources added yet</p>
                                    <Button 
                                      onClick={() => setIsAddSourceModalOpen(true)}
                                      className="bg-primary hover:bg-primary/90"
                                    >
                                      <PlusCircle className="h-4 w-4 mr-1" />
                                      Add Your First Source
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-800">
                                    <div className="flex items-center justify-between mb-2 text-xs text-gray-500 px-1">
                                      <span className="flex items-center">
                                        <ChevronDown className="h-3 w-3 mr-1 rotate-180" />
                                        <span>Drag to reorder processing sequence</span>
                                      </span>
                                      <span className="text-xs">
                                        {multimodalState.sources.length} source{multimodalState.sources.length !== 1 ? 's' : ''}
                                      </span>
                                    </div>
                                    
                                    {multimodalState.sources.map((source, index) => (
                                      <SourceCardNext 
                                        key={source.id} 
                                        source={source} 
                                        index={index}
                                        onDelete={handleDeleteSource}
                                        onEdit={handleEditSource}
                                        onProcess={handleProcessSource}
                                        onConnect={handleConnectSource}
                                        isActive={activeSourceId === source.id}
                                        onSelect={setActiveSourceId}
                                        isDragging={dragSourceId === source.id}
                                        onDragStart={handleDragStart}
                                        onDragOver={handleDragOver}
                                        onDrop={handleDrop}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                              
                              {multimodalState.sources.length > 0 && (
                                <div className="bg-gray-900 border-t border-gray-800 px-4 py-3 flex justify-between items-center">
                                  <span className="text-xs text-gray-400">
                                    {multimodalState.sources.filter(s => s.isProcessed).length} of {multimodalState.sources.length} processed
                                  </span>
                                  <Button 
                                    className="bg-primary hover:bg-primary/90"
                                    size="sm"
                                    onClick={handleProcessAllSources}
                                    disabled={multimodalState.isProcessing || multimodalState.sources.length === 0}
                                  >
                                    <Brain className="h-4 w-4 mr-1.5" />
                                    Process All with OpenAI
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                      
                      {/* Processing & Visualization Tab */}
                      <TabsContent value="processing" className="mt-0">
                        {/* Processing status bar */}
                        <div className="flex flex-wrap gap-3 items-center justify-between mb-4 px-1 py-2">
                          <div className="flex gap-3 items-center">
                            <div className={`relative h-2.5 w-2.5 rounded-full ${
                              multimodalState.isProcessing ? 'bg-amber-400 animate-pulse' : 
                              multimodalState.graph.nodes.length > 0 ? 'bg-emerald-400' : 'bg-gray-500'
                            }`}>
                              <span className={`absolute -inset-0.5 rounded-full opacity-50 animate-ping ${
                                multimodalState.isProcessing ? 'bg-amber-400' : 
                                multimodalState.graph.nodes.length > 0 ? 'bg-emerald-400' : 'bg-transparent'
                              }`}></span>
                            </div>
                            <span className={`text-sm font-medium ${
                              multimodalState.isProcessing ? 'text-amber-400' : 
                              multimodalState.graph.nodes.length > 0 ? 'text-emerald-400' : 'text-gray-400'
                            }`}>
                              {multimodalState.isProcessing ? 'Processing data...' : 
                               multimodalState.graph.nodes.length > 0 ? 'Knowledge Graph Ready' : 'Ready for Processing'}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {multimodalState.graph.nodes.length > 0 && (
                              <div className="bg-gray-900/90 text-xs px-3 py-1.5 rounded-full border border-gray-800">
                                <span className="text-gray-400 mr-1">Nodes:</span>
                                <span className="text-blue-400 font-semibold">{multimodalState.graph.nodes.length}</span>
                                <span className="text-gray-600 mx-1">|</span>
                                <span className="text-gray-400 mr-1">Links:</span>
                                <span className="text-purple-400 font-semibold">{multimodalState.graph.links.length}</span>
                              </div>
                            )}
                            
                            {multimodalState.messages.length > 0 && !multimodalState.isProcessing && (
                              <Button
                                variant="ghost"
                                onClick={handleClearMessages}
                                className="h-8 text-xs text-gray-400 hover:text-red-500 hover:bg-gray-700/30"
                              >
                                <AlertCircle className="h-3 w-3 mr-1.5" />
                                Clear Logs
                              </Button>
                            )}
                            
                            {multimodalState.graph.nodes.length > 0 && (
                              <Button 
                                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 transition-all text-sm"
                                onClick={handleSaveGraph}
                                disabled={multimodalState.isProcessing}
                              >
                                <Save className="h-3.5 w-3.5 mr-1.5" />
                                Save Graph
                              </Button>
                            )}
                            
                            <Button 
                              className="bg-gradient-to-r from-blue-600 to-primary hover:from-blue-700 hover:to-primary/90 text-sm"
                              onClick={handleProcessAllSources}
                              disabled={multimodalState.isProcessing || multimodalState.sources.length === 0}
                            >
                              <Brain className="h-3.5 w-3.5 mr-1.5" />
                              Process All
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                          {/* Main visualization area */}
                          <div className="lg:col-span-8">
                            <div className="bg-gray-900/50 border border-gray-800 rounded-lg h-[calc(100vh-240px)] overflow-hidden relative">
                              {multimodalState.graph.nodes.length > 0 ? (
                                <GraphVisualizer 
                                  graph={multimodalState.graph}
                                  viewMode={graphViewMode}
                                  layoutType={layoutType}
                                  className="w-full h-full"
                                />
                              ) : (
                                <div className="flex items-center justify-center h-full">
                                  <div className="text-center opacity-50 max-w-md p-8">
                                    <Network className="h-16 w-16 mx-auto mb-4 text-blue-500/30" />
                                    <h3 className="text-xl font-semibold text-gray-400 mb-2">No Graph Data</h3>
                                    <p className="text-gray-500 mb-6">
                                      Process your sources to generate a knowledge graph and visualize connections between entities.
                                    </p>
                                    <Button 
                                      variant="outline"
                                      disabled={multimodalState.sources.length === 0}
                                      onClick={handleProcessAllSources}
                                      className="bg-gray-900/70 border-gray-700 text-gray-300 hover:bg-gray-800"
                                    >
                                      <Brain className="h-4 w-4 mr-2" />
                                      Process Sources
                                    </Button>
                                  </div>
                                </div>
                              )}
                              {multimodalState.graph.nodes.length > 0 && showGraphControls && (
                                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900/90 backdrop-blur-sm border border-gray-800 rounded-lg px-3 py-2 flex items-center space-x-2">
                                  <Button
                                    variant="ghost"
                                    size="sm" 
                                    className="h-7 w-7 p-0 text-gray-400 hover:text-white rounded-md"
                                    onClick={() => setGraphViewMode(graphViewMode === '2d' ? '3d' : '2d')}
                                  >
                                    {graphViewMode === '2d' ? <Maximize className="h-3.5 w-3.5" /> : <Minimize className="h-3.5 w-3.5" />}
                                  </Button>
                                  <Separator orientation="vertical" className="h-5 bg-gray-700" />
                                  <Select
                                    value={layoutType}
                                    onValueChange={(v: any) => setLayoutType(v)}
                                  >
                                    <SelectTrigger className="h-7 text-xs bg-transparent border-gray-700 focus:ring-0">
                                      <SelectValue placeholder="Layout Type" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-900 border-gray-700">
                                      <SelectItem value="force">Force</SelectItem>
                                      <SelectItem value="radial">Radial</SelectItem>
                                      <SelectItem value="hierarchical">Hierarchical</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Separator orientation="vertical" className="h-5 bg-gray-700" />
                                  <Button
                                    variant="ghost"
                                    size="sm" 
                                    className="h-7 w-7 p-0 text-gray-400 hover:text-white rounded-md"
                                  >
                                    <ZoomIn className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm" 
                                    className="h-7 w-7 p-0 text-gray-400 hover:text-white rounded-md"
                                  >
                                    <ZoomOut className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Processing logs panel */}
                          <div className="lg:col-span-4">
                            <div className="bg-gray-900/50 border border-gray-800 rounded-lg h-[calc(100vh-240px)] overflow-hidden flex flex-col">
                              <div className="bg-gray-900 px-4 py-2 border-b border-gray-800 flex justify-between items-center">
                                <div className="flex items-center">
                                  <div className="h-2 w-2 rounded-full mr-2 animate-pulse bg-blue-500"></div>
                                  <span className="font-medium text-sm">Processing Logs</span>
                                </div>
                                <div className="flex gap-1">
                                  {multimodalState.messages.length > 0 && !multimodalState.isProcessing && (
                                    <Button
                                      variant="ghost"
                                      size="xs"
                                      onClick={handleClearMessages}
                                      className="h-6 text-xs py-0 px-1.5 text-gray-400 hover:text-red-400 hover:bg-transparent"
                                    >
                                      <X className="h-3 w-3 mr-1 text-gray-500" />
                                      Clear
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <div 
                                ref={logsRef}
                                className="flex-grow overflow-y-auto p-3 space-y-2 bg-gray-950/20"
                              >
                                <ProcessingLogNext 
                                  messages={multimodalState.messages} 
                                  isProcessing={multimodalState.isProcessing}
                                  streamingContent={multimodalState.streamingContent}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                    </div>
                  </Tabs>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
      
      {/* Add Source Modal */}
      <Dialog open={isAddSourceModalOpen} onOpenChange={setIsAddSourceModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-gray-900 text-gray-100 border-gray-800">
          <DialogHeader>
            <DialogTitle>Add Information Source</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="sourceType">Source Type</Label>
              <Select
                value={sourceType}
                onValueChange={(value: SourceType) => setSourceType(value)}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700">
                  <SelectValue placeholder="Select source type" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="website">Website URL</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="pdf">PDF Document</SelectItem>
                  <SelectItem value="youtube">YouTube Video</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="sourceTitle">Title</Label>
              <Input
                id="sourceTitle"
                placeholder="Enter a title for this source"
                value={sourceTitle}
                onChange={(e) => setSourceTitle(e.target.value)}
                className="bg-gray-800 border-gray-700"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="sourceContent">
                {sourceType === 'text' ? 'Content' :
                 sourceType === 'website' ? 'URL' :
                 sourceType === 'youtube' ? 'Video URL' :
                 'Reference'}
              </Label>
              
              {sourceType === 'text' ? (
                <Textarea 
                  id="sourceContent"
                  placeholder="Enter or paste text content"
                  className="min-h-[120px] bg-gray-800 border-gray-700"
                  value={sourceContent}
                  onChange={(e) => setSourceContent(e.target.value)}
                />
              ) : (
                <Input 
                  id="sourceContent"
                  placeholder={`Enter ${sourceType} URL`}
                  value={sourceContent}
                  onChange={(e) => setSourceContent(e.target.value)}
                  className="bg-gray-800 border-gray-700"
                />
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddSourceModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSource}>
              Add Source
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Multimodal;