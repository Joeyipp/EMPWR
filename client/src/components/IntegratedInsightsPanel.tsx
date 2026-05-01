import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InfoIcon, BrainCircuitIcon, Bot, AlertCircleIcon, CheckCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import WordCloud from '@/components/ui/WordCloud';

// Define interface for component props
interface IntegratedInsightsPanelProps {
  graphName: string;
  graphId: number;
  entityCount: number;
  relationCount: number;
  apiKey?: string;
  savedApiKey?: string;
  loading: boolean;
  graphMetrics?: any;
  aiInsights?: any;
  assistant?: any;
  chatMessages: any[];
  userMessage: string;
  setUserMessage: (message: string) => void;
  handleSendMessage: (e: React.FormEvent) => void;
  handleGenerateInsights: () => void;
  handleCreateAssistant: () => void;
  setApiKeyRequired: (required: boolean) => void;
  setApiKey: (key: string) => void;
}

export function IntegratedInsightsPanel({
  graphName,
  graphId,
  entityCount,
  relationCount,
  apiKey,
  savedApiKey,
  loading,
  graphMetrics,
  aiInsights,
  assistant,
  chatMessages,
  userMessage,
  setUserMessage,
  handleSendMessage,
  handleGenerateInsights,
  handleCreateAssistant,
  setApiKeyRequired,
  setApiKey
}: IntegratedInsightsPanelProps) {
  // State for tabs
  const [activeTab, setActiveTab] = useState<string>('metrics');
  const [apiKeyRequired, setLocalApiKeyRequired] = useState<boolean>(false);

  // Update API key requirement state
  const handleApiKeyRequired = (required: boolean) => {
    setLocalApiKeyRequired(required);
    setApiKeyRequired(required);
  };

  // Determine if AI features are available
  const hasAiKey = !!savedApiKey || !!apiKey;
  
  // Control content displayed in AI insights/assistant tabs
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    
    if (!hasAiKey && (tab === 'ai-insights' || tab === 'assistant')) {
      handleApiKeyRequired(true);
      return;
    }
    
    if (tab === 'ai-insights' && !aiInsights) {
      handleGenerateInsights();
    } else if (tab === 'assistant' && !assistant) {
      handleCreateAssistant();
    }
  };

  // Format word cloud data from entities
  const getWordCloudData = () => {
    if (!graphMetrics?.mostConnectedEntities) return [];
    
    return graphMetrics.mostConnectedEntities.map((entity: any) => ({
      text: entity.name,
      value: entity.connectionCount * 5 // Scale up for better visualization
    }));
  };

  // Animation variants
  const containerAnimation = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemAnimation = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { type: "spring", stiffness: 100 }
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerAnimation}
      className="space-y-6"
    >
      <motion.div variants={itemAnimation}>
        <Card className="bg-gray-900 border-gray-800 shadow-lg overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
              {graphName}
            </CardTitle>
            <CardDescription>
              Graph #{graphId} • {entityCount} entities • {relationCount} relations
            </CardDescription>
          </CardHeader>

          {/* API Key info */}
          {savedApiKey && !apiKeyRequired && (
            <CardContent className="pt-0">
              <Alert className="bg-green-950/30 border-green-800 mb-4 animate-fade-in">
                <CheckCircleIcon className="h-4 w-4 text-green-500" />
                <AlertTitle>Using Saved API Key</AlertTitle>
                <AlertDescription>
                  Your saved OpenAI API key will be used for AI-powered features.
                </AlertDescription>
              </Alert>
            </CardContent>
          )}
          
          {/* API Key input if required */}
          {apiKeyRequired && (
            <CardContent className="pt-0">
              <Alert className="bg-yellow-950/30 border-yellow-800 mb-4">
                <AlertCircleIcon className="h-4 w-4 text-yellow-500" />
                <AlertTitle>OpenAI API Key Required</AlertTitle>
                <AlertDescription>
                  An OpenAI API key is required for AI-powered insights.
                </AlertDescription>
              </Alert>
              
              <div className="flex space-x-2">
                <Input
                  type="password"
                  placeholder="Enter your OpenAI API key"
                  value={apiKey || ''}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex-grow"
                />
                <Button 
                  onClick={() => {
                    if (apiKey) {
                      handleApiKeyRequired(false);
                      if (activeTab === 'ai-insights') {
                        handleGenerateInsights();
                      } else if (activeTab === 'assistant') {
                        handleCreateAssistant();
                      }
                    }
                  }}
                  disabled={!apiKey}
                >
                  Apply
                </Button>
              </div>
            </CardContent>
          )}

          <Tabs 
            defaultValue="metrics" 
            value={activeTab}
            onValueChange={handleTabChange}
            className="w-full"
          >
            <CardContent className="p-4 border-t border-gray-800">
              <TabsList className="grid w-full grid-cols-3 bg-gray-800">
                <TabsTrigger value="metrics" className="data-[state=active]:bg-primary/20">
                  <InfoIcon className="h-4 w-4 mr-2" />
                  Metrics
                </TabsTrigger>
                <TabsTrigger value="ai-insights" className="data-[state=active]:bg-primary/20">
                  <BrainCircuitIcon className="h-4 w-4 mr-2" />
                  AI Insights
                </TabsTrigger>
                <TabsTrigger value="assistant" className="data-[state=active]:bg-primary/20">
                  <Bot className="h-4 w-4 mr-2" />
                  Assistant
                </TabsTrigger>
              </TabsList>
            </CardContent>
          </Tabs>
        </Card>
      </motion.div>

      {/* Loading state */}
      {loading && (
        <motion.div variants={itemAnimation}>
          <Card className="p-8 bg-gray-900 border-gray-800 shadow-lg">
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-lg">
                {activeTab === 'ai-insights' ? 'Generating insights...' : activeTab === 'assistant' ? 'Setting up assistant...' : 'Analyzing graph...'}
              </p>
              <p className="text-sm text-gray-400 mt-2">
                This may take a few moments
              </p>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Tabs Content */}
      <Tabs 
        defaultValue="metrics" 
        value={activeTab}
        className="w-full"
      >
        {/* Metrics Tab Content */}
        <TabsContent value="metrics" className="mt-0">
          {!loading && graphMetrics && (
            <motion.div 
              initial="hidden"
              animate="visible"
              variants={containerAnimation}
              className="space-y-6"
            >
              {/* Summary metrics */}
              <motion.div variants={itemAnimation} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gray-900 border-gray-800 shadow-lg animate-slide-up">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-400">
                      Connected Components
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{graphMetrics.connectedComponentsCount}</div>
                    <p className="text-xs text-gray-400 mt-1">
                      {graphMetrics.density.toFixed(2)} graph density
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="bg-gray-900 border-gray-800 shadow-lg animate-slide-up" style={{ animationDelay: '0.1s' }}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-400">
                      Avg. Connections
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{graphMetrics.averageConnections.toFixed(1)}</div>
                    <p className="text-xs text-gray-400 mt-1">
                      per entity
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="bg-gray-900 border-gray-800 shadow-lg animate-slide-up" style={{ animationDelay: '0.2s' }}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-400">
                      Isolated Entities
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{graphMetrics.isolatedEntities.length}</div>
                    <p className="text-xs text-gray-400 mt-1">
                      {Math.round((graphMetrics.isolatedEntities.length / graphMetrics.entityCount) * 100)}% of total
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
              
              {/* Most connected entities visualization */}
              <motion.div variants={itemAnimation} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-gray-900 border-gray-800 shadow-lg animate-slide-left">
                  <CardHeader>
                    <CardTitle className="text-md flex items-center">
                      Most Connected Entities
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[300px] overflow-y-auto pr-2 scrollbar-hide hover:scrollbar-default">
                      {graphMetrics.mostConnectedEntities.slice(0, 10).map((entity: any, i: number) => (
                        <div key={`entity-${i}`} className="py-2 flex justify-between items-center">
                          <div className="flex items-center">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center mr-3 bg-primary/20 text-primary`}>
                              {i + 1}
                            </div>
                            <span className="text-sm font-medium">{entity.name}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="text-xs font-medium text-primary">{entity.connectionCount}</div>
                            <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary" 
                                style={{ 
                                  width: `${Math.min(100, (entity.connectionCount / (graphMetrics.mostConnectedEntities[0]?.connectionCount || 1)) * 100)}%`
                                }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gray-900 border-gray-800 shadow-lg overflow-hidden animate-slide-right">
                  <CardHeader>
                    <CardTitle className="text-md flex items-center">
                      Entity Connections
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px] relative">
                      <WordCloud 
                        words={getWordCloudData()} 
                        maxFontSize={40} 
                        minFontSize={14}
                      />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
              
              {/* Relationship types */}
              <motion.div variants={itemAnimation}>
                <Card className="bg-gray-900 border-gray-800 shadow-lg animate-slide-up">
                  <CardHeader>
                    <CardTitle className="text-md flex items-center">
                      Relationship Types
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[200px] overflow-y-auto pr-2 scrollbar-hide hover:scrollbar-default">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {graphMetrics.relationshipTypes.map((type: any, i: number) => (
                          <div key={`relation-${i}`} className="py-2 flex justify-between items-center">
                            <div className="flex-1 text-sm">{type.type}</div>
                            <div className="flex items-center space-x-2">
                              <div className="text-xs font-medium text-primary">{type.count}</div>
                              <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary" 
                                  style={{ 
                                    width: `${Math.min(100, (type.count / (graphMetrics.relationshipTypes[0]?.count || 1)) * 100)}%`
                                  }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          )}
        </TabsContent>
        
        {/* AI Insights Tab Content */}
        <TabsContent value="ai-insights" className="mt-0">
          {!loading && (
            <motion.div 
              initial="hidden"
              animate="visible"
              variants={containerAnimation}
            >
              {aiInsights ? (
                <motion.div variants={itemAnimation} className="space-y-6">
                  {/* Key Insights */}
                  <Card className="bg-gray-900 border-gray-800 shadow-lg animate-slide-up">
                    <CardHeader>
                      <CardTitle className="text-md flex items-center">
                        Key Insights
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide hover:scrollbar-default">
                        {aiInsights.keyInsights?.map((insight: string, i: number) => (
                          <div 
                            key={`insight-${i}`} 
                            className="p-3 bg-gray-800/50 rounded-md animate-fade-in"
                            style={{ animationDelay: `${i * 0.1}s` }}
                          >
                            {insight}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Patterns & Hypotheses */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Patterns */}
                    <Card className="bg-gray-900 border-gray-800 shadow-lg animate-slide-left">
                      <CardHeader>
                        <CardTitle className="text-md flex items-center">
                          Identified Patterns
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 scrollbar-hide hover:scrollbar-default">
                          {aiInsights.patterns?.map((pattern: any, i: number) => (
                            <div 
                              key={`pattern-${i}`} 
                              className="space-y-1 animate-fade-in"
                              style={{ animationDelay: `${i * 0.1}s` }}
                            >
                              <div className="font-medium text-sm text-primary">Pattern {i+1}</div>
                              <div className="text-sm">{pattern.description}</div>
                              <div className="w-full bg-gray-700 rounded-full h-1.5 my-1">
                                <div 
                                  className="bg-primary h-1.5 rounded-full" 
                                  style={{ width: `${(pattern.confidence || 0.5) * 100}%` }}
                                />
                              </div>
                              <div className="text-xs text-gray-400">
                                Confidence: {Math.round((pattern.confidence || 0.5) * 100)}%
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Hypotheses */}
                    <Card className="bg-gray-900 border-gray-800 shadow-lg animate-slide-right">
                      <CardHeader>
                        <CardTitle className="text-md flex items-center">
                          Generated Hypotheses
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 scrollbar-hide hover:scrollbar-default">
                          {aiInsights.hypotheses?.map((hypothesis: any, i: number) => (
                            <div 
                              key={`hypothesis-${i}`} 
                              className="space-y-1 animate-fade-in"
                              style={{ animationDelay: `${i * 0.1}s` }}
                            >
                              <div className="font-medium text-sm text-primary">Hypothesis {i+1}</div>
                              <div className="text-sm">{hypothesis.statement}</div>
                              <div className="text-xs text-gray-400 mt-1">
                                {hypothesis.reasoning}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </motion.div>
              ) : (
                <motion.div variants={itemAnimation}>
                  <Card className="p-8 bg-gray-900 border-gray-800 shadow-lg">
                    <div className="flex flex-col items-center justify-center text-center">
                      <BrainCircuitIcon className="h-12 w-12 text-primary/50 mb-4" />
                      <h3 className="text-lg font-medium mb-2">AI Insights Not Generated</h3>
                      <p className="text-gray-400 mb-6 max-w-md">
                        Generate AI-powered insights to discover patterns, connections, and hidden knowledge in your graph.
                      </p>
                      <Button onClick={handleGenerateInsights}>
                        Generate Insights
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              )}
            </motion.div>
          )}
        </TabsContent>
        
        {/* Assistant Tab Content */}
        <TabsContent value="assistant" className="mt-0">
          {!loading && (
            <motion.div 
              initial="hidden"
              animate="visible"
              variants={containerAnimation}
            >
              {assistant ? (
                <motion.div variants={itemAnimation}>
                  <Card className="overflow-hidden flex flex-col bg-gray-900 border-gray-800 shadow-lg animate-slide-up" style={{ height: '600px' }}>
                    <CardHeader className="pb-3 sticky top-0 z-10 bg-gray-900 border-b border-gray-800">
                      <CardTitle className="text-md flex items-center">
                        <Bot className="mr-2 h-5 w-5 text-primary" />
                        Graph Assistant
                      </CardTitle>
                    </CardHeader>
                    
                    <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-hide hover:scrollbar-default">
                      <div className="space-y-4">
                        {chatMessages.map((message) => (
                          <div 
                            key={message.id}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div 
                              className={`max-w-[80%] p-3 rounded-lg ${
                                message.role === 'user' 
                                  ? 'bg-primary/20 text-primary-foreground ml-12 animate-slide-left' 
                                  : message.role === 'assistant'
                                    ? 'bg-gray-800 text-gray-100 mr-12 animate-slide-right'
                                    : 'bg-gray-900 text-gray-400 border border-gray-800 text-sm animate-fade-in w-full'
                              }`}
                            >
                              {message.content}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="p-4 border-t border-gray-800 sticky bottom-0 bg-gray-900">
                      <form onSubmit={handleSendMessage} className="flex space-x-2">
                        <Input
                          placeholder="Ask a question about this knowledge graph..."
                          value={userMessage}
                          onChange={(e) => setUserMessage(e.target.value)}
                          className="flex-1 bg-gray-800 border-gray-700"
                        />
                        <Button type="submit" disabled={!userMessage.trim()}>
                          Send
                        </Button>
                      </form>
                    </div>
                  </Card>
                </motion.div>
              ) : (
                <motion.div variants={itemAnimation}>
                  <Card className="p-8 bg-gray-900 border-gray-800 shadow-lg animate-fade-in">
                    <div className="flex flex-col items-center justify-center text-center">
                      <Bot className="h-12 w-12 text-primary/50 mb-4" />
                      <h3 className="text-lg font-medium mb-2">Graph Assistant Not Initialized</h3>
                      <p className="text-gray-400 mb-6 max-w-md">
                        Create an AI assistant to ask questions and explore your knowledge graph through natural conversation.
                      </p>
                      <Button onClick={handleCreateAssistant}>
                        Create Assistant
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              )}
            </motion.div>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

export default IntegratedInsightsPanel;