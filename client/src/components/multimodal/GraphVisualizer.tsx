import { FC, useEffect, useRef, useState } from 'react';
import { KnowledgeGraph } from '@/types/multimodal';
import { ForceGraph2D } from 'react-force-graph';
import { 
  Network, User, Building, Globe, Calendar, Sparkles, FileText, 
  Lightbulb, Share2, ArrowUpRight, GitCommit, Target, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface GraphVisualizerProps {
  graph: KnowledgeGraph;
  isLoading: boolean;
  height?: string;
}

const GraphVisualizer: FC<GraphVisualizerProps> = ({ 
  graph, 
  isLoading,
  height = 'auto'
}) => {
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [hoverNode, setHoverNode] = useState<any>(null);
  const graphRef = useRef<any>();
  
  // Function to get node color based on entity type
  const getNodeColor = (group: number) => {
    switch (group) {
      case 1: return "#3B82F6"; // Person - blue
      case 2: return "#8B5CF6"; // Organization - purple
      case 3: return "#10B981"; // Place - green
      case 4: return "#F59E0B"; // Concept - amber
      case 5: return "#EC4899"; // Date - pink
      default: return "#6B7280"; // Other - gray
    }
  };
  
  // Function to get entity type name based on group
  const getEntityTypeName = (group: number): string => {
    switch (group) {
      case 1: return "Person";
      case 2: return "Organization";
      case 3: return "Place";
      case 4: return "Concept";
      case 5: return "Date";
      default: return "Other";
    }
  };
  
  // Function to get entity type icon based on group
  const getEntityIcon = (group: number) => {
    switch (group) {
      case 1: return <User className="h-3 w-3" />;
      case 2: return <Building className="h-3 w-3" />;
      case 3: return <Globe className="h-3 w-3" />;
      case 4: return <FileText className="h-3 w-3" />;
      case 5: return <Calendar className="h-3 w-3" />;
      default: return <Sparkles className="h-3 w-3" />;
    }
  };
  
  // If loading, show loading state
  if (isLoading) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center p-8 space-y-4 bg-gray-950/50">
        <div className="relative">
          <div className="h-20 w-20 rounded-full border-4 border-indigo-600/30 border-t-indigo-500 animate-spin"></div>
          <div className="absolute -inset-4 bg-indigo-500/10 rounded-full blur-xl"></div>
          <Network className="h-10 w-10 text-indigo-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
        </div>
        <div className="text-center mt-6">
          <p className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 font-semibold text-lg">Generating Knowledge Graph</p>
          <p className="text-gray-400 text-sm mt-2">Extracting entities and mapping relationships...</p>
        </div>
      </div>
    );
  }
  
  // If no data, show empty state
  if (graph.nodes.length === 0) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 relative">
        <div className="absolute top-1/4 left-1/4 w-24 h-24 rounded-full bg-blue-600/5 blur-xl"></div>
        <div className="absolute bottom-1/3 right-1/3 w-32 h-32 rounded-full bg-indigo-600/5 blur-xl"></div>
        
        <div className="relative mb-8">
          <div className="p-6 rounded-full bg-[#131f38]/50 border border-blue-800/40 relative mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 rounded-full"></div>
            <Network className="h-20 w-20 text-blue-400 relative z-10" />
          </div>
        </div>
        
        <div className="space-y-4 max-w-md relative z-10">
          <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-indigo-300">
            Interactive Knowledge Graph
          </h3>
          <p className="text-gray-400 text-sm">
            Process your information sources to transform unstructured data into a visual network of entities and relationships.
          </p>
        </div>
      </div>
    );
  }
  
  // Count entities by group (for distribution)
  const entityCounts: {[key: number]: number} = {};
  graph.nodes.forEach(node => {
    const group = node.group || 0;
    entityCounts[group] = (entityCounts[group] || 0) + 1;
  });
  
  // Convert entity counts to array for rendering
  const entityDistribution = Object.entries(entityCounts)
    .map(([group, count]) => ({
      group: parseInt(group),
      count,
      percentage: (count / graph.nodes.length) * 100
    }))
    .sort((a, b) => b.count - a.count);
  
  // Get top entities by relationship count
  const getNodeConnections = (nodeId: number): number => {
    return graph.links.filter(link => 
      link.source === nodeId || link.target === nodeId
    ).length;
  };
  
  // Sort nodes by connection count
  const keyEntities = [...graph.nodes]
    .map(node => ({
      ...node,
      connectionCount: getNodeConnections(node.id)
    }))
    .sort((a, b) => b.connectionCount - a.connectionCount)
    .slice(0, 5);
  
  return (
    <div className="h-full" style={{ height: height || 'calc(100vh - 280px)' }}>
      {/* Full-width Force Graph Visualization with key relations */}
      <div className="w-full h-full relative">
        <div className="absolute inset-0">
          <ForceGraph2D
            ref={graphRef}
            graphData={{
              nodes: graph.nodes.map(node => ({
                ...node,
                color: getNodeColor(node.group || 0),
                val: getNodeConnections(node.id) * 2 + 1 // Size based on connections
              })),
              links: graph.links
            }}
            nodeLabel={(node: any) => {
              const connections = graph.links.filter(link => 
                link.source === node.id || link.target === node.id
              ).length;
              return `${node.name} (${getEntityTypeName(node.group || 0)}, ${connections} connections)`;
            }}
            linkLabel={(link: any) => {
              const sourceNode = graph.nodes.find(n => n.id === link.source);
              const targetNode = graph.nodes.find(n => n.id === link.target);
              return `${sourceNode?.name || 'Unknown'} ${link.label || link.relationship || 'related to'} ${targetNode?.name || 'Unknown'}`;
            }}
            nodeRelSize={6}
            nodeVal={(node: any) => node.val}
            linkWidth={(link: any) => {
              // Highlight key relationships
              const isKeyLink = 
                link.relationship?.toLowerCase().includes('founded') || 
                link.relationship?.toLowerCase().includes('created') ||
                link.relationship?.toLowerCase().includes('owns') ||
                link.relationship?.toLowerCase().includes('manages') ||
                link.relationship?.toLowerCase().includes('works') ||
                link.relationship?.toLowerCase().includes('born') ||
                link.relationship?.toLowerCase().includes('located');
              
              return isKeyLink ? 3 : 1.5;
            }}
            linkColor={(link: any) => {
              // Color code relationships by type
              if (!link.relationship) return '#ffffff30';
              
              if (link.relationship.toLowerCase().includes('founded') || 
                  link.relationship.toLowerCase().includes('created') || 
                  link.relationship.toLowerCase().includes('invented'))
                return '#22c55e80'; // Green
                
              if (link.relationship.toLowerCase().includes('works') || 
                  link.relationship.toLowerCase().includes('employs') || 
                  link.relationship.toLowerCase().includes('manages'))
                return '#3b82f680'; // Blue
                
              if (link.relationship.toLowerCase().includes('located') || 
                  link.relationship.toLowerCase().includes('based'))
                return '#f59e0b80'; // Amber
                
              if (link.relationship.toLowerCase().includes('part') || 
                  link.relationship.toLowerCase().includes('component'))
                return '#8b5cf680'; // Purple
                
              if (link.relationship.toLowerCase().includes('married') || 
                  link.relationship.toLowerCase().includes('friend') ||
                  link.relationship.toLowerCase().includes('colleague'))
                return '#ec489980'; // Pink
                
              return '#94a3b880'; // Gray
            }}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={0.75}
            linkCurvature={0.25}
            linkDirectionalParticles={3}
            linkDirectionalParticleWidth={(link: any) => {
              // Add particles to important relationships
              const isKeyLink = 
                link.relationship?.toLowerCase().includes('founded') || 
                link.relationship?.toLowerCase().includes('created') ||
                link.relationship?.toLowerCase().includes('owns') ||
                link.relationship?.toLowerCase().includes('manages');
              
              return isKeyLink ? 2 : 0;
            }}
            linkCanvasObjectMode={() => 'after'}
            linkCanvasObject={(link: any, ctx: any, globalScale: number) => {
              // Only draw link text when zoomed in enough
              if (globalScale < 0.7) return;
              
              const sourceNode = typeof link.source === 'object' ? link.source : 
                graph.nodes.find(n => n.id === link.source);
              const targetNode = typeof link.target === 'object' ? link.target : 
                graph.nodes.find(n => n.id === link.target);
                
              if (!sourceNode || !targetNode) return;
              
              // Calculate position for text (midway along the link)
              const startX = sourceNode.x || 0;
              const startY = sourceNode.y || 0;
              const endX = targetNode.x || 0;
              const endY = targetNode.y || 0;
              
              const textX = startX + (endX - startX) / 2;
              const textY = startY + (endY - startY) / 2;
              
              // Draw text background for better readability
              const relationship = link.label || link.relationship || 'relates to';
              const fontSize = Math.max(9, 14 / globalScale);
              ctx.font = `${fontSize}px Sans-Serif`;
              
              // Measure text to create appropriate background
              const textWidth = ctx.measureText(relationship).width;
              const padding = 4/globalScale;
              
              // Draw a semi-transparent background behind the text
              ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
              ctx.fillRect(
                textX - textWidth/2 - padding,
                textY - fontSize/2 - padding,
                textWidth + padding * 2,
                fontSize + padding * 2
              );
              
              // Draw text
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
              ctx.fillText(relationship, textX, textY);
            }}
            cooldownTicks={100}
            onNodeClick={(node: any) => setSelectedNode(node)}
            onNodeHover={(node: any) => setHoverNode(node)}
            backgroundColor="#060d1d"
            nodeCanvasObjectMode={() => 'after'}
            nodeCanvasObject={(node: any, ctx: any, globalScale: number) => {
              // Add text labels for all nodes with dynamic sizing
              const isImportant = node === hoverNode || node === selectedNode || node.val > 6;
              if (globalScale >= 0.8 || isImportant) {
                const fontSize = isImportant ? 14/globalScale : 10/globalScale;
                ctx.font = `${isImportant ? 'bold ' : ''}${fontSize}px Sans-Serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = 'white';
                
                // Add a shadow/outline to make text more readable
                ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                ctx.shadowBlur = 4;
                
                // Position the text above the node
                const textPos = isImportant ? -12 : -8;
                ctx.fillText(node.name, node.x || 0, (node.y || 0) + textPos);
                ctx.shadowBlur = 0;
              }
              
              // Add entity type icon for node context
              if (globalScale >= 0.6 || isImportant) {
                const size = 8/globalScale;
                const iconSize = size * 1.5;
                
                // Draw circle background for icon
                ctx.beginPath();
                ctx.arc(node.x, node.y + (node.val || 5) + size*1.2, size, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.fill();
                
                // Draw entity type text
                ctx.font = `${size}px Sans-Serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = getNodeColor(node.group || 0);
                ctx.fillText(getEntityTypeName(node.group || 0).charAt(0), 
                             node.x, node.y + (node.val || 5) + size*1.2);
              }
            }}
          />
        </div>
        
        {/* Selected Node Details */}
        {selectedNode && (
          <div className="absolute bottom-4 right-4 w-64 bg-gray-900/90 border border-indigo-900/40 rounded-lg shadow-lg p-3">
            <div className="flex justify-between items-start mb-2">
              <div 
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ backgroundColor: getNodeColor(selectedNode.group || 0) }}
              >
                {getEntityIcon(selectedNode.group || 0)}
              </div>
              <Button
                variant="ghost" 
                size="sm"
                className="h-6 w-6 p-0 rounded-full text-gray-400 hover:text-gray-300"
                onClick={() => setSelectedNode(null)}
              >
                ✕
              </Button>
            </div>
            
            <h3 className="text-md font-medium text-indigo-300 mb-1">{selectedNode.name}</h3>
            <div className="mb-2">
              <Badge variant="outline" className="bg-indigo-950/30">
                {getEntityTypeName(selectedNode.group || 0)}
              </Badge>
            </div>
            
            <ScrollArea className="max-h-48 pr-4">
              <div className="space-y-2 text-xs text-gray-400">
                {selectedNode.properties && Object.entries(selectedNode.properties)
                  .filter(([key]) => !['sourceId', 'provenance', 'sourceCount'].includes(key))
                  .map(([key, value]) => (
                    <div key={key} className="flex">
                      <span className="text-gray-500 mr-2">{key}:</span>
                      <span>{String(value)}</span>
                    </div>
                  ))
                }
                
                <div className="mt-2 pt-2 border-t border-gray-800">
                  <div className="text-indigo-400 mb-1">Connections:</div>
                  {graph.links
                    .filter(link => link.source === selectedNode.id || link.target === selectedNode.id)
                    .slice(0, 5)
                    .map((link, idx) => {
                      const isSource = link.source === selectedNode.id;
                      const otherNodeId = isSource ? link.target : link.source;
                      const otherNode = graph.nodes.find(n => n.id === otherNodeId);
                      
                      return (
                        <div key={idx} className="flex items-center py-1">
                          <div 
                            className="w-2 h-2 rounded-full mr-2" 
                            style={{ backgroundColor: getNodeColor(otherNode?.group || 0) }}
                          />
                          <span className="text-gray-300">
                            {isSource ? 'To' : 'From'} {otherNode?.name}
                          </span>
                          {link.label && (
                            <span className="ml-1 text-gray-500">({link.label})</span>
                          )}
                        </div>
                      );
                    })
                  }
                  {graph.links.filter(link => 
                    link.source === selectedNode.id || link.target === selectedNode.id
                  ).length > 5 && (
                    <div className="text-gray-500 text-center text-xs mt-1">
                      +{graph.links.filter(link => 
                        link.source === selectedNode.id || link.target === selectedNode.id
                      ).length - 5} more connections
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>
        )}
        
        {/* Enhanced Legend with Key Relationships */}
        <div className="absolute top-4 left-4 bg-gray-900/90 border border-gray-800 rounded-lg p-3 shadow-lg max-w-xs">
          <div className="text-xs text-white font-semibold mb-2">Legend</div>
          
          <div className="mb-3">
            <div className="text-xs text-gray-400 mb-1">Entity Types</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {entityDistribution.map(item => (
                <div key={item.group} className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-1"
                    style={{ backgroundColor: getNodeColor(item.group) }}
                  />
                  <span className="text-[10px] text-gray-300">{getEntityTypeName(item.group)}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <div className="text-xs text-gray-400 mb-1">Key Relationships</div>
            <div className="space-y-1">
              <div className="flex items-center">
                <div className="w-6 h-0.5 mr-1 bg-[#22c55e80]"></div>
                <span className="text-[10px] text-gray-300">Founded/Created</span>
              </div>
              <div className="flex items-center">
                <div className="w-6 h-0.5 mr-1 bg-[#3b82f680]"></div>
                <span className="text-[10px] text-gray-300">Works/Employs</span>
              </div>
              <div className="flex items-center">
                <div className="w-6 h-0.5 mr-1 bg-[#f59e0b80]"></div>
                <span className="text-[10px] text-gray-300">Location</span>
              </div>
              <div className="flex items-center">
                <div className="w-6 h-0.5 mr-1 bg-[#ec489980]"></div>
                <span className="text-[10px] text-gray-300">Relationship</span>
              </div>
              <div className="flex items-center">
                <div className="w-6 h-0.5 mr-1 bg-[#94a3b880]"></div>
                <span className="text-[10px] text-gray-300">Other</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Key Insights Panel */}
        <div className="absolute bottom-4 left-4 w-80 max-w-xs bg-gray-900/90 border border-indigo-900/30 rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-900/50 to-blue-900/50 px-4 py-2 flex items-center border-b border-indigo-900/30">
            <Lightbulb className="h-4 w-4 text-indigo-400 mr-2" />
            <h3 className="text-sm font-medium text-indigo-300">Key Insights</h3>
          </div>
          
          <ScrollArea className="h-[180px]">
            <div className="p-3 space-y-3">
              {/* Insight items */}
              <div className="space-y-1">
                <div className="flex items-start">
                  <div className="mt-0.5 mr-2 bg-blue-500/20 p-1 rounded-full">
                    <Target className="h-3 w-3 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-blue-300">Central Entity</p>
                    <p className="text-[11px] text-gray-400">
                      {keyEntities[0]?.name || "No entity"} is the most connected entity with {keyEntities[0]?.connectionCount || 0} links.
                    </p>
                  </div>
                </div>
              </div>
                
              <div className="space-y-1">
                <div className="flex items-start">
                  <div className="mt-0.5 mr-2 bg-green-500/20 p-1 rounded-full">
                    <Share2 className="h-3 w-3 text-green-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-green-300">Network Density</p>
                    <p className="text-[11px] text-gray-400">
                      {graph.links.length} connections between {graph.nodes.length} entities.
                      {graph.links.length > graph.nodes.length * 1.5 ? " High density network." : " Moderate density network."}
                    </p>
                  </div>
                </div>
              </div>
                
              <div className="space-y-1">
                <div className="flex items-start">
                  <div className="mt-0.5 mr-2 bg-amber-500/20 p-1 rounded-full">
                    <GitCommit className="h-3 w-3 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-amber-300">Key Relationships</p>
                    <p className="text-[11px] text-gray-400">
                      {graph.links.filter(l => 
                        l.relationship?.toLowerCase().includes('founded') || 
                        l.relationship?.toLowerCase().includes('created')).length} creation relationships and {
                        graph.links.filter(l => 
                          l.relationship?.toLowerCase().includes('works') || 
                          l.relationship?.toLowerCase().includes('employs')).length} employment connections found.
                    </p>
                  </div>
                </div>
              </div>
                
              <div className="space-y-1">
                <div className="flex items-start">
                  <div className="mt-0.5 mr-2 bg-purple-500/20 p-1 rounded-full">
                    <ArrowUpRight className="h-3 w-3 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-purple-300">Distribution</p>
                    <p className="text-[11px] text-gray-400">
                      Most common entity type: {entityDistribution[0] ? 
                        `${getEntityTypeName(entityDistribution[0].group)} (${entityDistribution[0].count})` : 
                        "None"}.
                    </p>
                  </div>
                </div>
              </div>
                
              <div className="space-y-1">
                <div className="flex items-start">
                  <div className="mt-0.5 mr-2 bg-red-500/20 p-1 rounded-full">
                    <AlertCircle className="h-3 w-3 text-red-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-red-300">Missing Links</p>
                    <p className="text-[11px] text-gray-400">
                      {graph.nodes.filter(n => !graph.links.some(l => 
                        l.source === n.id || l.target === n.id
                      )).length} disconnected entities found in the network.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
        
        {/* Controls */}
        <TooltipProvider>
          <div className="absolute top-4 right-4 flex space-x-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-gray-900/80 border-gray-800">
                  <span className="sr-only">Zoom In</span>
                  +
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Zoom In</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-gray-900/80 border-gray-800">
                  <span className="sr-only">Zoom Out</span>
                  -
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Zoom Out</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-gray-900/80 border-gray-800">
                  <span className="sr-only">Reset View</span>
                  ↺
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reset View</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
};

export default GraphVisualizer;
