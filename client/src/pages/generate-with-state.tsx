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
  const { toast } = useToast();
  
  // Get sidebar context for layout
  const sidebar = useSidebar();
  const { state, isMobile, openMobile } = sidebar;
  
  // Get navigation hook for redirection
  const [_, setLocation] = useLocation();
  
  // Calculate sidebar width for proper spacing
  const sidebarWidth = (sidebar as any).width || (state === 'expanded' ? 256 : 80);
  const graphExplorerRef = useRef<GraphRef>(null);

  // Update app state context when relevant state changes
  useEffect(() => {
    console.log('Updating app state with current Generate page state');
    updateGeneratePage({
      knowledgeGraph,
      originalGraph,
      enrichedGraph,
      text,
      selectedModel,
      inputType,
      extractResult
    });
  }, [knowledgeGraph, originalGraph, enrichedGraph, text, selectedModel, inputType, extractResult, updateGeneratePage]);

  // Handle text input changes
  const handleTextChange = (newText: string) => {
    setText(newText);
  };

  // ... rest of the Generate component implementation
  // (Copy the remaining methods and JSX from the original generate.tsx)
}