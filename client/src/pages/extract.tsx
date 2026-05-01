import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAppState } from '@/contexts/AppStateContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation } from '@tanstack/react-query';
import PageLayout from '@/components/PageLayout';
import { FileUpload } from '@/components/FileUpload';
import { 
  Globe, 
  FileSpreadsheet, 
  FileText, 
  FileCode, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Link as LinkIcon,
  Database 
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useLocation } from 'wouter';

/**
 * Get a placeholder URL for the input field based on the selected source type
 */
const getPlaceholderUrl = (sourceType: string): string => {
  switch (sourceType) {
    case 'wikidata':
      return 'https://www.wikidata.org/wiki/Q7251';
    case 'dbpedia':
      return 'https://dbpedia.org/page/Albert_Einstein';
    case 'schema':
      return 'https://schema.org/docs/full.html';
    case 'wikipedia':
      return 'https://en.wikipedia.org/wiki/Knowledge_graph';
    case 'general':
      return 'https://www.example.com/article';
    default:
      return 'https://www.wikidata.org/wiki/Q7251';
  }
};

/**
 * Get example text with relevant URLs for the selected source type
 */
const getUrlExampleText = (sourceType: string): JSX.Element => {
  switch (sourceType) {
    case 'wikidata':
      return (
        <span>
          Enter a Wikidata URL. Try examples like:{' '}
          <span className="text-gray-500">
            https://www.wikidata.org/wiki/Q7251 (Alan Turing), 
            https://www.wikidata.org/wiki/Q42 (Douglas Adams)
          </span>
        </span>
      );
    case 'dbpedia':
      return (
        <span>
          Enter a DBpedia URL. Try examples like:{' '}
          <span className="text-gray-500">
            https://dbpedia.org/page/Albert_Einstein,
            https://dbpedia.org/page/Marie_Curie
          </span>
        </span>
      );
    case 'schema':
      return (
        <span>
          Enter a URL with Schema.org markup. Try examples like:{' '}
          <span className="text-gray-500">
            https://schema.org/docs/full.html,
            https://schema.org/Person
          </span>
        </span>
      );
    case 'wikipedia':
      return (
        <span>
          Enter a Wikipedia article URL. Try examples like:{' '}
          <span className="text-gray-500">
            https://en.wikipedia.org/wiki/Knowledge_graph,
            https://en.wikipedia.org/wiki/Artificial_intelligence
          </span>
        </span>
      );
    case 'general':
      return (
        <span>
          Enter any website URL to extract content using AI. Try examples like:{' '}
          <span className="text-gray-500">
            https://en.wikipedia.org/wiki/Machine_learning,
            https://techcrunch.com/category/artificial-intelligence/
          </span>
        </span>
      );
    default:
      return <span>Enter the URL of the web page you want to extract knowledge from</span>;
  }
};

interface ExtractionSource {
  type: 'web' | 'csv' | 'txt' | 'rdf';
  url?: string;
  file?: File;
  sourceSystem?: string;
  model?: 'openai' | 'mistral';
  apiKey?: string;
}

interface ExtractionStats {
  entityCount: number;
  relationCount: number;
  sourceType: string;
  processingTime: number;
  sourceName: string;
  topEntities: Array<{name: string; count: number}>;
  topRelations: Array<{name: string; count: number}>;
}

