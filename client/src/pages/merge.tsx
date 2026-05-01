import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAppState } from '@/contexts/AppStateContext';
import { KnowledgeGraph, Link, Node } from "@shared/schema";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle, 
  CardFooter 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  RadioGroup,
  RadioGroupItem
} from "@/components/ui/radio-group";

import Sidebar from '@/components/Sidebar';
import HelpModal from '@/components/HelpModal';
import GraphVisualization from '@/components/GraphVisualization';
import { useSidebar } from '@/components/ui/sidebar';
import { 
  GitMerge, 
  Search, 
  ChevronsUpDown,
  Trash,
  Check,
  X,
  Info,
  RefreshCw,
  ArrowRight,
  Save,
  Filter,
  ClipboardCheck,
  Loader2
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Graph } from '@shared/schema';
import { MergeGraphsInput, MergeAlgorithmType, MergeAlgorithmTypeValue } from '@shared/schema';
import { useLocation } from 'wouter';

interface MergeGraphResult {
  graphId: number;
  name: string;
  entityCount: number;
  relationCount: number;
  stats: {
    originalNodeCount: number;
    mergedNodeCount: number;
    newLinks: number;
    unifiedEntities: Array<{
      originalIds: number[];
      originalNames: string[];
      mergedId: number;
      mergedName: string;
      algorithm: string;
      originalSources?: EntitySource[];
    }>;
    newRelationships: Array<{
      sourceId: number;
      sourceName: string;
      targetId: number;
      targetName: string;
      relationship: string;
    }>;
  };
  createdAt: string;
}

// Define source information for original entities
interface EntitySource {
  id: number;
  name: string;
  graphId: number;
  graphName: string;
}

// Define review interfaces
interface UnifiedEntityReview {
  originalIds: number[];
  originalNames: string[];
  mergedName: string;
  algorithm: string;
  approved: boolean;
  originalSources?: EntitySource[]; // Source information for each original entity
}

interface NewRelationshipReview {
  sourceId: number;
  sourceName: string;
  targetId: number;
  targetName: string;
  relationship: string;
  approved: boolean;
}

interface MergeReviewData {
  unifiedEntities: UnifiedEntityReview[];
  newRelationships: NewRelationshipReview[];
}

