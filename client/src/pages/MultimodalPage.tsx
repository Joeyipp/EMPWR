import { FC, useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import Sidebar from '@/components/Sidebar';
import { useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Menu, Brain, Database, Plus, Network, Save, PlusCircle, Sparkles, ZoomIn, ZoomOut, 
  AlertCircle, RefreshCw, Trash2, Upload, ChevronDown, Loader2, BookOpen, 
  Maximize, Minimize, Code, Clock, Share2, Download, Settings, LayoutGrid, Eye,
  FileText, Globe, Image, FileVideo, Command, RotateCcw, ListFilter, BarChart3,
  Lightbulb, Zap, Search, ArrowUpRight, SlidersHorizontal, PanelLeft, Wand2, X,
  Terminal, Activity, BarChart, ChartPie, PieChart, Link2, Users, CheckCircle
} from 'lucide-react';
import { Link } from 'wouter';
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
import { KnowledgeGraph } from '@/types/multimodal';

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
  name: string; // Required by KnowledgeGraphNode
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
  relationship?: string;
}

// Generate unique ID
const generateId = () => Math.random().toString(36).substr(2, 9);

// Main component
const MultimodalPage: FC = () => {
  // State
  const [activeTab, setActiveTab] = useState('sources');
  const [sourceType, setSourceType] = useState<SourceType>('text');
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceContent, setSourceContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  
  // Refs for file inputs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);
  
  // Modern UI state
  const [sidePanel, setSidePanel] = useState<'settings' | 'info' | null>(null);
  const [graphViewMode, setGraphViewMode] = useState<'2d' | '3d'>('2d');
  const [layoutType, setLayoutType] = useState<'force' | 'radial' | 'hierarchical'>('force');
  const [showGraphControls, setShowGraphControls] = useState(false);
  const [highlightedEntities, setHighlightedEntities] = useState<{[key: string]: boolean}>({});
  const [selectedModel, setSelectedModel] = useState<'openai' | 'mistral'>('openai');
  const [savedOpenaiApiKey, setSavedOpenaiApiKey] = useState<string | null>(null);
  const [savedMistralApiKey, setSavedMistralApiKey] = useState<string | null>(null);
  
  const [multimodalState, setMultimodalState] = useState<{
    sources: Source[];
    isProcessing: boolean;
    messages: Message[];
    streamingContent: string;
    graph: KnowledgeGraph;
    savedGraphId?: number | string;  // Track the ID of the saved graph
  }>({
    sources: [],
    isProcessing: false,
    messages: [],
    streamingContent: '',
    graph: { nodes: [], links: [] }
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
      logsRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [multimodalState.messages]);
  
  // Load API keys from the server
  useEffect(() => {
    const loadApiKeys = async () => {
      try {
        // Try to get OpenAI API key
        const openaiResponse = await fetch(`/api/api-keys/openai/active`);
        const openaiData = await openaiResponse.json();
        
        if (openaiData.success && openaiData.data?.key) {
          setSavedOpenaiApiKey(openaiData.data.key);
        } else {
          console.log('No OpenAI API key found for this user');
          setSavedOpenaiApiKey(null);
        }
        
        // Try to get Mistral API key
        const mistralResponse = await fetch(`/api/api-keys/mistral/active`);
        const mistralData = await mistralResponse.json();
        
        if (mistralData.success && mistralData.data?.key) {
          setSavedMistralApiKey(mistralData.data.key);
        } else {
          console.log('No Mistral API key found for this user');
          setSavedMistralApiKey(null);
        }
        
        // Show warning if no keys found
        if ((!openaiData.success || !openaiData.data?.key) && 
            (!mistralData.success || !mistralData.data?.key)) {
          toast({
            title: "No API keys found",
            description: "Please add API keys in the Settings page to use multimodal features.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error loading API keys:', error);
        toast({
          title: "Failed to load API keys",
          description: "There was a problem accessing your saved API keys.",
          variant: "destructive",
        });
      }
    };
    
    loadApiKeys();
  }, [toast]);

  // Automatically switch to knowledge graph tab when processing is complete
  useEffect(() => {
    // If we were processing but now we're not, and we have graph data, show the knowledge graph
    const wasProcessing = multimodalState.isProcessing;
    const hasGraphData = multimodalState.graph.nodes.length > 0;
    
    if (!multimodalState.isProcessing && wasProcessing && hasGraphData) {
      // Switch to knowledge graph tab automatically
      setActiveTab('knowledge');
    }
  }, [multimodalState.isProcessing, multimodalState.graph.nodes.length]);
  
  // Placeholder function for the required onConnect prop in SourceCardNext
  const handleConnectSource = (id: string) => {
    toast({
      title: 'Connection Feature',
      description: 'This feature will be implemented in a future update.',
    });
  };
  
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
      
      // Log the response for debugging
      console.log('Save Graph API Response:', response);
      
      // Directly access the data field
      const responseData = response.data;
      console.log('Response data:', responseData);
      
      // Our known response structure from server logs is:
      // {"success":true,"data":{"graphId":76,...}}
      const savedGraphId = responseData?.data?.graphId;
      
      console.log('Extracted graphId:', savedGraphId);
      
      if (!savedGraphId) {
        console.error('Failed to extract graphId from response');
        console.log('Response data keys:', responseData ? Object.keys(responseData) : 'No responseData');
        
        if (responseData && responseData.data) {
          console.log('Response data.data keys:', Object.keys(responseData.data));
        }
        
        // As a fallback, try searching in the entire response object
        let foundId: string | number | null = null;
        
        // Define recursive function with proper type annotations
        const searchForId = (obj: any, key = 'graphId'): string | number | null => {
          if (!obj || typeof obj !== 'object') return null;
          
          if (obj[key] !== undefined) return obj[key];
          
          for (const k in obj) {
            if (typeof obj[k] === 'object') {
              const result: string | number | null = searchForId(obj[k], key);
              if (result !== null) return result;
            }
          }
          return null;
        };
        
        foundId = searchForId(response);
        console.log('Deep search result for graphId:', foundId);
        
        if (foundId) {
          console.log('Found graphId through deep search:', foundId);
          return foundId;
        }
        
        toast({
          title: 'Error Saving Graph',
          description: 'Could not get valid graph ID from server response',
          variant: 'destructive'
        });
        return;
      }
      console.log('Saved Graph ID:', savedGraphId);
      
      setMultimodalState(prev => ({
        ...prev,
        isProcessing: false,
        savedGraphId: savedGraphId
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
  
  // File upload handlers
  const handleFileUpload = async (file: File, fileType?: string): Promise<string> => {
    try {
      // Check file size limit (25MB for multimodal content)
      const maxSize = 25 * 1024 * 1024; // 25MB
      if (file.size > maxSize) {
        toast({
          title: "File Too Large",
          description: `Please upload a file smaller than 25MB. Current file size: ${(file.size / 1024 / 1024).toFixed(1)}MB`,
          variant: "destructive",
        });
        return '';
      }

      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('apiKey', ''); // Will use the server's environment variable
      
      // Add file type if provided
      if (fileType) {
        formData.append('fileType', fileType);
      }
      
      // Add model selection
      formData.append('model', selectedModel);
      
      // Create a container element for the progress indicator
      const progressContainerId = `progress-${Date.now()}`;
      
      // Create and append the progress indicator to the DOM
      const progressContainer = document.createElement('div');
      progressContainer.id = progressContainerId;
      progressContainer.className = 'fixed top-5 right-5 z-50 w-80 bg-background border rounded-lg shadow-lg p-4';
      progressContainer.innerHTML = `
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center">
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <h3 class="text-sm font-medium">Uploading ${file.name}</h3>
          </div>
          <button type="button" class="ml-auto -mx-1.5 -my-1.5 bg-background text-muted-foreground hover:text-foreground rounded-lg p-1.5 inline-flex items-center justify-center h-8 w-8" id="close-${progressContainerId}">
            <span class="sr-only">Close</span>
            <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
            </svg>
          </button>
        </div>
        <div class="progress-container">
          <div class="flex justify-between mb-1 text-xs">
            <span>0%</span>
            <span>0KB / ${(file.size / 1024).toFixed(1)}KB</span>
          </div>
          <div class="w-full bg-secondary rounded-full h-2.5 mb-2">
            <div class="bg-primary h-2.5 rounded-full w-0 transition-all duration-300"></div>
          </div>
          <p class="text-xs text-muted-foreground">Preparing file...</p>
        </div>
      `;
      
      document.body.appendChild(progressContainer);
      
      // Add event listener to close button
      document.getElementById(`close-${progressContainerId}`)?.addEventListener('click', () => {
        if (document.getElementById(progressContainerId)) {
          document.getElementById(progressContainerId)?.remove();
        }
      });
      
      // Function to update progress
      const updateProgress = (percentComplete: number, loaded: number) => {
        const progressBar = document.querySelector(`#${progressContainerId} .bg-primary`);
        const percentText = document.querySelector(`#${progressContainerId} .flex.justify-between span:first-child`);
        const sizeText = document.querySelector(`#${progressContainerId} .flex.justify-between span:last-child`);
        const statusText = document.querySelector(`#${progressContainerId} .text-xs.text-muted-foreground`);
        
        if (progressBar) {
          (progressBar as HTMLElement).style.width = `${percentComplete}%`;
        }
        
        if (percentText) {
          percentText.textContent = `${percentComplete}%`;
        }
        
        if (sizeText) {
          sizeText.textContent = `${(loaded / 1024).toFixed(1)}KB / ${(file.size / 1024).toFixed(1)}KB`;
        }
        
        if (statusText) {
          if (percentComplete < 25) {
            statusText.textContent = 'Starting upload...';
          } else if (percentComplete < 50) {
            statusText.textContent = 'Transferring data...';
          } else if (percentComplete < 75) {
            statusText.textContent = 'Upload in progress...';
          } else if (percentComplete < 100) {
            statusText.textContent = 'Almost done...';
          } else {
            statusText.textContent = 'Processing file...';
          }
        }
      };
      
      // Using XMLHttpRequest to track upload progress
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        // Track progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            updateProgress(percentComplete, event.loaded);
          }
        });
        
        // Handle completion
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              
              // Update the progress indicator to show success
              const progressContainer = document.getElementById(progressContainerId);
              if (progressContainer) {
                const progressIndicator = progressContainer.querySelector('.progress-container');
                if (progressIndicator) {
                  progressIndicator.innerHTML = `
                    <div class="flex items-center text-green-500 mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                      </svg>
                      <p>Upload successful</p>
                    </div>
                    <p class="text-xs text-muted-foreground">Processing file content...</p>
                  `;
                  
                  // Auto-remove the progress indicator after 3 seconds
                  setTimeout(() => {
                    if (document.getElementById(progressContainerId)) {
                      document.getElementById(progressContainerId)?.remove();
                    }
                  }, 3000);
                }
              }
              
              // Success toast
              toast({
                title: 'Upload Complete',
                description: `${file.name} uploaded successfully`,
                duration: 3000
              });
              
              setIsUploading(false);
              setSelectedFile(file);
              
              // Return the extracted text content for further processing
              // Prioritize extracted text over file path for better knowledge extraction
              if (data.text) {
                console.log('Extracted text content from file:', data.text.substring(0, 100) + '...');
                resolve(data.text);
              } else if (data.data && data.data.graph && data.data.graph.inputText) {
                // Try to get text content from graph input text if available
                console.log('Using graph inputText for processing:', data.data.graph.inputText.substring(0, 100) + '...');
                resolve(data.data.graph.inputText);
              } else if (data.filePath) {
                console.log('Using file path for processing:', data.filePath);
                resolve(data.filePath);
              } else {
                console.log('No content available, using empty string');
                resolve('');
              }
            } catch (e) {
              // Remove the progress indicator
              document.getElementById(progressContainerId)?.remove();
              reject(new Error('Invalid server response'));
            }
          } else {
            let errorMessage = 'Upload failed';
            try {
              const response = JSON.parse(xhr.responseText);
              errorMessage = response.message || errorMessage;
            } catch (e) {
              // If parsing fails, use default error message
            }
            
            // Update the progress indicator to show error
            const progressContainer = document.getElementById(progressContainerId);
            if (progressContainer) {
              const progressIndicator = progressContainer.querySelector('.progress-container');
              if (progressIndicator) {
                progressIndicator.innerHTML = `
                  <div class="flex items-center text-red-500 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                    </svg>
                    <p>Upload failed</p>
                  </div>
                  <p class="text-xs text-red-500">${errorMessage}</p>
                `;
                
                // Auto-remove the progress indicator after 5 seconds
                setTimeout(() => {
                  if (document.getElementById(progressContainerId)) {
                    document.getElementById(progressContainerId)?.remove();
                  }
                }, 5000);
              }
            }
            
            reject(new Error(errorMessage));
          }
        });
        
        // Handle errors
        xhr.addEventListener('error', () => {
          // Update the progress indicator to show network error
          const progressContainer = document.getElementById(progressContainerId);
          if (progressContainer) {
            const progressIndicator = progressContainer.querySelector('.progress-container');
            if (progressIndicator) {
              progressIndicator.innerHTML = `
                <div class="flex items-center text-red-500 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                  </svg>
                  <p>Network error</p>
                </div>
                <p class="text-xs text-red-500">Failed to connect to the server</p>
              `;
              
              // Auto-remove the progress indicator after 5 seconds
              setTimeout(() => {
                if (document.getElementById(progressContainerId)) {
                  document.getElementById(progressContainerId)?.remove();
                }
              }, 5000);
            }
          }
          
          reject(new Error('Network error occurred'));
        });
        
        xhr.addEventListener('abort', () => {
          // Update the progress indicator to show upload aborted
          const progressContainer = document.getElementById(progressContainerId);
          if (progressContainer) {
            const progressIndicator = progressContainer.querySelector('.progress-container');
            if (progressIndicator) {
              progressIndicator.innerHTML = `
                <div class="flex items-center text-yellow-500 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                  <p>Upload cancelled</p>
                </div>
                <p class="text-xs text-muted-foreground">The upload was aborted</p>
              `;
              
              // Auto-remove the progress indicator after 5 seconds
              setTimeout(() => {
                if (document.getElementById(progressContainerId)) {
                  document.getElementById(progressContainerId)?.remove();
                }
              }, 5000);
            }
          }
          
          reject(new Error('Upload was aborted'));
        });
        
        // Open and send the request
        xhr.open('POST', '/api/extract/file', true);
        xhr.send(formData);
      });
      
    } catch (error: any) {
      setIsUploading(false);
      toast({
        title: 'File Upload Failed',
        description: error.message || 'Failed to upload file',
        variant: 'destructive'
      });
      return '';
    }
  };
  
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
    
    if (!validImageTypes.includes(file.type)) {
      toast({
        title: 'Invalid Image Type',
        description: 'Please upload a valid image file (JPEG, PNG, GIF, BMP, WEBP)',
        variant: 'destructive'
      });
      return;
    }
    
    setSourceTitle(file.name);
    setSourceType('image');
    handleFileUpload(file, 'image').then(result => {
      if (result) {
        setSourceContent(result);
        toast({
          title: 'Image Ready',
          description: 'Image will be processed with OCR when source is added',
        });
      }
    });
  };
  
  const handlePdfUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (file.type !== 'application/pdf') {
      toast({
        title: 'Invalid File Type',
        description: 'Please upload a PDF file',
        variant: 'destructive'
      });
      return;
    }
    
    setSourceTitle(file.name);
    setSourceType('pdf');
    handleFileUpload(file, 'pdf').then(result => {
      if (result) {
        setSourceContent(result);
        toast({
          title: 'PDF Ready',
          description: 'PDF will be processed when source is added',
        });
      }
    });
  };
  
  const triggerImageUpload = () => {
    if (imageInputRef.current) {
      imageInputRef.current.click();
    }
  };
  
  const triggerPdfUpload = () => {
    if (pdfInputRef.current) {
      pdfInputRef.current.click();
    }
  };

  const handleAddSource = () => {
    // Check for required information based on source type
    if (!sourceTitle) {
      toast({
        title: 'Missing information',
        description: 'Please provide a title for the source',
        variant: 'destructive'
      });
      return;
    }
    
    // For PDF and image uploads, we only need the title (content was processed during upload)
    if (sourceType !== 'pdf' && sourceType !== 'image' && !sourceContent) {
      toast({
        title: 'Missing information',
        description: 'Please provide content for the source',
        variant: 'destructive'
      });
      return;
    }
    
    // Ensure we don't require content for PDFs and images
    const finalContent = (sourceType === 'pdf' || sourceType === 'image') ? (sourceContent || '') : sourceContent;
    
    const newSource: Source = {
      id: generateId(),
      type: sourceType,
      title: sourceTitle,
      content: finalContent || '', // Use our finalContent variable
      isProcessed: false,
      isProcessing: false
    };
    
    setMultimodalState(prev => ({
      ...prev,
      sources: [...prev.sources, newSource]
    }));
    
    setSourceTitle('');
    setSourceContent('');
    setSelectedFile(null);
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
            title: source.title,
            model: selectedModel
          }
        });
      } else if (source.type === 'website') {
        response = await apiRequest('/api/extract/url', {
          method: 'POST',
          data: {
            url: source.content,
            sourceSystem: 'general',
            model: selectedModel
          }
        });
      } else if (source.type === 'image') {
        // First, check if this is a valid URL or an uploaded file path
        const isValidUrl = source.content && 
          (source.content.startsWith('http://') || 
           source.content.startsWith('https://') || 
           source.content.startsWith('www.'));
        
        if (isValidUrl) {
          // If it's a URL, download the image first
          const progressMessage: Message = {
            role: 'system',
            content: `Downloading and processing image from URL...`,
            timestamp: new Date()
          };
          messages.push(progressMessage);
          
          response = await apiRequest('/api/extract/url', {
            method: 'POST',
            data: {
              url: source.content,
              sourceSystem: 'image',
              model: selectedModel
            }
          });
        } else {
          // This is an uploaded file or text content from OCR
          const progressMessage: Message = {
            role: 'system',
            content: `Processing image content with AI analysis...`,
            timestamp: new Date()
          };
          messages.push(progressMessage);
          
          // Pass the content directly to the text extraction endpoint
          response = await apiRequest('/api/extract/text', {
            method: 'POST',
            data: {
              text: source.content || `Image content from ${source.title}`,
              title: source.title,
              model: selectedModel
            }
          });
        }
      } else if (source.type === 'pdf') {
        // First, check if this is a valid URL or an uploaded file path
        const isValidUrl = source.content && 
          (source.content.startsWith('http://') || 
           source.content.startsWith('https://') || 
           source.content.startsWith('www.'));
        
        if (isValidUrl) {
          // If it's a URL, download the PDF first
          const progressMessage: Message = {
            role: 'system',
            content: `Downloading and processing PDF from URL...`,
            timestamp: new Date()
          };
          messages.push(progressMessage);
          
          response = await apiRequest('/api/extract/url', {
            method: 'POST',
            data: {
              url: source.content,
              sourceSystem: 'pdf',
              model: selectedModel
            }
          });
        } else {
          // This is an uploaded file or text content extracted from PDF
          const progressMessage: Message = {
            role: 'system',
            content: `Processing PDF content with AI analysis...`,
            timestamp: new Date()
          };
          messages.push(progressMessage);
          
          // Pass the content directly to the text extraction endpoint
          response = await apiRequest('/api/extract/text', {
            method: 'POST',
            data: {
              text: source.content || `PDF content from ${source.title}`,
              title: source.title,
              model: selectedModel
            }
          });
        }
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
              { id: Math.floor(Math.random() * 1000), name: source.title, label: source.title, group: 1, source: source.title },
              { id: Math.floor(Math.random() * 1000), name: 'Entity 1', label: 'Entity 1', group: 2, source: source.title },
              { id: Math.floor(Math.random() * 1000), name: 'Entity 2', label: 'Entity 2', group: 3, source: source.title }
            ],
            links: [
              { source: 0, target: 1, label: 'related to', relationship: 'related to' },
              { source: 0, target: 2, label: 'contains', relationship: 'contains' }
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
      
      // Make sure each node has a name property
      const processedNodes = response.graph.nodes.map((node: any) => ({
        ...node,
        name: node.name || node.label || `Node ${node.id}`
      }));
      
      // Return results
      return {
        success: true,
        nodes: processedNodes,
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
    
    // Create a map of original node IDs to their new IDs in the merged graph
    const nodeIdMap = new Map<number, number>();
    
    // Process new nodes
    for (const node of newNodes) {
      // Check if a similar node already exists (by name or label)
      const existingNode = mergedGraph.nodes.find(n => {
        // First try to match by name
        if (n.name && node.name && n.name.toLowerCase() === node.name.toLowerCase()) {
          return true;
        }
        
        // If name doesn't match, try label
        const nLabel = (n as any).label;
        const nodeLabel = (node as any).label;
        return nLabel && nodeLabel && nLabel.toLowerCase() === nodeLabel.toLowerCase();
      });
      
      if (existingNode) {
        // Map original node ID to existing node ID
        nodeIdMap.set(node.id, existingNode.id);
      } else {
        // If no similar node exists, add this one
        const newNodeId = mergedGraph.nodes.length > 0 
          ? Math.max(...mergedGraph.nodes.map(n => n.id)) + 1 
          : 0;
        
        // Store the mapping from original ID to new ID
        nodeIdMap.set(node.id, newNodeId);
        
        mergedGraph.nodes.push({
          ...node,
          id: newNodeId
        });
      }
    }
    
    // Process new links using the nodeIdMap
    for (const link of newLinks) {
      // Get the new IDs for source and target nodes
      const sourceId = nodeIdMap.get(link.source);
      const targetId = nodeIdMap.get(link.target);
      
      // Only proceed if we have valid mappings for both source and target
      if (sourceId !== undefined && targetId !== undefined) {
        // Check if a similar link already exists
        const existingLink = mergedGraph.links.find(l => 
          l.source === sourceId && 
          l.target === targetId &&
          l.label === link.label
        );
        
        if (!existingLink) {
          // Add new link with the mapped IDs
          mergedGraph.links.push({
            source: sourceId,
            target: targetId,
            label: link.label,
            relationship: link.relationship || link.label
          });
        }
      }
    }
    
    return mergedGraph;
  };
  
  const handleProcessSource = async (id: string) => {
    const source = multimodalState.sources.find(s => s.id === id);
    if (!source) return;
    
    // Check if API keys are available
    if (selectedModel === 'openai' && !savedOpenaiApiKey) {
      toast({
        title: "No OpenAI API key",
        description: "Please add an OpenAI API key in the Settings page to process this source.",
        variant: "destructive",
      });
      return;
    }
    
    if (selectedModel === 'mistral' && !savedMistralApiKey) {
      toast({
        title: "No Mistral API key",
        description: "Please add a Mistral API key in the Settings page to process this source.",
        variant: "destructive",
      });
      return;
    }
    
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
                error: !result.success ? result.messages[0]?.content : undefined
              } 
            : s
        ),
        graph: mergeGraphs(prev.graph, result.nodes, result.links)
      }));
      
      // If success, switch to the processing tab to show results
      if (result.success) {
        setActiveTab('processing');
      }
    } catch (error: any) {
      const errorMessage: Message = {
        role: 'system',
        content: `Error processing "${source.title}": ${error.message || 'Unknown error'}`,
        timestamp: new Date()
      };
      
      setMultimodalState(prev => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
        isProcessing: false,
        sources: prev.sources.map(s => 
          s.id === id 
            ? { 
                ...s, 
                isProcessed: false, 
                error: errorMessage.content
              } 
            : s
        )
      }));
    }
  };
  
  const handleProcessAllSources = async () => {
    if (multimodalState.sources.length === 0) {
      toast({
        title: 'No sources',
        description: 'Please add at least one source to process',
        variant: 'destructive'
      });
      return;
    }
    
    // Check if API keys are available
    if (selectedModel === 'openai' && !savedOpenaiApiKey) {
      toast({
        title: "No OpenAI API key",
        description: "Please add an OpenAI API key in the Settings page to process your sources.",
        variant: "destructive",
      });
      return;
    }
    
    if (selectedModel === 'mistral' && !savedMistralApiKey) {
      toast({
        title: "No Mistral API key",
        description: "Please add a Mistral API key in the Settings page to process your sources.",
        variant: "destructive",
      });
      return;
    }
    
    // Start processing
    setMultimodalState(prev => ({
      ...prev,
      isProcessing: true,
      messages: [
        ...prev.messages,
        {
          role: 'system',
          content: `Starting batch processing of ${multimodalState.sources.length} sources...`,
          timestamp: new Date()
        }
      ]
    }));
    
    // Process each source in sequence
    for (const source of multimodalState.sources) {
      if (source.isProcessed) continue; // Skip already processed sources
      
      try {
        // Update source status
        setMultimodalState(prev => ({
          ...prev,
          sources: prev.sources.map(s => 
            s.id === source.id ? { ...s, isProcessing: true } : s
          ),
          streamingContent: `Processing ${source.title}...`
        }));
        
        // Process the source
        const result = await processSource(source);
        
        // Update with results
        setMultimodalState(prev => ({
          ...prev,
          messages: [...prev.messages, ...result.messages],
          streamingContent: '',
          sources: prev.sources.map(s => 
            s.id === source.id 
              ? { 
                  ...s, 
                  isProcessing: false,
                  isProcessed: result.success, 
                  processingTime: result.processingTime,
                  error: !result.success ? result.messages[0]?.content : undefined
                } 
              : s
          ),
          graph: mergeGraphs(prev.graph, result.nodes, result.links)
        }));
      } catch (error: any) {
        const errorMessage: Message = {
          role: 'system',
          content: `Error processing "${source.title}": ${error.message || 'Unknown error'}`,
          timestamp: new Date()
        };
        
        setMultimodalState(prev => ({
          ...prev,
          messages: [...prev.messages, errorMessage],
          streamingContent: '',
          sources: prev.sources.map(s => 
            s.id === source.id 
              ? { 
                  ...s, 
                  isProcessing: false,
                  isProcessed: false, 
                  error: errorMessage.content
                } 
              : s
          )
        }));
      }
    }
    
    // Complete processing
    setMultimodalState(prev => ({
      ...prev,
      isProcessing: false,
      messages: [
        ...prev.messages,
        {
          role: 'system',
          content: `Completed batch processing of ${multimodalState.sources.length} sources.`,
          timestamp: new Date()
        }
      ]
    }));
    
    // Auto-save the graph
    try {
      if (multimodalState.graph.nodes.length > 0) {
        const autoSaveName = `Auto-generated graph (${new Date().toLocaleString()})`;
        
        // Save the graph
        const response = await apiRequest('/api/knowledge-graphs', {
          method: 'POST',
          data: {
            name: autoSaveName,
            description: `Auto-generated graph with ${multimodalState.graph.nodes.length} nodes and ${multimodalState.graph.links.length} links`,
            graph: multimodalState.graph
          }
        });
        
        console.log('Auto-save response:', response);
        
        // Extract graph ID directly from known response structure
        const graphId = response?.data?.data?.graphId;
        
        if (graphId) {
          console.log('Auto-saved graph ID:', graphId);
          
          // Update state with saved ID
          setMultimodalState(prev => ({
            ...prev,
            savedGraphId: graphId
          }));
          
          // Switch to knowledge tab to show insights with notification
          setActiveTab('knowledge');
          
          toast({
            title: 'Graph Saved & Processing Complete',
            description: `Graph saved with ID: ${graphId}. View it in the Knowledge Insights tab.`,
            duration: 4000
          });
        } else {
          console.error('Failed to get valid graph ID from auto-save response');
          setActiveTab('knowledge');
          
          toast({
            title: 'Processing Complete',
            description: 'Knowledge graph generated successfully. Switching to Knowledge Insights tab.',
            duration: 4000
          });
        }
      } else {
        // No nodes to save
        setActiveTab('knowledge');
        
        toast({
          title: 'Processing Complete',
          description: 'Knowledge graph generated successfully. Switching to Knowledge Insights tab.',
          duration: 4000
        });
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
      
      // Switch to knowledge tab despite the error
      setActiveTab('knowledge');
      
      toast({
        title: 'Processing Complete',
        description: 'Knowledge graph generated successfully. Switching to Knowledge Insights tab.',
        duration: 4000
      });
    }
  };
  
  // Format timestamp for display
  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  
  // Get appropriate icon and label for source type
  const getSourceTypeIcon = (type: SourceType) => {
    switch (type) {
      case 'text': return <FileText className="h-4 w-4" />;
      case 'website': return <Globe className="h-4 w-4" />;
      case 'image': return <Image className="h-4 w-4" />;
      case 'pdf': return <FileText className="h-4 w-4" />;
      case 'youtube': return <FileVideo className="h-4 w-4" />;
      default: return <Database className="h-4 w-4" />;
    }
  };
  
  const getSourceTypeLabel = (type: SourceType) => {
    switch (type) {
      case 'text': return 'Text Content';
      case 'website': return 'Website URL';
      case 'image': return 'Image';
      case 'pdf': return 'PDF Document';
      case 'youtube': return 'YouTube Video';
      default: return 'Unknown Type';
    }
  };
  
  const getSourceTypeColor = (type: SourceType) => {
    switch (type) {
      case 'text': return 'bg-blue-600';
      case 'website': return 'bg-indigo-600';
      case 'image': return 'bg-purple-600';
      case 'pdf': return 'bg-amber-600';
      case 'youtube': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
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
                
                {/* Modern Navigation Tabs */}
                <div className="px-6">
                  <Tabs defaultValue="sources" value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="flex items-center justify-between">
                      <TabsList className="bg-transparent border-0 p-0 h-auto">
                        <TabsTrigger 
                          value="sources"
                          className="data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 transition-all data-[state=active]:text-blue-400 text-gray-400 hover:text-gray-200"
                        >
                          <Database className="mr-2 h-4 w-4" />
                          Sources {multimodalState.sources.length > 0 && 
                            <Badge className="ml-2 bg-blue-900/30 text-blue-300 border-blue-900/30">
                              {multimodalState.sources.length}
                            </Badge>
                          }
                        </TabsTrigger>
                        
                        <TabsTrigger 
                          value="knowledge"
                          className="data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-purple-500 transition-all data-[state=active]:text-purple-400 text-gray-400 hover:text-gray-200"
                        >
                          <Lightbulb className="mr-2 h-4 w-4" />
                          Knowledge Insights
                          {multimodalState.graph.nodes.length > 0 && 
                            <Badge className="ml-2 bg-purple-900/30 text-purple-300 border-purple-900/30">
                              {multimodalState.graph.nodes.length}
                            </Badge>
                          }
                        </TabsTrigger>
                      </TabsList>
                      
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="border-indigo-900/40 hover:border-indigo-700/40 bg-indigo-950/20 hover:bg-indigo-900/30"
                          onClick={handleProcessAllSources}
                          disabled={multimodalState.sources.length === 0 || multimodalState.isProcessing}
                        >
                          {multimodalState.isProcessing ? (
                            <div className="flex items-center">
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Processing...
                            </div>
                          ) : (
                            <>
                              <Wand2 className="mr-2 h-4 w-4" />
                              Generate Knowledge Graph
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </Tabs>
                </div>
              </div>
              
              {/* Side Panel - Settings or Info */}
              {sidePanel && (
                <div className="absolute top-20 right-6 z-20 w-72 bg-gray-900/95 backdrop-blur-md border border-gray-800 rounded-xl shadow-xl overflow-hidden transform transition-transform duration-300 ease-in-out">
                  <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h3 className="font-medium text-white flex items-center">
                      {sidePanel === 'settings' ? (
                        <>
                          <Settings className="h-4 w-4 mr-2" />
                          Settings
                        </>
                      ) : (
                        <>
                          <BookOpen className="h-4 w-4 mr-2" />
                          Documentation
                        </>
                      )}
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 rounded-full"
                      onClick={() => setSidePanel(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <ScrollArea className="h-[calc(100vh-180px)]">
                    <div className="p-4">
                      {sidePanel === 'settings' && (
                        <div className="space-y-6">
                          <div className="space-y-3">
                            <h4 className="text-sm font-medium text-gray-300">AI Model</h4>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label htmlFor="modelSelection" className="text-xs">AI Model</Label>
                                <Select
                                  value={selectedModel}
                                  onValueChange={(value: 'openai' | 'mistral') => setSelectedModel(value)}
                                >
                                  <SelectTrigger className="w-[180px] bg-gray-900 border-gray-700 text-gray-300">
                                    <SelectValue placeholder="Select model" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-gray-900 border-gray-700 text-gray-300">
                                    <SelectItem value="openai" className="text-gray-300 hover:bg-gray-800">OpenAI</SelectItem>
                                    <SelectItem value="mistral" className="text-gray-300 hover:bg-gray-800">Mistral AI</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <p className="text-xs text-gray-500">
                                {selectedModel === 'openai' 
                                  ? "Using OpenAI for knowledge extraction. Best for complex analysis."
                                  : "Using Mistral AI for knowledge extraction. More efficient for simple content."}
                              </p>
                              
                              {/* API Key Status */}
                              <div className="mt-2 pt-2 border-t border-gray-800">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-400">API Key Status:</span>
                                  {selectedModel === 'openai' ? (
                                    savedOpenaiApiKey ? (
                                      <Badge className="bg-green-600/20 text-green-400 border-green-500/20">
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        Available
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-red-600/20 text-red-400 border-red-500/20">
                                        <AlertCircle className="h-3 w-3 mr-1" />
                                        Missing
                                      </Badge>
                                    )
                                  ) : (
                                    savedMistralApiKey ? (
                                      <Badge className="bg-green-600/20 text-green-400 border-green-500/20">
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        Available
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-red-600/20 text-red-400 border-red-500/20">
                                        <AlertCircle className="h-3 w-3 mr-1" />
                                        Missing
                                      </Badge>
                                    )
                                  )}
                                </div>
                                {((selectedModel === 'openai' && !savedOpenaiApiKey) || 
                                   (selectedModel === 'mistral' && !savedMistralApiKey)) && (
                                  <div className="mt-2">
                                    <p className="text-xs text-amber-500 mb-2">
                                      <AlertCircle className="h-3 w-3 inline mr-1" />
                                      Please add an API key to process sources
                                    </p>
                                    <Link href="/settings" className="text-xs bg-blue-700/40 hover:bg-blue-700/60 text-blue-300 py-1 px-3 rounded-md inline-flex items-center transition-colors">
                                      <Settings className="h-3 w-3 mr-1" />
                                      Go to Settings
                                    </Link>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Graph Visualization controls removed as requested */}
                          
                          <Separator className="bg-gray-800" />
                          
                          <div className="space-y-3">
                            <h4 className="text-sm font-medium text-gray-300">AI Processing</h4>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label htmlFor="advanced-processing" className="text-xs">Advanced Entity Detection</Label>
                                <Switch id="advanced-processing" checked={true} />
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <Label htmlFor="auto-merge" className="text-xs">Auto-Merge Similar Entities</Label>
                                <Switch id="auto-merge" checked={true} />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {sidePanel === 'info' && (
                        <div className="space-y-6">
                          <div>
                            <h4 className="text-sm font-medium text-blue-400 mb-2">Getting Started</h4>
                            <div className="bg-blue-900/20 border border-blue-900/30 rounded-md p-3 text-xs text-gray-300 space-y-2">
                              <p>Welcome to the Knowledge Explorer! This tool helps you extract insights from various sources using AI.</p>
                              
                              <ol className="space-y-2 pl-4 list-decimal">
                                <li>Start by adding information sources using the <strong className="text-blue-300">Add Source</strong> button.</li>
                                <li>Process your sources to generate a knowledge graph with the <strong className="text-indigo-300">Generate Knowledge Graph</strong> button.</li>
                                <li>Explore the interactive visualization to discover connections between entities.</li>
                                <li>Save your findings for future reference.</li>
                              </ol>
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="text-sm font-medium text-purple-400 mb-2">Supported Source Types</h4>
                            <div className="grid grid-cols-1 gap-2">
                              <Card className="bg-gray-800/50 border-gray-700">
                                <CardHeader className="py-2 px-3">
                                  <CardTitle className="text-xs flex items-center">
                                    <FileText className="h-3.5 w-3.5 mr-1.5 text-blue-400" />
                                    Text Content
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="py-2 px-3">
                                  <p className="text-xs text-gray-400">Paste any text content for analysis.</p>
                                </CardContent>
                              </Card>
                              
                              <Card className="bg-gray-800/50 border-gray-700">
                                <CardHeader className="py-2 px-3">
                                  <CardTitle className="text-xs flex items-center">
                                    <Globe className="h-3.5 w-3.5 mr-1.5 text-green-400" />
                                    Website URL
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="py-2 px-3">
                                  <p className="text-xs text-gray-400">Analyze content from any website by URL.</p>
                                </CardContent>
                              </Card>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}
              
              <div className="px-6">
                <Tabs defaultValue="sources" value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsContent value="sources" className="m-0 mt-4">
                  {/* Processing Status Bar - Only shown when processing */}
                  {multimodalState.isProcessing && (
                    <div className="mb-4 bg-gradient-to-br from-[#0e1628]/90 to-[#0c1222]/90 border border-amber-900/30 rounded-xl p-4 shadow-md">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <div className="bg-amber-900/30 p-2 rounded-lg mr-3">
                            <Activity className="h-5 w-5 text-amber-400" />
                          </div>
                          <div>
                            <h3 className="text-base font-medium text-amber-300">Processing Sources</h3>
                            <p className="text-xs text-amber-400/70">Extracting entities and relationships</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-amber-900/30 text-amber-300 border-amber-900/50">
                          <div className="flex items-center">
                            <div className="h-1.5 w-1.5 rounded-full bg-amber-400 mr-1.5 animate-pulse"></div>
                            Active
                          </div>
                        </Badge>
                      </div>
                      
                      <div className="w-full bg-gray-800/50 rounded-full h-2 mb-2">
                        <div 
                          className="bg-gradient-to-r from-amber-500 to-amber-600 h-2 rounded-full" 
                          style={{ 
                            width: `${multimodalState.isProcessing ? Math.min(90, 20 + (multimodalState.messages.length * 10)) : 100}%` 
                          }}
                        ></div>
                      </div>
                      
                      <div className="flex items-start mt-3">
                        <div className="w-full lg:w-3/4">
                          <div className="text-xs text-amber-200/70 mb-1">Processing Log</div>
                          <div className="bg-gray-900/50 border border-amber-900/20 rounded-lg p-3 h-24 overflow-y-auto text-xs font-mono">
                            {multimodalState.messages.slice(-5).map((msg, idx) => (
                              <div key={idx} className="text-gray-400 mb-1">
                                <span className="text-amber-400/80">[{formatTimestamp(msg.timestamp)}]</span> {msg.content}
                              </div>
                            ))}
                            {multimodalState.streamingContent && (
                              <div className="text-blue-400 animate-pulse">
                                <span className="text-blue-400/80">[{formatTimestamp(new Date())}]</span> {multimodalState.streamingContent}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="hidden lg:block w-1/4 pl-4 border-l border-amber-900/20">
                          <div className="text-xs text-amber-200/70 mb-1">Statistics</div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Sources</span>
                              <span className="text-amber-200">{multimodalState.sources.length}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Entities</span>
                              <span className="text-amber-200">{multimodalState.graph.nodes.length}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Relationships</span>
                              <span className="text-amber-200">{multimodalState.graph.links.length}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Source List */}
                  {multimodalState.sources.length === 0 ? (
                    <div className="bg-gradient-to-br from-[#0e1628]/80 to-[#0c1222]/80 border border-[#1e2943]/50 rounded-xl p-10 flex flex-col items-center justify-center text-center">
                      <div className="relative mb-8">
                        <div className="absolute -inset-6 bg-blue-500/5 rounded-full blur-xl"></div>
                        <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 p-5 rounded-full shadow-lg shadow-blue-900/30">
                          <Database className="h-12 w-12 text-white" />
                        </div>
                      </div>
                      
                      <h3 className="text-2xl font-bold text-white mb-3">Add Information Sources</h3>
                      <p className="text-blue-200/80 max-w-lg mb-6">
                        Get started by adding text, websites, images, or documents to extract knowledge and generate insights. Your AI assistant will process these sources to build visual knowledge graphs.
                      </p>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 max-w-2xl mx-auto mb-8">
                        <Card className="bg-blue-900/20 border-blue-900/30 hover:bg-blue-900/30 transition-colors shadow-md group cursor-pointer" onClick={() => {
                          setSourceType('text'); 
                          setIsAddSourceModalOpen(true);
                        }}>
                          <CardContent className="p-4 text-center">
                            <div className="bg-gradient-to-br from-blue-500 to-blue-600 h-10 w-10 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-900/20 group-hover:scale-110 transition-transform">
                              <FileText className="h-5 w-5 text-white" />
                            </div>
                            <h4 className="text-sm font-medium text-blue-200">Text</h4>
                            <p className="text-blue-300/60 text-xs mt-1">Paste any text</p>
                          </CardContent>
                        </Card>
                        
                        <Card className="bg-indigo-900/20 border-indigo-900/30 hover:bg-indigo-900/30 transition-colors shadow-md group cursor-pointer" onClick={() => {
                          setSourceType('website'); 
                          setIsAddSourceModalOpen(true);
                        }}>
                          <CardContent className="p-4 text-center">
                            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 h-10 w-10 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-indigo-900/20 group-hover:scale-110 transition-transform">
                              <Globe className="h-5 w-5 text-white" />
                            </div>
                            <h4 className="text-sm font-medium text-indigo-200">Website</h4>
                            <p className="text-indigo-300/60 text-xs mt-1">Enter a URL</p>
                          </CardContent>
                        </Card>
                        
                        <Card className="bg-purple-900/20 border-purple-900/30 hover:bg-purple-900/30 transition-colors shadow-md group cursor-pointer" onClick={() => {
                          setSourceType('image'); 
                          setIsAddSourceModalOpen(true);
                        }}>
                          <CardContent className="p-4 text-center">
                            <div className="bg-gradient-to-br from-purple-500 to-purple-600 h-10 w-10 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-purple-900/20 group-hover:scale-110 transition-transform">
                              <Image className="h-5 w-5 text-white" />
                            </div>
                            <h4 className="text-sm font-medium text-purple-200">Image</h4>
                            <p className="text-purple-300/60 text-xs mt-1">Image URL</p>
                          </CardContent>
                        </Card>
                        
                        <Card className="bg-pink-900/20 border-pink-900/30 hover:bg-pink-900/30 transition-colors shadow-md group cursor-pointer" onClick={() => {
                          setSourceType('pdf'); 
                          setIsAddSourceModalOpen(true);
                        }}>
                          <CardContent className="p-4 text-center">
                            <div className="bg-gradient-to-br from-pink-500 to-pink-600 h-10 w-10 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-pink-900/20 group-hover:scale-110 transition-transform">
                              <FileText className="h-5 w-5 text-white" />
                            </div>
                            <h4 className="text-sm font-medium text-pink-200">PDF</h4>
                            <p className="text-pink-300/60 text-xs mt-1">Document URL</p>
                          </CardContent>
                        </Card>
                      </div>
                      
                      <Button 
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-900/30"
                        size="lg"
                        onClick={() => setIsAddSourceModalOpen(true)}
                      >
                        <Plus className="mr-2 h-5 w-5" />
                        Add Your First Source
                      </Button>
                    </div>
                  ) : (
                    <div>
                      {/* Source Filters and Actions */}
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="bg-blue-900/20 text-blue-300 border-blue-900/30 px-3 py-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5"></div>
                            {multimodalState.sources.length} Sources
                          </Badge>
                          
                          <Badge variant="outline" className={`px-3 py-1 text-xs ${
                            multimodalState.isProcessing 
                              ? "border-amber-500/50 bg-amber-500/10 text-amber-300" 
                              : "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                          }`}>
                            {multimodalState.isProcessing 
                              ? <div className="flex items-center"><div className="h-1.5 w-1.5 rounded-full bg-amber-400 mr-1.5 animate-pulse"></div>Processing</div>
                              : <div className="flex items-center"><div className="h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5"></div>Ready</div>
                            }
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="border-blue-900/40 hover:border-blue-700/40 bg-blue-950/20 hover:bg-blue-900/30"
                            onClick={() => setIsAddSourceModalOpen(true)}
                          >
                            <Plus className="h-4 w-4 mr-1.5" />
                            Add Source
                          </Button>
                        </div>
                      </div>
                      
                      {/* Source Cards Grid - Redesigned */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {multimodalState.sources.map((source, index) => (
                          <SourceCardNext
                            key={source.id}
                            source={source}
                            index={index}
                            onDelete={handleDeleteSource}
                            onEdit={handleEditSource}
                            onProcess={handleProcessSource}
                            onConnect={handleConnectSource}
                            isActive={source.id === activeSourceId}
                            onSelect={(id) => setActiveSourceId(id)}
                            isDragging={dragSourceId === source.id}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>
                

                
                <TabsContent value="knowledge" className="m-0 mt-4">
                  <div className="grid grid-cols-1 gap-6">
                    {/* Knowledge Graph Insights Card */}
                    <div className="bg-gradient-to-br from-[#0e1628]/90 to-[#0c1222]/90 border border-purple-900/30 rounded-xl shadow-xl overflow-hidden">
                      <div className="flex justify-between items-center px-5 py-3 border-b border-purple-900/30">
                        <div className="flex items-center space-x-3">
                          <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-2 rounded-lg">
                            <Lightbulb className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-white">Knowledge Graph Insights</h3>
                            <p className="text-xs text-purple-300/70">Interactive visualization of extracted data</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          
                          {/* Save Button */}
                          {multimodalState.graph.nodes.length > 0 && (
                            <Button 
                              size="sm"
                              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shadow-indigo-900/20"
                              onClick={handleSaveGraph}
                              disabled={multimodalState.isProcessing}
                            >
                              <Save className="h-3.5 w-3.5 mr-1.5" />
                              Save Graph
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {multimodalState.graph.nodes.length > 0 ? (
                        <div className="p-5">
                          {/* Summary Statistics */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
                            <div className="bg-purple-950/30 border border-purple-900/30 rounded-lg p-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="text-xs text-purple-300/80 mb-1">Total Entities</p>
                                  <h4 className="text-2xl font-bold text-purple-300">{multimodalState.graph.nodes.length}</h4>
                                </div>
                                <div className="bg-purple-900/40 p-2 rounded-lg">
                                  <Users className="h-5 w-5 text-purple-300" />
                                </div>
                              </div>
                            </div>
                            
                            <div className="bg-indigo-950/30 border border-indigo-900/30 rounded-lg p-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="text-xs text-indigo-300/80 mb-1">Total Relationships</p>
                                  <h4 className="text-2xl font-bold text-indigo-300">{multimodalState.graph.links.length}</h4>
                                </div>
                                <div className="bg-indigo-900/40 p-2 rounded-lg">
                                  <Link2 className="h-5 w-5 text-indigo-300" />
                                </div>
                              </div>
                            </div>
                            
                            <div className="bg-blue-950/30 border border-blue-900/30 rounded-lg p-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="text-xs text-blue-300/80 mb-1">Network Density</p>
                                  <h4 className="text-2xl font-bold text-blue-300">
                                    {multimodalState.graph.nodes.length > 1 
                                      ? (multimodalState.graph.links.length / (multimodalState.graph.nodes.length * (multimodalState.graph.nodes.length - 1) / 2)).toFixed(2)
                                      : "0.00"}
                                  </h4>
                                </div>
                                <div className="bg-blue-900/40 p-2 rounded-lg">
                                  <Network className="h-5 w-5 text-blue-300" />
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Narrative Summary */}
                          <div className="bg-blue-950/20 border border-blue-900/30 rounded-lg p-4 mb-6">
                            <div className="flex items-start mb-3">
                              <div className="bg-blue-900/40 p-2 rounded-lg mr-3">
                                <Lightbulb className="h-4 w-4 text-blue-300" />
                              </div>
                              <div>
                                <h5 className="text-sm font-medium text-blue-300 mb-1">Graph Narrative Summary</h5>
                                <p className="text-xs text-gray-400">AI-generated insights from your knowledge graph</p>
                              </div>
                            </div>
                            <div className="prose prose-sm prose-invert max-w-none text-gray-300">
                              <p>
                                This knowledge graph contains <span className="text-purple-300 font-medium">{multimodalState.graph.nodes.length} entities</span> connected by <span className="text-indigo-300 font-medium">{multimodalState.graph.links.length} relationships</span>. 
                                {multimodalState.graph.nodes.length > 0 && multimodalState.graph.links.length > 0 && (
                                  <>
                                    {' '}The most connected entity is <span className="text-blue-300 font-medium">
                                      {Array.from(new Set(multimodalState.graph.nodes))
                                        .sort((a, b) => {
                                          const aConnections = multimodalState.graph.links.filter(
                                            link => link.source === a.id || link.target === a.id
                                          ).length;
                                          const bConnections = multimodalState.graph.links.filter(
                                            link => link.source === b.id || link.target === b.id
                                          ).length;
                                          return bConnections - aConnections;
                                        })[0]?.name || 'Unknown'}
                                    </span>, and the most common relationship type is <span className="text-blue-300 font-medium">
                                      {Object.entries(
                                        multimodalState.graph.links.reduce((acc, link) => {
                                          const rel = link.relationship || link.label || 'related';
                                          acc[rel] = (acc[rel] || 0) + 1;
                                          return acc;
                                        }, {} as Record<string, number>)
                                      )
                                        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'related'}
                                    </span>.
                                  </>
                                )}
                              </p>
                              <p className="mt-2">
                                {multimodalState.sources.length > 0 ? (
                                  <>The graph was generated from {multimodalState.sources.length} source{multimodalState.sources.length !== 1 ? 's' : ''} using {selectedModel === 'openai' ? 'OpenAI' : 'Mistral AI'} processing.</>
                                ) : (
                                  <>Add sources and process them to generate a more detailed knowledge graph.</>
                                )}
                              </p>
                            </div>
                          </div>
                          
                          {/* Key Entities & Relationships */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                            <div>
                              <h5 className="text-sm font-medium text-purple-300 mb-3">Key Entities</h5>
                              <div className="bg-gray-900/50 border border-purple-900/20 rounded-lg p-3 h-48 overflow-y-auto">
                                <table className="w-full text-sm">
                                  <thead className="text-xs text-gray-400">
                                    <tr>
                                      <th className="text-left pb-2">Entity</th>
                                      <th className="text-left pb-2">Type</th>
                                      <th className="text-right pb-2">Connections</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Array.from(new Set(multimodalState.graph.nodes))
                                      .sort((a, b) => {
                                        // Count connections for each node
                                        const aConnections = multimodalState.graph.links.filter(
                                          link => link.source === a.id || link.target === a.id
                                        ).length;
                                        const bConnections = multimodalState.graph.links.filter(
                                          link => link.source === b.id || link.target === b.id
                                        ).length;
                                        return bConnections - aConnections;
                                      })
                                      .slice(0, 10)
                                      .map((node, idx) => {
                                        // Count connections for this node
                                        const connections = multimodalState.graph.links.filter(
                                          link => link.source === node.id || link.target === node.id
                                        ).length;
                                        
                                        return (
                                          <tr key={idx} className="border-b border-gray-800/30 last:border-0">
                                            <td className="py-2 text-purple-200">{node.name}</td>
                                            <td className="py-2 text-gray-400">{node.type || 'Entity'}</td>
                                            <td className="py-2 text-right text-indigo-300 font-medium">{connections}</td>
                                          </tr>
                                        );
                                      })
                                    }
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            
                            <div>
                              <h5 className="text-sm font-medium text-indigo-300 mb-3">Key Relationships</h5>
                              <div className="bg-gray-900/50 border border-indigo-900/20 rounded-lg p-3 h-48 overflow-y-auto">
                                <table className="w-full text-sm">
                                  <thead className="text-xs text-gray-400">
                                    <tr>
                                      <th className="text-left pb-2">Type</th>
                                      <th className="text-right pb-2">Count</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Object.entries(
                                      multimodalState.graph.links.reduce((acc, link) => {
                                        const rel = link.relationship || link.label || 'related';
                                        acc[rel] = (acc[rel] || 0) + 1;
                                        return acc;
                                      }, {} as Record<string, number>)
                                    )
                                      .sort((a, b) => b[1] - a[1])
                                      .slice(0, 10)
                                      .map(([relationship, count], idx) => (
                                        <tr key={idx} className="border-b border-gray-800/30 last:border-0">
                                          <td className="py-2 text-indigo-200">{relationship}</td>
                                          <td className="py-2 text-right text-indigo-300 font-medium">{count}</td>
                                        </tr>
                                      ))
                                    }
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                          
                          {/* View Interactive Graph Button */}
                          <div className="flex justify-center mt-3">
                            <Button
                              variant="outline"
                              className="border-purple-900/40 bg-purple-950/20 hover:bg-purple-900/30 text-purple-300"
                              onClick={async () => {
                                // Redirect to graph visualization page with this graph
                                if (multimodalState.graph.nodes.length === 0) {
                                  toast({
                                    title: 'No graph data',
                                    description: 'Process sources first to generate a knowledge graph',
                                    variant: 'destructive'
                                  });
                                  return;
                                }
                                
                                // If the graph has been saved, navigate to that specific graph
                                if (multimodalState.savedGraphId) {
                                  console.log('Using saved graph ID:', multimodalState.savedGraphId);
                                  
                                  // Show toast before redirecting
                                  toast({
                                    title: 'Loading Saved Graph',
                                    description: `Redirecting to graph ID: ${multimodalState.savedGraphId}`
                                  });
                                  
                                  // Use setTimeout to ensure toast is shown
                                  setTimeout(() => {
                                    window.location.href = `/load?graphId=${multimodalState.savedGraphId}`;
                                  }, 100);
                                } else {
                                  // Auto-save the graph first
                                  toast({
                                    title: 'Saving Graph',
                                    description: 'Saving your knowledge graph before viewing...'
                                  });
                                  
                                  // Auto-generate a name for the graph based on sources
                                  const sourceNames = multimodalState.sources.map(s => s.title).slice(0, 2).join(", ");
                                  const graphName = `Multimodal Graph: ${sourceNames}${multimodalState.sources.length > 2 ? ' and more' : ''}`;
                                  
                                  try {
                                    const response = await apiRequest('/api/knowledge-graphs', {
                                      method: 'POST',
                                      data: {
                                        name: graphName,
                                        description: `Auto-saved graph from ${multimodalState.sources.length} sources in Multimodal page`,
                                        graph: multimodalState.graph
                                      }
                                    });
                                    
                                    // Log the response object for debugging
                                    console.log('API Response:', response);
                                    
                                    // Extract graphId based on the actual response format shown in the error screenshot
                                    // The response seems to be: {graphId: 82, message: "Graph saved successfully"}
                                    
                                    // Check for the most direct access pattern first (from the screenshot)
                                    let savedGraphId: string | number | null = null;
                                    
                                    if (response.graphId !== undefined) {
                                      // Direct pattern from error screenshot - {graphId: 82, message: "..."}
                                      savedGraphId = response.graphId;
                                      console.log('Extracted graphId directly from response:', savedGraphId);
                                    } 
                                    else if (response.data && response.data.graphId !== undefined) {
                                      // Pattern from API response: {success: true, data: {graphId: 82, ...}}
                                      savedGraphId = response.data.graphId;
                                      console.log('Extracted graphId from response.data:', savedGraphId);
                                    }
                                    else if (response.data && response.data.data && response.data.data.graphId !== undefined) {
                                      // Pattern from API response: {success: true, data: {data: {graphId: 82}}}
                                      savedGraphId = response.data.data.graphId;
                                      console.log('Extracted graphId from response.data.data:', savedGraphId);
                                    }
                                    
                                    // If we still don't have a graphId, try a deep search
                                    if (!savedGraphId) {
                                      // Comprehensive recursive search for graphId anywhere in the object
                                      const findGraphId = (obj: any): string | number | null => {
                                        if (!obj || typeof obj !== 'object') return null;
                                        
                                        // Check if current object has graphId property
                                        if (obj.graphId !== undefined) return obj.graphId;
                                        
                                        // Search in all object properties
                                        for (const key in obj) {
                                          if (typeof obj[key] === 'object') {
                                            const found = findGraphId(obj[key]);
                                            if (found !== null) return found;
                                          }
                                        }
                                        
                                        return null;
                                      };
                                      
                                      savedGraphId = findGraphId(response);
                                      console.log('Deep search result for graphId:', savedGraphId);
                                    }
                                    
                                    if (!savedGraphId) {
                                      console.error('Invalid response - cannot find graphId:', response);
                                      toast({
                                        title: 'Error Saving Graph',
                                        description: 'Could not get valid graph ID from server response',
                                        variant: 'destructive'
                                      });
                                      return;
                                    }
                                    console.log('Saved Graph ID:', savedGraphId);
                                    
                                    // Update state with new ID
                                    setMultimodalState(prev => ({
                                      ...prev,
                                      savedGraphId: savedGraphId
                                    }));
                                    
                                    // Redirect to the saved graph in the Load page
                                    toast({
                                      title: 'Graph Saved Successfully',
                                      description: `Graph ID: ${savedGraphId} - Redirecting to viewer...`
                                    });
                                    
                                    // Use short timeout to ensure state is updated and toast is shown
                                    setTimeout(() => {
                                      window.location.href = `/load?graphId=${savedGraphId}`;
                                    }, 100);
                                  } catch (error: any) {
                                    // If saving fails, fallback to temp storage method
                                    toast({
                                      title: 'Auto-save failed',
                                      description: 'Using temporary storage instead',
                                      variant: 'destructive'
                                    });
                                    localStorage.setItem('tempGraphData', JSON.stringify(multimodalState.graph));
                                    window.location.href = '/load?temp=true';
                                  }
                                }
                              }}
                            >
                              <Network className="mr-2 h-4 w-4" />
                              View Interactive Graph
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-center p-6">
                          <div className="text-purple-500 bg-purple-950/30 p-3 rounded-full mb-4">
                            <Lightbulb className="h-7 w-7" />
                          </div>
                          <h3 className="text-lg font-medium text-gray-300 mb-2">No Knowledge Graph Available</h3>
                          <p className="text-sm text-gray-400 max-w-md mb-4">
                            Process your sources to generate a knowledge graph and gain insights about your data.
                          </p>
                          <Button
                            variant="outline"
                            className="border-purple-700/30 bg-purple-950/20 hover:bg-purple-900/30 text-purple-300 hover:text-purple-200"
                            onClick={handleProcessAllSources}
                            disabled={multimodalState.sources.length === 0 || multimodalState.isProcessing}
                          >
                            <Wand2 className="mr-2 h-4 w-4" />
                            Generate Knowledge Graph
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
                </Tabs>
              </div>
            </div>
          </main>
        </div>
      </div>
      
      {/* Modern Source Modal */}
      <Dialog open={isAddSourceModalOpen} onOpenChange={setIsAddSourceModalOpen}>
        <DialogContent className="sm:max-w-lg bg-gradient-to-b from-[#0e1628] to-[#0c1222] border-[#1e2943]/70">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center">
              <Plus className="h-5 w-5 mr-2 text-blue-500" />
              Add New Source
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-5 py-4">
            <div className="flex gap-5 overflow-x-auto pb-2 -mx-1 px-1">
              <Card 
                className={`shrink-0 w-20 border cursor-pointer transition-all ${
                  sourceType === 'text' 
                    ? 'bg-blue-900/20 border-blue-500/50 shadow-lg shadow-blue-900/30' 
                    : 'bg-gray-900/40 border-gray-800 hover:bg-gray-900/60'
                }`}
                onClick={() => setSourceType('text')}
              >
                <CardContent className="p-3 text-center">
                  <div className={`mx-auto h-8 w-8 rounded-full flex items-center justify-center mb-1 ${
                    sourceType === 'text' ? 'bg-blue-600' : 'bg-gray-800'
                  }`}>
                    <FileText className="h-4 w-4 text-white" />
                  </div>
                  <p className={`text-xs font-medium ${sourceType === 'text' ? 'text-blue-300' : 'text-gray-400'}`}>Text</p>
                </CardContent>
              </Card>
              
              <Card 
                className={`shrink-0 w-20 border cursor-pointer transition-all ${
                  sourceType === 'website' 
                    ? 'bg-indigo-900/20 border-indigo-500/50 shadow-lg shadow-indigo-900/30' 
                    : 'bg-gray-900/40 border-gray-800 hover:bg-gray-900/60'
                }`}
                onClick={() => setSourceType('website')}
              >
                <CardContent className="p-3 text-center">
                  <div className={`mx-auto h-8 w-8 rounded-full flex items-center justify-center mb-1 ${
                    sourceType === 'website' ? 'bg-indigo-600' : 'bg-gray-800'
                  }`}>
                    <Globe className="h-4 w-4 text-white" />
                  </div>
                  <p className={`text-xs font-medium ${sourceType === 'website' ? 'text-indigo-300' : 'text-gray-400'}`}>Website</p>
                </CardContent>
              </Card>
              
              <Card 
                className={`shrink-0 w-20 border cursor-pointer transition-all ${
                  sourceType === 'image' 
                    ? 'bg-purple-900/20 border-purple-500/50 shadow-lg shadow-purple-900/30' 
                    : 'bg-gray-900/40 border-gray-800 hover:bg-gray-900/60'
                }`}
                onClick={() => setSourceType('image')}
              >
                <CardContent className="p-3 text-center">
                  <div className={`mx-auto h-8 w-8 rounded-full flex items-center justify-center mb-1 ${
                    sourceType === 'image' ? 'bg-purple-600' : 'bg-gray-800'
                  }`}>
                    <Image className="h-4 w-4 text-white" />
                  </div>
                  <p className={`text-xs font-medium ${sourceType === 'image' ? 'text-purple-300' : 'text-gray-400'}`}>Image</p>
                </CardContent>
              </Card>
              
              <Card 
                className={`shrink-0 w-20 border cursor-pointer transition-all ${
                  sourceType === 'pdf' 
                    ? 'bg-amber-900/20 border-amber-500/50 shadow-lg shadow-amber-900/30' 
                    : 'bg-gray-900/40 border-gray-800 hover:bg-gray-900/60'
                }`}
                onClick={() => setSourceType('pdf')}
              >
                <CardContent className="p-3 text-center">
                  <div className={`mx-auto h-8 w-8 rounded-full flex items-center justify-center mb-1 ${
                    sourceType === 'pdf' ? 'bg-amber-600' : 'bg-gray-800'
                  }`}>
                    <FileText className="h-4 w-4 text-white" />
                  </div>
                  <p className={`text-xs font-medium ${sourceType === 'pdf' ? 'text-amber-300' : 'text-gray-400'}`}>PDF</p>
                </CardContent>
              </Card>
              
              <Card 
                className={`shrink-0 w-20 border cursor-pointer transition-all ${
                  sourceType === 'youtube' 
                    ? 'bg-red-900/20 border-red-500/50 shadow-lg shadow-red-900/30' 
                    : 'bg-gray-900/40 border-gray-800 hover:bg-gray-900/60'
                }`}
                onClick={() => setSourceType('youtube')}
              >
                <CardContent className="p-3 text-center">
                  <div className={`mx-auto h-8 w-8 rounded-full flex items-center justify-center mb-1 ${
                    sourceType === 'youtube' ? 'bg-red-600' : 'bg-gray-800'
                  }`}>
                    <FileVideo className="h-4 w-4 text-white" />
                  </div>
                  <p className={`text-xs font-medium ${sourceType === 'youtube' ? 'text-red-300' : 'text-gray-400'}`}>YouTube</p>
                </CardContent>
              </Card>
            </div>
            
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="sourceTitle" className="text-gray-300">Source Title</Label>
                <Input
                  id="sourceTitle"
                  placeholder="Enter a descriptive title for this source"
                  value={sourceTitle}
                  onChange={(e) => setSourceTitle(e.target.value)}
                  className="bg-gray-900/70 border-gray-800 focus:border-blue-700"
                />
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="sourceContent" className="text-gray-300">
                  {sourceType === 'text' ? 'Text Content' : 
                   sourceType === 'website' ? 'Website URL' :
                   sourceType === 'image' ? 'Image URL' :
                   sourceType === 'pdf' ? 'PDF URL' :
                   sourceType === 'youtube' ? 'YouTube URL' : 'Content'}
                </Label>
                
                {sourceType === 'text' ? (
                  <Textarea
                    id="sourceContent"
                    placeholder="Enter or paste text content..."
                    value={sourceContent}
                    onChange={(e) => setSourceContent(e.target.value)}
                    className="h-32 bg-gray-900/70 border-gray-800 focus:border-blue-700"
                  />
                ) : (
                  <Input
                    id="sourceContent"
                    placeholder={sourceType === 'website' ? 'https://example.com' : 
                                 sourceType === 'image' ? 'https://example.com/image.jpg' :
                                 sourceType === 'pdf' ? 'https://example.com/document.pdf' :
                                 sourceType === 'youtube' ? 'https://youtube.com/watch?v=...' : 
                                 'Enter URL...'}
                    value={sourceContent}
                    onChange={(e) => setSourceContent(e.target.value)}
                    className="bg-gray-900/70 border-gray-800 focus:border-blue-700"
                  />
                )}
                
                <p className="text-xs text-gray-400 mt-1">
                  {sourceType === 'text' ? 'Enter any text you want to analyze.' : 
                   sourceType === 'website' ? 'Enter a valid website URL including https://' :
                   sourceType === 'image' ? 'Enter a direct URL to an image (JPG, PNG, etc.)' :
                   sourceType === 'pdf' ? 'Enter a direct URL to a PDF document' :
                   sourceType === 'youtube' ? 'Enter a YouTube video URL' : 
                   'Enter content URL'}
                </p>
              </div>
              
              {/* File upload options */}
              {(sourceType === 'image' || sourceType === 'pdf') && (
                <div className="mt-4 border border-gray-800 rounded-md p-3 bg-gray-900/50">
                  <h4 className="text-sm font-medium text-blue-400 mb-2 flex items-center">
                    <Upload className="w-4 h-4 mr-1" /> 
                    Upload {sourceType === 'image' ? 'an image' : 'a PDF'} file instead
                  </h4>
                  
                  <div 
                    className="border border-dashed border-gray-700 rounded-md p-4 text-center cursor-pointer hover:border-blue-500 transition-colors"
                    onClick={sourceType === 'image' ? triggerImageUpload : triggerPdfUpload}
                  >
                    <div className="flex flex-col items-center justify-center">
                      {sourceType === 'image' ? (
                        <Image className="w-8 h-8 mb-2 text-gray-500" />
                      ) : (
                        <FileText className="w-8 h-8 mb-2 text-gray-500" />
                      )}
                      
                      <p className="text-sm text-gray-400">
                        Click to upload {sourceType === 'image' ? 'image' : 'PDF'}
                      </p>
                      
                      <p className="text-xs text-gray-500 mt-1">
                        {sourceType === 'image' 
                          ? 'JPG, PNG, GIF, BMP, WEBP (max 10MB)' 
                          : 'PDF documents only (max 10MB)'}
                      </p>
                      
                      {selectedFile && (
                        <div className="mt-2 py-1 px-2 bg-gray-800 rounded text-xs text-gray-300 flex items-center">
                          <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
                          {selectedFile.name} ({Math.round(selectedFile.size / 1024)}KB)
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Hidden file inputs */}
          <input 
            type="file"
            ref={imageInputRef}
            onChange={handleImageUpload}
            accept="image/jpeg,image/png,image/gif,image/bmp,image/webp"
            className="hidden"
          />
          
          <input 
            type="file"
            ref={pdfInputRef}
            onChange={handlePdfUpload}
            accept="application/pdf"
            className="hidden"
          />
          
          <DialogFooter>
            <Button variant="outline" className="border-gray-800" onClick={() => setIsAddSourceModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddSource}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white"
              disabled={!sourceTitle || (sourceType !== 'pdf' && sourceType !== 'image' && !sourceContent)}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Source
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MultimodalPage;