const Extract = () => {
  // Get app state context
  const { appState, updateExtractPage } = useAppState();
  
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // Initialize from app state
  const [activeTab, setActiveTab] = useState('web');
  const [extractionSource, setExtractionSource] = useState<ExtractionSource>({
    type: 'web'
  });
  const [webSource, setWebSource] = useState(appState.extractPage?.selectedSource || "general");
  const [webUrl, setWebUrl] = useState(appState.extractPage?.url || "");
  const [isExtracting, setIsExtracting] = useState(appState.extractPage?.isExtracting || false);
  const [progress, setProgress] = useState(0);
  const [extractionStats, setExtractionStats] = useState<ExtractionStats | null>(null);
  const [extractedGraphId, setExtractedGraphId] = useState<number | null>(null);
  
  // API key management
  const [openaiApiKey, setOpenaiApiKey] = useState<string>('');
  const [mistralApiKey, setMistralApiKey] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<'openai' | 'mistral'>('openai');
  const [savedOpenaiApiKey, setSavedOpenaiApiKey] = useState<string | null>(null);
  const [savedMistralApiKey, setSavedMistralApiKey] = useState<string | null>(null);
  
  // Update app state when values change
  useEffect(() => {
    // Check if values have actually changed before updating
    const hasUrlChanged = appState.extractPage.url !== webUrl;
    const hasSourceChanged = appState.extractPage.selectedSource !== webSource;
    const hasExtractingStatusChanged = appState.extractPage.isExtracting !== isExtracting;
    
    if (hasUrlChanged || hasSourceChanged || hasExtractingStatusChanged) {
      updateExtractPage({
        url: webUrl,
        selectedSource: webSource,
        extractedGraph: null, // We'll update this when we have a graph
        isExtracting: isExtracting
      });
    }
  }, [webUrl, webSource, isExtracting, updateExtractPage, appState.extractPage]);

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
            description: "Please add API keys in the Settings page to use extraction features.",
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

  const extractMutation = useMutation({
    mutationFn: async (source: ExtractionSource) => {
      setIsExtracting(true);
      setProgress(0);
      
      // Simulate progress updates (this would be replaced with actual socket-based progress)
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + Math.random() * 10;
          return newProgress > 95 ? 95 : newProgress;
        });
      }, 500);

      try {
        let response;
        const formData = new FormData();
        
        if (source.type === 'web') {
          const rawResponse = await apiRequest('POST', '/api/extract/web', {
            url: source.url,
            sourceSystem: source.sourceSystem,
            model: source.model // Include model parameter
          });
          // Parse the JSON response
          response = await rawResponse.json();
          console.log("Web extraction raw response:", response);
        } else {
          if (source.file) {
            formData.append('file', source.file);
            formData.append('fileType', source.type); // Changed 'type' to 'fileType' to match server expectation
            
            response = await fetch('/api/extract/file', {
              method: 'POST',
              body: formData
            });
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            response = await response.json();
            console.log("File extraction raw response:", response);
          } else {
            throw new Error('No file selected for extraction.');
          }
        }
        
        // Clear the progress interval and set to 100%
        clearInterval(progressInterval);
        setProgress(100);
        
        return response;
      } catch (error) {
        clearInterval(progressInterval);
        console.error('Extraction error:', error);
        throw error;
      } finally {
        // Ensure we clear the interval if there's an error
        setTimeout(() => {
          setIsExtracting(false);
        }, 1000);
      }
    },
    onSuccess: (response) => {
      // Log full response for debugging
      console.log("Full extraction response:", response);
      
      if (!response || !response.success || !response.data) {
        console.error("Extraction returned invalid response:", response);
        toast({
          title: "Extraction Failed",
          description: "The server returned an invalid response",
          variant: "destructive",
        });
        return;
      }
      
      console.log("Extraction response data:", response.data);
      
      // Process the stats from the response
      const stats = response.data.stats;
      if (stats) {
        console.log("Setting extraction stats:", stats);
        setExtractionStats(stats);
        
        toast({
          title: "Extraction Complete",
          description: `Successfully extracted knowledge graph with ${stats.entityCount} entities and ${stats.relationCount} relations.`,
        });
      } else {
        console.error("No stats found in extraction response");
      }
      
      // Process the graph ID from the response
      let graphId = null;
      
      // Try different locations in the response to find the graph ID
      if (response.data.graphId && typeof response.data.graphId === 'number') {
        graphId = response.data.graphId;
        console.log("Found graph ID in response.data.graphId:", graphId);
      } else if (response.data.graph && response.data.graph.id && typeof response.data.graph.id === 'number') {
        graphId = response.data.graph.id;
        console.log("Found graph ID in response.data.graph.id:", graphId);
      } else if (response.data.id && typeof response.data.id === 'number') {
        // Direct ID property
        graphId = response.data.id;
        console.log("Found graph ID in response.data.id:", graphId);
      } else {
        // Log the structure of response.data to help diagnose
        console.log("Could not find graph ID in expected locations. Data structure:", 
          Object.keys(response.data).map(key => `${key}: ${typeof response.data[key]}`));
        
        // If response.data is an object with a single property that has an id
        if (typeof response.data === 'object' && response.data !== null) {
          const possibleObjectWithId = Object.values(response.data).find(
            val => val && typeof val === 'object' && val !== null && 'id' in val && typeof (val as any).id === 'number'
          );
          
          if (possibleObjectWithId && typeof possibleObjectWithId === 'object' && possibleObjectWithId !== null && 'id' in possibleObjectWithId) {
            graphId = (possibleObjectWithId as any).id;
            console.log("Found graph ID in nested object:", graphId);
          }
        }
      }
      
      if (graphId) {
        console.log("Setting extracted graph ID:", graphId);
        setExtractedGraphId(graphId);
        
        // If we have a graph in the response, update the app state
        if (response.data.graph) {
          // Update app state with the extracted graph
          updateExtractPage({
            extractedGraph: response.data.graph,
            isExtracting: false
          });
        }
      } else {
        console.warn("No graph ID found in extraction response");
      }
    },
    onError: (error) => {
      toast({
        title: "Extraction Failed",
        description: error instanceof Error ? error.message : "Failed to extract knowledge graph",
        variant: "destructive",
      });
      setProgress(0);
    }
  });

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setExtractionSource({
      type: value as 'web' | 'csv' | 'txt' | 'rdf'
    });
    setExtractionStats(null);
    setExtractedGraphId(null);
    setProgress(0);
  };

  const handleExtract = () => {
    if (activeTab === 'web' && !webUrl) {
      toast({
        title: "Error",
        description: "Please enter a URL to extract from",
        variant: "destructive",
      });
      return;
    }

    if (activeTab !== 'web' && !extractionSource.file) {
      toast({
        title: "Error",
        description: "Please select a file to extract from",
        variant: "destructive",
      });
      return;
    }
    
    // Check if the selected model has a valid API key
    if (activeTab === 'web') {
      if (selectedModel === 'openai' && !savedOpenaiApiKey) {
        toast({
          title: "No OpenAI API key",
          description: "Please add an OpenAI API key in the Settings page or select a different model.",
          variant: "destructive",
        });
        return;
      }
      
      if (selectedModel === 'mistral' && !savedMistralApiKey) {
        toast({
          title: "No Mistral API key",
          description: "Please add a Mistral API key in the Settings page or select a different model.",
          variant: "destructive",
        });
        return;
      }
    }

    const source: ExtractionSource = {
      type: activeTab as 'web' | 'csv' | 'txt' | 'rdf',
    };

    if (activeTab === 'web') {
      source.url = webUrl;
      source.sourceSystem = webSource;
      
      // Always include model selection for all web extractions
      source.model = selectedModel;
      console.log(`Using model: ${selectedModel} for extraction`);
    } else {
      // For file extractions, use the file from extractionSource
      source.file = extractionSource.file;
    }

    console.log("Extracting with source:", source);
    extractMutation.mutate(source);
  };

  const handleFileSelected = (file: File | null) => {
    if (file) {
      setExtractionSource({
        ...extractionSource,
        file
      });
    }
  };

  const viewExtractedGraph = () => {
    // Navigate to load page and display the newly created graph
    if (extractedGraphId) {
      // Redirect to the load page with the graph ID as a query parameter
      setLocation(`/load?graphId=${extractedGraphId}`);
    } else {
      // Fallback to the load page without a specific graph
      setLocation('/load');
    }
  };

  return (
    <PageLayout title="Extract Knowledge Graph">
      <div className="min-h-screen flex flex-col bg-gray-950">
        <div className="flex-grow container mx-auto px-4 py-6 text-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Extraction Options Panel */}
            <div className="md:col-span-2">
              <Card className="bg-gray-900 border-gray-800 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Database className="mr-2 h-5 w-5" />
                    Extract Knowledge Graph
                  </CardTitle>
                  <CardDescription>
                    Extract entities and relationships from web pages, CSV files, text files, or RDF data
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
                    <TabsList className="grid grid-cols-4 mb-4">
                      <TabsTrigger value="web" className="flex items-center justify-center">
                        <Globe className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Web</span>
                      </TabsTrigger>
                      <TabsTrigger value="csv" className="flex items-center justify-center">
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">CSV/Excel</span>
                      </TabsTrigger>
                      <TabsTrigger value="txt" className="flex items-center justify-center">
                        <FileText className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Text File</span>
                      </TabsTrigger>
                      <TabsTrigger value="rdf" className="flex items-center justify-center">
                        <FileCode className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">RDF</span>
                      </TabsTrigger>
                    </TabsList>

                    {/* Web Extraction */}
                    <TabsContent value="web" className="space-y-4">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="source-system">Data Source</Label>
                          <Select 
                            value={webSource} 
                            onValueChange={setWebSource}
                          >
                            <SelectTrigger className="bg-gray-800 border-gray-700">
                              <SelectValue placeholder="Select data source" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700">
                              <SelectItem value="wikidata">Wikidata</SelectItem>
                              <SelectItem value="dbpedia">DBpedia</SelectItem>
                              <SelectItem value="schema">Schema.org</SelectItem>
                              <SelectItem value="wikipedia">Wikipedia</SelectItem>
                              <SelectItem value="general">General Website</SelectItem>
                            </SelectContent>
                          </Select>
                          {webSource === 'general' && (
                            <>
                              <div className="mt-2 p-3 bg-amber-900/30 border border-amber-800/50 rounded-md text-amber-200 text-sm">
                                <AlertCircle className="inline-block mr-2 h-4 w-4" />
                                This extraction uses AI models and will consume API tokens.
                              </div>
                              
                              <div className="mt-4">
                                <Label htmlFor="model-selection">AI Model</Label>
                                <Select 
                                  value={selectedModel} 
                                  onValueChange={(value: 'openai' | 'mistral') => setSelectedModel(value)}
                                >
                                  <SelectTrigger className="bg-gray-800 border-gray-700 mt-1">
                                    <SelectValue placeholder="Select AI model" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-gray-800 border-gray-700">
                                    <SelectItem value="openai">OpenAI GPT-4o</SelectItem>
                                    <SelectItem value="mistral">Mistral AI</SelectItem>
                                  </SelectContent>
                                </Select>
                                
                                <div className="mt-2 text-xs text-gray-400">
                                  {selectedModel === 'openai' ? 
                                    (savedOpenaiApiKey ? 
                                      "Using saved OpenAI API key" : 
                                      "No OpenAI API key found. Please add one in settings.") : 
                                    (savedMistralApiKey ? 
                                      "Using saved Mistral AI key" : 
                                      "No Mistral API key found. Please add one in settings.")}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="web-url">Website URL</Label>
                          <div className="flex space-x-2">
                            <div className="relative flex-grow">
                              <Input
                                id="web-url"
                                type="url"
                                placeholder={getPlaceholderUrl(webSource)}
                                value={webUrl}
                                onChange={(e) => setWebUrl(e.target.value)}
                                onFocus={(e) => e.target.placeholder = ""}
                                onBlur={(e) => e.target.placeholder = getPlaceholderUrl(webSource)}
                                className="bg-gray-800 border-gray-700 pr-10 placeholder:text-gray-500"
                              />
                              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                <LinkIcon className="h-4 w-4 text-gray-400" />
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-gray-400">
                            {getUrlExampleText(webSource)}
                          </p>
                        </div>
                      </div>
                    </TabsContent>

                    {/* CSV/Excel Extraction */}
                    <TabsContent value="csv" className="space-y-4">
                      <div className="space-y-4">
                        <div className="rounded-md border-2 border-dashed border-gray-700 p-6 text-center">
                          <FileUpload 
                            accept=".csv,.xlsx,.xls" 
                            maxSize={10} 
                            onFileSelected={handleFileSelected}
                            icon={<FileSpreadsheet className="mx-auto h-10 w-10 text-gray-400" />}
                            label="Upload CSV or Excel file"
                            description="Drag and drop a CSV or Excel file, or click to browse"
                          />
                        </div>
                        <p className="text-xs text-gray-400">
                          The file should contain structured data with relationships between entities.
                          Maximum file size: 10MB
                        </p>
                      </div>
                    </TabsContent>

                    {/* Text File Extraction */}
                    <TabsContent value="txt" className="space-y-4">
                      <div className="space-y-4">
                        <div className="rounded-md border-2 border-dashed border-gray-700 p-6 text-center">
                          <FileUpload 
                            accept=".txt,.md,.doc,.docx" 
                            maxSize={10} 
                            onFileSelected={handleFileSelected}
                            icon={<FileText className="mx-auto h-10 w-10 text-gray-400" />}
                            label="Upload Text file"
                            description="Drag and drop a text file, or click to browse"
                          />
                        </div>
                        <p className="text-xs text-gray-400">
                          Upload any text document. The system will analyze the text to extract entities and relationships.
                          Maximum file size: 10MB
                        </p>
                      </div>
                    </TabsContent>

                    {/* RDF Extraction */}
                    <TabsContent value="rdf" className="space-y-4">
                      <div className="space-y-4">
                        <div className="rounded-md border-2 border-dashed border-gray-700 p-6 text-center">
                          <FileUpload 
                            accept=".rdf,.owl,.ttl,.n3,.jsonld" 
                            maxSize={10} 
                            onFileSelected={handleFileSelected}
                            icon={<FileCode className="mx-auto h-10 w-10 text-gray-400" />}
                            label="Upload RDF file"
                            description="Drag and drop an RDF file, or click to browse"
                          />
                        </div>
                        <p className="text-xs text-gray-400">
                          Upload RDF, OWL, Turtle, N3, or JSON-LD files to import knowledge graphs directly.
                          Maximum file size: 10MB
                        </p>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
                <CardFooter className="flex justify-between pt-4">
                  {isExtracting ? (
                    <div className="w-full space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Extracting knowledge graph...</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  ) : (
                    <Button 
                      onClick={handleExtract} 
                      className="w-full"
                      disabled={
                        (activeTab === 'web' && !webUrl) || 
                        ((activeTab === 'csv' || activeTab === 'txt' || activeTab === 'rdf') && !extractionSource.file)
                      }
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Extract Knowledge Graph
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </div>

            {/* Extraction Results Panel */}
            <div className="md:col-span-1">
              <Card className="bg-gray-900 border-gray-800 shadow-lg h-full">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    Extraction Report
                  </CardTitle>
                  <CardDescription>
                    View details about the extracted knowledge graph
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {extractionStats ? (
                    <div className="space-y-4">
                      <div className="rounded-md bg-gray-800 p-4">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <p className="text-xs text-gray-400">Source</p>
                            <p className="font-medium truncate" title={extractionStats.sourceName || 'N/A'}>
                              {extractionStats.sourceName || 'N/A'}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-gray-400">Type</p>
                            <p className="font-medium">{extractionStats.sourceType || 'N/A'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-gray-400">Entities</p>
                            <p className="font-medium">{extractionStats.entityCount || 0}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-gray-400">Relations</p>
                            <p className="font-medium">{extractionStats.relationCount || 0}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-gray-400">Processing Time</p>
                            <p className="font-medium">{extractionStats.processingTime ? extractionStats.processingTime.toFixed(2) : '0.00'}s</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Debug info for extraction */}
                      <div className="text-xs bg-gray-800 p-2 rounded-md mb-2 text-amber-500">
                        <div>Stats found: {extractionStats ? 'Yes' : 'No'}</div>
                        <div>Graph ID: {extractedGraphId ? extractedGraphId : 'Not found'}</div>
                        <div>Entity count: {extractionStats?.entityCount || 0}</div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Top Entities</h4>
                        <div className="space-y-1">
                          {extractionStats.topEntities && extractionStats.topEntities.length > 0 ? (
                            extractionStats.topEntities.map((entity, index) => (
                              <div key={index} className="flex justify-between text-sm">
                                <span className="truncate max-w-[70%]" title={entity.name}>
                                  {entity.name}
                                </span>
                                <span className="text-gray-400">{entity.count}</span>
                              </div>
                            ))
                          ) : (
                            <div className="text-gray-400 text-sm">No entities found</div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Top Relations</h4>
                        <div className="space-y-1">
                          {extractionStats.topRelations && extractionStats.topRelations.length > 0 ? (
                            extractionStats.topRelations.map((relation, index) => (
                              <div key={index} className="flex justify-between text-sm">
                                <span className="truncate max-w-[70%]" title={relation.name}>
                                  {relation.name}
                                </span>
                                <span className="text-gray-400">{relation.count}</span>
                              </div>
                            ))
                          ) : (
                            <div className="text-gray-400 text-sm">No relations found</div>
                          )}
                        </div>
                      </div>

                      {/* Debug info */}
                      <div className="text-xs text-amber-500 mb-2">
                        Graph ID: {extractedGraphId ? extractedGraphId : 'No graph ID available'}
                      </div>

                      {extractedGraphId && (
                        <Button 
                          onClick={viewExtractedGraph}
                          className="w-full"
                          variant="outline"
                        >
                          View Graph
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center py-8 text-gray-400">
                      <AlertCircle className="h-10 w-10 mb-4 opacity-40" />
                      <p className="mb-2">No extraction data yet</p>
                      <p className="text-sm">Extract a knowledge graph to see detailed statistics</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default Extract;