export default function Merge() {
  // Get app state context
  const { appState, updateMergePage } = useAppState();
  
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
  const [savedGraphs, setSavedGraphs] = useState<Graph[]>([]);
  const [filteredGraphs, setFilteredGraphs] = useState<Graph[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Initialize state from app state
  const [selectedGraphIds, setSelectedGraphIds] = useState<Set<number>>(
    new Set(appState.mergePage?.selectedGraphs || [])
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isMerging, setIsMerging] = useState<boolean>(false);
  const [showMergeConfig, setShowMergeConfig] = useState<boolean>(false);
  const [newGraphName, setNewGraphName] = useState<string>('');
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(
    appState.mergePage?.similarityThreshold || 0.7
  );
  const [thresholdLabel, setThresholdLabel] = useState<string>('Medium');
  const [mergeAlgorithm, setMergeAlgorithm] = useState<MergeAlgorithmTypeValue>(
    (appState.mergePage?.mergeAlgorithm as MergeAlgorithmTypeValue) || 'string-similarity'
  );
  const [mergeResult, setMergeResult] = useState<MergeGraphResult | null>(null);
  const [mergeSuccessOpen, setMergeSuccessOpen] = useState<boolean>(false);
  const [mergeProgress, setMergeProgress] = useState<number>(0);
  const [mergeStartTime, setMergeStartTime] = useState<number | null>(null);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string>('');
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [apiKeyError, setApiKeyError] = useState<string>('');
  
  // New states for review mode
  const [showReviewPanel, setShowReviewPanel] = useState<boolean>(false);
  const [mergeReviewData, setMergeReviewData] = useState<MergeReviewData | null>(null);
  const [isReviewComplete, setIsReviewComplete] = useState<boolean>(false);
  const [pendingMergeData, setPendingMergeData] = useState<any>(null);
  
  // Get sidebar context for layout
  const sidebar = useSidebar();
  const { state, isMobile, openMobile } = sidebar;
  
  // Calculate sidebar width for proper spacing
  const sidebarWidth = (sidebar as any).width || (state === 'expanded' ? 256 : 80);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Toggle help modal
  const toggleHelpModal = () => {
    setIsHelpModalOpen(!isHelpModalOpen);
  };

  // We'll use inline style for margins instead of classes for more consistent layout

  // Fetch saved graphs and API keys on component mount
  useEffect(() => {
    fetchSavedGraphs();
    fetchApiKeys();
  }, []);
  
  // Update filtered graphs when the search query changes
  useEffect(() => {
    filterAndSortGraphs();
  }, [searchQuery, savedGraphs, sortField, sortDirection]);
  
  // Set default graph name based on selected graphs
  useEffect(() => {
    if (selectedGraphIds.size > 0) {
      const selectedGraphs = savedGraphs.filter(graph => selectedGraphIds.has(graph.id));
      const graphNames = selectedGraphs.map(graph => graph.name || `Graph ${graph.id}`);
      let mergedName;
      
      if (graphNames.length === 2) {
        mergedName = `Merged: ${graphNames[0]} + ${graphNames[1]}`;
      } else if (graphNames.length > 2) {
        mergedName = `Merged: ${graphNames[0]} + ${graphNames.length - 1} others`;
      } else {
        mergedName = `Merged: ${graphNames[0]}`;
      }
      
      setNewGraphName(mergedName);
    }
  }, [selectedGraphIds, savedGraphs]);
  
  // Update threshold label when the threshold changes
  useEffect(() => {
    if (similarityThreshold < 0.6) {
      setThresholdLabel('Low - More nodes preserved');
    } else if (similarityThreshold < 0.8) {
      setThresholdLabel('Medium - Balanced');
    } else {
      setThresholdLabel('High - More aggressive merging');
    }
  }, [similarityThreshold]);
  
  // Update app state when merge settings change
  useEffect(() => {
    // Convert Set to Array for storage in app state
    const selectedGraphsArray = Array.from(selectedGraphIds);
    
    // Check if values have actually changed before updating to prevent infinite loop
    const hasSelectedGraphsChanged = !appState.mergePage.selectedGraphs || 
      appState.mergePage.selectedGraphs.length !== selectedGraphsArray.length || 
      !selectedGraphsArray.every(id => appState.mergePage.selectedGraphs.includes(id));
      
    const hasMergeAlgorithmChanged = appState.mergePage.mergeAlgorithm !== mergeAlgorithm;
    const hasThresholdChanged = appState.mergePage.similarityThreshold !== similarityThreshold;
    const hasMergedGraphChanged = 
      (!!appState.mergePage.mergedGraph !== !!mergeResult) || 
      (mergeResult?.graphId && appState.mergePage.mergedGraph?.id !== mergeResult.graphId);
    
    if (hasSelectedGraphsChanged || hasMergeAlgorithmChanged || hasThresholdChanged || hasMergedGraphChanged) {
      updateMergePage({
        selectedGraphs: selectedGraphsArray,
        mergeAlgorithm: mergeAlgorithm,
        similarityThreshold: similarityThreshold,
        mergedGraph: mergeResult?.graphId ? { 
          id: mergeResult.graphId,
          nodes: [], // We don't have the full graph data here
          links: []
        } as KnowledgeGraph : null
      });
    }
  }, [selectedGraphIds, mergeAlgorithm, similarityThreshold, mergeResult, updateMergePage, appState.mergePage]);

  // Fetch all saved graphs
  const fetchSavedGraphs = async () => {
    setIsLoading(true);
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
        title: 'Failed to Load Saved Graphs',
        description:
          error instanceof Error
            ? error.message
            : 'An error occurred while loading saved graphs.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Filter and sort graphs based on search query and sort settings
  const filterAndSortGraphs = () => {
    let filtered = [...savedGraphs];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(graph => 
        (graph.name && graph.name.toLowerCase().includes(query)) || 
        (graph.inputText && graph.inputText.toLowerCase().includes(query))
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      if (sortField === 'name') {
        const nameA = a.name || '';
        const nameB = b.name || '';
        comparison = nameA.localeCompare(nameB);
      } else if (sortField === 'entityCount') {
        comparison = (a.entityCount || 0) - (b.entityCount || 0);
      } else if (sortField === 'relationCount') {
        comparison = (a.relationCount || 0) - (b.relationCount || 0);
      } else if (sortField === 'createdAt') {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        comparison = dateA - dateB;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    setFilteredGraphs(filtered);
  };
  
  // Toggle sort direction or change sort field
  const toggleSort = (field: string) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };
  
  // Toggle graph selection
  const toggleGraphSelection = (id: number) => {
    const newSelection = new Set(selectedGraphIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedGraphIds(newSelection);
  };
  
  // Select all filtered graphs
  const selectAllGraphs = () => {
    const allIds = new Set(filteredGraphs.map(graph => graph.id));
    setSelectedGraphIds(allIds);
  };
  
  // Deselect all graphs
  const clearSelection = () => {
    setSelectedGraphIds(new Set());
  };
  
  // Fetch API keys
  const fetchApiKeys = async () => {
    try {
      // Fetch OpenAI API key
      const openaiResponse = await fetch('/api/api-keys/openai/active');
      if (openaiResponse.ok) {
        const openaiResult = await openaiResponse.json();
        if (openaiResult.success && openaiResult.data) {
          setApiKeys(prev => ({ ...prev, openai: openaiResult.data.key }));
        }
      }
      
      // Fetch Mistral API key
      const mistralResponse = await fetch('/api/api-keys/mistral/active');
      if (mistralResponse.ok) {
        const mistralResult = await mistralResponse.json();
        if (mistralResult.success && mistralResult.data) {
          setApiKeys(prev => ({ ...prev, mistral: mistralResult.data.key }));
        }
      }
    } catch (error) {
      console.error('Error fetching API keys:', error);
    }
  };
  
  // Prepare for merge operation
  const prepareMerge = () => {
    if (selectedGraphIds.size < 2) {
      toast({
        title: 'Cannot Merge',
        description: 'Please select at least 2 graphs to merge.',
        variant: 'destructive',
      });
      return;
    }
    // Hide previous merge success panel when opening the configuration panel
    setMergeSuccessOpen(false);
    setShowMergeConfig(true);
  };
  
  // Step 1: Analyze potential merges and present for review
  const executeGraphMerge = async () => {
    if (selectedGraphIds.size < 2) {
      toast({
        title: 'Cannot Merge',
        description: 'Please select at least 2 graphs to merge.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!newGraphName.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please provide a name for the merged graph.',
        variant: 'destructive',
      });
      return;
    }
    
    // Check if API key is required and available
    if (mergeAlgorithm === 'openai' && !apiKeys.openai) {
      toast({
        title: 'API Key Required',
        description: 'OpenAI API key is required for the selected algorithm. Please add it in the Settings page.',
        variant: 'destructive',
      });
      setLocation('/settings');
      return;
    }
    
    if (mergeAlgorithm === 'mistral' && !apiKeys.mistral) {
      toast({
        title: 'API Key Required',
        description: 'Mistral AI API key is required for the selected algorithm. Please add it in the Settings page.',
        variant: 'destructive',
      });
      setLocation('/settings');
      return;
    }
    
    setIsMerging(true);
    setMergeStartTime(Date.now());
    
    // Progress simulation based on graph size and algorithm
    const totalGraphNodes = selectedGraphIds.size > 0 
      ? Array.from(selectedGraphIds).reduce((total, id) => {
          const graph = savedGraphs.find(g => g.id === id);
          return total + (graph?.entityCount || 0);
        }, 0)
      : 100;
    
    // Set up estimated time (more nodes or more complex algorithm takes longer)
    const baseTimePerNode = 5; // milliseconds per node for basic processing
    const algorithmComplexity = 
      mergeAlgorithm === 'string-similarity' ? 1 :
      mergeAlgorithm === 'wordnet' ? 3 : 
      mergeAlgorithm === 'mistral' ? 8 :
      10; // OpenAI is slowest
      
    const totalEstimatedTime = totalGraphNodes * baseTimePerNode * algorithmComplexity;
      
    // Set up progress tracking
    const progressInterval = setInterval(() => {
      if (isMerging) {
        setMergeProgress(prev => {
          // Calculate progress based on elapsed time and estimated total time
          const elapsed = Date.now() - (mergeStartTime || Date.now());
          const newProgress = Math.min(95, (elapsed / totalEstimatedTime) * 100);
          
          // Calculate remaining time
          const remainingTime = (totalEstimatedTime - elapsed) / 1000; // in seconds
          if (remainingTime > 0) {
            if (remainingTime < 60) {
              setEstimatedTimeRemaining(`${Math.ceil(remainingTime)} seconds`);
            } else {
              setEstimatedTimeRemaining(`${Math.ceil(remainingTime / 60)} minutes`);
            }
          }
          
          return newProgress;
        });
      }
    }, 200);
    
    try {
      // First, analyze the potential merges without finalizing
      const analyzeData = {
        graphIds: Array.from(selectedGraphIds),
        newName: newGraphName.trim(), // Include the name even for analysis
        similarityThreshold,
        algorithm: mergeAlgorithm
      };
      
      const analyzeResponse = await fetch('/api/graphs/analyze-merge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(analyzeData),
      });
      
      if (!analyzeResponse.ok) {
        const errorResult = await analyzeResponse.json();
        throw new Error(errorResult.message || 'Failed to analyze potential graph merges');
      }
      
      const analyzeResult = await analyzeResponse.json();
      
      // Set progress to 100% when analysis is complete
      setMergeProgress(100);
      
      // Prepare review data from analysis results
      const reviewData: MergeReviewData = {
        unifiedEntities: analyzeResult.data.unifiedEntities.map((entity: any) => ({
          ...entity,
          originalSources: entity.originalSources || [],
          approved: true // Default to approved
        })),
        newRelationships: analyzeResult.data.newRelationships.map((relation: any) => ({
          ...relation,
          approved: true // Default to approved
        }))
      };
      
      // Store the merge data for later execution after review
      setPendingMergeData({
        graphIds: Array.from(selectedGraphIds),
        newName: newGraphName.trim(),
        similarityThreshold,
        algorithm: mergeAlgorithm
      });
      
      // Show the review panel
      setMergeReviewData(reviewData);
      setShowReviewPanel(true);
      setShowMergeConfig(false);
      
      // Reset progress for next step
      setTimeout(() => {
        setMergeProgress(0);
        setEstimatedTimeRemaining('');
      }, 1000);
      
    } catch (error) {
      console.error('Error analyzing merge potential:', error);
      toast({
        title: 'Analysis Failed',
        description:
          error instanceof Error
            ? error.message
            : 'An error occurred while analyzing potential merges.',
        variant: 'destructive',
      });
    } finally {
      clearInterval(progressInterval);
      setIsMerging(false);
      
      // Make sure progress is reset even on error
      setTimeout(() => {
        setMergeProgress(0);
        setEstimatedTimeRemaining('');
      }, 1000);
    }
  };
  
  // Step 2: Execute final merge after user review
  const finalizeMerge = async () => {
    if (!pendingMergeData || !mergeReviewData) {
      toast({
        title: 'Cannot Finalize Merge',
        description: 'Missing merge data. Please restart the merge process.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsMerging(true);
    setMergeStartTime(Date.now());
    
    // Set up progress tracking
    const progressInterval = setInterval(() => {
      if (isMerging) {
        setMergeProgress(prev => Math.min(95, prev + 1));
      }
    }, 50);
    
    try {
      // Include all entities but mark their approval status
      // Note: Even single-entity groups are included to ensure consistent processing
      const approvedEntities = mergeReviewData.unifiedEntities
        .map(entity => ({
          originalIds: entity.originalIds,
          originalNames: entity.originalNames,
          mergedName: entity.mergedName,
          algorithm: entity.algorithm,
          // For entities with originalIds.length === 1, they don't need merging, so we mark them as approved
          // For entities with originalIds.length > 1, we respect the user's approval decision
          approved: entity.originalIds.length === 1 ? true : entity.approved
        }));
      
      const approvedRelationships = mergeReviewData.newRelationships
        .filter(relation => relation.approved)
        .map(relation => ({
          sourceId: relation.sourceId,
          sourceName: relation.sourceName,
          targetId: relation.targetId,
          targetName: relation.targetName,
          relationship: relation.relationship
        }));
      
      // Send the final merge request with approved items
      const finalizeData = {
        ...pendingMergeData,
        approvedEntities,
        approvedRelationships
      };
      
      const response = await fetch('/api/graphs/merge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalizeData),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to finalize graph merge');
      }
      
      // Set progress to 100% when complete
      setMergeProgress(100);
      
      // Clear the selected graphs and review data
      setSelectedGraphIds(new Set());
      setShowReviewPanel(false);
      setPendingMergeData(null);
      setMergeReviewData(null);
      
      // Store the merge result and show success dialog
      setMergeResult(result.data);
      setMergeSuccessOpen(true);
      
      // Refresh the graph list
      fetchSavedGraphs();
      
      // Reset progress bar after a short delay to show 100% completion
      setTimeout(() => {
        setMergeProgress(0);
        setEstimatedTimeRemaining('');
      }, 1000);
      
    } catch (error) {
      console.error('Error finalizing merge:', error);
      toast({
        title: 'Merge Failed',
        description:
          error instanceof Error
            ? error.message
            : 'An error occurred while finalizing the merge.',
        variant: 'destructive',
      });
    } finally {
      clearInterval(progressInterval);
      setIsMerging(false);
      
      // Make sure progress is reset even on error
      setTimeout(() => {
        setMergeProgress(0);
        setEstimatedTimeRemaining('');
      }, 1000);
    }
  };
  
  // Navigate to the newly merged graph
  const navigateToMergedGraph = () => {
    if (mergeResult) {
      setLocation(`/load?graph=${mergeResult.graphId}`);
    }
    setMergeSuccessOpen(false);
    // Reset progress when closing the success panel
    setMergeProgress(0);
    setEstimatedTimeRemaining('');
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
                Merge Knowledge Graphs
              </h1>
            </div>
          </header>
          
          <main className="flex-grow container mx-auto px-4 py-6 text-gray-200">
            <Card className="bg-gray-900 border-gray-800 shadow-xl mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl font-bold text-white flex items-center">
                  <GitMerge className="w-6 h-6 mr-2 text-primary" /> 
                  Graph Merge Tool
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Select and combine multiple knowledge graphs into a unified representation with intelligent entity resolution.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 h-4 w-4" />
                      <Input
                        placeholder="Search graphs by name or content..."
                        className="pl-9 bg-gray-800 border-gray-700 text-gray-200"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-gray-400">
                        {selectedGraphIds.size > 0 ? 
                          `${selectedGraphIds.size} graph${selectedGraphIds.size !== 1 ? 's' : ''} selected` : 
                          'Select graphs for merging'}
                      </div>
                      <div className="flex-1"></div>
                      <div className="flex space-x-2">
                        {selectedGraphIds.size === 0 && filteredGraphs.length > 0 && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-xs"
                            onClick={selectAllGraphs}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Select All
                          </Button>
                        )}
                        {selectedGraphIds.size > 0 && (
                          <>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-xs"
                              onClick={clearSelection}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Clear
                            </Button>
                            <Button 
                              variant="default" 
                              size="sm" 
                              className="text-xs bg-primary hover:bg-primary/90"
                              onClick={prepareMerge}
                              disabled={selectedGraphIds.size < 2}
                            >
                              <GitMerge className="h-3 w-3 mr-1" />
                              Merge Selected
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="overflow-hidden rounded-md border border-gray-700">
                    <Table className="min-w-full">
                      <TableHeader className="bg-gray-800 text-xs">
                        <TableRow>
                          <TableHead className="w-10 text-center p-2"></TableHead>
                          <TableHead className="p-2 cursor-pointer" onClick={() => toggleSort('name')}>
                            <div className="flex items-center">
                              Name
                              {sortField === 'name' && (
                                <ChevronsUpDown className="h-3 w-3 ml-1" />
                              )}
                            </div>
                          </TableHead>
                          <TableHead className="p-2 cursor-pointer text-right" onClick={() => toggleSort('entityCount')}>
                            <div className="flex items-center justify-end">
                              Entities
                              {sortField === 'entityCount' && (
                                <ChevronsUpDown className="h-3 w-3 ml-1" />
                              )}
                            </div>
                          </TableHead>
                          <TableHead className="p-2 cursor-pointer text-right" onClick={() => toggleSort('relationCount')}>
                            <div className="flex items-center justify-end">
                              Relations
                              {sortField === 'relationCount' && (
                                <ChevronsUpDown className="h-3 w-3 ml-1" />
                              )}
                            </div>
                          </TableHead>
                          <TableHead className="p-2 cursor-pointer text-right" onClick={() => toggleSort('createdAt')}>
                            <div className="flex items-center justify-end">
                              Created
                              {sortField === 'createdAt' && (
                                <ChevronsUpDown className="h-3 w-3 ml-1" />
                              )}
                            </div>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-gray-400">
                              Loading graphs...
                            </TableCell>
                          </TableRow>
                        ) : filteredGraphs.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-gray-400">
                              {searchQuery ? 'No matching graphs found.' : 'No saved graphs found.'}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredGraphs.map((graph) => (
                            <TableRow 
                              key={graph.id}
                              className={`cursor-pointer hover:bg-gray-800 ${
                                selectedGraphIds.has(graph.id) ? 'bg-gray-800/60' : ''
                              }`}
                              onClick={() => toggleGraphSelection(graph.id)}
                            >
                              <TableCell className="p-2 text-center">
                                <Checkbox 
                                  checked={selectedGraphIds.has(graph.id)}
                                  className="mt-0.5"
                                />
                              </TableCell>
                              <TableCell className="p-2 font-medium text-gray-200">
                                {graph.name || `Graph ${graph.id}`}
                              </TableCell>
                              <TableCell className="p-2 text-right">
                                {graph.entityCount}
                              </TableCell>
                              <TableCell className="p-2 text-right">
                                {graph.relationCount}
                              </TableCell>
                              <TableCell className="p-2 text-right text-gray-400 text-sm">
                                {new Date(graph.createdAt).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Review Panel for Entity and Relationship Approval */}
            {showReviewPanel && mergeReviewData && (
              <Card className="bg-gray-900 text-gray-200 border-gray-700 shadow-xl mb-6">
                <CardHeader className="pb-3 border-b border-gray-800">
                  <CardTitle className="text-xl text-white flex items-center">
                    <ClipboardCheck className="h-5 w-5 mr-2 text-primary" />
                    Review Merge Suggestions
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Review and approve entity unifications and new relationships before finalizing the merge.
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="py-4">
                  <div className="space-y-6">
                    {/* Entity Unifications Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-white">Proposed Entity Unifications</h3>
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-xs"
                            onClick={() => {
                              setMergeReviewData({
                                ...mergeReviewData,
                                unifiedEntities: mergeReviewData.unifiedEntities.map(entity => ({
                                  ...entity,
                                  // Only change entities that need unification
                                  approved: entity.originalIds.length > 1 ? true : entity.approved
                                }))
                              });
                            }}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Approve All
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-xs"
                            onClick={() => {
                              setMergeReviewData({
                                ...mergeReviewData,
                                unifiedEntities: mergeReviewData.unifiedEntities.map(entity => ({
                                  ...entity,
                                  // Only change entities that need unification
                                  approved: entity.originalIds.length > 1 ? false : entity.approved
                                }))
                              });
                            }}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Reject All
                          </Button>
                        </div>
                      </div>
                      
                      {/* Filter to only show entities that require unification (have more than 1 original entity) */}
                      {mergeReviewData.unifiedEntities.filter(entity => entity.originalIds.length > 1).length === 0 ? (
                        <div className="text-gray-400 text-sm p-4 bg-gray-800/50 rounded-md">
                          No entity unifications suggested with current settings.
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                          {mergeReviewData.unifiedEntities
                            .filter(entity => entity.originalIds.length > 1) // Only show entities that need unification
                            .map((entity, index) => (
                            <div 
                              key={index}
                              className={`p-3 rounded-md border ${
                                entity.approved ? 'border-green-600/30 bg-green-950/20' : 'border-red-600/30 bg-red-950/20'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="space-y-1 flex-1">
                                  <div className="flex items-center">
                                    <span className="font-medium text-white">{entity.mergedName}</span>
                                    <Badge className="ml-2 text-xs" variant="outline">
                                      {entity.algorithm}
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-gray-400 mt-2">
                                    <div>Original entities:</div>
                                    <div className="space-y-2 mt-1">
                                      {entity.originalSources ? (
                                        // Display detailed source information
                                        entity.originalSources.map((source, idx) => (
                                          <div key={idx} className="bg-gray-700/50 p-2 rounded-md text-gray-200 flex flex-col">
                                            <div className="font-medium">{source.name}</div>
                                            <div className="text-xs text-gray-400 flex justify-between mt-1">
                                              <span>ID: {source.id}</span>
                                              <span>Source: {source.graphName}</span>
                                            </div>
                                          </div>
                                        ))
                                      ) : (
                                        // Fallback to simple name display if source info isn't available
                                        <div className="flex flex-wrap gap-1">
                                          {entity.originalNames.map((name, idx) => (
                                            <span key={idx} className="bg-gray-700 px-2 py-1 rounded-md text-gray-200">
                                              {name}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <Switch 
                                  checked={entity.approved}
                                  onCheckedChange={(checked) => {
                                    // Find the actual index in the full array by matching originalIds
                                    const actualIndex = mergeReviewData.unifiedEntities.findIndex(
                                      e => JSON.stringify(e.originalIds) === JSON.stringify(entity.originalIds)
                                    );
                                    
                                    if (actualIndex !== -1) {
                                      const updatedEntities = [...mergeReviewData.unifiedEntities];
                                      updatedEntities[actualIndex].approved = checked;
                                      setMergeReviewData({
                                        ...mergeReviewData,
                                        unifiedEntities: updatedEntities
                                      });
                                    }
                                  }}
                                  className="ml-4"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* New Relationships Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-white">Discovered Relationships</h3>
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-xs"
                            onClick={() => {
                              setMergeReviewData({
                                ...mergeReviewData,
                                newRelationships: mergeReviewData.newRelationships.map(rel => ({
                                  ...rel,
                                  approved: true
                                }))
                              });
                            }}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Approve All
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-xs"
                            onClick={() => {
                              setMergeReviewData({
                                ...mergeReviewData,
                                newRelationships: mergeReviewData.newRelationships.map(rel => ({
                                  ...rel,
                                  approved: false
                                }))
                              });
                            }}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Reject All
                          </Button>
                        </div>
                      </div>
                      
                      {mergeReviewData.newRelationships.length === 0 ? (
                        <div className="text-gray-400 text-sm p-4 bg-gray-800/50 rounded-md">
                          No new relationships discovered between the graphs.
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                          {mergeReviewData.newRelationships.map((relationship, index) => (
                            <div 
                              key={index}
                              className={`p-3 rounded-md border ${
                                relationship.approved ? 'border-green-600/30 bg-green-950/20' : 'border-red-600/30 bg-red-950/20'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="space-y-1 flex-1">
                                  <div className="flex items-center text-sm">
                                    <span className="font-medium text-gray-300">{relationship.sourceName}</span>
                                    <ArrowRight className="h-3 w-3 mx-2 text-gray-500" />
                                    <span className="font-medium text-primary">{relationship.relationship}</span>
                                    <ArrowRight className="h-3 w-3 mx-2 text-gray-500" />
                                    <span className="font-medium text-gray-300">{relationship.targetName}</span>
                                  </div>
                                </div>
                                <Switch 
                                  checked={relationship.approved}
                                  onCheckedChange={(checked) => {
                                    // Create a unique identifier for this relationship
                                    const relIdentifier = `${relationship.sourceId}-${relationship.relationship}-${relationship.targetId}`;
                                    
                                    // Find the actual index by matching relationship properties
                                    const actualIndex = mergeReviewData.newRelationships.findIndex(
                                      rel => `${rel.sourceId}-${rel.relationship}-${rel.targetId}` === relIdentifier
                                    );
                                    
                                    if (actualIndex !== -1) {
                                      const updatedRelationships = [...mergeReviewData.newRelationships];
                                      updatedRelationships[actualIndex].approved = checked;
                                      setMergeReviewData({
                                        ...mergeReviewData,
                                        newRelationships: updatedRelationships
                                      });
                                    }
                                  }}
                                  className="ml-4"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
                
                <CardFooter className="border-t border-gray-800 pt-4">
                  <div className="flex justify-between w-full">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setShowReviewPanel(false);
                        setShowMergeConfig(true);
                        setPendingMergeData(null);
                        setMergeReviewData(null);
                      }}
                    >
                      Back to Configuration
                    </Button>
                    <Button 
                      onClick={finalizeMerge}
                      disabled={isMerging}
                    >
                      {isMerging ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Finalizing...
                        </>
                      ) : (
                        <>Finalize Merge</>
                      )}
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            )}
            
            {/* Merge Success Panel (shown instead of a dialog) */}
            {mergeSuccessOpen && mergeResult && (
              <Card className="bg-gray-900 text-gray-200 border-gray-700 shadow-xl mb-6">
                <CardHeader className="pb-3 border-b border-gray-800">
                  <CardTitle className="text-xl text-white flex items-center">
                    <Check className="h-5 w-5 mr-2 text-green-500" />
                    Merge Successful
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Your graphs have been successfully merged.
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="py-4">
                  <div className="space-y-4">
                    <div className="bg-gray-800 p-4 rounded-md">
                      <h3 className="font-medium text-primary mb-2">{mergeResult.name}</h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center">
                          <span className="text-gray-400 mr-2">Entities:</span>
                          <span className="font-medium">{mergeResult.entityCount}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-gray-400 mr-2">Relations:</span>
                          <span className="font-medium">{mergeResult.relationCount}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-800/50 p-4 rounded-md">
                      <h3 className="font-medium text-gray-300 mb-2">Merge Statistics</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Original Entities:</span>
                          <span className="font-medium">{mergeResult.stats.originalNodeCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Final Entity Count:</span>
                          <span className="font-medium">{mergeResult.stats.mergedNodeCount}</span>
                        </div>
                        {/* Unification stats */}
                        <div className="mt-3 pt-3 border-t border-gray-700">
                          <div className="text-primary text-sm font-medium mb-2">Unification Summary</div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Entities Unified:</span>
                              <span className="font-medium">{mergeResult.stats.unifiedEntities.filter(entity => entity.originalIds.length > 1).length}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Entities Preserved:</span>
                              <span className="font-medium">{mergeResult.stats.unifiedEntities.filter(entity => entity.originalIds.length === 1).length}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">New Relations:</span>
                              <span className="font-medium">{mergeResult.stats.newLinks}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Redundancy Removed:</span>
                              <span className="font-medium">
                                {mergeResult.stats.unifiedEntities
                                  .filter(entity => entity.originalIds.length > 1)
                                  .reduce((total, entity) => total + entity.originalIds.length - 1, 0)
                                }
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Unified Entities & New Relationships Section - Full width */}
                    <div className="space-y-4 w-full">
                      {/* Unified Entities Section */}
                      {mergeResult.stats.unifiedEntities && mergeResult.stats.unifiedEntities.length > 0 && (
                        <div className="bg-gray-800/50 p-4 rounded-md">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-medium text-gray-300">
                              Unified Entities ({mergeResult.stats.unifiedEntities.filter(entity => entity.originalIds.length > 1).length} unified)
                            </h3>
                            <Badge variant="outline" className="bg-green-900/20 text-green-400 border-green-700">Approved</Badge>
                          </div>
                          <div className="text-xs text-gray-400 mb-3">
                            Showing entities that were successfully merged during the unification process. Each unification combines two or more entities.
                          </div>
                          <div className="space-y-3 text-sm max-h-80 overflow-y-auto pr-2">
                            {mergeResult.stats.unifiedEntities
                              .filter(entity => entity.originalIds.length > 1) // Only show entities that had more than one original ID (actually merged)
                              .map((unified, index) => (
                                <div key={index} className="bg-gray-800 p-3 rounded border border-gray-700">
                                  <div className="font-medium text-primary text-base mb-1">Merged as: {unified.mergedName}</div>
                                  <div className="text-sm text-gray-300 mt-2">
                                    Original entities:
                                    <div className="space-y-2 mt-1">
                                      {unified.originalSources ? (
                                        // Display detailed source information
                                        unified.originalSources.map((source, idx) => (
                                          <div key={idx} className="bg-gray-700/50 p-2 rounded-md text-gray-200 flex flex-col">
                                            <div className="font-medium">{source.name}</div>
                                            <div className="text-xs text-gray-400 flex justify-between mt-1">
                                              <span>ID: {source.id}</span>
                                              <span>Source: {source.graphName}</span>
                                            </div>
                                          </div>
                                        ))
                                      ) : (
                                        // Fallback to simple name display if source info isn't available
                                        <div className="flex flex-wrap gap-1">
                                          {unified.originalNames.map((name, idx) => (
                                            <span key={idx} className="bg-gray-700 px-2 py-1 rounded-md text-gray-200">
                                              {name}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-xs text-gray-400 mt-3">Resolved using: {unified.algorithm}</div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      
                      {/* New Relationships Section */}
                      {mergeResult.stats.newRelationships && mergeResult.stats.newRelationships.length > 0 && (
                        <div className="bg-gray-800/50 p-4 rounded-md">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-medium text-gray-300">New Relationships ({mergeResult.stats.newRelationships.length})</h3>
                            <Badge variant="outline" className="bg-blue-900/20 text-blue-400 border-blue-700">Discovered</Badge>
                          </div>
                          <div className="text-xs text-gray-400 mb-3">
                            These are new connections found between entities from different source graphs. Each represents a new insight.
                          </div>
                          <div className="space-y-3 text-sm max-h-80 overflow-y-auto pr-2">
                            {mergeResult.stats.newRelationships.map((relation, index) => (
                              <div key={index} className="flex items-center bg-gray-800 p-3 rounded border border-gray-700">
                                <span className="font-medium text-blue-400">{relation.sourceName}</span>
                                <ArrowRight className="h-4 w-4 mx-2 text-gray-500" />
                                <span className="bg-gray-700 px-2 py-1 rounded text-primary font-medium">
                                  {relation.relationship}
                                </span>
                                <ArrowRight className="h-4 w-4 mx-2 text-gray-500" />
                                <span className="font-medium text-green-400">{relation.targetName}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
                
                <CardFooter className="border-t border-gray-800 pt-4 flex justify-end space-x-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setMergeSuccessOpen(false);
                      // Reset progress when closing the success panel
                      setMergeProgress(0);
                      setEstimatedTimeRemaining('');
                    }}
                  >
                    Close
                  </Button>
                  <Button
                    onClick={navigateToMergedGraph}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <ArrowRight className="h-4 w-4 mr-1" />
                    View Merged Graph
                  </Button>
                </CardFooter>
              </Card>
            )}
            
            {/* Merge Configuration Panel */}
            {showMergeConfig && (
              <Card className="bg-gray-900 border-gray-800 shadow-xl mb-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl font-bold text-white flex items-center">
                    <GitMerge className="w-6 h-6 mr-2 text-primary" /> 
                    Merge Configuration
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Configure how the selected graphs will be merged together.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 py-2">
                    {isMerging ? (
                      <div className="space-y-6">
                        <div className="text-center mb-4">
                          <h3 className="text-lg font-semibold text-white mb-1">Merging Knowledge Graphs</h3>
                          <p className="text-gray-400 text-sm">Please wait while we merge your selected graphs...</p>
                        </div>
                        
                        {/* Progress bar */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-sm mb-1">
                            <span className="text-gray-400">Progress</span>
                            <span className="text-gray-300 font-medium">{Math.round(mergeProgress)}%</span>
                          </div>
                          <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-primary h-4 rounded-full transition-all duration-300 ease-out"
                              style={{ width: `${mergeProgress}%` }}
                            ></div>
                          </div>
                          <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
                            <span>Using {mergeAlgorithm} algorithm</span>
                            {estimatedTimeRemaining && (
                              <span>Estimated time remaining: {estimatedTimeRemaining}</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-sm text-gray-400 bg-gray-800/60 p-4 rounded-md">
                          <div className="flex items-center mb-2">
                            <span className="w-2 h-2 bg-primary rounded-full mr-2 animate-pulse"></span>
                            <span className="font-medium text-gray-300">Processing Steps:</span>
                          </div>
                          <ul className="space-y-2 pl-4">
                            <li className="flex items-center">
                              <Check className="h-4 w-4 mr-2 text-green-500" />
                              <span>Collecting entities from {selectedGraphIds.size} graphs</span>
                            </li>
                            <li className="flex items-center">
                              <Check className="h-4 w-4 mr-2 text-green-500" />
                              <span>Comparing entities using {mergeAlgorithm} algorithm</span>
                            </li>
                            <li className={`flex items-center ${mergeProgress > 50 ? 'text-gray-300' : 'text-gray-500'}`}>
                              {mergeProgress > 50 ? (
                                <Check className="h-4 w-4 mr-2 text-green-500" />
                              ) : (
                                <span className="w-4 h-4 mr-2 rounded-full border-2 border-gray-600 border-t-transparent animate-spin"></span>
                              )}
                              <span>Resolving entity references</span>
                            </li>
                            <li className={`flex items-center ${mergeProgress > 80 ? 'text-gray-300' : 'text-gray-500'}`}>
                              {mergeProgress > 80 ? (
                                <Check className="h-4 w-4 mr-2 text-green-500" />
                              ) : (
                                <span className="w-4 h-4 mr-2"></span>
                              )}
                              <span>Creating unified knowledge graph</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="merged-name">Merged Graph Name</Label>
                          <Input
                            id="merged-name"
                            className="bg-gray-800 border-gray-700"
                            value={newGraphName}
                            onChange={(e) => setNewGraphName(e.target.value)}
                            placeholder="Enter a name for the merged graph"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Merge Algorithm</Label>
                          <RadioGroup 
                            defaultValue="string-similarity"
                            value={mergeAlgorithm}
                            onValueChange={(value) => setMergeAlgorithm(value as MergeAlgorithmTypeValue)}
                            className="grid grid-cols-1 gap-4 pt-2"
                          >
                            <div className="flex items-center space-x-2 rounded-md border border-gray-700 p-3 bg-gray-800/50 hover:bg-gray-800">
                              <RadioGroupItem value="string-similarity" id="algorithm-string" className="mt-0" />
                              <Label htmlFor="algorithm-string" className="flex-1 cursor-pointer font-medium">
                                <div className="flex flex-col">
                                  <span className="text-gray-200">String Similarity</span>
                                  <span className="text-xs text-gray-400">Basic algorithm using text matching</span>
                                </div>
                              </Label>
                            </div>
                            
                            <div className="flex items-center space-x-2 rounded-md border border-gray-700 p-3 bg-gray-800/50 hover:bg-gray-800">
                              <RadioGroupItem value="wordnet" id="algorithm-wordnet" className="mt-0" />
                              <Label htmlFor="algorithm-wordnet" className="flex-1 cursor-pointer font-medium">
                                <div className="flex flex-col">
                                  <span className="text-gray-200">WordNet Semantic</span>
                                  <span className="text-xs text-gray-400">Enhanced matching using synonym recognition</span>
                                </div>
                              </Label>
                            </div>
                            
                            <div className="flex items-center space-x-2 rounded-md border border-gray-700 p-3 bg-gray-800/50 hover:bg-gray-800">
                              <RadioGroupItem value="openai" id="algorithm-openai" className="mt-0" />
                              <Label htmlFor="algorithm-openai" className="flex-1 cursor-pointer font-medium">
                                <div className="flex flex-col">
                                  <span className="text-gray-200">OpenAI Advanced</span>
                                  <span className="text-xs text-gray-400">Context-aware entity resolution (requires API key)</span>
                                </div>
                              </Label>
                            </div>
                            
                            <div className="flex items-center space-x-2 rounded-md border border-gray-700 p-3 bg-gray-800/50 hover:bg-gray-800">
                              <RadioGroupItem value="mistral" id="algorithm-mistral" className="mt-0" />
                              <Label htmlFor="algorithm-mistral" className="flex-1 cursor-pointer font-medium">
                                <div className="flex flex-col">
                                  <span className="text-gray-200">Mistral AI</span>
                                  <span className="text-xs text-gray-400">Advanced semantic matching using Mistral API (requires API key)</span>
                                </div>
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <Label htmlFor="similarity-threshold">Entity Similarity Threshold</Label>
                            <span className="text-sm text-gray-400">{thresholdLabel}</span>
                          </div>
                          <Slider
                            id="similarity-threshold"
                            defaultValue={[0.8]}
                            max={1}
                            min={0.5}
                            step={0.05}
                            value={[similarityThreshold]}
                            onValueChange={(value) => setSimilarityThreshold(value[0])}
                            className="py-4"
                          />
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>0.5 (Low Similarity)</span>
                            <span>1.0 (Exact Match)</span>
                          </div>
                        </div>
                        
                        <div className="text-sm text-gray-400 bg-gray-800 p-3 rounded-md">
                          <p className="font-medium text-primary mb-1 flex items-center">
                            <Info className="h-4 w-4 mr-1" /> About Merge Algorithms
                          </p>
                          <p className="mb-2">
                            Choose the algorithm that best fits your needs:
                          </p>
                          <ul className="list-disc list-inside space-y-1 pl-2">
                            <li><strong>String Similarity:</strong> Fast, works well for exact or close matches</li>
                            <li><strong>WordNet Semantic:</strong> Better at recognizing synonyms and related terms</li>
                            <li><strong>OpenAI Advanced:</strong> Powerful, understands context and semantic meaning</li>
                            <li><strong>Mistral AI:</strong> Advanced semantic analysis for entity resolution</li>
                          </ul>
                          <p className="mt-2 mb-1 font-medium text-primary">Similarity Threshold</p>
                          <p>This controls how similar entities must be to be considered the same:</p>
                          <ul className="list-disc list-inside space-y-1 pl-2">
                            <li><strong>Low (0.5-0.6):</strong> More permissive, preserves more nodes</li>
                            <li><strong>Medium (0.7-0.8):</strong> Balanced approach, recommended</li>
                            <li><strong>High (0.9-1.0):</strong> Strict matching, only merges very similar entities</li>
                          </ul>
                        </div>
                        
                        <div className="flex justify-end space-x-2 pt-4">
                          <Button
                            variant="secondary"
                            onClick={() => setShowMergeConfig(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={executeGraphMerge}
                            disabled={isMerging || !newGraphName.trim()}
                            className="bg-primary hover:bg-primary/90"
                          >
                            {isMerging ? 'Merging...' : 'Merge Graphs'}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            
            <Card className="bg-gray-900 border-gray-800 shadow-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold text-white flex items-center">
                  <Info className="w-5 h-5 mr-2 text-primary" /> 
                  About Graph Merging
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-gray-300">
                  <p>
                    <strong>Entity Resolution:</strong> When merging graphs, similar entities are combined based on various matching algorithms.
                  </p>
                  <p>
                    <strong>Resolution Algorithms:</strong> Choose from string-based matching, WordNet semantic analysis, or AI-powered contextual resolution.
                  </p>
                  <p>
                    <strong>New Relationships:</strong> The merge process can discover new relationships between entities from different source graphs.
                  </p>
                  <p>
                    <strong>Similarity Control:</strong> Adjust the threshold to determine how aggressively entities are merged across graphs.
                  </p>
                  <p>
                    <strong>Result:</strong> The merged graph preserves all relationships from the source graphs while eliminating duplicate entities.
                  </p>
                </div>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
      
      {isHelpModalOpen && <HelpModal onClose={toggleHelpModal} />}
    </div>
  );
}