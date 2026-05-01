import { useState, useRef, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  KnowledgeGraph,
  Node,
  Link as SchemaLink,
  EntitySchema,
} from "@shared/schema";
import Sidebar from "@/components/Sidebar";
import HelpModal from "@/components/HelpModal";
import LoadingOverlay from "@/components/LoadingOverlay";
import TextInputPanel from "@/components/TextInputPanel";
import { useSidebar } from "@/components/ui/sidebar";
import {
  DatabaseIcon,
  DownloadIcon,
  FileText,
  Upload,
  List,
  FileJson,
  Download,
  GitMerge,
  Sparkles,
  Brain,
  FileCode,
  Code
} from "lucide-react";
import AnimatedGradientBackground from "@/components/AnimatedGradientBackground";
import KnowledgeGraphExplorer from "@/components/KnowledgeGraphExplorer";
import { useLocation } from "wouter";

// Define the GraphRef interface for export functions
export interface GraphRef {
  highlightNode: (nodeId: number) => void;
  exportAsImage: () => void;
  exportAsJSON: () => void;
  exportAsRDF: () => void;
  exportAsCSV: () => void;
}

interface ModelOption {
  id: string;
  name: string;
  provider: string;
  description: string;
}

export default function Hybrid() {
  // Get app state context
  const { appState, updateHybridPage } = useAppState();
  
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
  
  // Initialize state from app state
  const [text, setText] = useState<string>(appState?.hybridPage?.text || "");
  const [knowledgeGraph, setKnowledgeGraph] = useState<KnowledgeGraph | null>(
    appState?.hybridPage?.knowledgeGraph || null
  );
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>(
    appState?.hybridPage?.selectedModel || "gpt-4o"
  );
  const [inputType, setInputType] = useState<'text' | 'document'>('text');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [ontologyFile, setOntologyFile] = useState<File | null>(null);
  const [ontologyFormat, setOntologyFormat] = useState<string>('rdf');
  const [ontologyInputType, setOntologyInputType] = useState<'file' | 'text'>('file');
  const [ontologyText, setOntologyText] = useState<string>('');
  const [hybridMode, setHybridMode] = useState<'strict' | 'enhance'>('strict');
  const [currentKeyModel, setCurrentKeyModel] = useState<ModelOption | null>(null);
  const [currentApiKey, setCurrentApiKey] = useState<string>('');
  const [isExportDialogOpen, setIsExportDialogOpen] = useState<boolean>(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState<boolean>(false);
  const [graphName, setGraphName] = useState<string>('');
  const [savedGraphs, setSavedGraphs] = useState<{id: number, name: string, entityCount: number, relationCount: number, createdAt: string}[]>([]);
  const { toast } = useToast();
  
  // Get sidebar context for layout
  const sidebar = useSidebar();
  const { state, isMobile, openMobile } = sidebar;
  
  // Get navigation hook for redirection
  const [_, setLocation] = useLocation();
  
  // Calculate sidebar width for proper spacing
  const sidebarWidth = (sidebar as any).width || (state === 'expanded' ? 256 : 80);
  const graphExplorerRef = useRef<GraphRef>(null);

  // Toggle help modal
  const toggleHelpModal = () => {
    setIsHelpModalOpen(!isHelpModalOpen);
  };

  // Model options
  const modelOptions: ModelOption[] = [
    {
      id: "gpt-4o",
      name: "GPT-4o",
      provider: "OpenAI",
      description: "Most capable model for complex reasoning"
    },
    {
      id: "mistral-large",
      name: "Mistral Large",
      provider: "Mistral AI", 
      description: "Powerful open-source model"
    }
  ];

  // Update app state when page state changes
  useEffect(() => {
    if (appState?.hybridPage) {
      updateHybridPage({
        text,
        knowledgeGraph,
        selectedModel,
        inputType,
        processingStage
      });
    }
  }, [text, knowledgeGraph, selectedModel, inputType, processingStage, updateHybridPage, appState?.hybridPage]);

  // Check API key availability on mount and model change
  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const provider = selectedModel === 'gpt-4o' ? 'openai' : 'mistral';
        const response = await fetch(`/api/api-keys/${provider}/active`);
        const result = await response.json();
        
        if (result.success && result.data) {
          setCurrentKeyModel(modelOptions.find(m => m.id === selectedModel) || null);
          setCurrentApiKey(result.data.key || '');
        } else {
          setCurrentKeyModel(null);
          setCurrentApiKey('');
        }
      } catch (error) {
        console.error('Error checking API key:', error);
        setCurrentKeyModel(null);
        setCurrentApiKey('');
      }
    };

    checkApiKey();
  }, [selectedModel]);

  // Clear text content and knowledge graph
  const clearText = () => {
    setText("");
    setSelectedFile(null);
    setKnowledgeGraph(null);
  };

  // Handle ontology file upload
  const handleOntologyUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: `Please upload a file smaller than 10MB. Current file size: ${(file.size / 1024 / 1024).toFixed(1)}MB`,
        variant: "destructive"
      });
      return;
    }
    
    // Check file format
    const fileExtension = file.name.toLowerCase().split('.').pop() || '';
    const supportedFormats = ['rdf', 'owl', 'rdfs', 'ttl', 'n3', 'jsonld', 'json'];
    
    if (!supportedFormats.includes(fileExtension)) {
      toast({
        title: "Unsupported Format",
        description: "Please upload an RDF, OWL, RDFS, TTL, N3, or JSON-LD file.",
        variant: "destructive"
      });
      return;
    }
    
    setOntologyFile(file);
    
    // Auto-detect format from file extension
    if (fileExtension === 'jsonld' || fileExtension === 'json') {
      setOntologyFormat('json-ld');
    } else {
      setOntologyFormat(fileExtension);
    }
    
    toast({
      title: "Ontology Uploaded",
      description: `Successfully uploaded ${file.name}`,
    });
  };

  // Generate knowledge graph with ontology constraint
  const generateGraph = async () => {
    if (!text.trim()) {
      toast({
        title: "No Content",
        description: "Please enter some text or upload a document to analyze.",
        variant: "destructive"
      });
      return;
    }

    if (ontologyInputType === 'file' && !ontologyFile) {
      toast({
        title: "No Ontology",
        description: "Please upload an ontology file to guide the knowledge graph generation.",
        variant: "destructive"
      });
      return;
    }

    if (ontologyInputType === 'text' && !ontologyText.trim()) {
      toast({
        title: "No Ontology",
        description: "Please paste your ontology schema to guide the knowledge graph generation.",
        variant: "destructive"
      });
      return;
    }

    if (!currentApiKey) {
      toast({
        title: "API Key Required",
        description: `Please configure a ${selectedModel === 'gpt-4o' ? 'OpenAI' : 'Mistral AI'} API key in Settings.`,
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setProcessingStage(hybridMode === 'strict' 
      ? "Analyzing text with strict ontology constraints..." 
      : "Generating enhanced knowledge graph...");

    try {
      // Build request body - send raw ontology text directly for text input
      const requestBody: any = {
        text: text,
        model: selectedModel,
        useOntologyConstraints: true,
        mode: hybridMode
      };

      if (ontologyInputType === 'file' && ontologyFile) {
        // Upload ontology file first
        setProcessingStage("Processing ontology file...");
        const ontologyFormData = new FormData();
        ontologyFormData.append('file', ontologyFile);
        ontologyFormData.append('format', ontologyFormat);

        const ontologyResponse = await fetch('/api/ontologies/upload', {
          method: 'POST',
          body: ontologyFormData
        });

        if (!ontologyResponse.ok) {
          throw new Error('Failed to upload ontology');
        }

        const ontologyResult = await ontologyResponse.json();
        requestBody.ontologyId = ontologyResult.data.id;
        setProcessingStage("Analyzing text with ontology constraints...");
      } else {
        // Send raw ontology text directly - no parsing needed
        requestBody.rawOntologyText = ontologyText;
      }

      const response = await fetch("/api/hybrid-process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to generate knowledge graph");
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        setKnowledgeGraph(result.data);
        setProcessingStage("");
        
        toast({
          title: "Knowledge Graph Generated",
          description: `Successfully created graph with ${result.data.nodes?.length || 0} entities and ${result.data.links?.length || 0} relationships.`,
        });
      } else {
        throw new Error(result.message || "Failed to generate knowledge graph");
      }
    } catch (error) {
      console.error("Error generating knowledge graph:", error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "An error occurred while generating the knowledge graph.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProcessingStage("");
    }
  };

  // Handle file upload from TextInputPanel
  const handleFileUpload = async () => {
    // File processing is handled by TextInputPanel
    return Promise.resolve();
  };

  // Export functions
  const exportAsJSON = () => {
    if (graphExplorerRef.current?.exportAsJSON) {
      setIsExportDialogOpen(false);
      graphExplorerRef.current.exportAsJSON();
      toast({
        title: "JSON Export",
        description: "Graph exported as JSON file.",
      });
    }
  };

  const exportAsCSV = () => {
    if (graphExplorerRef.current?.exportAsCSV) {
      setIsExportDialogOpen(false);
      graphExplorerRef.current.exportAsCSV();
      toast({
        title: "CSV Export",
        description: "Graph exported as CSV files.",
      });
    }
  };

  const exportAsRDF = () => {
    if (graphExplorerRef.current?.exportAsRDF) {
      setIsExportDialogOpen(false);
      graphExplorerRef.current.exportAsRDF();
      toast({
        title: "RDF Export",
        description: "Graph exported as RDF file.",
      });
    }
  };

  const exportAsImage = () => {
    if (graphExplorerRef.current?.exportAsImage) {
      setIsExportDialogOpen(false);
      graphExplorerRef.current.exportAsImage();
      toast({
        title: "Image Export",
        description: "Graph exported as PNG image.",
      });
    }
  };

  // Save graph function
  const saveGraph = async () => {
    if (!knowledgeGraph) {
      toast({
        title: "No Graph to Save",
        description: "Generate a knowledge graph first.",
        variant: "destructive"
      });
      return;
    }

    if (!graphName.trim()) {
      toast({
        title: "Graph Name Required",
        description: "Please enter a name for your graph.",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch('/api/graphs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: graphName,
          nodes: knowledgeGraph.nodes,
          links: knowledgeGraph.links,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save graph');
      }

      const result = await response.json();
      
      toast({
        title: "Graph Saved",
        description: `Successfully saved "${graphName}" to your collection.`,
      });

      setIsSaveDialogOpen(false);
      setGraphName('');
      
      // Redirect to Load page to view saved graph
      setLocation(`/load?graphId=${result.data.id}`);
    } catch (error) {
      console.error('Error saving graph:', error);
      toast({
        title: "Save Failed",
        description: "An error occurred while saving the graph.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <AnimatedGradientBackground>
        <div></div>
      </AnimatedGradientBackground>
      
      <div className="flex h-screen relative z-10">
        <Sidebar onToggleHelp={toggleHelpModal} active="/hybrid" />
        
        <div 
          className="flex-1 overflow-hidden transition-all duration-300 ease-in-out"
          style={{ marginLeft: `${sidebarWidth}px` }}
        >
          <main className="h-full p-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
              {/* Left Panel - Input and Controls */}
              <div className="lg:col-span-1 space-y-4 overflow-y-auto">
                {/* Header */}
                <Card className="bg-gray-900 border-gray-800 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-bold text-white flex items-center">
                      <GitMerge className="w-5 h-5 mr-2 text-orange-500" />
                      Hybrid Generation
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      Upload an ontology schema and generate conforming knowledge graphs from text
                    </CardDescription>
                  </CardHeader>
                </Card>

                {/* Ontology Upload */}
                <Card className="bg-gray-900 border-gray-800 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-bold text-white flex items-center">
                      <FileCode className="w-5 h-5 mr-2 text-blue-500" />
                      Ontology Schema
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      Provide your ontology to guide knowledge graph generation
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Input Type Toggle */}
                    <div className="flex rounded-lg bg-gray-800 p-1">
                      <button
                        onClick={() => setOntologyInputType('file')}
                        className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                          ontologyInputType === 'file'
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        <Upload className="w-4 h-4 inline mr-1" />
                        Upload File
                      </button>
                      <button
                        onClick={() => setOntologyInputType('text')}
                        className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                          ontologyInputType === 'text'
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        <FileText className="w-4 h-4 inline mr-1" />
                        Paste Text
                      </button>
                    </div>

                    <div>
                      <Label htmlFor="ontology-format" className="text-sm font-medium text-gray-300">
                        Format
                      </Label>
                      <Select value={ontologyFormat} onValueChange={setOntologyFormat}>
                        <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                          <SelectValue placeholder="Select format" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          <SelectItem value="rdf">RDF/XML</SelectItem>
                          <SelectItem value="owl">OWL</SelectItem>
                          <SelectItem value="rdfs">RDFS</SelectItem>
                          <SelectItem value="ttl">Turtle (TTL)</SelectItem>
                          <SelectItem value="n3">N3</SelectItem>
                          <SelectItem value="json-ld">JSON-LD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {ontologyInputType === 'file' ? (
                      <div>
                        <Label htmlFor="ontology-upload" className="text-sm font-medium text-gray-300 mb-2 block">
                          Upload Ontology File
                        </Label>
                        <div className="border-2 border-dashed border-gray-700 rounded-lg p-4 text-center hover:border-gray-600 transition-colors">
                          <input
                            id="ontology-upload"
                            type="file"
                            accept=".rdf,.owl,.rdfs,.ttl,.n3,.jsonld,.json"
                            onChange={handleOntologyUpload}
                            className="hidden"
                          />
                          <label
                            htmlFor="ontology-upload"
                            className="cursor-pointer flex flex-col items-center"
                          >
                            <Code className="w-8 h-8 text-gray-500 mb-2" />
                            {ontologyFile ? (
                              <div>
                                <p className="text-sm text-green-400 font-medium">{ontologyFile.name}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {(ontologyFile.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            ) : (
                              <div>
                                <p className="text-sm text-gray-400">Click to upload ontology</p>
                                <p className="text-xs text-gray-500 mt-1">RDF, OWL, RDFS, TTL, N3, JSON-LD (max. 10MB)</p>
                              </div>
                            )}
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Label htmlFor="ontology-text" className="text-sm font-medium text-gray-300 mb-2 block">
                          Paste Ontology Schema
                        </Label>
                        <Textarea
                          id="ontology-text"
                          value={ontologyText}
                          onChange={(e) => setOntologyText(e.target.value)}
                          placeholder="Paste your ontology schema here..."
                          className="bg-gray-800 border-gray-700 text-white min-h-[150px] font-mono text-sm placeholder:text-gray-500 placeholder:select-all"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {ontologyText ? (
                            <span className="text-green-400">{ontologyText.length} characters</span>
                          ) : (
                            "Supports RDF/XML, OWL, RDFS, Turtle, N3, JSON-LD formats"
                          )}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Generation Mode */}
                <Card className="bg-gray-900 border-gray-800 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-bold text-white flex items-center">
                      <GitMerge className="w-5 h-5 mr-2 text-cyan-500" />
                      Generation Mode
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex bg-gray-800 rounded-lg p-1">
                      <button
                        onClick={() => setHybridMode('strict')}
                        className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                          hybridMode === 'strict'
                            ? 'bg-purple-600 text-white'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Strict
                      </button>
                      <button
                        onClick={() => setHybridMode('enhance')}
                        className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                          hybridMode === 'enhance'
                            ? 'bg-cyan-600 text-white'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Enhance
                      </button>
                    </div>
                    <p className="text-xs text-gray-400">
                      {hybridMode === 'strict' 
                        ? "Strictly follows ontology schema - only extracts entities and relationships defined in the ontology."
                        : "Combines free-form extraction with ontology guidance - generates richer graphs by merging unconstrained and ontology-guided results."}
                    </p>
                  </CardContent>
                </Card>

                {/* Model Selection */}
                <Card className="bg-gray-900 border-gray-800 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-bold text-white flex items-center">
                      <Brain className="w-5 h-5 mr-2 text-purple-500" />
                      AI Model
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                        <SelectValue placeholder="Select AI model" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        {modelOptions.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            <div className="flex flex-col text-left">
                              <span className="font-medium">{model.name}</span>
                              <span className="text-xs text-gray-400">{model.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {currentKeyModel && (
                      <div className="mt-2 p-2 bg-green-900/20 border border-green-800 rounded text-xs text-green-400">
                        ✓ {currentKeyModel.provider} API key configured
                      </div>
                    )}
                    
                    {!currentKeyModel && (
                      <div className="mt-2 p-2 bg-red-900/20 border border-red-800 rounded text-xs text-red-400">
                        ⚠ No API key found for {modelOptions.find(m => m.id === selectedModel)?.provider}
                      </div>
                    )}
                  </CardContent>
                </Card>


              </div>

              {/* Middle Panel - Text Input */}
              <div className="lg:col-span-1 h-full">
                <div className="h-full">
                  <TextInputPanel
                    text={text}
                    onTextChange={setText}
                    knowledgeGraph={knowledgeGraph}
                    onGenerateGraph={generateGraph}
                    onFileUpload={handleFileUpload}
                    inputType={inputType}
                    setInputType={setInputType}
                    selectedFile={selectedFile}
                    setSelectedFile={setSelectedFile}
                    onClearText={clearText}
                    isHybridMode={true}
                  />
                </div>
              </div>

              {/* Right Panel - Graph Visualization */}
              <div className="lg:col-span-1 h-full">
                <Card className="bg-gray-900 border-gray-800 shadow-lg h-full flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-bold text-white flex items-center">
                      <FileText className="w-5 h-5 mr-2 text-primary" />
                      Knowledge Graph
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      {knowledgeGraph ? (
                        <span>
                          {knowledgeGraph.nodes?.length || 0} entities and{" "}
                          {knowledgeGraph.links?.length || 0} relationships
                        </span>
                      ) : (
                        <span>
                          Your ontology-guided knowledge graph will appear here
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow overflow-hidden p-4">
                    {knowledgeGraph ? (
                      <KnowledgeGraphExplorer
                        knowledgeGraph={knowledgeGraph}
                        ref={graphExplorerRef}
                        hideControls={false}
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <div className="text-center">
                          <GitMerge className="h-16 w-16 mx-auto text-gray-700 mb-4" />
                          <h3 className="text-lg font-medium text-gray-400 mb-2">
                            Upload Ontology & Enter Text
                          </h3>
                          <p className="text-sm text-gray-500 max-w-sm">
                            Upload an ontology schema and provide text content to generate a 
                            knowledge graph that conforms to your specified structure.
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
                <FileText className="h-12 w-12 mx-auto text-primary" />
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

      {/* Save Dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Save Knowledge Graph</DialogTitle>
            <DialogDescription>
              Give your knowledge graph a name to save it to your collection.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label htmlFor="graph-name" className="text-sm font-medium text-gray-300">
              Graph Name
            </Label>
            <Input
              id="graph-name"
              value={graphName}
              onChange={(e) => setGraphName(e.target.value)}
              placeholder="Enter graph name..."
              className="mt-1 bg-gray-800 border-gray-700 text-white"
            />
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={saveGraph}
              disabled={!graphName.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              Save Graph
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Use the enhanced LoadingOverlay component for processing */}
      {isProcessing && (
        <LoadingOverlay
          stage={processingStage || `Generating hybrid knowledge graph...`}
          modelName={modelOptions.find(m => m.id === selectedModel)?.name || selectedModel}
        />
      )}

      {isHelpModalOpen && <HelpModal onClose={toggleHelpModal} />}
    </div>
  );
}