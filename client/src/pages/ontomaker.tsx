import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAppState } from '@/contexts/AppStateContext';
import PageLayout from '@/components/PageLayout';
import { 
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle, DialogTrigger 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Layers, Plus, Edit, Search, Network, FileUp, BookOpen, Download, X, Save,
  Trash2, RefreshCw, Info, Upload, Database, AlignLeft, FileText, Lightbulb,
  Clock, LayoutGrid, Package, Folder, FolderOpen, Settings, List, ListFilter,
  MoreHorizontal, Copy, ExternalLink, ArrowRight, CheckSquare, Filter, TableIcon as TableLucide,
  PanelRight, HelpCircle, Sparkles, Code, Braces as BracesIcon, 
  Loader2, Check, Lightbulb as LightbulbIcon
} from 'lucide-react';
import GraphVisualization from '@/components/GraphVisualization';
import KnowledgeGraphExplorer, { GraphRef } from '@/components/KnowledgeGraphExplorer';
// Schema.org integration now handled inline, no separate component needed
import { Node as SchemaNode, Link as SchemaLink } from '@shared/schema';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';

// Helper component for tooltips
const HelpTooltip = ({ content, children }: { content: string, children: React.ReactNode }) => {
  // Using the direct children within TooltipProvider context
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent className="bg-gray-900 border-gray-700 text-white max-w-[300px]">
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// OntoMaker Steps Component
const OntoMakerSteps = () => {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-300">Getting Started</h4>
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <div className="bg-primary/10 text-primary rounded-full h-5 w-5 flex items-center justify-center text-xs mt-0.5">1</div>
          <div>
            <p className="text-xs font-medium text-gray-300">Create or Import an Ontology</p>
            <p className="text-xs text-gray-400">Start with a new ontology or import an existing one</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="bg-primary/10 text-primary rounded-full h-5 w-5 flex items-center justify-center text-xs mt-0.5">2</div>
          <div>
            <p className="text-xs font-medium text-gray-300">Define Entities and Relations</p>
            <p className="text-xs text-gray-400">Add classes, properties, and relationships</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="bg-primary/10 text-primary rounded-full h-5 w-5 flex items-center justify-center text-xs mt-0.5">3</div>
          <div>
            <p className="text-xs font-medium text-gray-300">Visualize Your Ontology</p>
            <p className="text-xs text-gray-400">Explore the knowledge graph representation</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="bg-primary/10 text-primary rounded-full h-5 w-5 flex items-center justify-center text-xs mt-0.5">4</div>
          <div>
            <p className="text-xs font-medium text-gray-300">Enrich with AI or Standards</p>
            <p className="text-xs text-gray-400">Expand your ontology with additional knowledge</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Interfaces
interface OntologyEntity {
  id: number;
  name: string;
  description: string;
  type: string;
  properties: {
    name: string;
    type: string;
    description: string;
  }[];
}

interface OntologyRelation {
  id: number;
  name: string;
  source: string;
  target: string;
  description: string;
}

interface OntologyVersion {
  id: number;
  version: string;
  timestamp: string;
  description: string;
  changes: {
    type: 'add' | 'update' | 'delete';
    element?: 'entity' | 'relation' | 'property';
    itemType?: string;
    name?: string;
    description?: string;
    count?: number;
    source?: string;
  }[];
}

interface Ontology {
  id: number;
  name: string;
  description: string;
  domain: string;
  createdAt: string;
  updatedAt: string;
  entities: OntologyEntity[];
  relations: OntologyRelation[];
  versions: OntologyVersion[];
}

interface OntologyNode {
  id: number;
  name: string;
  group: number;
  type: string;
  description?: string;
}

interface OntologyLink {
  id?: number;
  source: number;
  target: number;
  value: number;
  label: string;
  description?: string;
}

interface KnowledgeGraph {
  nodes: OntologyNode[];
  links: OntologyLink[];
  id?: number;
  name?: string;
}

// Main OntoMaker component
export default function OntoMaker() {
  // Get app state context
  const { appState, updateOntomakerPage } = useAppState();
  
  // State for various UI elements - initialize from app state
  const [activeTab, setActiveTab] = useState(appState.ontomakerPage.selectedTab || 'design');
  const [selectedModel, setSelectedModel] = useState('openai');
  const [ontologyPrompt, setOntologyPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [fileFormat, setFileFormat] = useState('rdf');
  const [currentOntology, setCurrentOntology] = useState<Ontology | null>(appState.ontomakerPage.selectedOntology);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEntityDialog, setShowEntityDialog] = useState(false);
  const [showRelationDialog, setShowRelationDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<OntologyVersion | null>(null);
  const [showVersionDialog, setShowVersionDialog] = useState(false);
  const [schemaIntegrationType, setSchemaIntegrationType] = useState<'extend' | 'replace' | 'annotate'>('extend');
  const [schemaMappingType, setSchemaMappingType] = useState<'suggested' | 'manual' | 'all'>('suggested');
  const [showSchemaOrgSuggestions, setShowSchemaOrgSuggestions] = useState(false);
  
  // State for graph import
  const [selectedGraphId, setSelectedGraphId] = useState<string>(
    appState.ontomakerPage.selectedOntologyId ? appState.ontomakerPage.selectedOntologyId.toString() : ''
  );
  const [graphImportName, setGraphImportName] = useState(appState.ontomakerPage.ontologyName || '');
  const [graphImportDomain, setGraphImportDomain] = useState('');
  const [isConvertingGraph, setIsConvertingGraph] = useState(false);
  
  // State for enrichment options
  const [enrichmentType, setEnrichmentType] = useState<string>('ai');
  const [enrichmentFocus, setEnrichmentFocus] = useState<'all' | 'entities' | 'relations' | 'properties'>('all');
  const [enrichmentInstructions, setEnrichmentInstructions] = useState('');
  
  // Separate state for AI enrichment and Schema.org enrichment
  const [isAIEnriching, setIsAIEnriching] = useState(false);
  const [aiEnrichmentProgress, setAIEnrichmentProgress] = useState(0);
  const [aiEnrichmentStage, setAIEnrichmentStage] = useState('');
  
  const [isSchemaEnriching, setIsSchemaEnriching] = useState(false);
  const [schemaEnrichmentProgress, setSchemaEnrichmentProgress] = useState(0);
  const [schemaEnrichmentStage, setSchemaEnrichmentStage] = useState('');
  
  // Combined state for backward compatibility
  const isEnriching = isAIEnriching || isSchemaEnriching;
  const enrichmentProgress = enrichmentType === 'ai' ? aiEnrichmentProgress : schemaEnrichmentProgress;
  const enrichmentStage = enrichmentType === 'ai' ? aiEnrichmentStage : schemaEnrichmentStage;
  
  const [enrichmentSuggestions, setEnrichmentSuggestions] = useState<{
    entities: OntologyEntity[],
    relations: OntologyRelation[],
    properties: {entityName: string, property: {name: string, type: string, description: string}}[]
  }>({entities: [], relations: [], properties: []});
  
  // Track selected suggestions for batch processing
  const [selectedSuggestions, setSelectedSuggestions] = useState<{
    entities: number[],
    relations: number[],
    properties: number[]
  }>({entities: [], relations: [], properties: []});
  
  // For export
  const [selectedOntologyId, setSelectedOntologyId] = useState<number | null>(null);
  
  // Assign group number based on entity type
  const getGroupForEntityType = (type: string): number => {
    const typeMap: Record<string, number> = {
      'Class': 1,
      'Property': 2,
      'DataType': 3,
      'ObjectProperty': 4,
      'AnnotationProperty': 5
    };
    
    return typeMap[type] || 6;
  };
  
  // Convert ontology to knowledge graph format for visualization
  const convertOntologyToGraph = (ontology: Ontology): KnowledgeGraph => {
    if (!ontology) return { nodes: [], links: [], id: 0 };

    const nodes: OntologyNode[] = ontology.entities.map((entity, index) => ({
      id: entity.id,
      name: entity.name,
      group: getGroupForEntityType(entity.type),
      type: entity.type,
      description: entity.description
    }));

    const links: OntologyLink[] = ontology.relations.map((relation, index) => {
      const sourceNode = ontology.entities.find(e => e.name === relation.source);
      const targetNode = ontology.entities.find(e => e.name === relation.target);

      if (!sourceNode || !targetNode) return null;

      return {
        id: relation.id, // Include relation ID for updates
        source: sourceNode.id,
        target: targetNode.id,
        value: 1,
        label: relation.name,
        description: relation.description
      };
    }).filter(Boolean) as OntologyLink[];

    // Include the ontology ID as the graph ID for proper updates
    return { 
      id: ontology.id, 
      name: ontology.name,
      nodes, 
      links 
    };
  };
  
  // Memoize the graph data to prevent hook errors
  const memoizedGraph = React.useMemo(() => 
    currentOntology ? convertOntologyToGraph(currentOntology) : null
  , [currentOntology]);

  // Update app state when selected ontology or tab changes
  useEffect(() => {
    // Check if values have actually changed before updating to prevent infinite loop
    const hasOntologyChanged = 
      JSON.stringify(appState.ontomakerPage.selectedOntology) !== JSON.stringify(currentOntology);
    const hasOntologyIdChanged = 
      appState.ontomakerPage.selectedOntologyId !== (currentOntology?.id || null);
    const hasOntologyNameChanged = 
      appState.ontomakerPage.ontologyName !== (currentOntology?.name || '');
    const hasOntologyDescriptionChanged = 
      appState.ontomakerPage.ontologyDescription !== (currentOntology?.description || '');
    const hasTabChanged = 
      appState.ontomakerPage.selectedTab !== activeTab;
    
    if (
      hasOntologyChanged || 
      hasOntologyIdChanged || 
      hasOntologyNameChanged || 
      hasOntologyDescriptionChanged || 
      hasTabChanged
    ) {
      updateOntomakerPage({
        selectedOntology: currentOntology,
        selectedOntologyId: currentOntology?.id || null,
        ontologyName: currentOntology?.name || '',
        ontologyDescription: currentOntology?.description || '',
        selectedTab: activeTab
      });
    }
  }, [currentOntology, activeTab, updateOntomakerPage, appState.ontomakerPage]);

  // References
  const fileInputRef = useRef<HTMLInputElement>(null);
  const graphRef = useRef<GraphRef>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state for entity editing
  const [entityForm, setEntityForm] = useState<{
    id?: number;
    name: string;
    description: string;
    type: string;
    properties: { name: string; type: string; description: string }[];
  }>({
    name: '',
    description: '',
    type: 'Class',
    properties: []
  });

  // Form state for relation editing
  const [relationForm, setRelationForm] = useState<{
    id?: number;
    name: string;
    source: string;
    target: string;
    description: string;
  }>({
    name: '',
    source: '',
    target: '',
    description: ''
  });

  // Form state for version creation
  const [versionForm, setVersionForm] = useState<{
    version: string;
    description: string;
  }>({
    version: '',
    description: ''
  });

  // Queries for data fetching
  const { data: ontologiesData, isLoading: isLoadingOntologies } = useQuery({
    queryKey: ['/api/ontologies'],
    queryFn: async () => {
      try {
        // This API endpoint would need to be created
        const response = await fetch('/api/ontologies');
        const data = await response.json();
        return data.success ? data.data : [];
      } catch (error) {
        console.error('Failed to fetch ontologies:', error);
        return [];
      }
    }
  });

  const ontologies = ontologiesData || [];
  
  // State for bulk ontology management
  const [selectedOntologies, setSelectedOntologies] = useState<number[]>([]);
  const [isAllSelected, setIsAllSelected] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingOntology, setEditingOntology] = useState<{id: number, name: string} | null>(null);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);

  // Query for knowledge graphs
  const { data: graphsData, isLoading: isLoadingGraphs } = useQuery({
    queryKey: ['/api/graphs'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/graphs');
        const data = await response.json();
        return data.success ? data.data : [];
      } catch (error) {
        console.error('Failed to fetch graphs:', error);
        return [];
      }
    }
  });
  
  const graphs = graphsData || [];
  
  // Queries for API keys
  const { data: openaiKeyData } = useQuery<{data?: {key: string}}>({
    queryKey: ['/api/api-keys/openai/active'],
    retry: 1
  });

  const { data: mistralKeyData } = useQuery<{data?: {key: string}}>({
    queryKey: ['/api/api-keys/mistral/active'],
    retry: 1
  });

  // Extract API keys
  const openaiApiKey = openaiKeyData?.data?.key || '';
  const mistralApiKey = mistralKeyData?.data?.key || '';

  // Add property to current entity form
  const addPropertyToEntity = () => {
    setEntityForm({
      ...entityForm,
      properties: [
        ...entityForm.properties,
        { name: '', type: 'string', description: '' }
      ]
    });
  };

  // Remove property from current entity form
  const removePropertyFromEntity = (index: number) => {
    const updatedProperties = [...entityForm.properties];
    updatedProperties.splice(index, 1);
    setEntityForm({
      ...entityForm,
      properties: updatedProperties
    });
  };

  // Update property in current entity form
  const updatePropertyInEntity = (index: number, field: string, value: string) => {
    const updatedProperties = [...entityForm.properties];
    updatedProperties[index] = {
      ...updatedProperties[index],
      [field]: value
    };
    
    setEntityForm({
      ...entityForm,
      properties: updatedProperties
    });
  };

  // Reset form states
  const resetForms = () => {
    setEntityForm({
      name: '',
      description: '',
      type: 'Other', // Default to "Other" instead of "Class"
      properties: []
    });
    
    setRelationForm({
      name: '',
      source: '',
      target: '',
      description: ''
    });
    
    setVersionForm({
      version: '',
      description: ''
    });
    
    setEditMode(false);
  };

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Check file size limit (10MB for OntoMaker)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast({
          title: "File Too Large",
          description: `Please upload a file smaller than 10MB. Current file size: ${(file.size / 1024 / 1024).toFixed(1)}MB`,
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

  // Trigger file input click
  const handleFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Generate ontology from prompt
  const generateOntologyFromPrompt = async () => {
    if (!ontologyPrompt.trim()) {
      toast({
        title: "Error",
        description: "Please provide a domain description for the ontology.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    
    // Start progress animation
    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => {
        // Don't go to 100% until we actually finish
        const newProgress = prev + (Math.random() * 5);
        return Math.min(newProgress, 90);
      });
    }, 300);

    try {
      // This API endpoint would need to be created
      const response = await fetch('/api/ontologies/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: ontologyPrompt,
          model: selectedModel,
          apiKey: selectedModel === 'openai' ? openaiApiKey : mistralApiKey
        })
      });

      // Stop the interval before processing the response
      clearInterval(progressInterval);
      
      const data = await response.json();

      if (data.success) {
        // Set to 100% when complete
        setGenerationProgress(100);
        
        // Small delay to show the completed progress
        setTimeout(async () => {
          const generatedOntology = data.data;
          setCurrentOntology(generatedOntology);
          
          try {
            // Auto-save the generated ontology
            const saveResponse = await fetch('/api/ontologies', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(generatedOntology)
            });
            
            const saveData = await saveResponse.json();
            
            if (saveData.success) {
              setCurrentOntology(saveData.data);
              queryClient.invalidateQueries({ queryKey: ['/api/ontologies'] });
              toast({
                title: "Success",
                description: "Ontology generated and auto-saved successfully!",
              });
            } else {
              toast({
                title: "Generated But Not Saved",
                description: "Ontology was generated but could not be auto-saved.",
                variant: "destructive"
              });
            }
          } catch (error) {
            console.error('Error auto-saving ontology:', error);
            toast({
              title: "Generated But Not Saved",
              description: "Ontology was generated but could not be auto-saved."
            });
          }
          
          setIsGenerating(false);
        }, 500);
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to generate ontology.",
          variant: "destructive"
        });
        setIsGenerating(false);
      }
    } catch (error) {
      // Stop the interval in case of error
      clearInterval(progressInterval);
      console.error('Error generating ontology:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while generating the ontology.",
        variant: "destructive"
      });
      setIsGenerating(false);
    }
  };

  // Upload ontology file
  const loadOntology = async (ontologyId: number) => {
    try {
      // Show loading state
      toast({
        title: "Loading",
        description: "Loading ontology...",
      });
      
      const response = await fetch(`/api/ontologies/${ontologyId}`);
      const data = await response.json();

      if (data.success) {
        // Parse and set the ontology data
        const loadedOntology = data.data;
        
        // Ensure entities and relations are properly initialized
        if (!Array.isArray(loadedOntology.entities)) {
          loadedOntology.entities = [];
        }
        
        if (!Array.isArray(loadedOntology.relations)) {
          loadedOntology.relations = [];
        }
        
        if (!Array.isArray(loadedOntology.versions)) {
          loadedOntology.versions = [];
        }
        
        // Set current ontology
        setCurrentOntology(loadedOntology);
        
        // Switch to design tab
        setActiveTab('design');
        
        // Reset entity and relation forms
        setEntityForm({
          id: Date.now(),
          name: '',
          type: 'Other', // Default to "Other" instead of "Class"
          description: '',
          properties: []
        });
        
        setRelationForm({
          id: Date.now(),
          name: '',
          source: '',
          target: '',
          description: ''
        });
        
        toast({
          title: "Success",
          description: `Ontology "${loadedOntology.name}" loaded successfully!`,
        });
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to load ontology.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error loading ontology:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while loading the ontology.",
        variant: "destructive"
      });
    }
  };

  const uploadOntologyFile = async () => {
    if (!selectedFile) {
      toast({
        title: "Error",
        description: "Please select a file to upload.",
        variant: "destructive"
      });
      return;
    }

    // Check file size limit (10MB for ontology files)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (selectedFile.size > maxSize) {
      toast({
        title: "File Too Large",
        description: `Please upload a file smaller than 10MB. Current file size: ${(selectedFile.size / 1024 / 1024).toFixed(1)}MB`,
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('format', fileFormat);

      // This API endpoint would need to be created
      const response = await fetch('/api/ontologies/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        const uploadedOntology = data.data;
        setCurrentOntology(uploadedOntology);
        
        // Auto-save the uploaded ontology
        try {
          const saveResponse = await fetch('/api/ontologies', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(uploadedOntology)
          });
          
          const saveData = await saveResponse.json();
          
          if (saveData.success) {
            setCurrentOntology(saveData.data);
            queryClient.invalidateQueries({ queryKey: ['/api/ontologies'] });
            toast({
              title: "Success",
              description: "Ontology uploaded and auto-saved successfully!",
            });
          } else {
            toast({
              title: "Uploaded But Not Saved",
              description: "Ontology was uploaded but could not be auto-saved.",
              variant: "default"
            });
          }
        } catch (error) {
          console.error('Error auto-saving uploaded ontology:', error);
          toast({
            title: "Uploaded But Not Saved",
            description: "Ontology was uploaded but could not be auto-saved.",
            variant: "default"
          });
        }
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to upload ontology.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error uploading ontology:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while uploading the ontology.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  // Convert graph to ontology
  const handleGraphConversion = async () => {
    if (!selectedGraphId) {
      toast({
        title: "Error",
        description: "Please select a knowledge graph to convert.",
        variant: "destructive"
      });
      return;
    }

    setIsConvertingGraph(true);

    try {
      const response = await fetch('/api/ontologies/convert-from-graph', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          graphId: parseInt(selectedGraphId),
          name: graphImportName,
          domain: graphImportDomain
        })
      });

      const data = await response.json();

      if (data.success) {
        const convertedOntology = data.data;
        setCurrentOntology(convertedOntology);
        
        // Reset the form
        setSelectedGraphId('');
        setGraphImportName('');
        setGraphImportDomain('');
        
        // Switch to the visualization tab
        setActiveTab('visualize');
        
        // Auto-save is already handled in the backend for graph conversion,
        // but we'll refresh the ontologies list to ensure the UI is up-to-date
        queryClient.invalidateQueries({ queryKey: ['/api/ontologies'] });
        
        toast({
          title: "Success",
          description: "Graph successfully converted to ontology and saved!",
        });
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to convert graph to ontology.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error converting graph to ontology:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while converting the graph.",
        variant: "destructive"
      });
    } finally {
      setIsConvertingGraph(false);
    }
  };

  // Save current ontology
  const saveOntology = async () => {
    if (!currentOntology) {
      toast({
        title: "Error",
        description: "No ontology to save.",
        variant: "destructive"
      });
      return;
    }

    try {
      // This API endpoint would need to be created
      const response = await fetch('/api/ontologies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(currentOntology)
      });

      const data = await response.json();

      if (data.success) {
        setCurrentOntology(data.data);
        queryClient.invalidateQueries({ queryKey: ['/api/ontologies'] });
        toast({
          title: "Success",
          description: "Ontology saved successfully!",
        });
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to save ontology.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error saving ontology:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while saving the ontology.",
        variant: "destructive"
      });
    }
  };

  // Create a new entity
  const createEntity = () => {
    if (!currentOntology) return;
    
    if (!entityForm.name.trim()) {
      toast({
        title: "Error",
        description: "Entity name is required.",
        variant: "destructive"
      });
      return;
    }

    // Check if entity with the same name exists
    const nameExists = currentOntology.entities.some(
      entity => entity.name.toLowerCase() === entityForm.name.toLowerCase() && 
                (!editMode || entity.id !== entityForm.id)
    );

    if (nameExists) {
      toast({
        title: "Error",
        description: "An entity with this name already exists.",
        variant: "destructive"
      });
      return;
    }

    // Generate a new ID if creating a new entity
    const newId = !editMode
      ? Math.max(0, ...currentOntology.entities.map(e => e.id)) + 1
      : entityForm.id!;

    const newEntity: OntologyEntity = {
      id: newId,
      name: entityForm.name,
      description: entityForm.description,
      type: entityForm.type,
      properties: [...entityForm.properties] // Create a fresh copy of properties array
    };

    let updatedEntities: OntologyEntity[];
    
    if (editMode) {
      // Update existing entity
      updatedEntities = currentOntology.entities.map(entity => 
        entity.id === newId ? newEntity : entity
      );
      
      toast({
        title: "Success",
        description: `Entity "${newEntity.name}" has been updated.`
      });
    } else {
      // Add new entity
      updatedEntities = [...currentOntology.entities, newEntity];
      
      toast({
        title: "Success",
        description: `Entity "${newEntity.name}" has been created.`
      });
    }

    // Update the current ontology with the new/updated entity
    const updatedOntology = {
      ...currentOntology,
      entities: updatedEntities
    };
    
    setCurrentOntology(updatedOntology);
    setShowEntityDialog(false);
    resetForms();
  };

  // Create a new relation
  const createRelation = () => {
    if (!currentOntology) return;

    if (!relationForm.name.trim() || !relationForm.source || !relationForm.target) {
      toast({
        title: "Error",
        description: "Relation name, source, and target are required.",
        variant: "destructive"
      });
      return;
    }

    // Check if relation with the same name and source/target exists
    const relationExists = currentOntology.relations.some(
      relation => 
        relation.name.toLowerCase() === relationForm.name.toLowerCase() && 
        relation.source === relationForm.source && 
        relation.target === relationForm.target &&
        (!editMode || relation.id !== relationForm.id)
    );

    if (relationExists) {
      toast({
        title: "Error",
        description: "A relation with the same name, source, and target already exists.",
        variant: "destructive"
      });
      return;
    }

    // Generate a new ID if creating a new relation
    const newId = !editMode
      ? Math.max(0, ...currentOntology.relations.map(r => r.id)) + 1
      : relationForm.id!;

    const newRelation: OntologyRelation = {
      id: newId,
      name: relationForm.name,
      source: relationForm.source,
      target: relationForm.target,
      description: relationForm.description
    };

    let updatedRelations: OntologyRelation[];
    
    if (editMode) {
      // Update existing relation
      updatedRelations = currentOntology.relations.map(relation => 
        relation.id === newId ? newRelation : relation
      );
      
      toast({
        title: "Success",
        description: `Relation "${newRelation.name}" has been updated.`
      });
    } else {
      // Add new relation
      updatedRelations = [...currentOntology.relations, newRelation];
      
      toast({
        title: "Success",
        description: `Relation "${newRelation.name}" has been created.`
      });
    }

    // Update the current ontology with the new/updated relation
    const updatedOntology = {
      ...currentOntology,
      relations: updatedRelations
    };
    
    setCurrentOntology(updatedOntology);
    setShowRelationDialog(false);
    resetForms();
  };
  
  // Enrich ontology with AI to get suggestions (deprecated, now using getEnrichmentSuggestions)
  const enrichWithAI = async () => {
    // Forward to the current implementation
    await getEnrichmentSuggestions();
  };
  
  // Add suggested entity to ontology
  const addSuggestedEntity = (entity: OntologyEntity) => {
    if (!currentOntology) return;
    
    // Check if entity with the same name already exists
    const nameExists = currentOntology.entities.some(
      e => e.name.toLowerCase() === entity.name.toLowerCase()
    );
    
    if (nameExists) {
      toast({
        title: "Warning",
        description: `An entity named '${entity.name}' already exists.`,
        variant: "destructive"
      });
      return;
    }
    
    // Generate a new ID for the entity
    const newId = Math.max(0, ...currentOntology.entities.map(e => e.id)) + 1;
    
    // Create a new entity with the generated ID
    const newEntity: OntologyEntity = {
      ...entity,
      id: newId
    };
    
    // Add the entity to the ontology
    setCurrentOntology({
      ...currentOntology,
      entities: [...currentOntology.entities, newEntity]
    });
    
    // Remove the entity from suggestions
    setEnrichmentSuggestions(prev => ({
      ...prev,
      entities: prev.entities.filter(e => e.name !== entity.name)
    }));
    
    toast({
      title: "Success",
      description: `Added entity '${entity.name}'.`,
    });
  };
  
  // Add suggested relation to ontology
  const addSuggestedRelation = (relation: OntologyRelation) => {
    if (!currentOntology) return;
    
    // Check if source and target entities exist
    let sourceExists = currentOntology.entities.some(
      e => e.name.toLowerCase() === relation.source.toLowerCase()
    );
    
    let targetExists = currentOntology.entities.some(
      e => e.name.toLowerCase() === relation.target.toLowerCase()
    );
    
    // If source or target entity doesn't exist, try to find them in the suggestions
    // and add them automatically
    if (!sourceExists || !targetExists) {
      // Try to find source entity in suggestions
      if (!sourceExists) {
        const sourceEntity = enrichmentSuggestions.entities.find(
          e => e.name.toLowerCase() === relation.source.toLowerCase()
        );
        
        if (sourceEntity) {
          // Add source entity first
          addSuggestedEntity(sourceEntity);
          sourceExists = true;
        }
      }
      
      // Try to find target entity in suggestions
      if (!targetExists) {
        const targetEntity = enrichmentSuggestions.entities.find(
          e => e.name.toLowerCase() === relation.target.toLowerCase()
        );
        
        if (targetEntity) {
          // Add target entity 
          addSuggestedEntity(targetEntity);
          targetExists = true;
        }
      }
      
      // If still missing entities, show error
      if (!sourceExists || !targetExists) {
        toast({
          title: "Warning",
          description: `Source or target entity doesn't exist and wasn't found in suggestions.`,
          variant: "destructive"
        });
        return;
      }
    }
    
    // Check if relation with the same name already exists
    const nameExists = currentOntology.relations.some(
      r => r.name.toLowerCase() === relation.name.toLowerCase() &&
           r.source.toLowerCase() === relation.source.toLowerCase() &&
           r.target.toLowerCase() === relation.target.toLowerCase()
    );
    
    if (nameExists) {
      toast({
        title: "Warning",
        description: `A relation with the same name between these entities already exists.`,
        variant: "destructive"
      });
      return;
    }
    
    // Generate a new ID for the relation
    const newId = Math.max(0, ...currentOntology.relations.map(r => r.id)) + 1;
    
    // Create a new relation with the generated ID
    const newRelation: OntologyRelation = {
      ...relation,
      id: newId
    };
    
    // Add the relation to the ontology
    setCurrentOntology({
      ...currentOntology,
      relations: [...currentOntology.relations, newRelation]
    });
    
    // Remove the relation from suggestions
    setEnrichmentSuggestions(prev => ({
      ...prev,
      relations: prev.relations.filter(r => 
        !(r.name === relation.name && 
          r.source === relation.source && 
          r.target === relation.target)
      )
    }));
    
    toast({
      title: "Success",
      description: `Added relation '${relation.name}'.`,
    });
  };
  
  // Add suggested property to entity
  const addSuggestedProperty = (prop: {entityName: string, property: {name: string, type: string, description: string}}) => {
    if (!currentOntology) return;
    
    // Find the entity
    const entityIndex = currentOntology.entities.findIndex(
      e => e.name.toLowerCase() === prop.entityName.toLowerCase()
    );
    
    if (entityIndex === -1) {
      // Try to find the entity in suggestions
      const entitySuggestion = enrichmentSuggestions.entities.find(
        e => e.name.toLowerCase() === prop.entityName.toLowerCase()
      );
      
      if (entitySuggestion) {
        // Add the entity first
        addSuggestedEntity(entitySuggestion);
        
        // Try again after adding the entity
        const newEntityIndex = currentOntology.entities.findIndex(
          e => e.name.toLowerCase() === prop.entityName.toLowerCase()
        );
        
        if (newEntityIndex !== -1) {
          // Now we can add the property to the newly added entity
          const updatedEntities = [...currentOntology.entities];
          updatedEntities[newEntityIndex] = {
            ...updatedEntities[newEntityIndex],
            properties: [...updatedEntities[newEntityIndex].properties, prop.property]
          };
          
          // Update the ontology
          setCurrentOntology({
            ...currentOntology,
            entities: updatedEntities
          });
          
          // Remove the property from suggestions
          setEnrichmentSuggestions(prev => ({
            ...prev,
            properties: prev.properties.filter(p => 
              !(p.entityName === prop.entityName && p.property.name === prop.property.name)
            )
          }));
          
          toast({
            title: "Success",
            description: `Added property '${prop.property.name}' to newly created entity '${prop.entityName}'.`,
          });
          return;
        }
      }
      
      toast({
        title: "Warning",
        description: `Entity '${prop.entityName}' not found.`,
        variant: "destructive"
      });
      return;
    }
    
    // Check if property with same name already exists
    const propertyExists = currentOntology.entities[entityIndex].properties.some(
      p => p.name.toLowerCase() === prop.property.name.toLowerCase()
    );
    
    if (propertyExists) {
      toast({
        title: "Warning",
        description: `Property '${prop.property.name}' already exists for entity '${prop.entityName}'.`,
        variant: "destructive"
      });
      return;
    }
    
    // Add the property to the entity
    const updatedEntities = [...currentOntology.entities];
    updatedEntities[entityIndex] = {
      ...updatedEntities[entityIndex],
      properties: [...updatedEntities[entityIndex].properties, prop.property]
    };
    
    // Update the ontology
    setCurrentOntology({
      ...currentOntology,
      entities: updatedEntities
    });
    
    // Remove the property from suggestions
    setEnrichmentSuggestions(prev => ({
      ...prev,
      properties: prev.properties.filter(p => 
        !(p.entityName === prop.entityName && p.property.name === prop.property.name)
      )
    }));
    
    toast({
      title: "Success",
      description: `Added property '${prop.property.name}' to '${prop.entityName}'.`,
    });
  };
  
  // Add all suggestions
  const addAllSuggestions = async () => {
    if (!currentOntology) return;
    
    // Create a duplicate first with a new name
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const newOntologyName = `${currentOntology.name} (Enhanced ${timestamp})`;
    
    // Create a deep copy of the current ontology
    let newOntology = {
      ...currentOntology,
      id: 0, // Will be assigned by the server
      name: newOntologyName
    };
    
    // Add all entities first
    enrichmentSuggestions.entities.forEach(entity => {
      const newEntity = { ...entity };
      // Generate a new ID for the entity
      const newEntityId = Math.max(0, ...newOntology.entities.map(e => e.id)) + 1;
      newEntity.id = newEntityId;
      
      // Add to the new ontology
      newOntology.entities = [...newOntology.entities, newEntity];
    });
    
    // Add all properties
    enrichmentSuggestions.properties.forEach(prop => {
      // Find the entity to add the property to
      const entity = newOntology.entities.find(e => e.name === prop.entityName);
      if (entity) {
        entity.properties = [
          ...entity.properties,
          { ...prop.property }
        ];
      }
    });
    
    // Add all relations last (as they depend on entities)
    enrichmentSuggestions.relations.forEach(relation => {
      const newRelation = { ...relation };
      // Generate a new ID for the relation
      const newRelationId = Math.max(0, ...newOntology.relations.map(r => r.id)) + 1;
      newRelation.id = newRelationId;
      
      // Add to the new ontology
      newOntology.relations = [...newOntology.relations, newRelation];
    });
    
    // Create a version history entry for the new ontology
    const entitiesCount = enrichmentSuggestions.entities.length;
    const propertiesCount = enrichmentSuggestions.properties.length;
    const relationsCount = enrichmentSuggestions.relations.length;
    
    const newVersion: OntologyVersion = {
      id: 1, // First version of the new ontology
      version: `v1.0`,
      timestamp: new Date().toISOString(),
      description: `Created as enhanced copy with ${entitiesCount} entities, ${propertiesCount} properties, and ${relationsCount} relations from AI suggestions`,
      changes: []
    };
    
    // Add detailed changes for entities
    if (entitiesCount > 0) {
      if (entitiesCount > 10) {
        // If there are many entities, add a batch change
        newVersion.changes.push({ 
          type: 'add', 
          element: 'entity', 
          itemType: 'batch', 
          count: entitiesCount, 
          source: 'ai-suggestion',
          description: `Added ${entitiesCount} entities from AI suggestions` 
        });
      } else {
        // For a manageable number, add detailed individual changes
        enrichmentSuggestions.entities.forEach(entity => {
          newVersion.changes.push({
            type: 'add',
            element: 'entity',
            name: entity.name,
            description: entity.description || `Entity of type ${entity.type}`,
            source: 'ai-suggestion'
          });
        });
      }
    }
    
    // Add detailed changes for properties
    if (propertiesCount > 0) {
      if (propertiesCount > 10) {
        // If there are many properties, add a batch change
        newVersion.changes.push({ 
          type: 'add', 
          element: 'property', 
          itemType: 'batch', 
          count: propertiesCount, 
          source: 'ai-suggestion',
          description: `Added ${propertiesCount} properties from AI suggestions` 
        });
      } else {
        // For a manageable number, add detailed individual changes
        enrichmentSuggestions.properties.forEach(prop => {
          newVersion.changes.push({
            type: 'add',
            element: 'property',
            name: prop.property.name,
            description: `Added property to ${prop.entityName}`,
            source: 'ai-suggestion'
          });
        });
      }
    }
    
    // Add detailed changes for relations
    if (relationsCount > 0) {
      if (relationsCount > 10) {
        // If there are many relations, add a batch change
        newVersion.changes.push({ 
          type: 'add', 
          element: 'relation', 
          itemType: 'batch', 
          count: relationsCount, 
          source: 'ai-suggestion',
          description: `Added ${relationsCount} relations from AI suggestions` 
        });
      } else {
        // For a manageable number, add detailed individual changes
        enrichmentSuggestions.relations.forEach(relation => {
          newVersion.changes.push({
            type: 'add',
            element: 'relation',
            name: relation.name,
            description: `Added relation from ${relation.source} to ${relation.target}`,
            source: 'ai-suggestion'
          });
        });
      }
    }
    
    newOntology.versions = [newVersion];
    
    // Create the new ontology on the backend
    try {
      const response = await fetch('/api/ontologies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newOntologyName,
          description: `Enhanced version of ${currentOntology.name} with AI suggestions`,
          domain: currentOntology.domain,
          entities: newOntology.entities,
          relations: newOntology.relations,
          versions: newOntology.versions
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // Update the current ontology to the new one
          setCurrentOntology(data.data);
          
          // Refresh ontologies list
          queryClient.invalidateQueries({ queryKey: ['/api/ontologies'] });
          
          // Clear all suggestions since we've applied everything
          setEnrichmentSuggestions({entities: [], relations: [], properties: []});
          
          toast({
            title: "Success",
            description: `All suggestions have been added to a new ontology: "${newOntologyName}"`,
          });
        } else {
          throw new Error(data.message || 'Failed to create new ontology');
        }
      } else {
        throw new Error(await response.text());
      }
    } catch (error) {
      console.error('Error creating new ontology:', error);
      toast({
        title: "Error",
        description: "Failed to create enhanced ontology. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  // Process selected suggestions
  const addSelectedSuggestions = async () => {
    if (!currentOntology) return;
    
    // Create a duplicate first with a new name
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const newOntologyName = `${currentOntology.name} (Enhanced ${timestamp})`;
    
    // Create a deep copy of the current ontology
    let newOntology = {
      ...currentOntology,
      id: 0, // Will be assigned by the server
      name: newOntologyName
    };
    
    // Add selected entities
    const selectedEntities = selectedSuggestions.entities.map(idx => enrichmentSuggestions.entities[idx]).filter(Boolean);
    selectedEntities.forEach(entity => {
      const newEntity = { ...entity };
      // Generate a new ID for the entity
      const newEntityId = Math.max(0, ...newOntology.entities.map(e => e.id)) + 1;
      newEntity.id = newEntityId;
      
      // Add to the new ontology
      newOntology.entities = [...newOntology.entities, newEntity];
    });
    
    // Add selected properties
    const selectedProperties = selectedSuggestions.properties.map(idx => enrichmentSuggestions.properties[idx]).filter(Boolean);
    selectedProperties.forEach(prop => {
      // Find the entity to add the property to
      const entity = newOntology.entities.find(e => e.name === prop.entityName);
      if (entity) {
        entity.properties = [
          ...entity.properties,
          { ...prop.property }
        ];
      }
    });
    
    // Add selected relations
    const selectedRelations = selectedSuggestions.relations.map(idx => enrichmentSuggestions.relations[idx]).filter(Boolean);
    selectedRelations.forEach(relation => {
      const newRelation = { ...relation };
      // Generate a new ID for the relation
      const newRelationId = Math.max(0, ...newOntology.relations.map(r => r.id)) + 1;
      newRelation.id = newRelationId;
      
      // Add to the new ontology
      newOntology.relations = [...newOntology.relations, newRelation];
    });
    
    // Create a version history entry
    const entitiesCount = selectedEntities.length;
    const propertiesCount = selectedProperties.length;
    const relationsCount = selectedRelations.length;
    
    // Determine the source of suggestions based on the enrichment type
    const suggestionSource = enrichmentType === 'schema' ? 'schema-org' : 'ai-suggestion';
    const sourceName = enrichmentType === 'schema' 
      ? `Schema.org (${schemaIntegrationType} mode)` 
      : `AI (${selectedModel})`;
    
    const newVersion: OntologyVersion = {
      id: 1, // First version of the new ontology
      version: `v1.0`,
      timestamp: new Date().toISOString(),
      description: `Created with selected ${entitiesCount} entities, ${propertiesCount} properties, and ${relationsCount} relations from ${sourceName}`,
      changes: []
    };
    
    // Add detailed changes for each entity
    if (entitiesCount > 0) {
      if (entitiesCount > 5) {
        // If there are many entities, add a batch change
        newVersion.changes.push({ 
          type: 'add', 
          element: 'entity', 
          itemType: 'batch', 
          count: entitiesCount, 
          source: suggestionSource,
          description: `Added ${entitiesCount} entities from ${sourceName}` 
        });
      } else {
        // If there are few entities, add individual changes
        selectedEntities.forEach(entity => {
          newVersion.changes.push({
            type: 'add',
            element: 'entity',
            name: entity.name,
            description: entity.description || `Entity of type ${entity.type}`,
            source: suggestionSource
          });
        });
      }
    }

    // Add detailed changes for each property
    if (propertiesCount > 0) {
      if (propertiesCount > 5) {
        // If there are many properties, add a batch change
        newVersion.changes.push({ 
          type: 'add', 
          element: 'property', 
          itemType: 'batch', 
          count: propertiesCount, 
          source: suggestionSource,
          description: `Added ${propertiesCount} properties from ${sourceName}` 
        });
      } else {
        // If there are few properties, add individual changes
        selectedProperties.forEach(prop => {
          newVersion.changes.push({
            type: 'add',
            element: 'property',
            name: prop.property.name,
            description: `Added property to ${prop.entityName}`,
            source: suggestionSource
          });
        });
      }
    }

    // Add detailed changes for each relation
    if (relationsCount > 0) {
      if (relationsCount > 5) {
        // If there are many relations, add a batch change
        newVersion.changes.push({ 
          type: 'add', 
          element: 'relation', 
          itemType: 'batch', 
          count: relationsCount, 
          source: suggestionSource,
          description: `Added ${relationsCount} relations from ${sourceName}` 
        });
      } else {
        // If there are few relations, add individual changes
        selectedRelations.forEach(relation => {
          newVersion.changes.push({
            type: 'add',
            element: 'relation',
            name: relation.name,
            description: `Added relation from ${relation.source} to ${relation.target}`,
            source: suggestionSource
          });
        });
      }
    }
    
    newOntology.versions = [newVersion];
    
    // Create the new ontology on the backend
    try {
      const response = await fetch('/api/ontologies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newOntologyName,
          description: `Enhanced version of ${currentOntology.name} with selected suggestions from ${sourceName}`,
          domain: currentOntology.domain,
          entities: newOntology.entities,
          relations: newOntology.relations,
          versions: newOntology.versions
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // Update the current ontology to the new one
          setCurrentOntology(data.data);
          
          // Refresh ontologies list
          queryClient.invalidateQueries({ queryKey: ['/api/ontologies'] });
          
          // Reset selections after adding
          setSelectedSuggestions({entities: [], relations: [], properties: []});
          
          toast({
            title: "Success",
            description: `Selected suggestions have been added to a new ontology: "${newOntologyName}"`,
          });
        } else {
          throw new Error(data.message || 'Failed to create new ontology');
        }
      } else {
        throw new Error(await response.text());
      }
    } catch (error) {
      console.error('Error creating new ontology:', error);
      toast({
        title: "Error",
        description: "Failed to create enhanced ontology. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  // Clear suggestions
  const clearSuggestions = () => {
    setEnrichmentSuggestions({
      entities: [],
      relations: [],
      properties: []
    });
    setSelectedSuggestions({entities: [], relations: [], properties: []});
  };

  // Create a new version
  const createVersion = () => {
    if (!currentOntology) return;

    if (!versionForm.version.trim()) {
      toast({
        title: "Error",
        description: "Version number is required.",
        variant: "destructive"
      });
      return;
    }

    // Check if version with the same number exists
    const versionExists = currentOntology.versions.some(
      v => v.version === versionForm.version
    );

    if (versionExists) {
      toast({
        title: "Error",
        description: "A version with this number already exists.",
        variant: "destructive"
      });
      return;
    }

    // Generate a new ID
    const newId = Math.max(0, ...currentOntology.versions.map(v => v.id)) + 1;

    const newVersion: OntologyVersion = {
      id: newId,
      version: versionForm.version,
      timestamp: new Date().toISOString(),
      description: versionForm.description,
      changes: []
    };

    setCurrentOntology({
      ...currentOntology,
      versions: [...currentOntology.versions, newVersion]
    });

    setShowVersionDialog(false);
    resetForms();
  };

  // Edit an entity
  const editEntity = (entity: OntologyEntity) => {
    setEntityForm({
      id: entity.id,
      name: entity.name,
      description: entity.description,
      type: entity.type,
      properties: [...entity.properties]
    });
    setEditMode(true);
    setShowEntityDialog(true);
  };

  // Export graph visualization as image
  const exportAsImage = () => {
    if (graphRef.current) {
      graphRef.current.exportAsImage();
      toast({
        title: "Success",
        description: "Visualization exported as PNG image.",
      });
    } else {
      toast({
        title: "Error",
        description: "Could not export visualization. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  // Export graph in JSON format
  const exportAsJSON = () => {
    if (graphRef.current) {
      graphRef.current.exportAsJSON();
      toast({
        title: "Success",
        description: "Visualization exported as JSON.",
      });
    } else {
      toast({
        title: "Error",
        description: "Could not export visualization. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  // Highlight a specific node in the graph
  const highlightNode = (nodeId: number) => {
    if (graphRef.current) {
      graphRef.current.highlightNode(nodeId);
    }
  };
  
  // Delete an entity
  const deleteEntity = (entityId: number) => {
    if (!currentOntology) return;

    // Check if this entity is used in any relations
    const isUsedInRelations = currentOntology.relations.some(
      relation => {
        const entityName = currentOntology.entities.find(e => e.id === entityId)?.name;
        return relation.source === entityName || relation.target === entityName;
      }
    );

    if (isUsedInRelations) {
      toast({
        title: "Cannot Delete",
        description: "This entity is used in one or more relations. Please delete those relations first.",
        variant: "destructive"
      });
      return;
    }

    // Remove the entity
    const updatedEntities = currentOntology.entities.filter(
      entity => entity.id !== entityId
    );

    setCurrentOntology({
      ...currentOntology,
      entities: updatedEntities
    });

    toast({
      title: "Success",
      description: "Entity deleted successfully."
    });
  };

  // Edit a relation
  const editRelation = (relation: OntologyRelation) => {
    setRelationForm({
      id: relation.id,
      name: relation.name,
      source: relation.source,
      target: relation.target,
      description: relation.description
    });
    setEditMode(true);
    setShowRelationDialog(true);
  };

  // Delete a relation
  const deleteRelation = (relationId: number) => {
    if (!currentOntology) return;

    // Remove the relation
    const updatedRelations = currentOntology.relations.filter(
      relation => relation.id !== relationId
    );

    setCurrentOntology({
      ...currentOntology,
      relations: updatedRelations
    });

    toast({
      title: "Success",
      description: "Relation deleted successfully."
    });
  };

  // View a version
  const viewVersion = (version: OntologyVersion) => {
    setCurrentVersion(version);
    setShowVersionDialog(true);
  };

  // Delete an ontology
  const handleDeleteOntology = async (ontologyId: number) => {
    if (window.confirm("Are you sure you want to delete this ontology? This action cannot be undone.")) {
      try {
        const response = await fetch(`/api/ontologies/${ontologyId}`, {
          method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
          toast({
            title: "Success",
            description: "Ontology deleted successfully."
          });
          
          // Refresh ontologies list
          queryClient.invalidateQueries({ queryKey: ['/api/ontologies'] });
          
          // If the current ontology was deleted, reset it
          if (currentOntology && currentOntology.id === ontologyId) {
            setCurrentOntology(null);
          }
          
          // Remove from selected ontologies if it was selected
          if (selectedOntologies.includes(ontologyId)) {
            setSelectedOntologies(prev => prev.filter(id => id !== ontologyId));
          }
        } else {
          toast({
            title: "Error",
            description: data.message || "Failed to delete ontology.",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error("Error deleting ontology:", error);
        toast({
          title: "Error",
          description: "An unexpected error occurred while deleting the ontology.",
          variant: "destructive"
        });
      }
    }
  };

  // Toggle selection of a single ontology
  const toggleOntologySelection = (ontologyId: number) => {
    setSelectedOntologies(prev => {
      if (prev.includes(ontologyId)) {
        // If already selected, remove it
        const newSelection = prev.filter(id => id !== ontologyId);
        setIsAllSelected(false);
        return newSelection;
      } else {
        // If not selected, add it
        const newSelection = [...prev, ontologyId];
        // Check if all are now selected
        setIsAllSelected(newSelection.length === ontologies.length);
        return newSelection;
      }
    });
  };
  
  // Toggle selection of all ontologies
  const toggleSelectAll = () => {
    if (isAllSelected || selectedOntologies.length === ontologies.length) {
      // If all are selected, deselect all
      setSelectedOntologies([]);
      setIsAllSelected(false);
    } else {
      // Otherwise, select all
      setSelectedOntologies(ontologies.map((ontology: Ontology) => ontology.id));
      setIsAllSelected(true);
    }
  };
  
  // Bulk delete selected ontologies
  const bulkDeleteOntologies = async () => {
    if (selectedOntologies.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one ontology to delete.",
        variant: "default"
      });
      return;
    }
    
    try {
      // Confirm deletion
      if (!window.confirm(`Are you sure you want to delete ${selectedOntologies.length} selected ontologies? This action cannot be undone.`)) {
        return;
      }
      
      // Delete each selected ontology
      const deletePromises = selectedOntologies.map(id => 
        fetch(`/api/ontologies/${id}`, { method: 'DELETE' })
          .then(res => res.json())
      );
      
      const results = await Promise.all(deletePromises);
      const successCount = results.filter(result => result.success).length;
      
      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/ontologies'] });
      
      // Clear selections
      setSelectedOntologies([]);
      setIsAllSelected(false);
      
      // If the current ontology was deleted, clear it
      if (currentOntology && selectedOntologies.includes(currentOntology.id)) {
        setCurrentOntology(null);
      }
      
      toast({
        title: "Bulk Delete Complete",
        description: `Successfully deleted ${successCount} out of ${selectedOntologies.length} ontologies.`,
        variant: successCount === selectedOntologies.length ? "default" : "destructive"
      });
    } catch (error) {
      console.error('Error in bulk delete operation:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred during bulk delete operation.",
        variant: "destructive"
      });
    }
  };
  
  // Open rename dialog for an ontology
  const openRenameDialog = (ontology: Ontology) => {
    setEditingOntology({
      id: ontology.id,
      name: ontology.name
    });
    setIsRenameDialogOpen(true);
  };
  
  // Handle renaming an ontology
  const handleRenameOntology = async () => {
    if (!editingOntology) return;
    
    if (!editingOntology.name.trim()) {
      toast({
        title: "Invalid Name",
        description: "Ontology name cannot be empty.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Find the ontology to update
      const ontologyToUpdate = ontologies.find((o: Ontology) => o.id === editingOntology.id);
      if (!ontologyToUpdate) {
        toast({
          title: "Error",
          description: "Ontology not found.",
          variant: "destructive"
        });
        return;
      }
      
      // Create updated ontology object
      const updatedOntology = {
        ...ontologyToUpdate,
        name: editingOntology.name
      };
      
      // Send update request
      const response = await fetch(`/api/ontologies/${editingOntology.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedOntology)
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Close the dialog
        setIsRenameDialogOpen(false);
        setEditingOntology(null);
        
        // Update current ontology if it's the one being renamed
        if (currentOntology && currentOntology.id === editingOntology.id) {
          setCurrentOntology({
            ...currentOntology,
            name: editingOntology.name
          });
        }
        
        // Refresh the data
        queryClient.invalidateQueries({ queryKey: ['/api/ontologies'] });
        
        toast({
          title: "Success",
          description: "Ontology renamed successfully."
        });
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to rename ontology.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error renaming ontology:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while renaming the ontology.",
        variant: "destructive"
      });
    }
  };
  
  // Duplicate an ontology
  const handleDuplicateOntology = async (ontologyId: number) => {
    try {
      const response = await fetch(`/api/ontologies/${ontologyId}/duplicate`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Success",
          description: "Ontology duplicated successfully."
        });
        
        // Refresh ontologies list
        queryClient.invalidateQueries({ queryKey: ['/api/ontologies'] });
        
        // Load the duplicated ontology
        setCurrentOntology(data.data);
        setActiveTab('design');
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to duplicate ontology.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error duplicating ontology:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while duplicating the ontology.",
        variant: "destructive"
      });
    }
  };
  
  // Get dismiss function from useToast at the component level
  const { dismiss: dismissToast } = useToast();

  // Export a specific ontology
  const handleExportOntology = (ontologyId: number) => {
    // Save ontology ID for reference
    setSelectedOntologyId(ontologyId);
    
    // Generate a unique ID for this toast to prevent duplicates
    const menuToastId = `export-menu-${Date.now()}`;
    
    // Define a helper function to handle format selection
    const handleExportFormat = (format: string) => {
      // Use the component-level dismiss function
      dismissToast(menuToastId);
      
      // Create a short-lived toast to indicate processing - without custom ID
      toast({
        title: "Processing",
        description: `Preparing ${format.toUpperCase()} export...`,
        duration: 1000, // Shorter duration to avoid duplicates
      });
      
      // Start the export process immediately - the exportOntology function handles timing
      exportOntology(format, ontologyId);
    };
    
    // Show context menu with export options - without custom ID to avoid TS errors
    toast({
      title: "Export Options",
      description: (
        <div className="flex flex-col gap-2 mt-2">
          <Button 
            variant="ghost" 
            className="justify-start hover:bg-gray-700" 
            onClick={() => handleExportFormat('rdf')}
          >
            <Code className="mr-2 h-4 w-4" /> Export as RDF/XML
          </Button>
          <Button 
            variant="ghost" 
            className="justify-start hover:bg-gray-700" 
            onClick={() => handleExportFormat('ttl')}
          >
            <FileText className="mr-2 h-4 w-4" /> Export as Turtle (TTL)
          </Button>
          <Button 
            variant="ghost" 
            className="justify-start hover:bg-gray-700" 
            onClick={() => handleExportFormat('json')}
          >
            <BracesIcon className="mr-2 h-4 w-4" /> Export as JSON-LD
          </Button>
        </div>
      ),
      duration: 10000
    });
  };

  // Export ontology to a specific format
  const exportOntology = async (format: string, ontologyId?: number) => {
    // If specific ontologyId is provided, use it; otherwise use the currentOntology
    const targetOntologyId = ontologyId || (currentOntology ? currentOntology.id : null);
    
    if (!targetOntologyId) {
      toast({
        title: "Error",
        description: "No ontology to export.",
        variant: "destructive"
      });
      return;
    }
    
    // Progress toast is already shown by the caller for menu-triggered exports
    const toastId = Date.now().toString();
    
    try {
      // First get the ontology data if we don't have it already
      let ontologyName = currentOntology?.name || `ontology-${targetOntologyId}`;
      
      // If we're exporting a different ontology than the current one, fetch its details
      if (ontologyId && (!currentOntology || currentOntology.id !== ontologyId)) {
        const detailsResponse = await fetch(`/api/ontologies/${ontologyId}`);
        if (detailsResponse.ok) {
          const details = await detailsResponse.json();
          if (details.success && details.data) {
            ontologyName = details.data.name || ontologyName;
          }
        }
      }
      
      // Normalize format
      const normalizedFormat = format.toLowerCase();
      
      // Determine proper file extension and mime type
      let fileExtension = normalizedFormat;
      let fileType = '';
      if (normalizedFormat === 'rdf' || normalizedFormat === 'rdfxml') {
        fileExtension = 'rdf';
        fileType = 'application/rdf+xml';
      } else if (normalizedFormat === 'ttl' || normalizedFormat === 'turtle') {
        fileExtension = 'ttl';
        fileType = 'text/turtle';
      } else if (normalizedFormat === 'json' || normalizedFormat === 'jsonld') {
        fileExtension = 'jsonld';
        fileType = 'application/ld+json';
      }

      // Use the dedicated export endpoint
      const response = await fetch(`/api/ontologies/${targetOntologyId}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': fileType || '*/*'
        },
        body: JSON.stringify({ format: normalizedFormat })
      });

      if (!response.ok) {
        throw new Error(`Failed to export ontology: ${response.statusText}`);
      }

      // Get the blob with the correct type from the response
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Create download link
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${ontologyName.replace(/\s+/g, '_')}.${fileExtension}`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Show success toast
      toast({
        title: "Export Complete",
        description: `Ontology "${ontologyName}" exported as ${format.toUpperCase()} successfully!`
      });
    } catch (error) {
      console.error('Error exporting ontology:', error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred while exporting the ontology.",
        variant: "destructive"
      });
    }
  };

  // Generate enrichment suggestions for the current ontology
  const getEnrichmentSuggestions = async () => {
    if (!currentOntology) {
      toast({
        title: "Error",
        description: "No ontology to enrich.",
        variant: "destructive"
      });
      return;
    }

    // Use AI-specific state variables
    setIsAIEnriching(true);
    setAIEnrichmentProgress(0);
    setAIEnrichmentStage('Initializing...');
    setEnrichmentSuggestions({entities: [], relations: [], properties: []});
    
    // Set up a progress animation
    const progressInterval = setInterval(() => {
      setAIEnrichmentProgress(prev => {
        if (prev >= 90) return prev; // Don't exceed 90% until we're done
        
        // Calculate next progress value based on current progress
        if (prev < 20) {
          setAIEnrichmentStage('Analyzing ontology structure...');
          return prev + (Math.random() * 1.5);
        } else if (prev < 40) {
          setAIEnrichmentStage('Identifying enrichment opportunities...');
          return prev + (Math.random() * 1.0);
        } else if (prev < 60) {
          setAIEnrichmentStage('Generating entity suggestions...');
          return prev + (Math.random() * 0.8);
        } else if (prev < 80) {
          setAIEnrichmentStage('Creating relationship suggestions...');
          return prev + (Math.random() * 0.7);
        } else {
          setAIEnrichmentStage('Finalizing enrichment suggestions...');
          return prev + (Math.random() * 0.5);
        }
      });
    }, 300);

    try {
      const response = await fetch('/api/ontologies/enrich-suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          ontologyId: currentOntology.id,
          model: selectedModel,
          focus: enrichmentFocus,
          instructions: enrichmentInstructions,
          apiKey: selectedModel === 'openai' ? openaiApiKey : mistralApiKey
        })
      });
      
      // Stop the progress animation
      clearInterval(progressInterval);
      
      const data = await response.json();

      if (data.success) {
        // Indicate success with 100% progress
        setAIEnrichmentProgress(100);
        setAIEnrichmentStage('Completed successfully!');
        
        // Add a small delay before loading the results to show the completed progress
        setTimeout(() => {
          setEnrichmentSuggestions(data.data);
          toast({
            title: "Success",
            description: "Enrichment suggestions generated successfully!",
          });
          // Ensure AI enriching state is set to false AFTER showing the suggestions
          setIsAIEnriching(false);
        }, 500);
      } else {
        setAIEnrichmentProgress(0);
        setAIEnrichmentStage('');
        setIsAIEnriching(false);
        toast({
          title: "Error",
          description: data.message || "Failed to generate enrichment suggestions.",
          variant: "destructive"
        });
      }
    } catch (error) {
      // Stop the progress animation
      clearInterval(progressInterval);
      setAIEnrichmentProgress(0);
      setAIEnrichmentStage('');
      setIsAIEnriching(false);
      
      console.error('Error generating enrichment suggestions:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while generating enrichment suggestions.",
        variant: "destructive"
      });
    }
  };
  
  // Get Schema.org suggestions
  const getSchemaOrgSuggestions = async () => {
    if (!currentOntology) {
      toast({
        title: "Error",
        description: "No ontology to enrich.",
        variant: "destructive"
      });
      return;
    }
    
    // Set enrichment type to schema
    setEnrichmentType('schema');

    // Use Schema-specific state variables
    setIsSchemaEnriching(true);
    setSchemaEnrichmentProgress(0);
    setSchemaEnrichmentStage('Initializing...');
    setEnrichmentSuggestions({entities: [], relations: [], properties: []});
    
    // Set up a progress animation for visual feedback
    const progressInterval = setInterval(() => {
      setSchemaEnrichmentProgress(prev => {
        if (prev >= 90) return prev; // Don't exceed 90% until we're done
        
        // Calculate next progress value based on current progress
        if (prev < 20) {
          setSchemaEnrichmentStage('Analyzing ontology structure...');
          return prev + (Math.random() * 1.5);
        } else if (prev < 40) {
          setSchemaEnrichmentStage('Identifying Schema.org mappings...');
          return prev + (Math.random() * 1.0);
        } else if (prev < 60) {
          setSchemaEnrichmentStage('Generating entity suggestions...');
          return prev + (Math.random() * 0.8);
        } else if (prev < 80) {
          setSchemaEnrichmentStage('Creating relationship mappings...');
          return prev + (Math.random() * 0.7);
        } else {
          setSchemaEnrichmentStage('Finalizing Schema.org suggestions...');
          return prev + (Math.random() * 0.5);
        }
      });
    }, 300);

    try {
      // Get Schema.org suggestions through the API
      const response = await fetch('/api/ontologies/schema-suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ontologyId: currentOntology.id,
          integrationType: schemaIntegrationType,
          mappingType: schemaMappingType
        })
      });
      
      // Stop the progress animation
      clearInterval(progressInterval);
      
      const data = await response.json();

      if (data.success) {
        // Indicate success with 100% progress
        setSchemaEnrichmentProgress(100);
        setSchemaEnrichmentStage('Schema.org mapping complete!');
        
        // Structure the data for the enrichment suggestions format
        setTimeout(() => {
          // Transform Schema.org suggestions into the same format as AI suggestions
          const suggestions = {
            entities: data.data.entities || [],
            relations: data.data.relations || [],
            properties: data.data.properties || []
          };

          setEnrichmentSuggestions(suggestions);
          
          // Initialize all suggestions as selected
          setSelectedSuggestions({
            entities: suggestions.entities.map((_: any, idx: number) => idx),
            relations: suggestions.relations.map((_: any, idx: number) => idx),
            properties: suggestions.properties.map((_: any, idx: number) => idx)
          });
          
          toast({
            title: "Success",
            description: "Schema.org suggestions generated successfully!",
          });
          
          // Ensure isSchemaEnriching is set to false AFTER showing the suggestions
          setIsSchemaEnriching(false);
        }, 500);
      } else {
        setSchemaEnrichmentProgress(0);
        setSchemaEnrichmentStage('');
        setIsSchemaEnriching(false);
        toast({
          title: "Error",
          description: data.message || "Failed to get Schema.org suggestions.",
          variant: "destructive"
        });
      }
    } catch (error) {
      clearInterval(progressInterval);
      setSchemaEnrichmentProgress(0);
      setSchemaEnrichmentStage('');
      setIsSchemaEnriching(false);
      console.error('Error getting Schema.org suggestions:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while getting Schema.org suggestions.",
        variant: "destructive"
      });
    }
  };

  // Enrich the current ontology
  const enrichOntology = async () => {
    if (!currentOntology) {
      toast({
        title: "Error",
        description: "No ontology to enrich.",
        variant: "destructive"
      });
      return;
    }

    try {
      // For Schema.org integration, get suggestions directly
      if (enrichmentType === 'schema') {
        // Get Schema.org suggestions
        await getSchemaOrgSuggestions();
        return;
      } 
      // Handle AI enrichment
      else {
        const response = await fetch(`/api/ontologies/${currentOntology.id}/enrich`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            model: selectedModel,
            apiKey: selectedModel === 'openai' ? openaiApiKey : mistralApiKey,
            enrichmentType
          })
        });

        const data = await response.json();

        if (data.success) {
          setCurrentOntology(data.data);
          toast({
            title: "Success",
            description: "Ontology enriched successfully with AI!",
          });
        } else {
          toast({
            title: "Error",
            description: data.message || "Failed to enrich ontology with AI.",
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error('Error enriching ontology:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while enriching the ontology.",
        variant: "destructive"
      });
    }
  };

  // Handle graph visualization
  // Memoize the entire visualization component to prevent unnecessary re-renders
  const VisualizationComponent = React.useMemo(() => {
    if (!currentOntology) {
      return (
        <div className="text-center py-16 bg-gradient-to-b from-gray-900 to-gray-950 rounded-lg border border-gray-800 px-4 h-full flex flex-col items-center justify-center">
          <Network className="h-16 w-16 text-primary/40 mb-4" />
          <h3 className="text-xl font-medium mb-2 text-gray-200">No Ontology to Visualize</h3>
          <p className="text-gray-400 mb-6 max-w-md">
            Create or load an ontology first to visualize it as a knowledge graph.
          </p>
        </div>
      );
    }

    if (memoizedGraph && (memoizedGraph.nodes.length === 0 || memoizedGraph.links.length === 0)) {
      return (
        <div className="text-center py-16 bg-gradient-to-b from-gray-900 to-gray-950 rounded-lg border border-gray-800 px-4 h-full flex flex-col items-center justify-center">
          <Database className="h-16 w-16 text-primary/40 mb-4" />
          <h3 className="text-xl font-medium mb-2 text-gray-200">Empty Ontology</h3>
          <p className="text-gray-400 mb-6 max-w-md">
            This ontology doesn't have any entities or relations to visualize. Add some in the Design tab.
          </p>
          <Button 
            onClick={() => setActiveTab('design')}
            className="bg-primary hover:bg-primary/90"
          >
            <Edit className="w-4 h-4 mr-2" /> Go to Design
          </Button>
        </div>
      );
    }

    // Prepare the graph data object once to prevent new object creation on each render
    const graphData = memoizedGraph ? {
      id: memoizedGraph.id, // Include the graph ID for CRUD operations
      name: memoizedGraph.name, // Include the graph name
      nodes: memoizedGraph.nodes.map(node => ({
        id: node.id,
        name: node.name,
        group: node.group,
        description: node.description,
        type: node.type // Include the entity type
      })),
      links: memoizedGraph.links.map(link => ({
        id: link.id, // Include the link ID for updates
        source: link.source,
        target: link.target,
        value: link.value,
        label: link.label,
        description: link.description
      }))
    } : { id: undefined, name: '', nodes: [], links: [] };

    return (
      <div className="min-h-[500px] h-full bg-gray-900/30 border border-gray-800 rounded-lg overflow-hidden">
        {memoizedGraph && (
          <KnowledgeGraphExplorer 
            knowledgeGraph={graphData}
            ref={graphRef}
            hideControls={true} // Hide all tabs and controls to show only the graph
            onGraphUpdated={() => {
              // When the graph is updated, refresh the memoized data
              queryClient.invalidateQueries({ queryKey: ['/api/ontologies'] });
              if (currentOntology?.id) {
                queryClient.invalidateQueries({ queryKey: [`/api/ontologies/${currentOntology.id}`] });
              }
            }}
            onRefreshRequested={() => {
              // Reload the current ontology when refresh is requested
              if (currentOntology?.id) {
                loadOntology(currentOntology.id);
              }
            }}
          />
        )}
      </div>
    );
  }, [currentOntology, memoizedGraph, setActiveTab]);

  // Filter entities by search term
  const filteredEntities = currentOntology?.entities.filter(entity =>
    entity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entity.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entity.type.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Filter relations by search term
  const filteredRelations = currentOntology?.relations.filter(relation =>
    relation.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    relation.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
    relation.target.toLowerCase().includes(searchTerm.toLowerCase()) ||
    relation.description.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Content for design tab
  const designTabContent = (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search entities and relations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64 bg-gray-800 border-gray-700"
          />
          {searchTerm && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setSearchTerm('')}
              className="h-9 w-9"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={saveOntology}
            className="bg-primary hover:bg-primary/90"
          >
            <Save className="w-4 h-4 mr-2" /> Save Ontology
          </Button>
          <HelpTooltip content="Export your ontology in different formats">
            <Select>
              <SelectTrigger className="w-[180px] bg-gray-800 border-gray-700">
                <SelectValue placeholder="Export as..." />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="rdf" onClick={() => {
                  toast({
                    title: "Processing",
                    description: "Preparing RDF/XML export...",
                    duration: 300,
                  });
                  setTimeout(() => exportOntology('rdf'), 400);
                }}>RDF/XML</SelectItem>
                <SelectItem value="ttl" onClick={() => {
                  toast({
                    title: "Processing",
                    description: "Preparing Turtle (TTL) export...",
                    duration: 300,
                  });
                  setTimeout(() => exportOntology('ttl'), 400);
                }}>Turtle (TTL)</SelectItem>
                <SelectItem value="json" onClick={() => {
                  toast({
                    title: "Processing",
                    description: "Preparing JSON-LD export...",
                    duration: 300,
                  });
                  setTimeout(() => exportOntology('json'), 400);
                }}>JSON-LD</SelectItem>
              </SelectContent>
            </Select>
          </HelpTooltip>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Entities Section */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader className="pb-3 border-b border-gray-800">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg flex items-center">
                <Package className="w-4 h-4 mr-2 text-primary-400" /> Entities
              </CardTitle>
              <HelpTooltip content="Add a new entity (class, property, etc)">
                <Button 
                  size="sm" 
                  onClick={() => {
                    resetForms();
                    setShowEntityDialog(true);
                  }}
                  className="bg-primary hover:bg-primary/90 h-8"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Entity
                </Button>
              </HelpTooltip>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            {filteredEntities.length > 0 ? (
              <ScrollArea className="h-[350px] pr-4">
                <div className="space-y-3">
                  {filteredEntities.map((entity) => (
                    <Card key={entity.id} className="bg-gray-800/50 border-gray-700">
                      <CardHeader className="p-3 pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-base flex items-center">
                              {entity.name}
                              <Badge 
                                variant="outline" 
                                className="ml-2 text-xs py-0 h-5 bg-primary/10 text-primary border-primary/20"
                              >
                                {entity.type}
                              </Badge>
                            </CardTitle>
                            <CardDescription className="text-xs mt-1 text-gray-400">
                              {entity.description || "No description"}
                            </CardDescription>
                          </div>
                          <div className="flex gap-1">
                            <HelpTooltip content="Edit this entity">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-gray-400 hover:text-primary hover:bg-gray-700"
                                onClick={() => editEntity(entity)}
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                            </HelpTooltip>
                            <HelpTooltip content="Delete this entity">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-gray-400 hover:text-red-500 hover:bg-gray-700"
                                onClick={() => deleteEntity(entity.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </HelpTooltip>
                          </div>
                        </div>
                      </CardHeader>
                      {entity.properties.length > 0 && (
                        <CardContent className="p-3 pt-0">
                          <div className="mt-1">
                            <p className="text-xs font-medium text-gray-400 mb-1">Properties:</p>
                            <div className="space-y-1">
                              {entity.properties.map((prop, idx) => (
                                <div key={idx} className="flex items-center text-xs">
                                  <span className="text-primary-400">{prop.name}</span>
                                  <span className="mx-1 text-gray-600">:</span>
                                  <span className="text-gray-300">{prop.type}</span>
                                  {prop.description && (
                                    <span className="ml-2 text-gray-500">• {prop.description}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            ) : searchTerm ? (
              <div className="text-center py-4 text-muted-foreground">
                No entities match your search criteria.
              </div>
            ) : (
              <div className="text-center py-10">
                <Package className="h-10 w-10 mx-auto text-gray-600 mb-3" />
                <h3 className="text-sm font-medium text-gray-400">No Entities Yet</h3>
                <p className="text-xs text-gray-500 mt-1 mb-4">
                  Add entities like classes and properties to your ontology.
                </p>
                <Button 
                  size="sm" 
                  onClick={() => {
                    resetForms();
                    setShowEntityDialog(true);
                  }}
                  className="bg-primary/80 hover:bg-primary text-xs"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add First Entity
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Relations Section */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader className="pb-3 border-b border-gray-800">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg flex items-center">
                <ArrowRight className="w-4 h-4 mr-2 text-blue-400" /> Relations
              </CardTitle>
              <HelpTooltip content="Add a new relation between entities">
                <Button 
                  size="sm" 
                  onClick={() => {
                    resetForms();
                    setShowRelationDialog(true);
                  }}
                  disabled={!currentOntology || currentOntology.entities.length < 2}
                  className="bg-blue-600 hover:bg-blue-700 h-8"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Relation
                </Button>
              </HelpTooltip>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            {filteredRelations.length > 0 ? (
              <ScrollArea className="h-[350px] pr-4">
                <div className="space-y-3">
                  {filteredRelations.map((relation) => (
                    <Card key={relation.id} className="bg-gray-800/50 border-gray-700">
                      <CardHeader className="p-3 pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-base flex items-center">
                              {relation.name}
                            </CardTitle>
                            <div className="flex items-center mt-1 text-xs text-gray-400">
                              <span className="font-medium text-gray-300">{relation.source}</span>
                              <ArrowRight className="h-3 w-3 mx-1" />
                              <span className="font-medium text-gray-300">{relation.target}</span>
                            </div>
                            {relation.description && (
                              <CardDescription className="text-xs mt-1 text-gray-400">
                                {relation.description}
                              </CardDescription>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <HelpTooltip content="Edit this relation">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-gray-400 hover:text-blue-500 hover:bg-gray-700"
                                onClick={() => editRelation(relation)}
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                            </HelpTooltip>
                            <HelpTooltip content="Delete this relation">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-gray-400 hover:text-red-500 hover:bg-gray-700"
                                onClick={() => deleteRelation(relation.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </HelpTooltip>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            ) : searchTerm ? (
              <div className="text-center py-4 text-muted-foreground">
                No relations match your search criteria.
              </div>
            ) : (
              <div className="text-center py-10">
                <ArrowRight className="h-10 w-10 mx-auto text-gray-600 mb-3" />
                <h3 className="text-sm font-medium text-gray-400">No Relations Yet</h3>
                <p className="text-xs text-gray-500 mt-1 mb-4">
                  Add relationships between your entities.
                </p>
                <Button 
                  size="sm" 
                  onClick={() => {
                    resetForms();
                    setShowRelationDialog(true);
                  }}
                  disabled={!currentOntology || currentOntology.entities.length < 2}
                  className="bg-blue-600/80 hover:bg-blue-600 text-xs"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add First Relation
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Version History */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader className="pb-3 border-b border-gray-800">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg flex items-center">
              <Clock className="w-4 h-4 mr-2 text-amber-400" /> Version History
            </CardTitle>
            <HelpTooltip content="Create a new version of your ontology">
              <Button 
                size="sm" 
                onClick={() => {
                  resetForms();
                  setShowVersionDialog(true);
                }}
                disabled={!currentOntology}
                className="bg-amber-600 hover:bg-amber-700 h-8"
              >
                <Plus className="w-3 h-3 mr-1" /> New Version
              </Button>
            </HelpTooltip>
          </div>
        </CardHeader>
        <CardContent className="pt-3">
          {currentOntology && currentOntology.versions.length > 0 ? (
            <ScrollArea className="max-h-[250px] pr-4">
              <div className="space-y-3">
                {currentOntology.versions
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .map((version) => (
                    <Card key={version.id} className="bg-gray-800/50 border-gray-700">
                      <CardHeader className="p-3 pb-2">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center">
                              <CardTitle className="text-base">{version.version}</CardTitle>
                              <span className="text-xs text-gray-500 ml-3">
                                {new Date(version.timestamp).toLocaleDateString()} at {
                                  new Date(version.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                }
                              </span>
                            </div>
                            {version.description && (
                              <CardDescription className="text-xs mt-1 text-gray-400">
                                {version.description}
                              </CardDescription>
                            )}
                            {version.changes.length > 0 && (
                              <div className="mt-2">
                                <div className="flex space-x-2">
                                  {version.changes.filter(c => c.type === 'add').length > 0 && (
                                    <Badge variant="outline" className="bg-green-900/20 text-green-400 border-green-900">
                                      {version.changes.filter(c => c.type === 'add').length} added
                                    </Badge>
                                  )}
                                  {version.changes.filter(c => c.type === 'update').length > 0 && (
                                    <Badge variant="outline" className="bg-blue-900/20 text-blue-400 border-blue-900">
                                      {version.changes.filter(c => c.type === 'update').length} updated
                                    </Badge>
                                  )}
                                  {version.changes.filter(c => c.type === 'delete').length > 0 && (
                                    <Badge variant="outline" className="bg-red-900/20 text-red-400 border-red-900">
                                      {version.changes.filter(c => c.type === 'delete').length} deleted
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 px-2 text-xs text-gray-400 hover:text-amber-500 hover:bg-gray-700"
                            onClick={() => viewVersion(version)}
                          >
                            <Clock className="h-3 w-3 mr-1" /> Details
                          </Button>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-6">
              <Clock className="h-10 w-10 mx-auto text-gray-600 mb-3" />
              <h3 className="text-sm font-medium text-gray-400">No Version History</h3>
              <p className="text-xs text-gray-500 mt-1">
                Create versions to track changes to your ontology over time.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // Create Tab Content
  const createTabContent = (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
      {/* AI Generation */}
      <Card className="md:col-span-6 bg-gray-900/50 border-gray-800">
        <CardHeader className="pb-3 border-b border-gray-800">
          <CardTitle className="text-lg flex items-center">
            <Sparkles className="w-4 h-4 mr-2 text-primary-400" /> Generate with AI
          </CardTitle>
          <CardDescription>
            Create an ontology from a text description using AI
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-1">
              <Label htmlFor="model">Model</Label>
              <HelpTooltip content="Choose which AI model to use for generation">
                <HelpCircle className="h-3 w-3 text-gray-500" />
              </HelpTooltip>
            </div>
            <RadioGroup 
              value={selectedModel} 
              onValueChange={setSelectedModel as any}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="openai" id="openai" />
                <Label htmlFor="openai" className="cursor-pointer">OpenAI</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mistral" id="mistral" />
                <Label htmlFor="mistral" className="cursor-pointer">Mistral AI</Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center space-x-1">
              <Label htmlFor="prompt">Domain Description</Label>
              <HelpTooltip content="Describe the domain for which you want to create an ontology">
                <HelpCircle className="h-3 w-3 text-gray-500" />
              </HelpTooltip>
            </div>
            <Textarea 
              id="prompt"
              placeholder="Describe the domain or field for which you want to create an ontology. For example: 'Create an ontology for a healthcare system that includes patients, doctors, treatments, and medical records.'"
              className="bg-gray-800 border-gray-700 min-h-[150px]"
              value={ontologyPrompt}
              onChange={(e) => setOntologyPrompt(e.target.value)}
            />
          </div>
          
          <Button 
            className="w-full bg-primary hover:bg-primary/90"
            disabled={isGenerating || !ontologyPrompt.trim() || (
              selectedModel === 'openai' && !openaiApiKey) || 
              (selectedModel === 'mistral' && !mistralApiKey
            )}
            onClick={generateOntologyFromPrompt}
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" /> Generate Ontology
              </>
            )}
          </Button>
          
          {(selectedModel === 'openai' && !openaiApiKey) || (selectedModel === 'mistral' && !mistralApiKey) ? (
            <div className="text-xs text-amber-400 flex items-center mt-2">
              <Info className="h-3 w-3 mr-1" /> API key for {selectedModel === 'openai' ? 'OpenAI' : 'Mistral AI'} is not set.
            </div>
          ) : null}
        </CardContent>
      </Card>
      
      {/* File Upload */}
      <Card className="md:col-span-6 bg-gray-900/50 border-gray-800">
        <CardHeader className="pb-3 border-b border-gray-800">
          <CardTitle className="text-lg flex items-center">
            <Upload className="w-4 h-4 mr-2 text-blue-400" /> Import File
          </CardTitle>
          <CardDescription>
            Upload an existing ontology file (RDF, TTL, JSON-LD)
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-1">
              <Label htmlFor="fileFormat">File Format</Label>
              <HelpTooltip content="Select the format of the file you're uploading">
                <HelpCircle className="h-3 w-3 text-gray-500" />
              </HelpTooltip>
            </div>
            <Select value={fileFormat} onValueChange={setFileFormat}>
              <SelectTrigger className="bg-gray-800 border-gray-700">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="rdf">RDF/XML</SelectItem>
                <SelectItem value="ttl">Turtle (TTL)</SelectItem>
                <SelectItem value="jsonld">JSON-LD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".rdf,.ttl,.json,.jsonld"
            />
            <div 
              className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={handleFileSelect}
            >
              <FileUp className="h-8 w-8 mx-auto text-gray-500 mb-2" />
              <p className="text-sm text-gray-400">
                {selectedFile ? selectedFile.name : 'Click to select or drag & drop a file'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {selectedFile ? `${(selectedFile.size / 1024).toFixed(2)} KB` : 'Supports RDF, TTL, and JSON-LD formats'}
              </p>
            </div>
          </div>
          
          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={isUploading || !selectedFile}
            onClick={uploadOntologyFile}
          >
            {isUploading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" /> Upload Ontology
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      
      {/* Knowledge Graph Import */}
      <Card className="md:col-span-12 bg-gray-900/50 border-gray-800">
        <CardHeader className="pb-3 border-b border-gray-800">
          <CardTitle className="text-lg flex items-center">
            <Network className="w-4 h-4 mr-2 text-green-400" /> Import from Knowledge Graph
          </CardTitle>
          <CardDescription>
            Convert an existing knowledge graph into an ontology
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-1">
                <Label htmlFor="graphId">Select Knowledge Graph</Label>
                <HelpTooltip content="Choose a knowledge graph to convert into an ontology">
                  <HelpCircle className="h-3 w-3 text-gray-500" />
                </HelpTooltip>
              </div>
              <Select value={selectedGraphId} onValueChange={setSelectedGraphId}>
                <SelectTrigger className="bg-gray-800 border-gray-700">
                  <SelectValue placeholder="Select a graph" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {isLoadingGraphs ? (
                    <div className="p-2 text-center">
                      <RefreshCw className="h-4 w-4 animate-spin mx-auto" />
                      <p className="text-xs mt-1">Loading graphs...</p>
                    </div>
                  ) : !Array.isArray(graphs) ? (
                    <SelectItem value="none">No valid graphs available</SelectItem>
                  ) : graphs.length === 0 ? (
                    <div className="p-2 text-center">
                      <p className="text-xs">No knowledge graphs available</p>
                    </div>
                  ) : (
                    graphs.map((graph: any) => (
                      <SelectItem key={graph.id} value={graph.id.toString()}>
                        {graph.name || `Graph #${graph.id}`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="graphName">Ontology Name</Label>
              <Input
                id="graphName"
                placeholder="Enter a name for the new ontology"
                className="bg-gray-800 border-gray-700"
                value={graphImportName}
                onChange={(e) => setGraphImportName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="graphDomain">Domain</Label>
              <Input
                id="graphDomain"
                placeholder="Enter the domain (e.g., healthcare, finance)"
                className="bg-gray-800 border-gray-700"
                value={graphImportDomain}
                onChange={(e) => setGraphImportDomain(e.target.value)}
              />
            </div>
          </div>
          
          <Button 
            className="w-full mt-4 bg-green-600 hover:bg-green-700"
            disabled={isConvertingGraph || !selectedGraphId || !graphImportName}
            onClick={handleGraphConversion}
          >
            {isConvertingGraph ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Converting...
              </>
            ) : (
              <>
                <Network className="w-4 h-4 mr-2" /> Convert to Ontology
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  // Enrich Tab Content
  const enrichTabContent = (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
      <Card className="md:col-span-12 bg-gray-900/50 border-gray-800">
        <CardHeader className="pb-3 border-b border-gray-800">
          <CardTitle className="text-lg flex items-center">
            <Sparkles className="w-4 h-4 mr-2 text-amber-400" /> Enrich Ontology
          </CardTitle>
          <CardDescription>
            Enhance your ontology with AI or standard ontology schemas
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {currentOntology ? (
            <>
              <RadioGroup 
                value={enrichmentType} 
                onValueChange={setEnrichmentType as any}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ai" id="ai-enrichment" />
                  <Label htmlFor="ai-enrichment" className="cursor-pointer">AI Enrichment</Label>
                  <HelpTooltip content="Use AI to suggest additional entities and relations for your ontology">
                    <HelpCircle className="h-3 w-3 text-gray-500" />
                  </HelpTooltip>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="schema" id="schema-enrichment" />
                  <Label htmlFor="schema-enrichment" className="cursor-pointer">Schema.org Integration</Label>
                  <HelpTooltip content="Enhance your ontology with standard types and properties from Schema.org">
                    <HelpCircle className="h-3 w-3 text-gray-500" />
                  </HelpTooltip>
                </div>
              </RadioGroup>
              
              {enrichmentType === 'ai' && (
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-1">
                      <Label htmlFor="enrichModel">AI Model</Label>
                      <HelpTooltip content="Choose which AI model to use for enrichment">
                        <HelpCircle className="h-3 w-3 text-gray-500" />
                      </HelpTooltip>
                    </div>
                    <RadioGroup 
                      value={selectedModel} 
                      onValueChange={setSelectedModel as any}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="openai" id="openai-enrich" />
                        <Label htmlFor="openai-enrich" className="cursor-pointer">OpenAI</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="mistral" id="mistral-enrich" />
                        <Label htmlFor="mistral-enrich" className="cursor-pointer">Mistral AI</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <h4 className="text-sm font-medium flex items-center text-amber-400">
                      <Info className="h-4 w-4 mr-1" /> About AI Enrichment
                    </h4>
                    <p className="text-sm mt-1 text-gray-400">
                      AI will analyze your current ontology and suggest additional entities, properties, and relationships
                      that might be relevant. It will not remove any existing elements.
                    </p>
                    <div className="mt-3 text-xs text-gray-500">
                      <p>Current ontology statistics:</p>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>{currentOntology.entities.length} entities defined</li>
                        <li>{currentOntology.relations.length} relations defined</li>
                        <li>Domain: {currentOntology.domain || "Not specified"}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              
              {enrichmentType === 'schema' && (
                <div className="space-y-4 mt-4">
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <h4 className="text-sm font-medium flex items-center text-green-400">
                      <Info className="h-4 w-4 mr-1" /> About Schema.org Integration
                    </h4>
                    <p className="text-sm mt-1 text-gray-400">
                      Schema.org provides a collection of shared vocabularies that you can use to mark up your ontology.
                      This enrichment will add relevant Schema.org types and properties based on your current ontology domain.
                    </p>
                    <div className="mt-3 text-xs text-gray-500">
                      <p>Benefits of Schema.org integration:</p>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>Improved interoperability with other systems</li>
                        <li>Better alignment with web standards</li>
                        <li>Enhanced semantic clarity and organization</li>
                      </ul>
                    </div>
                    
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Integration Mode</h4>
                      <RadioGroup 
                        defaultValue="extend"
                        name="schemaIntegrationType"
                        onValueChange={(value) => setSchemaIntegrationType(value as 'extend' | 'replace' | 'annotate')}
                        className="space-y-2"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="extend" id="schema-extend" />
                          <Label htmlFor="schema-extend">Extend ontology</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="replace" id="schema-replace" />
                          <Label htmlFor="schema-replace">Replace matching entities</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="annotate" id="schema-annotate" />
                          <Label htmlFor="schema-annotate">Add annotations only</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full bg-amber-600 hover:bg-amber-700 mt-2"
                    onClick={() => {
                      setShowSchemaOrgSuggestions(true);
                    }}
                  >
                    <Database className="w-4 h-4 mr-2" /> 
                    View Schema.org Suggestions
                  </Button>
                </div>
              )}
              
              {enrichmentType === 'ai' && (
                <Button 
                  className="w-full bg-amber-600 hover:bg-amber-700 mt-2"
                  onClick={enrichOntology}
                  disabled={((selectedModel === 'openai' && !openaiApiKey) || (selectedModel === 'mistral' && !mistralApiKey))}
                >
                  <Sparkles className="w-4 h-4 mr-2" /> 
                  Enrich with AI
                </Button>
              )}
              
              {enrichmentType === 'ai' && ((selectedModel === 'openai' && !openaiApiKey) || (selectedModel === 'mistral' && !mistralApiKey)) && (
                <div className="text-xs text-amber-400 flex items-center mt-2">
                  <Info className="h-3 w-3 mr-1" /> API key for {selectedModel === 'openai' ? 'OpenAI' : 'Mistral AI'} is not set.
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-10">
              <Sparkles className="h-12 w-12 mx-auto text-gray-600 mb-4" />
              <h3 className="text-base font-medium text-gray-300 mb-2">No Ontology to Enrich</h3>
              <p className="text-sm text-gray-400 max-w-md mx-auto mb-4">
                Create or load an ontology first before using the enrichment features.
              </p>
              <Button 
                onClick={() => setActiveTab('create')}
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-2" /> Create Ontology
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // Browse Tab Content
  const browseTabContent = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Input
          placeholder="Search ontologies..."
          className="w-64 bg-gray-800 border-gray-700"
        />
        <HelpTooltip content="Refresh the ontology list">
          <Button 
            variant="outline"
            size="icon"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['/api/ontologies'] });
              toast({
                title: "Refreshing",
                description: "Refreshing ontology list...",
                duration: 2000
              });
            }}
            disabled={isLoadingOntologies}
            className="bg-gray-800 border-gray-700"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingOntologies ? 'animate-spin' : ''}`} />
          </Button>
        </HelpTooltip>
      </div>
      
      {isLoadingOntologies ? (
        <div className="text-center py-20">
          <RefreshCw className="h-8 w-8 mx-auto text-gray-400 animate-spin mb-4" />
          <p className="text-gray-400">Loading ontologies...</p>
        </div>
      ) : ontologies.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ontologies.map((ontology: Ontology) => (
            <Card key={ontology.id} className="bg-gray-900/50 border-gray-800 overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base truncate pr-4">{ontology.name}</CardTitle>
                  <Badge variant="outline" className="bg-gray-800 font-normal">
                    v{ontology.versions[ontology.versions.length - 1]?.version || "1.0.0"}
                  </Badge>
                </div>
                <CardDescription className="text-xs line-clamp-2 h-8">
                  {ontology.description || "No description available"}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="text-xs text-gray-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Domain:</span>
                    <span className="font-medium text-gray-300">{ontology.domain || "Unspecified"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Entities:</span>
                    <span className="font-medium text-primary">{ontology.entities.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Relations:</span>
                    <span className="font-medium text-blue-400">{ontology.relations.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span className="font-medium text-gray-300">{new Date(ontology.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-gray-800/40 px-3 py-2 flex justify-between">
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-8 text-xs hover:bg-gray-700"
                >
                  <ExternalLink className="h-3 w-3 mr-1" /> Details
                </Button>
                <Button 
                  size="sm"
                  className="h-8 text-xs bg-primary hover:bg-primary/90"
                  onClick={() => {
                    setCurrentOntology(ontology);
                    setActiveTab('visualize');
                  }}
                >
                  <Folder className="h-3 w-3 mr-1" /> Load
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-gradient-to-b from-gray-900 to-gray-950 rounded-lg border border-gray-800 px-4">
          <FolderOpen className="h-16 w-16 mx-auto text-gray-700 mb-4" />
          <h3 className="text-xl font-medium mb-2 text-gray-300">No Ontologies Found</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            There are no saved ontologies in your repository. Create a new ontology to get started.
          </p>
          <Button 
            onClick={() => setActiveTab('create')}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-2" /> Create New Ontology
          </Button>
        </div>
      )}
    </div>
  );

  // Entity Dialog
  const entityDialog = showEntityDialog ? (
    <Dialog open={showEntityDialog} onOpenChange={setShowEntityDialog}>
      <DialogContent className="bg-gray-900 border-gray-800 text-gray-200 sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{editMode ? 'Edit Entity' : 'Add New Entity'}</DialogTitle>
          <DialogDescription>
            {editMode ? 'Modify the properties of this entity.' : 'Define a new entity for your ontology.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="entity-name" className="text-right">
              Name
            </Label>
            <Input
              id="entity-name"
              placeholder="Enter entity name"
              className="col-span-3 bg-gray-800 border-gray-700"
              value={entityForm.name}
              onChange={(e) => setEntityForm({ ...entityForm, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="entity-type" className="text-right">
              Type
            </Label>
            <Select
              value={entityForm.type}
              onValueChange={(value) => setEntityForm({ ...entityForm, type: value })}
            >
              <SelectTrigger className="col-span-3 bg-gray-800 border-gray-700">
                <SelectValue placeholder="Select entity type" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="Other">Other</SelectItem>
                <SelectItem value="Person">Person</SelectItem>
                <SelectItem value="Place">Place</SelectItem>
                <SelectItem value="Organization">Organization</SelectItem>
                <SelectItem value="Concept">Concept</SelectItem>
                <SelectItem value="Date">Date</SelectItem>
                <SelectItem value="Class">Class</SelectItem>
                <SelectItem value="Property">Property</SelectItem>
                <SelectItem value="DataType">DataType</SelectItem>
                <SelectItem value="ObjectProperty">ObjectProperty</SelectItem>
                <SelectItem value="AnnotationProperty">AnnotationProperty</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="entity-description" className="text-right pt-2">
              Description
            </Label>
            <Textarea
              id="entity-description"
              placeholder="Enter a description"
              className="col-span-3 bg-gray-800 border-gray-700"
              value={entityForm.description}
              onChange={(e) => setEntityForm({ ...entityForm, description: e.target.value })}
            />
          </div>
          
          <div className="grid grid-cols-4 items-start gap-4">
            <div className="text-right pt-2 flex items-center justify-end">
              <Label className="mr-1">Properties</Label>
              <HelpTooltip content="Add properties that define the characteristics of this entity">
                <HelpCircle className="h-3 w-3 text-gray-500" />
              </HelpTooltip>
            </div>
            <div className="col-span-3 space-y-3">
              {entityForm.properties.map((property, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-start relative">
                  <Input
                    placeholder="Name"
                    className="col-span-4 bg-gray-800 border-gray-700"
                    value={property.name}
                    onChange={(e) => updatePropertyInEntity(index, 'name', e.target.value)}
                  />
                  <Select
                    value={property.type}
                    onValueChange={(value) => updatePropertyInEntity(index, 'type', value)}
                  >
                    <SelectTrigger className="col-span-3 bg-gray-800 border-gray-700">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="string">String</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="boolean">Boolean</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="url">URL</SelectItem>
                      <SelectItem value="object">Object</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Description"
                    className="col-span-4 bg-gray-800 border-gray-700"
                    value={property.description}
                    onChange={(e) => updatePropertyInEntity(index, 'description', e.target.value)}
                  />
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 text-gray-400 hover:text-red-500 hover:bg-gray-800"
                    onClick={() => removePropertyFromEntity(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button 
                variant="outline" 
                size="sm" 
                className="text-xs bg-gray-800 hover:bg-gray-700 border-gray-700"
                onClick={addPropertyToEntity}
              >
                <Plus className="h-3 w-3 mr-1" /> Add Property
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setShowEntityDialog(false)}
            className="bg-gray-800 hover:bg-gray-700 border-gray-700"
          >
            Cancel
          </Button>
          <Button onClick={createEntity} className="bg-primary hover:bg-primary/90">
            {editMode ? 'Update Entity' : 'Create Entity'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null;

  // Relation Dialog
  const relationDialog = showRelationDialog ? (
    <Dialog open={showRelationDialog} onOpenChange={setShowRelationDialog}>
      <DialogContent className="bg-gray-900 border-gray-800 text-gray-200 sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{editMode ? 'Edit Relation' : 'Add New Relation'}</DialogTitle>
          <DialogDescription>
            {editMode ? 'Modify the properties of this relation.' : 'Define a new relation between entities.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="relation-name" className="text-right">
              Name
            </Label>
            <Input
              id="relation-name"
              placeholder="Enter relation name"
              className="col-span-3 bg-gray-800 border-gray-700"
              value={relationForm.name}
              onChange={(e) => setRelationForm({ ...relationForm, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="relation-source" className="text-right">
              Source
            </Label>
            <Select
              value={relationForm.source}
              onValueChange={(value) => setRelationForm({ ...relationForm, source: value })}
            >
              <SelectTrigger className="col-span-3 bg-gray-800 border-gray-700">
                <SelectValue placeholder="Select source entity" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                {currentOntology?.entities.map((entity) => (
                  <SelectItem key={entity.id} value={entity.name}>
                    {entity.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="relation-target" className="text-right">
              Target
            </Label>
            <Select
              value={relationForm.target}
              onValueChange={(value) => setRelationForm({ ...relationForm, target: value })}
            >
              <SelectTrigger className="col-span-3 bg-gray-800 border-gray-700">
                <SelectValue placeholder="Select target entity" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                {currentOntology?.entities.map((entity) => (
                  <SelectItem key={entity.id} value={entity.name}>
                    {entity.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="relation-description" className="text-right pt-2">
              Description
            </Label>
            <Textarea
              id="relation-description"
              placeholder="Enter a description"
              className="col-span-3 bg-gray-800 border-gray-700"
              value={relationForm.description}
              onChange={(e) => setRelationForm({ ...relationForm, description: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setShowRelationDialog(false)}
            className="bg-gray-800 hover:bg-gray-700 border-gray-700"
          >
            Cancel
          </Button>
          <Button onClick={createRelation} className="bg-blue-600 hover:bg-blue-700">
            {editMode ? 'Update Relation' : 'Create Relation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null;
  
  // Version Dialog
  const versionDialog = showVersionDialog ? (
    <Dialog open={showVersionDialog} onOpenChange={setShowVersionDialog}>
      <DialogContent className="bg-gray-900 border-gray-800 text-gray-200 sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {currentVersion ? `Version ${currentVersion.version}` : 'Create New Version'}
          </DialogTitle>
          <DialogDescription>
            {currentVersion 
              ? `Version details and changes from ${new Date(currentVersion.timestamp).toLocaleDateString()}`
              : 'Create a new version to track changes to your ontology.'}
          </DialogDescription>
        </DialogHeader>
        {currentVersion ? (
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center">
                <Clock className="w-4 h-4 mr-2 text-amber-400" /> Version Information
              </h4>
              <div className="bg-gray-800/50 rounded-lg p-3 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Version:</span>
                  <span>{currentVersion.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Created:</span>
                  <span>{new Date(currentVersion.timestamp).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Description:</span>
                  <span>{currentVersion.description || "No description"}</span>
                </div>
              </div>
            </div>
            
            {currentVersion.changes.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center">
                  <RefreshCw className="w-4 h-4 mr-2 text-blue-400" /> Changes in this Version
                </h4>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {currentVersion.changes.map((change, index) => (
                      <div key={index} className="bg-gray-800/50 rounded-lg p-3 text-sm">
                        <div className="flex items-center gap-2">
                          {change.type === 'add' && (
                            <Badge variant="outline" className="bg-green-900/20 text-green-400 border-green-900">Added</Badge>
                          )}
                          {change.type === 'update' && (
                            <Badge variant="outline" className="bg-blue-900/20 text-blue-400 border-blue-900">Updated</Badge>
                          )}
                          {change.type === 'delete' && (
                            <Badge variant="outline" className="bg-red-900/20 text-red-400 border-red-900">Deleted</Badge>
                          )}
                          {change.itemType === 'batch' ? (
                            <span className="font-medium">
                              {change.count} {change.element === 'entity' 
                                ? `Entities` 
                                : change.element === 'relation' 
                                  ? `Relations` 
                                  : `Properties`}
                            </span>
                          ) : (
                            <span className="font-medium">
                              {change.element === 'entity' 
                                ? 'Entity' 
                                : change.element === 'relation' 
                                  ? 'Relation' 
                                  : 'Property'}: {change.name}
                            </span>
                          )}
                        </div>
                        {change.description && (
                          <p className="mt-1 text-xs text-gray-400">{change.description}</p>
                        )}
                        {change.source && (
                          <p className="mt-1 text-xs text-gray-400">Source: {change.source}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="bg-gray-800/30 rounded-lg p-4 text-center">
                <p className="text-gray-400 text-sm">No changes recorded for this version.</p>
              </div>
            )}
            
            <DialogFooter>
              <Button 
                onClick={() => setShowVersionDialog(false)}
                className="bg-primary hover:bg-primary/90"
              >
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="version-number" className="text-right">
                  Version
                </Label>
                <Input
                  id="version-number"
                  placeholder="e.g., 1.0.0"
                  className="col-span-3 bg-gray-800 border-gray-700"
                  value={versionForm.version}
                  onChange={(e) => setVersionForm({ ...versionForm, version: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="version-description" className="text-right pt-2">
                  Description
                </Label>
                <Textarea
                  id="version-description"
                  placeholder="Describe the changes in this version"
                  className="col-span-3 bg-gray-800 border-gray-700"
                  value={versionForm.description}
                  onChange={(e) => setVersionForm({ ...versionForm, description: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setShowVersionDialog(false)}
                className="bg-gray-800 hover:bg-gray-700 border-gray-700"
              >
                Cancel
              </Button>
              <Button onClick={createVersion} className="bg-amber-600 hover:bg-amber-700">
                Create Version
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  ) : null;
  
  // Rename Ontology Dialog
  const renameDialog = (
    <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
      <DialogContent className="bg-gray-900 border-gray-800 text-gray-200 sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Rename Ontology</DialogTitle>
          <DialogDescription>
            Enter a new name for the selected ontology.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="ontology-name">Ontology Name</Label>
            <Input
              id="ontology-name"
              value={editingOntology?.name || ''}
              onChange={(e) => setEditingOntology(prev => prev ? {...prev, name: e.target.value} : null)}
              placeholder="Enter a new name"
              className="bg-gray-800 border-gray-700"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)} className="bg-gray-800 border-gray-700">
            Cancel
          </Button>
          <Button onClick={handleRenameOntology}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Header component for page layout
  const ontologyHeader = currentOntology ? (
    <div className="flex justify-between items-center">
      <div>
        <h2 className="text-lg font-medium">{currentOntology.name}</h2>
        <p className="text-sm text-muted-foreground">
          {currentOntology.domain && `Domain: ${currentOntology.domain}`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary">
          v{currentOntology.versions[currentOntology.versions.length - 1]?.version || "1.0.0"}
        </Badge>
      </div>
    </div>
  ) : undefined;

  return (
    <PageLayout 
      title="OntoMaker"
      header={ontologyHeader}
    >
      <div className="container mx-auto px-4 py-6 text-gray-200">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Content Area */}
          <div className="lg:col-span-9 space-y-6">
            <Card className="border-gray-800 bg-gray-900/50">
              <CardContent className="p-5">
                <Tabs
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="w-full"
                >
                  <TabsList className="grid grid-cols-4 mb-6">
                    <TabsTrigger value="create" className="text-sm">
                      <Layers className="w-4 h-4 mr-2" /> Create
                    </TabsTrigger>
                    <TabsTrigger value="design" className="text-sm">
                      <Edit className="w-4 h-4 mr-2" /> Design
                    </TabsTrigger>
                    <TabsTrigger value="visualize" className="text-sm">
                      <Network className="w-4 h-4 mr-2" /> Visualize
                    </TabsTrigger>
                    <TabsTrigger value="enrich" className="text-sm">
                      <Sparkles className="w-4 h-4 mr-2" /> Enrich
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="create" className="space-y-4">
                    <p className="text-sm mb-6 text-gray-400">
                      Create a new ontology by defining concepts, relationships, and rules for your knowledge domain.
                      You can import from an existing knowledge graph, upload a standard RDF/OWL file, or start from scratch.
                    </p>
                    
                    {/* Row 1: Generate with AI - Full Width */}
                    <div className="grid grid-cols-1 gap-4 mb-6">
                      {/* From AI */}
                      <Card className="border-gray-800 bg-gray-900/30">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-md flex items-center">
                            <Sparkles className="w-4 h-4 mr-2 text-primary" /> Generate with AI
                          </CardTitle>
                          <CardDescription>
                            Generate ontology from a text description
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <Select value={selectedModel} onValueChange={setSelectedModel}>
                                <SelectTrigger className="bg-gray-800 border-gray-700">
                                  <SelectValue placeholder="Select model" />
                                </SelectTrigger>
                                <SelectContent className="bg-gray-800 border-gray-700">
                                  <SelectItem value="openai" disabled={!openaiApiKey}>
                                    {openaiApiKey ? "OpenAI" : "OpenAI (API key needed)"}
                                  </SelectItem>
                                  <SelectItem value="mistral" disabled={!mistralApiKey}>
                                    {mistralApiKey ? "Mistral AI" : "Mistral AI (API key needed)"}
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              
                              <Input
                                placeholder="Ontology Name"
                                value={graphImportName}
                                onChange={(e) => setGraphImportName(e.target.value)}
                                className="bg-gray-800 border-gray-700"
                              />
                            </div>
                            
                            <Textarea
                              placeholder="Describe your domain (e.g., 'An e-commerce platform selling books, with authors, publishers, customers...')"
                              value={ontologyPrompt}
                              onChange={(e) => setOntologyPrompt(e.target.value)}
                              className="h-28 bg-gray-800 border-gray-700"
                            />
                            
                            {/* Progress bar */}
                            {isGenerating && (
                              <div className="mb-4">
                                <div className="flex justify-between mb-1">
                                  <span className="text-xs text-gray-400">Generating ontology</span>
                                  <span className="text-xs text-gray-400">{Math.round(generationProgress)}%</span>
                                </div>
                                <div className="w-full bg-gray-800 rounded-full h-2.5">
                                  <div 
                                    className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-in-out" 
                                    style={{ width: `${generationProgress}%` }}
                                  ></div>
                                </div>
                              </div>
                            )}
                            
                            <Button
                              onClick={generateOntologyFromPrompt}
                              disabled={isGenerating || !ontologyPrompt.trim() || !graphImportName || (selectedModel === 'openai' && !openaiApiKey) || (selectedModel === 'mistral' && !mistralApiKey)}
                              className="w-full"
                            >
                              {isGenerating ? (
                                <>
                                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                  Generating...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="mr-2 h-4 w-4" />
                                  Generate Ontology
                                </>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    
                    {/* Row 2: Import from File and From Knowledge Graph */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {/* From File */}
                      <Card className="border-gray-800 bg-gray-900/30">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-md flex items-center">
                            <FileUp className="w-4 h-4 mr-2 text-blue-400" /> Import from File
                          </CardTitle>
                          <CardDescription>
                            Upload semantic web ontology files
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <div className="flex items-center space-x-1">
                                <Label htmlFor="fileFormat">File Format</Label>
                                <HelpTooltip content="Select the format of your ontology file">
                                  <HelpCircle className="h-3 w-3 text-gray-500" />
                                </HelpTooltip>
                              </div>
                              <Select value={fileFormat} onValueChange={setFileFormat}>
                                <SelectTrigger className="bg-gray-800 border-gray-700">
                                  <SelectValue placeholder="Select format" />
                                </SelectTrigger>
                                <SelectContent className="bg-gray-800 border-gray-700">
                                  <SelectItem value="rdf">RDF/XML (.rdf)</SelectItem>
                                  <SelectItem value="owl">OWL (.owl)</SelectItem>
                                  <SelectItem value="rdfs">RDFS (.rdfs)</SelectItem>
                                  <SelectItem value="ttl">Turtle (.ttl)</SelectItem>
                                  <SelectItem value="n3">N3 (.n3)</SelectItem>
                                  <SelectItem value="jsonld">JSON-LD (.jsonld)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <input
                              type="file"
                              ref={fileInputRef}
                              className="hidden"
                              onChange={handleFileChange}
                              accept=".rdf,.owl,.rdfs,.ttl,.n3,.jsonld,.json"
                            />
                            
                            <div 
                              className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500/50 transition-colors"
                              onClick={handleFileSelect}
                            >
                              <FileUp className="h-8 w-8 mx-auto text-gray-500 mb-2" />
                              <p className="text-sm text-gray-400 mb-1">
                                {selectedFile ? selectedFile.name : 'Click to select ontology file'}
                              </p>
                              <p className="text-xs text-gray-500">
                                {selectedFile 
                                  ? `${(selectedFile.size / 1024).toFixed(1)} KB - ${fileFormat.toUpperCase()} format` 
                                  : 'Supports RDF/XML, OWL, RDFS, Turtle, N3, JSON-LD (max 10MB)'
                                }
                              </p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                onClick={handleFileSelect}
                                variant="outline" 
                                className="w-full bg-gray-800 border-gray-700 hover:bg-gray-700"
                              >
                                {selectedFile ? selectedFile.name.length > 15 ? selectedFile.name.substring(0, 15) + '...' : selectedFile.name : "Select File"}
                              </Button>
                              
                              <Button
                                onClick={uploadOntologyFile}
                                disabled={isUploading || !selectedFile}
                                className="w-full"
                              >
                                {isUploading ? (
                                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Upload className="mr-2 h-4 w-4" />
                                )}
                                Upload
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      {/* From Knowledge Graph */}
                      <Card className="border-gray-800 bg-gray-900/30">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-md flex items-center">
                            <Network className="w-4 h-4 mr-2 text-purple-400" /> From Knowledge Graph
                          </CardTitle>
                          <CardDescription>
                            Convert existing knowledge graph
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-2">
                              <Select 
                                value={selectedGraphId} 
                                onValueChange={setSelectedGraphId}
                              >
                                <SelectTrigger className="bg-gray-800 border-gray-700">
                                  <SelectValue placeholder="Select Graph" />
                                </SelectTrigger>
                                <SelectContent className="bg-gray-800 border-gray-700 max-h-[200px]">
                                  {isLoadingGraphs ? (
                                    <SelectItem value="loading" disabled>Loading graphs...</SelectItem>
                                  ) : graphs.length > 0 ? (
                                    graphs.map((graph: any) => (
                                      <SelectItem key={graph.id} value={graph.id.toString()}>
                                        {graph.name}
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <SelectItem value="none" disabled>No graphs available</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                              
                              <Input
                                placeholder="Ontology Name"
                                value={graphImportName}
                                onChange={(e) => setGraphImportName(e.target.value)}
                                className="bg-gray-800 border-gray-700"
                              />
                            </div>
                            
                            <Input
                              placeholder="Domain (optional)"
                              value={graphImportDomain}
                              onChange={(e) => setGraphImportDomain(e.target.value)}
                              className="bg-gray-800 border-gray-700"
                            />
                            
                            <Button
                              onClick={handleGraphConversion}
                              disabled={isConvertingGraph || !selectedGraphId || !graphImportName}
                              className="w-full"
                            >
                              {isConvertingGraph ? (
                                <>
                                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                  Converting...
                                </>
                              ) : (
                                <>
                                  <Network className="mr-2 h-4 w-4" />
                                  Convert to Ontology
                                </>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    
                    {/* Row 3: Existing Ontologies List */}
                    <div className="grid grid-cols-1 gap-4">
                      <Card className="border-gray-800 bg-gray-900/30">
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-center">
                            <CardTitle className="text-md flex items-center">
                              <BookOpen className="w-4 h-4 mr-2 text-amber-400" /> Existing Ontologies
                            </CardTitle>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                queryClient.invalidateQueries({ queryKey: ['/api/ontologies'] });
                                toast({
                                  title: "Refreshing",
                                  description: "Refreshing ontology list...",
                                  duration: 2000
                                });
                              }}
                              className="h-8 px-2"
                              disabled={isLoadingOntologies}
                            >
                              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingOntologies ? 'animate-spin' : ''}`} />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          {isLoadingOntologies ? (
                            <div className="py-8 text-center">
                              <RefreshCw className="h-8 w-8 mx-auto animate-spin text-primary/50" />
                              <p className="mt-2 text-sm text-gray-400">Loading ontologies...</p>
                            </div>
                          ) : ontologies.length > 0 ? (
                            <div className="border-t border-gray-800">
                              <Table>
                                <div className="flex justify-between items-center mb-2">
                                  <div className="flex items-center space-x-2">
                                    <Checkbox 
                                      checked={isAllSelected}
                                      onCheckedChange={toggleSelectAll}
                                      id="select-all"
                                    />
                                    <Label htmlFor="select-all" className="text-xs cursor-pointer select-none">
                                      {isAllSelected ? "Deselect All" : "Select All"}
                                    </Label>
                                  </div>
                                  
                                  {selectedOntologies.length > 0 && (
                                    <div className="flex items-center space-x-2">
                                      <span className="text-sm text-gray-400">{selectedOntologies.length} selected</span>
                                      <Button 
                                        size="sm" 
                                        variant="destructive"
                                        className="h-8"
                                        onClick={bulkDeleteOntologies}
                                      >
                                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete Selected
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                
                                <TableHeader>
                                  <TableRow className="hover:bg-transparent border-b border-gray-800">
                                    <TableHead className="w-10"></TableHead>
                                    <TableHead className="w-[250px]">Name</TableHead>
                                    <TableHead>Domain</TableHead>
                                    <TableHead className="text-center">Entities</TableHead>
                                    <TableHead className="text-center">Relations</TableHead>
                                    <TableHead className="text-center">Last Updated</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {ontologies.map((ontology: Ontology) => (
                                    <TableRow key={ontology.id} className="hover:bg-gray-800/50 border-b border-gray-800">
                                      <TableCell className="py-2">
                                        <Checkbox 
                                          checked={selectedOntologies.includes(ontology.id)}
                                          onCheckedChange={() => toggleOntologySelection(ontology.id)}
                                        />
                                      </TableCell>
                                      <TableCell className="font-medium">{ontology.name}</TableCell>
                                      <TableCell>{ontology.domain || "-"}</TableCell>
                                      <TableCell className="text-center">{ontology.entities.length}</TableCell>
                                      <TableCell className="text-center">{ontology.relations.length}</TableCell>
                                      <TableCell className="text-center">
                                        {new Date(ontology.updatedAt).toLocaleDateString()}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  onClick={() => loadOntology(ontology.id)}
                                                  className="h-8 w-8"
                                                >
                                                  <Edit className="h-3.5 w-3.5" />
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>Edit Ontology</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                          
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  onClick={() => openRenameDialog(ontology)}
                                                  className="h-8 w-8"
                                                >
                                                  <FileText className="h-3.5 w-3.5" />
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>Rename</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                          
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  onClick={() => handleDuplicateOntology(ontology.id)}
                                                  className="h-8 w-8"
                                                >
                                                  <Copy className="h-3.5 w-3.5" />
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>Duplicate</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                          
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  onClick={() => handleExportOntology(ontology.id)}
                                                  className="h-8 w-8"
                                                >
                                                  <Download className="h-3.5 w-3.5" />
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>Export</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                          
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  onClick={() => handleDeleteOntology(ontology.id)}
                                                  className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-950/20"
                                                >
                                                  <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>Delete Ontology</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          ) : (
                            <div className="py-8 text-center">
                              <BookOpen className="h-10 w-10 mx-auto text-gray-600 mb-2" />
                              <p className="text-sm text-gray-400">No ontologies found</p>
                              <p className="text-xs text-gray-500 mt-1">
                                Use the options above to create your first ontology
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="design">
                    {currentOntology ? designTabContent : (
                      <div className="py-12 text-center">
                        <Database className="h-12 w-12 mx-auto text-gray-600 mb-3" />
                        <h3 className="text-lg font-medium text-gray-300">No Ontology Selected</h3>
                        <p className="text-sm text-gray-400 mt-2 mb-4 max-w-md mx-auto">
                          Create a new ontology or select an existing one from the "Create" tab to start designing.
                        </p>
                        <Button
                          onClick={() => setActiveTab('create')}
                          variant="outline" 
                          className="bg-gray-800 border-gray-700 hover:bg-gray-700"
                        >
                          Go to Create Tab
                        </Button>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="visualize">
                    {currentOntology ? (
                      <div className="h-[calc(100vh-150px)] min-h-[700px]">
                        {VisualizationComponent}
                      </div>
                    ) : (
                      <div className="py-12 text-center">
                        <Network className="h-12 w-12 mx-auto text-gray-600 mb-3" />
                        <h3 className="text-lg font-medium text-gray-300">No Ontology to Visualize</h3>
                        <p className="text-sm text-gray-400 mt-2 mb-4 max-w-md mx-auto">
                          Create a new ontology or select an existing one to visualize its structure.
                        </p>
                        <Button
                          onClick={() => setActiveTab('create')}
                          variant="outline" 
                          className="bg-gray-800 border-gray-700 hover:bg-gray-700"
                        >
                          Go to Create Tab
                        </Button>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="enrich">
                    {currentOntology ? (
                      <div className="space-y-6">
                        <p className="text-sm text-gray-400 mb-6">
                          Enrich your ontology by incorporating external knowledge or analyzing with AI.
                        </p>
                        
                        <div className="flex space-x-4 mb-6">
                          <div className="flex items-center space-x-2">
                            <RadioGroup 
                              value={enrichmentType} 
                              onValueChange={(value) => {
                                // Clear any existing suggestions when switching modes
                                setEnrichmentSuggestions({entities: [], relations: [], properties: []});
                                setSelectedSuggestions({entities: [], relations: [], properties: []});
                                setEnrichmentType(value as 'ai' | 'schema');
                              }}
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="ai" id="ai-enrichment" />
                                <Label htmlFor="ai-enrichment" className="cursor-pointer">AI-Based Enrichment</Label>
                              </div>
                              <div className="flex items-center space-x-2 mt-2">
                                <RadioGroupItem value="schema" id="schema-enrichment" />
                                <Label htmlFor="schema-enrichment" className="cursor-pointer">Schema.org Integration</Label>
                              </div>
                            </RadioGroup>
                          </div>
                        </div>
                        
                        {enrichmentType === 'ai' ? (
                          <Card className="border-gray-800 bg-gray-900/30">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-md flex items-center">
                                <Sparkles className="w-4 h-4 mr-2 text-primary" /> AI Enrichment
                              </CardTitle>
                              <CardDescription>
                                Use AI to suggest additional entities, properties, and relationships
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-xs mb-2 block">Select Model</Label>
                                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                                    <SelectTrigger className="bg-gray-800 border-gray-700">
                                      <SelectValue placeholder="Select model" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-800 border-gray-700">
                                      <SelectItem value="openai" disabled={!openaiApiKey}>
                                        {openaiApiKey ? "OpenAI" : "OpenAI (API key needed)"}
                                      </SelectItem>
                                      <SelectItem value="mistral" disabled={!mistralApiKey}>
                                        {mistralApiKey ? "Mistral AI" : "Mistral AI (API key needed)"}
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                <div>
                                  <Label className="text-xs mb-2 block">Enrichment Focus</Label>
                                  <Select value={enrichmentFocus} onValueChange={(value) => setEnrichmentFocus(value as any)}>
                                    <SelectTrigger className="bg-gray-800 border-gray-700">
                                      <SelectValue placeholder="Select focus" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-800 border-gray-700">
                                      <SelectItem value="all">All (entities & relations)</SelectItem>
                                      <SelectItem value="entities">Entities only</SelectItem>
                                      <SelectItem value="relations">Relations only</SelectItem>
                                      <SelectItem value="properties">Properties only</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              
                              <Textarea
                                placeholder="Additional context or instructions for AI (optional)"
                                className="h-20 bg-gray-800 border-gray-700"
                                value={enrichmentInstructions}
                                onChange={(e) => setEnrichmentInstructions(e.target.value)}
                              />
                              
                              <Button 
                                className="w-full"
                                onClick={getEnrichmentSuggestions}
                                disabled={isAIEnriching || (!openaiApiKey && !mistralApiKey)}
                              >
                                {isAIEnriching ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Generating Suggestions...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Generate {selectedModel === 'openai' ? 'OpenAI' : 'Mistral AI'} Suggestions
                                  </>
                                )}
                              </Button>
                              
                              {isAIEnriching && (
                                <div className="mt-4 space-y-2">
                                  <div className="flex justify-between text-xs text-gray-400">
                                    <span>{aiEnrichmentStage}</span>
                                    <span>{Math.round(aiEnrichmentProgress)}%</span>
                                  </div>
                                  <Progress value={aiEnrichmentProgress} className="h-2" />
                                  <p className="text-xs text-gray-500 mt-1 italic text-center">
                                    Generating enrichment suggestions using {selectedModel === 'openai' ? 'OpenAI' : 'Mistral AI'}...
                                  </p>
                                </div>
                              )}
                              
                              {enrichmentType === 'ai' && (enrichmentSuggestions.entities.length > 0 || 
                               enrichmentSuggestions.relations.length > 0 || 
                               enrichmentSuggestions.properties.length > 0) ? (
                                <div className="mt-4 p-4 border border-gray-700 rounded-lg bg-gray-800/50">
                                  <h3 className="text-sm font-medium text-primary mb-3 flex items-center">
                                    <Lightbulb className="w-4 h-4 mr-2" />
                                    AI Suggestions ({selectedModel})
                                  </h3>
                                  
                                  {enrichmentSuggestions.entities.length > 0 && (
                                    <div className="mb-4">
                                      <h4 className="text-xs font-medium text-gray-300 mb-2">Suggested Entities:</h4>
                                      <div className="space-y-2">
                                        {enrichmentSuggestions.entities.map((entity, idx) => (
                                          <div key={idx} className="p-2 border border-gray-700 rounded-md bg-gray-800/80">
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="flex-1">
                                                <div>
                                                  <span className="text-sm font-medium">{entity.name}</span>
                                                  <span className="text-xs text-gray-400 ml-2">{entity.type}</span>
                                                </div>
                                              </div>
                                              <Switch
                                                id={`entity-switch-${idx}`}
                                                checked={selectedSuggestions.entities.includes(idx)}
                                                onCheckedChange={(checked) => {
                                                  setSelectedSuggestions(prev => {
                                                    const newEntities = checked 
                                                      ? [...prev.entities, idx]
                                                      : prev.entities.filter(i => i !== idx);
                                                    return { ...prev, entities: newEntities };
                                                  });
                                                }}
                                              />
                                              {/* Individual add button removed */}
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1">{entity.description}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {enrichmentSuggestions.relations.length > 0 && (
                                    <div className="mb-4">
                                      <h4 className="text-xs font-medium text-gray-300 mb-2">Suggested Relations:</h4>
                                      <div className="space-y-2">
                                        {enrichmentSuggestions.relations.map((relation, idx) => (
                                          <div key={idx} className="p-2 border border-gray-700 rounded-md bg-gray-800/80">
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="flex-1">
                                                <div>
                                                  <span className="text-sm font-medium">{relation.name}</span>
                                                  <div className="text-xs text-gray-400 flex items-center mt-1">
                                                    <span>{relation.source}</span>
                                                    <ArrowRight className="w-3 h-3 mx-1" />
                                                    <span>{relation.target}</span>
                                                  </div>
                                                </div>
                                              </div>
                                              <Switch
                                                id={`relation-switch-${idx}`}
                                                checked={selectedSuggestions.relations.includes(idx)}
                                                onCheckedChange={(checked) => {
                                                  setSelectedSuggestions(prev => {
                                                    const newRelations = checked 
                                                      ? [...prev.relations, idx]
                                                      : prev.relations.filter(i => i !== idx);
                                                    return { ...prev, relations: newRelations };
                                                  });
                                                }}
                                              />
                                              {/* Individual add button removed */}
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1">{relation.description}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {enrichmentSuggestions.properties.length > 0 && (
                                    <div>
                                      <h4 className="text-xs font-medium text-gray-300 mb-2">Suggested Properties:</h4>
                                      <div className="space-y-2">
                                        {enrichmentSuggestions.properties.map((prop, idx) => (
                                          <div key={idx} className="p-2 border border-gray-700 rounded-md bg-gray-800/80">
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="flex-1">
                                                <div>
                                                  <span className="text-sm font-medium">{prop.property.name}</span>
                                                  <span className="text-xs text-gray-400 ml-2">for {prop.entityName}</span>
                                                </div>
                                              </div>
                                              <Switch
                                                id={`property-switch-${idx}`}
                                                checked={selectedSuggestions.properties.includes(idx)}
                                                onCheckedChange={(checked) => {
                                                  setSelectedSuggestions(prev => {
                                                    const newProperties = checked 
                                                      ? [...prev.properties, idx]
                                                      : prev.properties.filter(i => i !== idx);
                                                    return { ...prev, properties: newProperties };
                                                  });
                                                }}
                                              />
                                              {/* Individual add button removed */}
                                            </div>
                                            <div className="text-xs mt-1">
                                              <span className="text-gray-300">Type: </span>
                                              <span className="text-gray-400">{prop.property.type}</span>
                                            </div>
                                            {prop.property.description && (
                                              <p className="text-xs text-gray-400 mt-1">{prop.property.description}</p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  <div className="mt-4 pt-3 border-t border-gray-700 flex justify-end">
                                    <Button 
                                      size="sm" 
                                      className="mr-2"
                                      variant="outline"
                                      onClick={() => addAllSuggestions()}
                                    >
                                      <Check className="w-3 h-3 mr-1" /> Add All
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      className="mr-2"
                                      variant="default"
                                      disabled={selectedSuggestions.entities.length === 0 && 
                                                selectedSuggestions.relations.length === 0 && 
                                                selectedSuggestions.properties.length === 0}
                                      onClick={() => addSelectedSuggestions()}
                                    >
                                      <Check className="w-3 h-3 mr-1" /> Add Selected
                                    </Button>
                                    <Button 
                                      size="sm"
                                      variant="outline"
                                      className="border-gray-700"
                                      onClick={() => clearSuggestions()}
                                    >
                                      <X className="w-3 h-3 mr-1" /> Clear
                                    </Button>
                                  </div>
                                </div>
                              ) : null}
                            </CardContent>
                          </Card>
                        ) : (
                          <Card className="border-gray-800 bg-gray-900/30">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-md flex items-center">
                                <Database className="w-4 h-4 mr-2 text-blue-400" /> Schema.org Integration
                              </CardTitle>
                              <CardDescription>
                                Map ontology concepts to standard Schema.org types
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-xs mb-2 block">Map To Schema Types</Label>
                                  <Select 
                                    defaultValue="suggested" 
                                    onValueChange={(value) => setSchemaMappingType(value as 'suggested' | 'manual' | 'all')}
                                    value={schemaMappingType}
                                  >
                                    <SelectTrigger className="bg-gray-800 border-gray-700">
                                      <SelectValue placeholder="Select mapping" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-800 border-gray-700">
                                      <SelectItem value="suggested">Suggested mappings</SelectItem>
                                      <SelectItem value="manual">Manual selection</SelectItem>
                                      <SelectItem value="all">All relevant types</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                <div>
                                  <Label className="text-xs mb-2 block">Integration Type</Label>
                                  <Select 
                                    defaultValue="extend" 
                                    onValueChange={(value) => setSchemaIntegrationType(value as 'extend' | 'replace' | 'annotate')}
                                    value={schemaIntegrationType}
                                  >
                                    <SelectTrigger className="bg-gray-800 border-gray-700">
                                      <SelectValue placeholder="Select integration" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-800 border-gray-700">
                                      <SelectItem value="extend">Extend ontology</SelectItem>
                                      <SelectItem value="replace">Replace matching entities</SelectItem>
                                      <SelectItem value="annotate">Add annotations only</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              
                              <Button 
                                className="w-full"
                                onClick={() => enrichOntology()}
                                disabled={isSchemaEnriching}
                              >
                                {isSchemaEnriching ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Generating Schema.org Mappings...
                                  </>
                                ) : (
                                  <>
                                    <Database className="mr-2 h-4 w-4" />
                                    Map to Schema.org
                                  </>
                                )}
                              </Button>
                              
                              {isSchemaEnriching && (
                                <div className="mt-4 space-y-2">
                                  <div className="flex justify-between text-xs text-gray-400">
                                    <span>{schemaEnrichmentStage}</span>
                                    <span>{Math.round(schemaEnrichmentProgress)}%</span>
                                  </div>
                                  <Progress value={schemaEnrichmentProgress} className="h-2" />
                                  <p className="text-xs text-gray-500 mt-1 italic text-center">
                                    Mapping to Schema.org using {schemaIntegrationType} mode...
                                  </p>
                                </div>
                              )}
                              
                              {enrichmentType === 'schema' && (enrichmentSuggestions.entities.length > 0 || 
                               enrichmentSuggestions.relations.length > 0 || 
                               enrichmentSuggestions.properties.length > 0) ? (
                                <div className="mt-4 p-4 border border-gray-700 rounded-lg bg-gray-800/50">
                                  <h3 className="text-sm font-medium text-primary mb-3 flex items-center">
                                    <Database className="w-4 h-4 mr-2" />
                                    Schema.org Suggestions ({schemaIntegrationType} mode)
                                  </h3>
                                  
                                  {enrichmentSuggestions.entities.length > 0 && (
                                    <div className="mb-4">
                                      <h4 className="text-xs font-medium text-gray-300 mb-2">Suggested Entities:</h4>
                                      <div className="space-y-2">
                                        {enrichmentSuggestions.entities.map((entity, idx) => (
                                          <div key={idx} className="p-2 border border-gray-700 rounded-md bg-gray-800/80">
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="flex-1">
                                                <div>
                                                  <span className="text-sm font-medium">{entity.name}</span>
                                                  <span className="text-xs text-gray-400 ml-2">{entity.type}</span>
                                                </div>
                                              </div>
                                              <Switch
                                                id={`entity-switch-${idx}`}
                                                checked={selectedSuggestions.entities.includes(idx)}
                                                onCheckedChange={(checked) => {
                                                  setSelectedSuggestions(prev => {
                                                    const newEntities = checked 
                                                      ? [...prev.entities, idx]
                                                      : prev.entities.filter(i => i !== idx);
                                                    return { ...prev, entities: newEntities };
                                                  });
                                                }}
                                              />
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1">{entity.description}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {enrichmentSuggestions.relations.length > 0 && (
                                    <div className="mb-4">
                                      <h4 className="text-xs font-medium text-gray-300 mb-2">Suggested Relations:</h4>
                                      <div className="space-y-2">
                                        {enrichmentSuggestions.relations.map((relation, idx) => (
                                          <div key={idx} className="p-2 border border-gray-700 rounded-md bg-gray-800/80">
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="flex-1">
                                                <div>
                                                  <span className="text-sm font-medium">{relation.name}</span>
                                                  <div className="text-xs text-gray-400 flex items-center mt-1">
                                                    <span>{relation.source}</span>
                                                    <ArrowRight className="w-3 h-3 mx-1" />
                                                    <span>{relation.target}</span>
                                                  </div>
                                                </div>
                                              </div>
                                              <Switch
                                                id={`relation-switch-${idx}`}
                                                checked={selectedSuggestions.relations.includes(idx)}
                                                onCheckedChange={(checked) => {
                                                  setSelectedSuggestions(prev => {
                                                    const newRelations = checked 
                                                      ? [...prev.relations, idx]
                                                      : prev.relations.filter(i => i !== idx);
                                                    return { ...prev, relations: newRelations };
                                                  });
                                                }}
                                              />
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1">{relation.description}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {enrichmentSuggestions.properties.length > 0 && (
                                    <div>
                                      <h4 className="text-xs font-medium text-gray-300 mb-2">Suggested Properties:</h4>
                                      <div className="space-y-2">
                                        {enrichmentSuggestions.properties.map((prop, idx) => (
                                          <div key={idx} className="p-2 border border-gray-700 rounded-md bg-gray-800/80">
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="flex-1">
                                                <div>
                                                  <span className="text-sm font-medium">{prop.property.name}</span>
                                                  <span className="text-xs text-gray-400 ml-2">for {prop.entityName}</span>
                                                </div>
                                              </div>
                                              <Switch
                                                id={`property-switch-${idx}`}
                                                checked={selectedSuggestions.properties.includes(idx)}
                                                onCheckedChange={(checked) => {
                                                  setSelectedSuggestions(prev => {
                                                    const newProperties = checked 
                                                      ? [...prev.properties, idx]
                                                      : prev.properties.filter(i => i !== idx);
                                                    return { ...prev, properties: newProperties };
                                                  });
                                                }}
                                              />
                                            </div>
                                            <div className="text-xs mt-1">
                                              <span className="text-gray-300">Type: </span>
                                              <span className="text-gray-400">{prop.property.type}</span>
                                            </div>
                                            {prop.property.description && (
                                              <p className="text-xs text-gray-400 mt-1">{prop.property.description}</p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  <div className="mt-4 pt-3 border-t border-gray-700 flex justify-end">
                                    <Button 
                                      size="sm" 
                                      className="mr-2"
                                      variant="outline"
                                      onClick={() => addAllSuggestions()}
                                    >
                                      <Check className="w-3 h-3 mr-1" /> Add All
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      className="mr-2"
                                      variant="default"
                                      disabled={selectedSuggestions.entities.length === 0 && 
                                                selectedSuggestions.relations.length === 0 && 
                                                selectedSuggestions.properties.length === 0}
                                      onClick={() => addSelectedSuggestions()}
                                    >
                                      <Check className="w-3 h-3 mr-1" /> Add Selected
                                    </Button>
                                    <Button 
                                      size="sm"
                                      variant="outline"
                                      className="border-gray-700"
                                      onClick={() => clearSuggestions()}
                                    >
                                      <X className="w-3 h-3 mr-1" /> Clear
                                    </Button>
                                  </div>
                                </div>
                              ) : null}
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    ) : (
                      <div className="py-12 text-center">
                        <Lightbulb className="h-12 w-12 mx-auto text-gray-600 mb-3" />
                        <h3 className="text-lg font-medium text-gray-300">No Ontology to Enrich</h3>
                        <p className="text-sm text-gray-400 mt-2 mb-4 max-w-md mx-auto">
                          Create a new ontology or select an existing one to enhance it with AI or external knowledge.
                        </p>
                        <Button
                          onClick={() => setActiveTab('create')}
                          variant="outline" 
                          className="bg-gray-800 border-gray-700 hover:bg-gray-700"
                        >
                          Go to Create Tab
                        </Button>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
            
          {/* Right Sidebar / Helper Panel */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="border-gray-800 bg-gray-900/50 overflow-hidden">
              <CardHeader className="pb-3 border-b border-gray-800">
                <CardTitle className="text-md">OntoMaker Guide</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <OntoMakerSteps />
                
                <Separator className="my-4 bg-gray-800" />
                
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-300">Resources</h4>
                  <div className="space-y-2 text-xs text-gray-400">
                    <div className="flex items-start gap-2">
                      <BookOpen className="h-3.5 w-3.5 mt-0.5 text-gray-500" />
                      <span>Ontology Design Best Practices</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <FileText className="h-3.5 w-3.5 mt-0.5 text-gray-500" />
                      <span>Documentation & Examples</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <HelpCircle className="h-3.5 w-3.5 mt-0.5 text-gray-500" />
                      <span>Troubleshooting Guide</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
          
        {/* Dialogs */}
        {entityDialog}
        {relationDialog}
        {versionDialog}
        {renameDialog}
        
        {/* Schema.org suggestions are now shown inline with AI suggestions */}
      </div>
    </PageLayout>
  );
}