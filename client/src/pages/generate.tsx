import React, { useState, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import Sidebar from '@/components/Sidebar';
import Instructions from '@/components/Instructions';
import TextInputPanel from '@/components/TextInputPanel';
import GraphVisualization from '@/components/GraphVisualization';
import KnowledgeGraphExplorer, { GraphRef } from '@/components/KnowledgeGraphExplorer';
import LoadingOverlay from '@/components/LoadingOverlay';
import HelpModal from '@/components/HelpModal';
import { KnowledgeGraph, EntitySchema, Node as SchemaNode, Link as SchemaLink } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useAppState } from '@/contexts/AppStateContext';
import { useLocation } from 'wouter';
import { useSidebar } from '@/components/ui/sidebar';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import {
  ArrowRightIcon,
  KeyIcon,
  SparklesIcon,
  RefreshCwIcon,
  DownloadIcon,
  ImageIcon,
  FileTextIcon,
  Share2Icon,
  Settings2Icon,
  InfoIcon,
  DatabaseIcon,
  GlobeIcon,
  NetworkIcon,
  ShuffleIcon,
  FileIcon,
  UploadIcon,
  FileUpIcon
} from 'lucide-react';

// Define model options
type ModelType = 'openai' | 'mistral' | 'spacy';

interface ModelOption {
  id: ModelType;
  name: string;
  description: string;
  requiresApiKey: boolean;
  keyName?: string;
}

const modelOptions: ModelOption[] = [
  {
    id: 'spacy',
    name: 'spaCy NLP',
    description: 'Use Python spaCy model for advanced NLP processing with dependency parsing and entity linking.',
    requiresApiKey: false
  },
  {
    id: 'openai',
    name: 'OpenAI GPT-4o',
    description: 'Use OpenAI\'s advanced GPT-4o model for enhanced entity recognition and relationship extraction.',
    requiresApiKey: true,
    keyName: 'OPENAI_API_KEY'
  },
  {
    id: 'mistral',
    name: 'Mistral Large',
    description: 'Use Mistral AI\'s Large model for accurate entity extraction and relationship mapping.',
    requiresApiKey: true,
    keyName: 'MISTRAL_API_KEY'
  }
];

type InputType = 'text' | 'document';

