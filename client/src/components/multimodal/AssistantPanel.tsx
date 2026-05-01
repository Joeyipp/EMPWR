import { FC, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlayCircle, Brain, CheckCircle, AlertCircle, Clock, InfoIcon, ArrowUpDown, FileText, Link, Network } from 'lucide-react';
import { AssistantPanelProps } from '@/types/multimodal';
import { ScrollArea } from '@/components/ui/scroll-area';

const AssistantPanel: FC<AssistantPanelProps> = ({ 
  messages, 
  isProcessing, 
  onSendMessage, 
  onClearMessages,
  onProcessAllSources,
  streamingContent = "" 
}) => {
  // Reference for auto-scrolling logs
  const logsRef = useRef<HTMLDivElement>(null);

  // Extract status messages and errors for visual display
  const statusMessages = messages.filter(msg => 
    msg.role === 'system' || 
    msg.role === 'assistant' || 
    (msg.role === 'user' && msg.content.includes('Process all sources'))
  );
  
  const hasError = statusMessages.some(msg => 
    msg.content.toLowerCase().includes('error') || 
    msg.role === 'system'
  );

  // Calculate progress for the progress bar based on streaming content
  const calculateProgress = () => {
    if (!isProcessing) {
      return statusMessages.length > 0 ? 100 : 0;
    }
    // Basic progress calculation based on streaming content length
    if (!streamingContent) return 20;
    const minProgress = 25;
    const maxProgress = 90;
    const contentLength = streamingContent.length;
    // More content means more progress
    return Math.min(maxProgress, minProgress + (contentLength / 50));
  };

  // Scroll to bottom whenever logs update
  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingContent]);
  
  // Get the most recent result as a summary
  const getLatestResult = () => {
    const assistantMessages = messages.filter(msg => msg.role === 'assistant');
    return assistantMessages.length > 0 ? assistantMessages[assistantMessages.length - 1].content : '';
  };

  // Process content from OpenAI to extract summary, analysis, and connections sections
  const processContentSections = (content: string) => {
    if (!content.includes('=== SUMMARY ===')) return { original: content };
    
    const parts = content.split('=== SUMMARY ===');
    const prefix = parts[0];
    const contentParts = parts.slice(1).map(part => {
      // Extract summary section
      const summaryEnd = part.indexOf('=== ANALYSIS ===');
      const summary = summaryEnd > -1 ? part.substring(0, summaryEnd).trim() : part.trim();
      
      // Extract analysis and connections sections
      let analysis = '';
      let connections = '';
      
      if (summaryEnd > -1) {
        const remainingContent = part.substring(summaryEnd);
        const connectionsStart = remainingContent.indexOf('=== CONNECTIONS ===');
        
        if (connectionsStart > -1) {
          analysis = remainingContent.substring(0, connectionsStart).trim();
          connections = remainingContent.substring(connectionsStart).trim();
        } else {
          analysis = remainingContent.trim();
        }
      }
      
      return { summary, analysis, connections };
    });
    
    return { prefix, contentParts };
  };

  return (
    <Card className="border border-[#1b1e29]/50 bg-[#101624] h-full flex flex-col shadow-lg overflow-hidden isolate">
      <CardHeader className="p-4 pb-3 flex flex-col border-b border-[#1b1e29]/50 bg-[#0e182f]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="relative bg-gradient-to-br from-purple-500 to-indigo-700 p-2 rounded-lg shadow-md mr-3 transform hover:rotate-12 transition-transform duration-300">
              <Brain className="h-5 w-5 text-white" />
              <div className="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-purple-500/0 via-purple-500/40 to-purple-500/0 opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-500 pointer-events-none"></div>
            </div>
            <CardTitle className="text-base text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-purple-300 font-semibold">
              AI Analysis Hub
            </CardTitle>
          </div>
          {messages.length > 0 && !isProcessing && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClearMessages}
              className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-gray-700/30 transition-all duration-200 rounded-full"
            >
              <AlertCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <div className="grid grid-cols-1 gap-3 mb-2">
          <Button 
            variant="default"
            onClick={onProcessAllSources}
            disabled={isProcessing}
            className={`w-full py-6 text-base font-medium bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 border-0 shadow-xl rounded-xl ${isProcessing ? 'opacity-70 cursor-not-allowed' : 'transition-all duration-300 hover:scale-[1.02] hover:shadow-indigo-500/20'}`}
          >
            <div className="absolute inset-0 bg-white/5 rounded-xl"></div>
            <div className="flex items-center justify-center">
              <div className="relative">
                <div className={`absolute -inset-1 bg-indigo-600/30 rounded-full blur-md ${isProcessing ? 'animate-pulse' : ''}`}></div>
                <PlayCircle className="h-5 w-5 mr-2 relative" />
              </div>
              <span className="relative">Process All Sources with OpenAI</span>
            </div>
          </Button>
          
          {messages.length > 0 && !isProcessing && (
            <Button 
              variant="outline"
              onClick={async () => {
                // Save graph to database
                try {
                  const assistantMessages = messages.filter(msg => msg.role === 'assistant');
                  if (assistantMessages.length > 0) {
                    const latestMessage = assistantMessages[assistantMessages.length - 1];
                    if (latestMessage.content.includes('graph') && latestMessage.content.includes('nodes') && latestMessage.content.includes('links')) {
                      // Get the graph data from the last message
                      let graph;
                      try {
                        // Try to parse as direct JSON if possible
                        graph = JSON.parse(latestMessage.content);
                        // Check if it's wrapped in a data object
                        if (graph.data && graph.data.graph) {
                          graph = graph.data.graph;
                        }
                        // If it's not a direct graph object but has graph property
                        else if (graph.graph) {
                          graph = graph.graph;
                        }
                      } catch (parseError) {
                        // If we can't parse the entire content as JSON, try to extract the graph part
                        // Using a more compatible regex approach without 's' flag
                        const graphMatch = latestMessage.content.match(/\{\s*"nodes":\s*\[[^\]]*\],\s*"links":\s*\[[^\]]*\]\s*\}/);
                        if (graphMatch) {
                          try {
                            graph = JSON.parse(graphMatch[0]);
                          } catch {
                            graph = { nodes: [], links: [] };
                          }
                        } else {
                          graph = { nodes: [], links: [] };
                        }
                      }
                      
                      if (graph && graph.nodes && graph.nodes.length > 0 && graph.links && graph.links.length > 0) {
                        try {
                          // Import the API function
                          const { saveGraph } = await import('@/lib/api');
                          
                          // Save the graph with current date as name
                          const graphName = `Knowledge Graph (${new Date().toLocaleDateString()})`;
                          await saveGraph(graph, graphName, 'Generated from multiple sources');
                          
                          // Use toast instead of alert for better UX
                          const { toast } = await import('@/hooks/use-toast');
                          toast({
                            title: 'Graph saved successfully',
                            description: `Knowledge graph saved with ${graph.nodes.length} nodes and ${graph.links.length} links.`,
                            variant: 'default'
                          });
                        } catch (saveError) {
                          console.error('Error during graph save:', saveError);
                          const { toast } = await import('@/hooks/use-toast');
                          toast({
                            title: 'Failed to save graph',
                            description: saveError instanceof Error ? saveError.message : 'Unknown error occurred',
                            variant: 'destructive'
                          });
                        }
                      } else {
                        // Use toast instead of alert for better UX
                        const { toast } = await import('@/hooks/use-toast');
                        toast({
                          title: 'No valid graph data',
                          description: 'Could not find valid graph data to save. Process your sources first.',
                          variant: 'destructive'
                        });
                      }
                    } else {
                      const { toast } = await import('@/hooks/use-toast');
                      toast({
                        title: 'No graph data',
                        description: 'No graph data available yet. Process your sources first.',
                        variant: 'destructive'
                      });
                    }
                  } else {
                    const { toast } = await import('@/hooks/use-toast');
                    toast({
                      title: 'No results available',
                      description: 'No processing results available yet. Process your sources first.',
                      variant: 'destructive'
                    });
                  }
                } catch (error) {
                  console.error('Error saving graph:', error);
                  const { toast } = await import('@/hooks/use-toast');
                  toast({
                    title: 'Error saving graph',
                    description: error instanceof Error ? error.message : 'Unknown error occurred',
                    variant: 'destructive'
                  });
                }
              }}
              className="w-full py-3 text-sm font-medium bg-gradient-to-r from-blue-700 to-indigo-600 hover:from-blue-600 hover:to-indigo-500 border-0 shadow-lg transition-all duration-300 hover:scale-[1.02] rounded-xl relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-white/5 rounded-xl"></div>
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/0 via-blue-500/20 to-blue-500/0 opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-500"></div>
              <div className="relative flex items-center justify-center">
                <svg className="h-5 w-5 mr-2 text-blue-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                <span>Save Knowledge Graph</span>
              </div>
            </Button>
          )}
        </div>
        
        <div className="text-xs text-gray-400 mt-3 text-center bg-[#131f38]/30 p-2 rounded-lg border border-[#1e2943]/30">
          <div className="flex items-center justify-center mb-1">
            <ArrowUpDown className="h-3 w-3 mr-1 text-indigo-400" />
            <span className="text-indigo-300 font-medium">Processing Order Matters</span>
          </div>
          <p>Sources will be processed sequentially from top to bottom. Drag to customize the processing flow.</p>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 flex-grow flex flex-col overflow-auto custom-scrollbar-dark">
        {messages.length === 0 && !isProcessing ? (
          <div className="flex-grow flex flex-col items-center justify-center text-center p-4 relative">
            {/* Decorative background elements */}
            <div className="absolute top-1/4 left-1/4 w-16 h-16 rounded-full bg-indigo-600/10 blur-xl"></div>
            <div className="absolute bottom-1/3 right-1/3 w-24 h-24 rounded-full bg-purple-600/10 blur-xl"></div>
            <div className="absolute top-1/2 right-1/4 w-12 h-12 rounded-full bg-blue-600/10 blur-xl"></div>
            
            {/* Animated brain icon */}
            <div className="relative mb-8">
              <div className="absolute -inset-10 bg-gradient-to-r from-indigo-500/0 via-indigo-500/10 to-purple-500/0 rounded-full blur-xl animate-pulse-slow"></div>
              <div className="p-6 rounded-full bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-800/40 relative">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-full animate-spin-slow"></div>
                <Brain className="h-20 w-20 text-indigo-400 relative z-10" />
              </div>
              
              {/* Animated connection lines */}
              <div className="absolute -inset-4 flex items-center justify-center">
                <div className="w-full h-full absolute">
                  <div className="absolute top-1/2 left-0 w-12 h-0.5 bg-gradient-to-r from-indigo-500/0 via-indigo-500/50 to-indigo-500/0 animate-ping-slow"></div>
                  <div className="absolute top-1/4 right-1/4 w-10 h-0.5 bg-gradient-to-r from-purple-500/0 via-purple-500/50 to-purple-500/0 animate-ping-slow delay-300"></div>
                  <div className="absolute bottom-1/3 right-0 w-14 h-0.5 bg-gradient-to-r from-blue-500/0 via-blue-500/50 to-blue-500/0 animate-ping-slow delay-700"></div>
                </div>
              </div>
            </div>
            
            <div className="space-y-4 max-w-md relative z-10">
              <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300">
                AI-Powered Knowledge Extraction
              </h3>
              <p className="text-gray-400 text-sm">
                Transform your information sources into a comprehensive knowledge graph using advanced AI analysis.
              </p>
              
              {/* Visual step indicators */}
              <div className="grid grid-cols-1 gap-4 mt-6">
                <div className="bg-[#131f38]/50 rounded-xl border border-[#1e2943]/30 p-4 transform transition-all duration-300 hover:scale-[1.02] hover:shadow-md hover:shadow-indigo-500/10 group">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 bg-gradient-to-br from-indigo-600 to-indigo-800 p-3 rounded-lg shadow-md mr-4 group-hover:scale-110 transition-transform duration-300">
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-sm font-medium text-indigo-300 mb-1">Add Information Sources</h4>
                      <p className="text-xs text-gray-400">Text, URLs, documents, and images can all be analyzed to extract knowledge.</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-[#131f38]/50 rounded-xl border border-[#1e2943]/30 p-4 transform transition-all duration-300 hover:scale-[1.02] hover:shadow-md hover:shadow-purple-500/10 group">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 bg-gradient-to-br from-purple-600 to-purple-800 p-3 rounded-lg shadow-md mr-4 group-hover:scale-110 transition-transform duration-300">
                      <Link className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-sm font-medium text-purple-300 mb-1">Create Connections</h4>
                      <p className="text-xs text-gray-400">Link related information sources to establish complex relationships between entities.</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-[#131f38]/50 rounded-xl border border-[#1e2943]/30 p-4 transform transition-all duration-300 hover:scale-[1.02] hover:shadow-md hover:shadow-blue-500/10 group">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 bg-gradient-to-br from-blue-600 to-blue-800 p-3 rounded-lg shadow-md mr-4 group-hover:scale-110 transition-transform duration-300">
                      <Network className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-sm font-medium text-blue-300 mb-1">Generate Knowledge Graph</h4>
                      <p className="text-xs text-gray-400">Advanced AI processing creates an interactive visualization of extracted knowledge.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5 flex-grow">
            {/* Progress Indicator */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <div className="text-sm font-medium text-gray-300">
                  {isProcessing ? 'Processing...' : hasError ? 'Processing Failed' : 'Processing Complete'}
                </div>
                <div className="text-xs text-gray-500">
                  {Math.round(calculateProgress())}%
                </div>
              </div>
              <div className={`h-2 w-full rounded-full overflow-hidden ${hasError ? 'bg-red-500/20' : 'bg-gray-800'}`}>
                <div 
                  className={`h-full transition-all ${hasError ? 'bg-red-500' : 'bg-primary'}`}
                  style={{ width: `${calculateProgress()}%` }}
                ></div>
              </div>
            </div>
            
            {/* Status Card */}
            <div className={`rounded-lg border p-4 ${
              hasError ? 'border-red-800 bg-red-950/20' : 
              isProcessing ? 'border-yellow-800 bg-yellow-950/20' : 
              'border-green-800 bg-green-950/20'
            }`}>
              <div className="flex items-start">
                <div className={`rounded-full p-1 mr-3 ${
                  hasError ? 'bg-red-900/50 text-red-400' : 
                  isProcessing ? 'bg-yellow-900/50 text-yellow-400' : 
                  'bg-green-900/50 text-green-400'
                }`}>
                  {hasError ? <AlertCircle className="h-5 w-5" /> : 
                   isProcessing ? <Clock className="h-5 w-5" /> : 
                   <CheckCircle className="h-5 w-5" />}
                </div>
                <div>
                  <h4 className={`text-sm font-medium ${
                    hasError ? 'text-red-400' : 
                    isProcessing ? 'text-yellow-400' : 
                    'text-green-400'
                  }`}>
                    {hasError ? 'Processing Error' : 
                     isProcessing ? 'Processing in Progress' : 
                     'Processing Complete'}
                  </h4>
                  <p className="text-xs mt-1 text-gray-400">
                    {hasError ? 'There was an error processing your sources. Check the logs below.' : 
                     isProcessing ? 'Your sources are being analyzed. Please wait...' : 
                     'All sources have been successfully processed.'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Processing Logs */}
            <div className="flex-grow">
              <div className="text-sm font-medium text-gray-300 mb-2 flex items-center">
                <InfoIcon className="h-4 w-4 mr-1" />
                Processing Logs
              </div>
              <div className="border border-gray-800 rounded-lg bg-gray-950 overflow-hidden flex flex-col h-[550px]">
                <ScrollArea className="flex-grow w-full h-full custom-scrollbar-dark">
                  <div className="p-3 space-y-3 overflow-x-hidden">
                    {statusMessages.map((msg, index) => (
                      <div 
                        key={index} 
                        style={{animationDelay: `${index * 0.05}s`}}
                        className={`p-3 rounded border text-xs shadow-sm animate-fadeIn ${
                          msg.content.toLowerCase().includes('error') 
                            ? 'border-red-800 bg-red-950/20 text-red-300' 
                            : msg.role === 'system' 
                            ? 'border-blue-800 bg-blue-950/20 text-blue-300'
                            : msg.role === 'user'
                            ? 'border-indigo-800 bg-indigo-950/20 text-indigo-300'
                            : 'border-emerald-800 bg-emerald-950/20 text-emerald-300'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-mono text-gray-500 flex items-center">
                            <div className={`w-2 h-2 rounded-full mr-2 ${
                              msg.content.toLowerCase().includes('error') 
                                ? 'bg-red-500 animate-pulse' 
                                : msg.role === 'system' 
                                ? 'bg-blue-500'
                                : msg.role === 'user'
                                ? 'bg-indigo-500'
                                : 'bg-emerald-500'
                            }`}></div>
                            {msg.timestamp.toLocaleTimeString()}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                            msg.content.toLowerCase().includes('error') 
                              ? 'bg-red-900/30 text-red-400 border border-red-800/40' 
                              : msg.role === 'system' 
                              ? 'bg-blue-900/30 text-blue-400 border border-blue-800/40'
                              : msg.role === 'user' 
                              ? 'bg-indigo-900/30 text-indigo-400 border border-indigo-800/40' 
                              : 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/40'
                          }`}>
                            {msg.content.toLowerCase().includes('error') ? 'ERROR' : 
                             msg.role === 'system' ? 'SYSTEM' :
                             msg.role === 'user' ? 'REQUEST' : 
                             'RESULT'}
                          </span>
                        </div>
                        <div className="font-mono whitespace-pre-wrap">
                          {msg.role === 'assistant' && msg.content.includes('=== SUMMARY ===') ? (
                            <div>
                              {msg.content.split("=== SUMMARY ===").map((part, idx) => {
                                if (idx === 0) return part;
                                
                                // For the summary section
                                const summaryEnd = part.indexOf("=== ANALYSIS ===");
                                const summary = summaryEnd > -1 ? part.substring(0, summaryEnd).trim() : part.trim();
                                
                                // For the analysis and connections sections
                                let analysis = "";
                                let connections = "";
                                
                                if (summaryEnd > -1) {
                                  const analysisSection = part.substring(summaryEnd);
                                  const connectionsStart = analysisSection.indexOf("=== CONNECTIONS ===");
                                  
                                  if (connectionsStart > -1) {
                                    analysis = analysisSection.substring(0, connectionsStart).trim();
                                    connections = analysisSection.substring(connectionsStart).trim();
                                  } else {
                                    analysis = analysisSection.trim();
                                  }
                                }
                                
                                return (
                                  <div key={idx}>
                                    <div className="mb-2 mt-2">
                                      <div className="text-blue-300 font-semibold mb-1 border-l-2 border-blue-500 pl-2">Source Summary</div>
                                      <div className="p-2 bg-blue-900/20 rounded text-blue-200">{summary}</div>
                                    </div>
                                    <div>{analysis}</div>
                                    {connections && (
                                      <div className="mb-2 mt-3">
                                        <div className="text-green-300 font-semibold mb-1 border-l-2 border-green-500 pl-2">Source Connections</div>
                                        <div className="p-2 bg-green-900/20 rounded text-green-200">{connections.replace("=== CONNECTIONS ===", "").trim()}</div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            msg.content
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {/* Current Processing Status */}
                    {isProcessing && streamingContent && (
                      <div className="p-3 rounded border border-indigo-800 bg-indigo-950/20 text-indigo-300 text-xs shadow-sm animate-fadeIn relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/0 via-indigo-600/5 to-indigo-600/0 bg-[length:200%_100%] animate-shimmer"></div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-mono text-gray-500 flex items-center">
                            <div className="w-2 h-2 rounded-full mr-2 bg-indigo-500 animate-pulse"></div>
                            {new Date().toLocaleTimeString()}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-900/30 text-indigo-400 border border-indigo-800/40 animate-pulse">
                            PROCESSING
                          </span>
                        </div>
                        <div className="font-mono whitespace-pre-wrap">
                          {streamingContent.includes('=== SUMMARY ===') ? (
                            <div>
                              {streamingContent.split("=== SUMMARY ===").map((part, idx) => {
                                if (idx === 0) return part;
                                
                                // For the summary section
                                const summaryEnd = part.indexOf("=== ANALYSIS ===");
                                const summary = summaryEnd > -1 ? part.substring(0, summaryEnd).trim() : part.trim();
                                
                                // For the analysis and connections sections
                                let analysis = "";
                                let connections = "";
                                
                                if (summaryEnd > -1) {
                                  const analysisSection = part.substring(summaryEnd);
                                  const connectionsStart = analysisSection.indexOf("=== CONNECTIONS ===");
                                  
                                  if (connectionsStart > -1) {
                                    analysis = analysisSection.substring(0, connectionsStart).trim();
                                    connections = analysisSection.substring(connectionsStart).trim();
                                  } else {
                                    analysis = analysisSection.trim();
                                  }
                                }
                                
                                return (
                                  <div key={idx}>
                                    <div className="mb-2 mt-2">
                                      <div className="text-blue-300 font-semibold mb-1 border-l-2 border-blue-500 pl-2">Source Summary</div>
                                      <div className="p-2 bg-blue-900/20 rounded text-blue-200">{summary}</div>
                                    </div>
                                    <div>{analysis}</div>
                                    {connections && (
                                      <div className="mb-2 mt-3">
                                        <div className="text-green-300 font-semibold mb-1 border-l-2 border-green-500 pl-2">Source Connections</div>
                                        <div className="p-2 bg-green-900/20 rounded text-green-200">{connections.replace("=== CONNECTIONS ===", "").trim()}</div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            streamingContent
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div ref={logsRef} />
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AssistantPanel;