export default function Generate() {
  // Get the app state context for persisting state across page navigation
  const { appState, updateGeneratePage } = useAppState();
  
  // Function to clean and format extracted text
  const cleanExtractedText = (text: string): string => {
    if (!text) return '';
    
    // Remove "--- Page X ---" markers that often appear in OCR output
    let cleaned = text.replace(/---\s*Page \d+\s*---/g, '\n\n');
    
    // Replace multiple newlines with a maximum of two
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    // Remove excessive spaces
    cleaned = cleaned.replace(/[ \t]{2,}/g, ' ');
    
    // Remove spaces at the beginning of lines
    cleaned = cleaned.replace(/\n[ \t]+/g, '\n');
    
    // Add proper paragraph breaks after periods that end sentences
    cleaned = cleaned.replace(/\.(?=\S)/g, '. ');
    
    // Format numbered/bulleted lists properly
    cleaned = cleaned.replace(/(\d+\.)(?=\S)/g, '$1 ');
    cleaned = cleaned.replace(/(\*|-)(?=\S)/g, '$1 ');
    
    // Trim leading and trailing whitespace
    cleaned = cleaned.trim();
    
    return cleaned;
  };
  
  // Input method state - initialize from app state
  const [inputType, setInputType] = useState<InputType>(appState.generatePage.inputType);
  const [selectedFile, setSelectedFile] = useState<File | null>(null); // Can't persist File objects
  const [processingStage, setProcessingStage] = useState<string>('');
  const [documentPageCount, setDocumentPageCount] = useState<number>(0);
  const [currentPageProcessing, setCurrentPageProcessing] = useState<number>(0);
  const [progressPercentage, setProgressPercentage] = useState<number>(0);
  const [documentType, setDocumentType] = useState<string>('');
  const [documentProcessingStage, setDocumentProcessingStage] = useState<string>('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketId, setSocketId] = useState<string>('');
  
  // Socket.IO reference
  const socketRef = useRef<Socket | null>(null);
  const socketIdRef = useRef<string | null>(null);
  
  // Initialize state from app state
  const [text, setText] = useState<string>(appState.generatePage.text);
  const [knowledgeGraph, setKnowledgeGraph] = useState<KnowledgeGraph | null>(appState.generatePage.knowledgeGraph);
  const [enrichedGraph, setEnrichedGraph] = useState<KnowledgeGraph | null>(appState.generatePage.enrichedGraph);
  const [originalGraph, setOriginalGraph] = useState<KnowledgeGraph | null>(appState.generatePage.originalGraph);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isEnriching, setIsEnriching] = useState<boolean>(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<ModelType>(appState.generatePage.selectedModel as ModelType || 'spacy');
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState<boolean>(false);
  const [currentKeyModel, setCurrentKeyModel] = useState<ModelOption | null>(null);
  const [currentApiKey, setCurrentApiKey] = useState<string>('');
  const [isExportDialogOpen, setIsExportDialogOpen] = useState<boolean>(false);
  const [isEnrichDialogOpen, setIsEnrichDialogOpen] = useState<boolean>(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState<boolean>(false);
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState<boolean>(false);
  const [maxEnrichments, setMaxEnrichments] = useState<number>(10);
  const [graphName, setGraphName] = useState<string>('');
  const [savedGraphs, setSavedGraphs] = useState<{id: number, name: string, entityCount: number, relationCount: number, createdAt: string}[]>([]);
  const [extractResult, setExtractResult] = useState<any>(appState.generatePage.extractResult);
  const [highlightedEntityName, setHighlightedEntityName] = useState<string>('');
  const [highlightTimeout, setHighlightTimeout] = useState<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  // Get sidebar context for layout
  const sidebar = useSidebar();
  const { state, isMobile, openMobile } = sidebar;
  
  // Get navigation hook for redirection
  const [_, setLocation] = useLocation();
  
  // Calculate sidebar width for proper spacing
  const sidebarWidth = (sidebar as any).width || (state === 'expanded' ? 256 : 80);
  const graphExplorerRef = useRef<GraphRef>(null);

  // Handle text input changes
  const handleTextChange = (newText: string) => {
    setText(newText);
  };

  // Handle node click in knowledge graph to highlight corresponding text
  const handleNodeClick = (nodeId: number, nodeName: string) => {
    // Clear any existing highlight timeout
    if (highlightTimeout) {
      clearTimeout(highlightTimeout);
    }

    // Set the entity name to highlight
    setHighlightedEntityName(nodeName);

    // Clear the highlight after 3 seconds with a subtle fade
    const timeout = setTimeout(() => {
      setHighlightedEntityName('');
    }, 3000);
    
    setHighlightTimeout(timeout);

    // Show a subtle toast to indicate the highlighting
    toast({
      title: "Entity Highlighted",
      description: `"${nodeName}" is highlighted in the text`,
      duration: 2000,
    });
  };

  // Handle text clearing and completely reset all graph-related state
  const handleClearText = () => {
    setText('');
    setSelectedFile(null);
    setKnowledgeGraph(null);
    setEnrichedGraph(null);
    setOriginalGraph(null);
    setExtractResult(null); // Clear any extracted document results
    setProcessingStage('');
    setDocumentPageCount(0);
    setCurrentPageProcessing(0);
    setHighlightedEntityName(''); // Clear any text highlighting
    if (highlightTimeout) {
      clearTimeout(highlightTimeout);
      setHighlightTimeout(null);
    }
  };
  
  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Check file size limit (15MB for Generate page)
      const maxSize = 15 * 1024 * 1024; // 15MB
      if (file.size > maxSize) {
        toast({
          title: "File Too Large",
          description: `Please upload a file smaller than 15MB. Current file size: ${(file.size / 1024 / 1024).toFixed(1)}MB`,
          variant: "destructive",
        });
        // Reset the file input
        if (e.target) {
          e.target.value = '';
        }
        return;
      }
      
      setSelectedFile(file);
    }
  };
  
  // Handle file upload and text extraction
  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a file to upload.",
        variant: "destructive",
      });
      return;
    }
    
    // Check file size limit (15MB for documents)
    const maxSize = 15 * 1024 * 1024; // 15MB
    if (selectedFile.size > maxSize) {
      toast({
        title: "File Too Large",
        description: `Please upload a file smaller than 15MB. Current file size: ${(selectedFile.size / 1024 / 1024).toFixed(1)}MB`,
        variant: "destructive",
      });
      return;
    }
    
    // Check if the selected model requires an API key
    const selectedModelOption = modelOptions.find(m => m.id === selectedModel);
    if (selectedModelOption?.requiresApiKey && !apiKeys[selectedModel]) {
      toast({
        title: `${selectedModelOption.name} API Key Required`,
        description: `You've selected the ${selectedModelOption.name} model but no API key is available. Please add an API key in the Settings page.`,
        variant: "destructive",
      });
      return; // Don't proceed without API key
    }
    
    setIsProcessing(true);
    setProcessingStage('Reading document...');
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const response = await fetch('/api/extract-text', {
        method: 'POST',
        headers: {
          'X-Socket-ID': socketIdRef.current || '' // Send socket ID for progress updates
        },
        body: formData,
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to extract text from file');
      }
      
      // Only store the extraction result if we actually have text content
      if (result.text && result.text.length > 0) {
        console.log('Setting extract result with text length:', result.text.length);
        setExtractResult(result);
        setText(result.text);
      } else {
        // Handle empty extraction result
        console.error('Received empty text content from extraction');
        throw new Error('Text extraction produced no content. Please try a different file or model.');
      }
      
      // We'll skip the toast for successful document processing to make 
      // the flow more seamless when automatically proceeding to generation
      
      // Use the currently selected model instead of forcing OpenAI
      // This allows users to use spaCy if they prefer
      
      // Only show toast if this was a standalone file processing action
      // and not part of an automatic document → generate process
      if (!document.querySelector('.loading-overlay-active')) {
        const modelName = selectedModel === 'openai' ? 'OpenAI' : 
                         selectedModel === 'mistral' ? 'Mistral AI' :
                         selectedModel === 'spacy' ? 'spaCy' : 
                         'Selected';
        
        toast({
          title: "Document Ready",
          description: `Text extracted successfully. ${modelName} model will be used for analysis.`,
        });
      }
      
    } catch (error) {
      console.error('Error extracting text from file:', error);
      toast({
        title: "File Processing Failed",
        description: error instanceof Error ? error.message : "An error occurred while processing the file.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
    }
  };
  
  // Enrich knowledge graph with Wikidata
  const handleEnrichGraph = async () => {
    if (!knowledgeGraph) {
      toast({
        title: "No Graph to Enrich",
        description: "Please generate a knowledge graph first.",
        variant: "destructive",
      });
      return;
    }
    
    setIsEnriching(true);
    
    try {
      const apiEndpoint = '/api/enrich-graph';
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          graph: knowledgeGraph,
          maxEnrichments
        }),
      });

      // Parse the JSON response
      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        console.error('Error parsing JSON response:', jsonError);
        throw new Error(`Server response error: Failed to parse response (${response.status})`);
      }

      // Handle non-200 responses
      if (!response.ok) {
        let errorMessage = result.message || 'Failed to enrich graph';
        throw new Error(errorMessage);
      }

      // Store original and enriched graphs
      setEnrichedGraph(result.data.enrichedGraph);
      
      // Update the current view with the enriched graph
      setKnowledgeGraph(result.data.enrichedGraph);
      
      // Also store the original graph for later restoration if needed
      setOriginalGraph(result.data.originalGraph);

      toast({
        title: "Success",
        description: `Knowledge graph enriched with ${result.data.newEntityCount || 0} new entities and ${result.data.newRelationCount || 0} new relationships!`,
      });
    } catch (error) {
      console.error('Error enriching knowledge graph:', error);
      
      let errorMessage = "Failed to enrich knowledge graph.";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Enrichment Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsEnriching(false);
      setIsEnrichDialogOpen(false);
    }
  };

  // Toggle help modal
  const toggleHelpModal = () => {
    setIsHelpModalOpen(!isHelpModalOpen);
  };

  // Open API key dialog
  const openApiKeyDialog = (model: ModelOption) => {
    setCurrentKeyModel(model);
    setCurrentApiKey(apiKeys[model.id] || '');
    setIsApiKeyDialogOpen(true);
  };

  // Export graph data as JSON
  const exportAsJson = () => {
    if (!knowledgeGraph) return;

    const dataStr = JSON.stringify(knowledgeGraph, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'knowledge_graph.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    toast({
      title: "Export Complete",
      description: "Knowledge graph exported as JSON successfully!",
    });
  };

  // Export graph data as RDF
  const exportAsRdf = () => {
    if (!knowledgeGraph) return;
    
    // Simple RDF format conversion
    let rdf = '@prefix : <http://example.org/> .\n';
    rdf += '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n\n';
    
    // Add entity type definitions
    rdf += '# Entity Types\n';
    rdf += ':Person rdf:type rdf:Class .\n';
    rdf += ':Place rdf:type rdf:Class .\n';
    rdf += ':Concept rdf:type rdf:Class .\n';
    rdf += ':Organization rdf:type rdf:Class .\n';
    rdf += ':Date rdf:type rdf:Class .\n';
    rdf += ':Other rdf:type rdf:Class .\n\n';
    
    // Add entity declarations
    rdf += '# Entities\n';
    knowledgeGraph.nodes.forEach(node => {
      const entityId = node.name.replace(/\s+/g, '_').replace(/[^\w]/g, '');
      const entityType = 
        node.group === 1 ? 'Person' :
        node.group === 2 ? 'Place' :
        node.group === 3 ? 'Concept' :
        node.group === 4 ? 'Organization' :
        node.group === 5 ? 'Date' : 'Other';
      
      rdf += `:${entityId} rdf:type :${entityType} .\n`;
      rdf += `:${entityId} :name "${node.name}" .\n`;
    });
    
    // Add relationships
    rdf += '\n# Relationships\n';
    knowledgeGraph.links.forEach(link => {
      const sourceNode = knowledgeGraph.nodes.find(n => n.id === link.source);
      const targetNode = knowledgeGraph.nodes.find(n => n.id === link.target);
      
      if (sourceNode && targetNode) {
        const sourceId = sourceNode.name.replace(/\s+/g, '_').replace(/[^\w]/g, '');
        const targetId = targetNode.name.replace(/\s+/g, '_').replace(/[^\w]/g, '');
        const predicate = link.label.replace(/\s+/g, '_').replace(/[^\w]/g, '');
        
        rdf += `:${sourceId} :${predicate} :${targetId} .\n`;
      }
    });
    
    const dataUri = 'data:text/plain;charset=utf-8,'+ encodeURIComponent(rdf);
    const exportFileDefaultName = 'knowledge_graph.ttl';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    toast({
      title: "Export Complete",
      description: "Knowledge graph exported as RDF Turtle format successfully!",
    });
  };

  // Export graph as image
  const exportAsImage = () => {
    if (!graphExplorerRef.current) return;
    
    toast({
      title: "Image Export",
      description: "Converting graph to image...",
    });
    
    try {
      // This function would be implemented in GraphVisualization or KnowledgeGraphExplorer
      if (graphExplorerRef.current.exportAsImage) {
        graphExplorerRef.current.exportAsImage();
      } else {
        throw new Error('Export as image not supported');
      }
    } catch (error) {
      console.error('Error exporting graph as image:', error);
      toast({
        title: "Export Failed",
        description: "Unable to export graph as image. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Load API keys from database on component mount
  const fetchApiKeys = async () => {
    try {
      const keysByProvider: Record<string, string> = {};
      
      // Fetch OpenAI keys (using the /active endpoint to get the full, unmasked key)
      const openaiResponse = await fetch('/api/api-keys/openai/active');
      if (openaiResponse.ok) {
        const openaiData = await openaiResponse.json();
        if (openaiData.success && openaiData.data) {
          keysByProvider['openai'] = openaiData.data.key;
        }
      }
      
      // Fetch Mistral keys (using the /active endpoint to get the full, unmasked key)
      const mistralResponse = await fetch('/api/api-keys/mistral/active');
      if (mistralResponse.ok) {
        const mistralData = await mistralResponse.json();
        if (mistralData.success && mistralData.data) {
          keysByProvider['mistral'] = mistralData.data.key;
        }
      }
      
      console.log('API Keys loaded successfully:', {
        openai: keysByProvider['openai'] ? 'Key found' : 'No key',
        mistral: keysByProvider['mistral'] ? 'Key found' : 'No key'
      });
      
      setApiKeys(keysByProvider);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      toast({
        title: "Failed to Load API Keys",
        description: "Could not load your API keys. Some features may be limited.",
        variant: "destructive"
      });
    }
  };
  
  // Load API keys on mount
  useEffect(() => {
    fetchApiKeys();
  }, []);
  
  // Fetch saved graphs on component mount
  useEffect(() => {
    fetchSavedGraphs();
  }, []);
  
  // Update app state context when relevant state changes
  useEffect(() => {
    // Check if values have actually changed before updating to prevent infinite loop
    const hasKnowledgeGraphChanged = 
      JSON.stringify(appState.generatePage.knowledgeGraph) !== JSON.stringify(knowledgeGraph);
    const hasOriginalGraphChanged = 
      JSON.stringify(appState.generatePage.originalGraph) !== JSON.stringify(originalGraph);
    const hasEnrichedGraphChanged = 
      JSON.stringify(appState.generatePage.enrichedGraph) !== JSON.stringify(enrichedGraph);
    const hasTextChanged = appState.generatePage.text !== text;
    const hasModelChanged = appState.generatePage.selectedModel !== selectedModel;
    const hasInputTypeChanged = appState.generatePage.inputType !== inputType;
    const hasExtractResultChanged = 
      JSON.stringify(appState.generatePage.extractResult) !== JSON.stringify(extractResult);
    
    if (
      hasKnowledgeGraphChanged || 
      hasOriginalGraphChanged || 
      hasEnrichedGraphChanged || 
      hasTextChanged || 
      hasModelChanged || 
      hasInputTypeChanged || 
      hasExtractResultChanged
    ) {
      updateGeneratePage({
        knowledgeGraph,
        originalGraph,
        enrichedGraph,
        text,
        selectedModel,
        inputType,
        extractResult
      });
    }
  }, [
    knowledgeGraph, 
    originalGraph, 
    enrichedGraph, 
    text, 
    selectedModel, 
    inputType, 
    extractResult, 
    updateGeneratePage, 
    appState.generatePage
  ]);
  
  // Setup Socket.IO connection for real-time PDF processing updates
  useEffect(() => {
    // Create socket connection
    const socket = io();
    socketRef.current = socket;
    
    // Store socket ID for use in API calls
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      socketIdRef.current = socket.id || '';
    });
    
    // Listen for PDF processing progress updates
    socket.on('pdf-progress', (progressData: { 
      currentPage: number, 
      totalPages: number, 
      stage?: string,
      percentComplete?: number,
      documentType?: string,
      processingStage?: string
    }) => {
      console.log('PDF progress update:', progressData);
      
      // Update the state based on the progress data
      setCurrentPageProcessing(progressData.currentPage);
      setDocumentPageCount(progressData.totalPages);
      
      // If a processing stage message is provided, update that too
      if (progressData.stage) {
        setProcessingStage(progressData.stage);
      }
      
      // Update additional progress information (percentComplete, documentType, processingStage)
      // These will be passed to the LoadingOverlay component
      if (typeof progressData.percentComplete === 'number') {
        setProgressPercentage(progressData.percentComplete);
      }
      
      // Store document type and processing stage for the LoadingOverlay
      if (progressData.documentType) {
        setDocumentType(progressData.documentType);
      }
      
      if (progressData.processingStage) {
        setDocumentProcessingStage(progressData.processingStage);
      }
    });
    
    // Cleanup socket connection on component unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);
  
  // Save API key
  const saveApiKey = () => {
    if (currentKeyModel) {
      const updatedKeys = {
        ...apiKeys,
        [currentKeyModel.id]: currentApiKey
      };
      
      // Save to state
      setApiKeys(updatedKeys);
      
      // Save to localStorage for persistence
      localStorage.setItem('empwr_api_keys', JSON.stringify(updatedKeys));
      
      setIsApiKeyDialogOpen(false);
      toast({
        title: "API Key Saved",
        description: `Your ${currentKeyModel.name} API key has been saved.`,
      });
    }
  };
  
  // Fetch saved graphs from the server
  const fetchSavedGraphs = async () => {
    try {
      const response = await fetch('/api/graphs');
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch saved graphs');
      }
      
      setSavedGraphs(result.data);
    } catch (error) {
      console.error('Error fetching saved graphs:', error);
      toast({
        title: "Failed to Load Graphs",
        description: error instanceof Error ? error.message : "An error occurred while loading saved graphs.",
        variant: "destructive"
      });
    }
  };
  
  // Load a graph by ID
  const loadGraph = async (id: number) => {
    try {
      const response = await fetch(`/api/graphs/${id}`);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to load graph');
      }
      
      // Set the knowledge graph from the loaded data with proper typing
      setKnowledgeGraph({
        id: result.data.graphId, // Include graph ID for CRUD operations
        nodes: result.data.nodes,
        links: result.data.links,
        schema: result.data.schema || [] // Include schema if it exists in the data
      } as KnowledgeGraph);
      
      // Clear enriched and original graph states
      setEnrichedGraph(null);
      setOriginalGraph(null);
      
      // Set the input text field with the original text used to generate this graph
      setText(result.data.inputText);
      
      toast({
        title: "Graph Loaded",
        description: `Successfully loaded graph: ${result.data.name}`,
      });
      
      setIsLoadDialogOpen(false);
    } catch (error) {
      console.error('Error loading graph:', error);
      toast({
        title: "Failed to Load Graph",
        description: error instanceof Error ? error.message : "An error occurred while loading the graph.",
        variant: "destructive"
      });
    }
  };
  
  // Save the current graph with a name
  const saveGraph = async () => {
    if (!knowledgeGraph) {
      toast({
        title: "No Graph to Save",
        description: "Please generate a knowledge graph first.",
        variant: "destructive",
      });
      return;
    }
    
    if (!graphName.trim()) {
      toast({
        title: "Graph Name Required",
        description: "Please provide a name for your graph.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Function to compute schema for the graph
      const computeSchema = () => {
        const { nodes } = knowledgeGraph!;
        const nodesByGroup: Record<number, SchemaNode[]> = {};
        
        // Group nodes by their group number
        nodes.forEach(node => {
          if (!nodesByGroup[node.group]) {
            nodesByGroup[node.group] = [];
          }
          nodesByGroup[node.group].push(node);
        });
        
        // Map group numbers to class names
        const groupToClass: Record<number, string> = {
          1: 'Person',
          2: 'Place',
          3: 'Concept',
          4: 'Organization',
          5: 'Date',
          6: 'Other'
        };
        
        // Build schema data for each class
        return Object.entries(nodesByGroup).map(([group, groupNodes]) => {
          // Count the frequency of each relation for this entity type
          const properties: Record<string, { type: string, count: number }> = {};
          
          knowledgeGraph!.links.forEach(link => {
            // Extract node IDs from source/target (handling different possible formats)
            const sourceId = typeof link.source === 'object' ? 
              (link.source as any)?.id || link.source : 
              (typeof link.source === 'string' ? parseInt(link.source as string, 10) : link.source);
            
            const targetId = typeof link.target === 'object' ? 
              (link.target as any)?.id || link.target : 
              (typeof link.target === 'string' ? parseInt(link.target as string, 10) : link.target);
            
            // Find the source and target nodes
            const sourceNode = nodes.find(n => n.id === sourceId);
            const targetNode = nodes.find(n => n.id === targetId);
            
            if (sourceNode && parseInt(group) === sourceNode.group) {
              if (!properties[link.label]) {
                properties[link.label] = { 
                  type: targetNode ? groupToClass[targetNode.group] || 'Unknown' : 'Unknown', 
                  count: 0 
                };
              }
              properties[link.label].count++;
            }
          });
          
          return {
            className: groupToClass[parseInt(group)] || 'Unknown',
            properties,
            instances: groupNodes.length
          };
        });
      };
      
      // Compute schema for the graph
      const schema = computeSchema();
      
      // Prepare the payload
      const payload = {
        graph: {
          nodes: knowledgeGraph.nodes,
          links: knowledgeGraph.links,
          schema, // Include the computed schema
        },
        name: graphName,
        description: `Generated from text with ${knowledgeGraph.nodes.length} entities and ${knowledgeGraph.links.length} relationships.`
      };
      
      console.log('Saving graph with payload:', JSON.stringify(payload));
      
      const response = await fetch('/api/save-graph', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to save graph');
      }
      
      toast({
        title: "Graph Saved",
        description: `Knowledge graph "${graphName}" saved successfully!`,
      });
      
      // Reset graph name input and close dialog
      setGraphName('');
      setIsSaveDialogOpen(false);
      
      // Refresh the list of saved graphs
      fetchSavedGraphs();
    } catch (error) {
      console.error('Error saving graph:', error);
      toast({
        title: "Failed to Save Graph",
        description: error instanceof Error ? error.message : "An error occurred while saving the graph.",
        variant: "destructive"
      });
    }
  };

  // Process text and generate knowledge graph
  // Separated function to extract text from document
  const handleExtractText = async () => {
    // Check if we're in document mode with a file selected
    if (inputType !== 'document' || !selectedFile) {
      return;
    }
    
    // Set processing state
    setIsProcessing(true);
    setProcessingStage('Reading document...');
    
    try {
      // Step 1: Extract text from document
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const extractResponse = await fetch('/api/extract-text', {
        method: 'POST',
        headers: {
          'X-Socket-ID': socketIdRef.current || '' // Send socket ID for progress updates
        },
        body: formData,
      });
      
      if (!extractResponse.ok) {
        const errorData = await extractResponse.json();
        throw new Error(errorData.message || 'Failed to extract text from document');
      }
      
      const extractResult = await extractResponse.json();
      
      // Validate that we received a valid text response with content
      if (!extractResult.text || extractResult.text.trim().length < 10) {
        throw new Error('No valid text could be extracted from the document. Please try a different file.');
      }
      
      console.log('Text extraction successful, length:', extractResult.text.length);
      
      // Clean and format the extracted text with more aggressive formatting for OCR
      const cleanedText = (() => {
        if (!extractResult.text) return '';
        
        // Step 1: First replace page markers and remove excessive whitespace
        // Remove "--- Page X ---" markers that often appear in OCR output
        let cleaned = extractResult.text.replace(/---\s*Page \d+\s*---/g, ' ');
        
        // Remove excessive horizontal whitespace (including tabs, multiple spaces)
        cleaned = cleaned.replace(/[ \t]{2,}/g, ' ');
        
        // Step 2: Normalize line breaks for consistent processing
        // Convert all types of line breaks to standard \n
        cleaned = cleaned.replace(/\r\n|\r/g, '\n');
        
        // Step 3: Fix common OCR formatting issues
        // Remove spaces at the beginning of lines
        cleaned = cleaned.replace(/\n[ \t]+/g, '\n');
        
        // Remove spaces at the end of lines
        cleaned = cleaned.replace(/[ \t]+\n/g, '\n');
        
        // Fix hyphenated words split across lines (common in OCR)
        cleaned = cleaned.replace(/(\w+)-\n(\w+)/g, '$1$2');
        
        // Step 4: Improve readability by fixing sentence and paragraph structure
        // Ensure periods have a space after them for proper sentence breaks
        cleaned = cleaned.replace(/\.(?=\S)/g, '. ');
        
        // Format numbered/bulleted lists properly
        cleaned = cleaned.replace(/(\d+\.)(?=\S)/g, '$1 ');
        cleaned = cleaned.replace(/(\*|-)(?=\S)/g, '$1 ');
        
        // Step 5: Normalize paragraph structure
        // Replace excessive blank lines with at most one blank line between paragraphs
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
        
        // Step 6: Fix common OCR errors
        // Replace common OCR errors like 'l' instead of 'I' at the beginning of sentences
        cleaned = cleaned.replace(/(\n|^)l([a-z])/g, '$1I$2');
        
        // Remove isolated single characters (likely OCR errors)
        cleaned = cleaned.replace(/(\s)([a-zA-Z])(\s)/g, '$1$3');
        
        // Remove random punctuation in isolation (likely OCR artifacts)
        cleaned = cleaned.replace(/\s[,.;:?!](?=\s)/g, ' ');
        
        // Step 7: Final cleanup
        // Collapse multiple spaces anywhere in the text
        cleaned = cleaned.replace(/[ \t]{2,}/g, ' ');
        
        // Trim leading and trailing whitespace
        return cleaned.trim();
      })();
      
      console.log('Cleaned text length:', cleanedText.length);
      
      // Update the extract result with the cleaned text
      const updatedExtractResult = {
        ...extractResult,
        text: cleanedText
      };
      
      setExtractResult(updatedExtractResult); // Save the result with file path
      setText(cleanedText); // Set text but don't show it in UI
      
      // Update progress message to show extraction is complete
      if (extractResult.isDocument) {
        const docType = extractResult.documentType.toUpperCase();
        const pageInfo = extractResult.pageCount ? ` (${extractResult.pageCount} pages)` : '';
        
        if (extractResult.ocrProcessed) {
          setProcessingStage(`OCR processing complete. Text extracted from ${docType} document${pageInfo}.`);
          // Switch to text mode to show the extracted text to the user
          setInputType('text');
        } else {
          setProcessingStage(`Text extracted from ${docType} document${pageInfo}.`);
          // Switch to text mode to show the extracted text to the user
          setInputType('text');
        }
        
        // Show success toast
        toast({
          title: "Text Extraction Complete",
          description: `Successfully extracted ${extractResult.text.length} characters from document. View and edit the extracted text in the Text Input panel before generating the graph.`,
        });
      }
      
      // Stop processing - let the user decide when to generate the graph
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingStage('');
      }, 2000); // Keep message visible briefly so user can read it
      
    } catch (error) {
      console.error('Error extracting text from document:', error);
      toast({
        title: "Document Processing Failed",
        description: error instanceof Error ? error.message : "An error occurred while processing the document.",
        variant: "destructive",
      });
      setIsProcessing(false);
      setProcessingStage('');
    }
  };

  const handleGenerateGraph = async () => {
    // Check if we're in document mode with a file selected
    if (inputType === 'document' && selectedFile && !extractResult) {
      // If the document hasn't been processed yet, process it first
      await handleExtractText();
      return; // Don't proceed to graph generation yet
    }
    
    // Check if there's no content to process
    if (!text.trim() && !(inputType === 'document' && selectedFile)) {
      toast({
        title: "Empty Input",
        description: inputType === 'text' 
          ? "Please enter some text to generate a knowledge graph."
          : "Please upload a document to generate a knowledge graph.",
        variant: "destructive",
      });
      return;
    }

    // Check if selected model requires API key and if it's available
    const selectedModelConfig = modelOptions.find(m => m.id === selectedModel);
    if (selectedModelConfig?.requiresApiKey && !apiKeys[selectedModel]) {
      toast({
        title: "API Key Required",
        description: `You need to add an API key in Settings to use ${selectedModelConfig.name}. Click "Manage in Settings" to add your key.`,
        variant: "destructive",
        action: (
          <ToastAction altText="Go to Settings" onClick={() => setLocation('/settings')}>
            Manage in Settings
          </ToastAction>
        ),
      });
      return;
    }

    setIsProcessing(true);
    // Set appropriate starting message based on input type
    setProcessingStage(inputType === 'document' ? 'Processing document...' : 'Analyzing content...');

    try {
      const apiEndpoint = '/api/process-text';
      
      // Debug log the request payload
      const requestPayload = { 
        // Make sure we always have valid text content - ensure it's trimmed and not empty
        text: (extractResult?.text || text || '').trim(),
        model: selectedModel,
        apiKey: apiKeys[selectedModel], // Pass the API key for any model that has one
        // Pass file path for document processing regardless of selected model
        filePath: extractResult?.filePath || null,
        // Flag to indicate if text was already extracted using OCR
        ocrProcessed: !!extractResult?.ocrProcessed
      };
      
      // Additional validation before making the API request
      if (!requestPayload.text) {
        throw new Error("No text content available to process. Please enter text or upload a document.");
      }
      
      console.log('Sending process-text request with data:', { 
        textLength: requestPayload.text.length,
        model: requestPayload.model,
        hasApiKey: !!requestPayload.apiKey,
        hasFilePath: !!requestPayload.filePath,
        ocrProcessed: requestPayload.ocrProcessed
      });
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Socket-ID': socketIdRef.current || '' // Send socket ID for progress updates
        },
        body: JSON.stringify(requestPayload),
      });

      // Parse the JSON response
      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        console.error('Error parsing JSON response:', jsonError);
        throw new Error(`Server response error: Failed to parse response (${response.status})`);
      }

      // Handle non-200 responses
      if (!response.ok) {
        let errorMessage = result.message || 'Failed to process text';
        
        // Special handling for PDF processing requiring API key
        if (result.requiresApiKey) {
          // Show the appropriate message based on the model
          const modelName = result.model === 'openai' ? 'OpenAI' : 
                            result.model === 'mistral' ? 'Mistral AI' : 
                            result.model;
          
          toast({
            title: "API Key Required",
            description: `You need a valid ${modelName} API key for document processing. Please add it in Settings.`,
            variant: "destructive",
            action: (
              <ToastAction altText="Go to Settings" onClick={() => setLocation('/settings')}>
                Manage in Settings
              </ToastAction>
            ),
          });
          return; // Stop processing here, user needs to add API key in Settings
        }
        
        // Include model-specific information in the error if available
        if (result.errorDetails && result.errorDetails.model) {
          errorMessage = `[${result.errorDetails.model.toUpperCase()}] ${errorMessage}`;
        }
        throw new Error(errorMessage);
      }

      // Clear any enriched or original graph data
      setEnrichedGraph(null);
      setOriginalGraph(null);
      
      // Set the new knowledge graph with proper typing
      setKnowledgeGraph({
        id: result.data.graphId, // Include graph ID for CRUD operations
        nodes: result.data.nodes,
        links: result.data.links,
        schema: result.data.schema || [] // Include schema if available
      } as KnowledgeGraph);

      toast({
        title: "Success",
        description: "Knowledge graph generated successfully!",
      });
    } catch (error) {
      console.error('Error generating knowledge graph:', error);
      // Display detailed error messages
      let errorTitle = "Error";
      let errorMessage = "Failed to generate knowledge graph.";
      
      try {
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (error instanceof Response) {
          errorMessage = "Server error: " + error.status;
        } else if (typeof error === 'object' && error !== null) {
          const errorObj = error as any;
          if (errorObj.message) {
            errorMessage = errorObj.message;
          }
        }
      } catch (e) {
        console.error("Error parsing error object:", e);
      }
      
      // Add model-specific context to error message
      errorTitle = `${selectedModel.toUpperCase()} Error`;
      
      // Add hints for common API key issues
      if (errorMessage.toLowerCase().includes('api key') || 
          errorMessage.toLowerCase().includes('auth') || 
          errorMessage.toLowerCase().includes('401')) {
        errorMessage += '\n\nPlease check that your API key is valid and has sufficient permissions.';
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
    }
  };

  // Calculate content margin based on sidebar state
  // We'll use inline style for margins instead of classes for more consistent layout

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      <Sidebar onToggleHelp={toggleHelpModal} />
      
      <div 
        className="flex-1 transition-all duration-300 ease-in-out"
        style={{ marginLeft: isMobile ? 0 : `${sidebarWidth}px` }}>
        <div className="min-h-screen flex flex-col">
          {/* Loading Overlay */}
          {isProcessing && (
            <LoadingOverlay 
              stage={processingStage}
              modelName={inputType === 'document' ? undefined : (
                selectedModel === 'openai' ? 'OpenAI GPT-4o' : 
                selectedModel === 'spacy' ? 'spaCy NLP' : 'Local NLP'
              )}
              documentProcessing={inputType === 'document' && selectedFile?.name?.toLowerCase().endsWith('.pdf')}
              pageCount={documentPageCount}
              currentPage={currentPageProcessing}
              textExtractionOnly={inputType === 'document' && !knowledgeGraph ? true : false}
              percentComplete={progressPercentage}
              documentType={documentType}
              processingStage={documentProcessingStage}
            />
          )}
          
          <header className="bg-gray-900 border-b border-gray-800">
            <div className="container mx-auto px-4 py-4 flex justify-between items-center">
              <h1 className="text-xl font-semibold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                Generate Knowledge Graph
              </h1>
              
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={toggleHelpModal}
                  className="flex items-center"
                >
                  <InfoIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </header>
          
          <main className="flex-grow container mx-auto px-4 py-6 text-gray-200">
            <div className="mb-6 bg-gray-900 p-4 rounded-lg border border-gray-800">
              <h2 className="text-lg font-medium mb-3 flex items-center">
                <SparklesIcon className="mr-2 h-5 w-5 text-primary" />
                Select Language Model
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {modelOptions.map((model) => (
                  <Card 
                    key={model.id} 
                    className={`cursor-pointer transition-all border ${selectedModel === model.id 
                      ? 'border-primary bg-gray-900/80' 
                      : 'border-gray-800 bg-gray-900/40 hover:border-gray-700'}`}
                    onClick={() => setSelectedModel(model.id)}
                  >
                    <CardHeader className="p-4 pb-0">
                      <CardTitle className="text-sm font-medium">{model.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      <p className="text-xs text-gray-400">{model.description}</p>
                    </CardContent>
                    {model.requiresApiKey && (
                      <CardFooter className="p-4 pt-0 flex justify-between items-center">
                        <div className="flex items-center text-xs text-gray-500">
                          <KeyIcon className="h-3 w-3 mr-1" />
                          {apiKeys[model.id] ? 'API Key Set' : 'Requires API Key'}
                        </div>
                        {/* Only show button for non-OpenAI/Mistral models, as those are managed in Settings */}
                        {model.id !== 'openai' && model.id !== 'mistral' ? (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              openApiKeyDialog(model);
                            }}
                          >
                            {apiKeys[model.id] ? 'Update Key' : 'Add Key'}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Navigate to settings page
                              window.location.href = '/settings';
                            }}
                          >
                            Manage in Settings
                          </Button>
                        )}
                      </CardFooter>
                    )}
                  </Card>
                ))}
              </div>
            </div>
            
            {/* Two Column Layout: Text Input Panel and Knowledge Graph Explorer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Input Panel - Left Column */}
              <div>
                <TextInputPanel 
                  text={text}
                  knowledgeGraph={knowledgeGraph}
                  onTextChange={handleTextChange}
                  onClearText={handleClearText}
                  onGenerateGraph={handleGenerateGraph}
                  onEntityClick={(nodeId) => {
                    // Use the ref to highlight the node in the graph explorer
                    if (graphExplorerRef.current) {
                      graphExplorerRef.current.highlightNode(nodeId);
                    }
                  }}
                  inputType={inputType}
                  setInputType={setInputType}
                  selectedFile={selectedFile}
                  setSelectedFile={setSelectedFile}
                  onFileUpload={handleFileUpload}
                  highlightedEntityName={highlightedEntityName}
                />
              </div>
              
              {/* Knowledge Graph Exploration Box - Right Column */}
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 h-[700px] overflow-hidden">
                <KnowledgeGraphExplorer 
                  knowledgeGraph={knowledgeGraph}
                  ref={graphExplorerRef}
                  hideControls={false}
                  onNodeClick={(node: any) => {
                    // Highlight the entity name in the text
                    if (node && node.name) {
                      setHighlightedEntityName(node.name);
                      // Clear highlight after 3 seconds
                      if (highlightTimeout) {
                        clearTimeout(highlightTimeout);
                      }
                      const timeout = setTimeout(() => {
                        setHighlightedEntityName('');
                      }, 3000);
                      setHighlightTimeout(timeout);
                    }
                  }}
                />
              </div>
            </div>
            
            {/* Graph Actions Toolbar */}
            {knowledgeGraph && (
              <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 mb-6">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium">Knowledge Graph Actions</h3>
                    <p className="text-sm text-gray-400">Enhance, export, save or load your knowledge graph</p>
                  </div>
                  
                  <Button
                    variant="outline"
                    className="gap-2 border-primary/50 hover:border-primary transition-all"
                    onClick={() => setIsEnrichDialogOpen(true)}
                  >
                    <GlobeIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Enrich with Wikidata</span>
                    <span className="sm:hidden">Enrich</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => setIsExportDialogOpen(true)}
                  >
                    <DownloadIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Export Graph</span>
                    <span className="sm:hidden">Export</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="gap-2 border-green-500/50 hover:border-green-500 transition-all"
                    onClick={() => setIsSaveDialogOpen(true)}
                  >
                    <DatabaseIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Save Graph</span>
                    <span className="sm:hidden">Save</span>
                  </Button>
                  
                  {enrichedGraph && (
                    <Button 
                      variant="outline"
                      className="gap-2 border-amber-500/50 hover:border-amber-500 transition-all"
                      onClick={() => {
                        // Reset to original graph
                        if (originalGraph) {
                          setKnowledgeGraph(originalGraph);
                        } else {
                          // Fallback to filtering if originalGraph is not available
                          setKnowledgeGraph({
                            nodes: knowledgeGraph.nodes.filter(n => !n.enriched),
                            links: knowledgeGraph.links.filter(l => !l.enriched)
                          });
                        }
                        toast({
                          title: "Original Graph Restored",
                          description: "Enriched entities and relationships have been removed.",
                        });
                      }}
                    >
                      <ShuffleIcon className="h-4 w-4" />
                      <span className="hidden sm:inline">Reset to Original</span>
                      <span className="sm:hidden">Reset</span>
                    </Button>
                  )}
                </div>
                
                {enrichedGraph && (
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium flex items-center">
                          <DatabaseIcon className="mr-2 h-4 w-4 text-blue-400" />
                          Enrichment Status
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Added {originalGraph ? 
                            (enrichedGraph.nodes.length - originalGraph.nodes.length) : 
                            (enrichedGraph.nodes.length - (knowledgeGraph.nodes.filter(n => !n.enriched).length))
                          } new entities and {
                            originalGraph ? 
                            (enrichedGraph.links.length - originalGraph.links.length) : 
                            (enrichedGraph.links.length - (knowledgeGraph.links.filter(l => !l.enriched).length))
                          } new relationships from Wikidata
                        </p>
                      </div>
                      
                      <div className="bg-gray-800 px-2 py-1 rounded text-xs">
                        <span className="text-blue-400">●</span> Original
                        <span className="ml-2 text-green-400">●</span> Wikidata
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
      
      {/* API Key Dialog */}
      <Dialog open={isApiKeyDialogOpen} onOpenChange={setIsApiKeyDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">
              {currentKeyModel?.name} API Key
            </DialogTitle>
            <DialogDescription>
              Enter your API key for {currentKeyModel?.name}. This key will be stored locally in your browser.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Input
                id="apiKey"
                placeholder="Enter your API key here"
                value={currentApiKey}
                onChange={(e) => setCurrentApiKey(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
              />
              <p className="text-xs text-gray-500">
                Your API key is stored locally and never sent to our servers except when making API requests to generate knowledge graphs.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApiKeyDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveApiKey} disabled={!currentApiKey.trim()}>
              Save API Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Enrich Dialog */}
      <Dialog open={isEnrichDialogOpen} onOpenChange={setIsEnrichDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">
              Enrich Knowledge Graph
            </DialogTitle>
            <DialogDescription>
              Enhance your knowledge graph with external data from Wikidata. 
              This will add new entities, relationships, and more context to your graph.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-200">Maximum Enrichments</label>
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  id="maxEnrichments"
                  min={1}
                  max={50}
                  value={maxEnrichments}
                  onChange={(e) => setMaxEnrichments(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
                  className="bg-gray-800 border-gray-700 text-white"
                />
                <span className="text-xs text-gray-400">entities</span>
              </div>
              <p className="text-xs text-gray-500">
                Choose how many entities to enrich. Higher values provide more data but may take longer.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEnrichDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleEnrichGraph} 
              disabled={isEnriching}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {isEnriching ? (
                <>
                  <RefreshCwIcon className="mr-2 h-4 w-4 animate-spin" />
                  Enriching...
                </>
              ) : (
                <>
                  <GlobeIcon className="mr-2 h-4 w-4" />
                  Enrich Graph
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">
              Export Knowledge Graph
            </DialogTitle>
            <DialogDescription>
              Choose a format to export your knowledge graph
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
            <Card 
              className="cursor-pointer transition-all border border-gray-800 bg-gray-900/40 hover:border-primary"
              onClick={exportAsJson}
            >
              <CardHeader className="p-4 text-center">
                <FileTextIcon className="h-12 w-12 mx-auto text-primary" />
              </CardHeader>
              <CardContent className="p-4 pt-0 text-center">
                <h3 className="font-medium">JSON</h3>
                <p className="text-xs text-gray-400 mt-1">Export as JSON for processing</p>
              </CardContent>
            </Card>
            
            <Card 
              className="cursor-pointer transition-all border border-gray-800 bg-gray-900/40 hover:border-primary"
              onClick={exportAsRdf}
            >
              <CardHeader className="p-4 text-center">
                <FileTextIcon className="h-12 w-12 mx-auto text-primary" />
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
                <ImageIcon className="h-12 w-12 mx-auto text-primary" />
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
      
      {/* Use the enhanced LoadingOverlay component for processing */}
      {isProcessing && (
        <LoadingOverlay
          stage={processingStage || `Analyzing content...`}
          modelName={modelOptions.find(m => m.id === selectedModel)?.name}
          documentProcessing={inputType === 'document'}
          pageCount={documentPageCount}
          currentPage={currentPageProcessing}
          percentComplete={progressPercentage}
          documentType={documentType}
          processingStage={documentProcessingStage}
        />
      )}
      
      {/* Use the enhanced LoadingOverlay component for enrichment */}
      {isEnriching && (
        <LoadingOverlay
          stage="Connecting to Wikidata..."
          modelName="Wikidata API"
        />
      )}
      
      {/* Save Graph Dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">
              Save Knowledge Graph
            </DialogTitle>
            <DialogDescription>
              Give your knowledge graph a name to save it for later use
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-200">Graph Name</label>
              <Input
                id="graphName"
                placeholder="My Knowledge Graph"
                value={graphName}
                onChange={(e) => setGraphName(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
              />
              <p className="text-xs text-gray-500">
                Choose a descriptive name to help you identify this graph later.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={saveGraph} 
              disabled={!graphName.trim()}
              className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700"
            >
              <DatabaseIcon className="mr-2 h-4 w-4" />
              Save Graph
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Load Graph Dialog */}
      <Dialog open={isLoadDialogOpen} onOpenChange={setIsLoadDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">
              Load Saved Graph
            </DialogTitle>
            <DialogDescription>
              Select a previously saved knowledge graph to load
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 max-h-[50vh] overflow-y-auto pr-2">
            {savedGraphs.length === 0 ? (
              <div className="text-center py-8">
                <DatabaseIcon className="h-12 w-12 mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400">No saved graphs found</p>
                <p className="text-xs text-gray-500 mt-2">
                  Generate a knowledge graph and use the Save button to store it for later use.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedGraphs.map((graph) => (
                  <Card 
                    key={graph.id}
                    className="cursor-pointer transition-all border border-gray-800 bg-gray-900/40 hover:border-blue-500"
                    onClick={() => loadGraph(graph.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium">{graph.name}</h3>
                          <p className="text-xs text-gray-400 mt-1">
                            {graph.entityCount} entities, {graph.relationCount} relationships
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(graph.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            loadGraph(graph.id);
                          }}
                        >
                          <ArrowRightIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsLoadDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={fetchSavedGraphs}
            >
              <RefreshCwIcon className="h-4 w-4" />
              Refresh List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isHelpModalOpen && <HelpModal onClose={toggleHelpModal} />}
    </div>
  );
}