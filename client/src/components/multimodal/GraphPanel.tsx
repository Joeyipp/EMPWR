import { FC, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GraphPanelProps } from '@/types/multimodal';
import { Network, ZoomIn, ZoomOut, RotateCcw, Database, Sparkles, Braces, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Get color for node based on group with enhanced color palette
function getNodeColor(group: number): string {
  const colors = [
    '#4361ee', // Vibrant Blue
    '#4cc9f0', // Cyan
    '#f72585', // Pink
    '#7209b7', // Purple
    '#3a86ff', // Royal Blue
    '#fb5607', // Orange
    '#ffbe0b', // Yellow
    '#8ac926', // Green
    '#06d6a0'  // Teal
  ];
  
  // Use modulo to ensure we always have a color, even for large group numbers
  return colors[group % colors.length];
}

// Get group label for better readability
function getGroupLabel(group: number): string {
  const groups = [
    "People",
    "Organizations",
    "Locations",
    "Concepts",
    "Events",
    "Products",
    "Creative Works",
    "Technologies",
    "Other"
  ];
  
  return group < groups.length ? groups[group] : `Group ${group}`;
}

// Custom radar chart component for entity distribution
const EntityRadarChart: FC<{nodes: any[]}> = ({ nodes }) => {
  // Count entities by group
  const groupCounts: {[key: number]: number} = {};
  nodes.forEach(node => {
    const group = node.group || 0;
    groupCounts[group] = (groupCounts[group] || 0) + 1;
  });
  
  // Get max count for scaling
  const maxCount = Math.max(...Object.values(groupCounts), 1);
  
  // Convert to array for rendering
  const groupData = Object.entries(groupCounts)
    .map(([group, count]) => ({
      group: parseInt(group),
      count,
      percentage: (count / maxCount) * 100
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6); // Show top 6 groups
  
  return (
    <div className="relative w-full h-48 flex items-center justify-center">
      {/* Decorative background */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500/5 to-purple-500/5"></div>
      <div className="absolute w-32 h-32 rounded-full border border-gray-800/50"></div>
      <div className="absolute w-64 h-64 rounded-full border border-gray-800/30"></div>
      <div className="absolute w-96 h-96 rounded-full border border-gray-800/20"></div>
      
      {/* Data points */}
      {groupData.map((item, i) => {
        // Calculate position on radar
        const angle = (i * (360 / groupData.length)) * (Math.PI / 180);
        const distance = (item.percentage / 100) * 120; // 120px is max radius
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        
        return (
          <div key={item.group} className="absolute" style={{
            transform: `translate(${x}px, ${y}px)`,
            transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            <div className="relative">
              <div 
                className="w-4 h-4 rounded-full shadow-lg animate-pulse-slow" 
                style={{ 
                  backgroundColor: getNodeColor(item.group),
                  opacity: 0.7
                }}
              />
              <div className="absolute -inset-1 rounded-full opacity-50" style={{ 
                backgroundColor: getNodeColor(item.group),
                filter: 'blur(4px)'
              }}></div>
              <div className="absolute -top-8 -left-20 w-40 text-center">
                <span className="px-2 py-1 bg-gray-800/80 rounded text-xs whitespace-nowrap">
                  {getGroupLabel(item.group)}: <span className="font-semibold text-white">{item.count}</span>
                </span>
              </div>
            </div>
            
            {/* Line to center */}
            <div className="absolute top-1/2 left-1/2 w-full h-0.5 origin-left" style={{
              backgroundColor: `${getNodeColor(item.group)}50`,
              width: distance,
              transform: `rotate(${angle * (180 / Math.PI)}deg)`,
              zIndex: -1,
              transformOrigin: '0 0'
            }}></div>
          </div>
        );
      })}
      
      {/* Center point */}
      <div className="absolute">
        <div className="relative">
          <div className="w-6 h-6 rounded-full bg-indigo-600/30 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
          </div>
          <div className="absolute -inset-1 rounded-full bg-indigo-500/20 filter blur-sm"></div>
        </div>
      </div>
    </div>
  );
};

const GraphPanel: FC<GraphPanelProps> = ({ graph, isLoading }) => {
  // State for active tab
  const [activeTab, setActiveTab] = useState<'overview' | 'entities' | 'connections'>('overview');
  
  // Animation effect when graph data changes
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    if (graph.nodes.length > 0) {
      setAnimate(true);
      const timer = setTimeout(() => setAnimate(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [graph.nodes.length]);
  
  return (
    <Card className="border border-[#1b1e29]/50 bg-[#0d1016] h-full flex flex-col shadow-lg overflow-hidden">
      <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between border-b border-[#1b1e29]/50 bg-[#0d1016]">
        <div className="flex items-center">
          <div className="relative bg-gradient-to-br from-blue-500 to-indigo-700 p-2 rounded-lg shadow-md mr-3 transform hover:rotate-12 transition-all duration-300">
            <Network className="h-5 w-5 text-white" />
            <div className="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-blue-500/0 via-blue-500/40 to-blue-500/0 opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-500 pointer-events-none"></div>
          </div>
          <CardTitle className="text-base text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-indigo-300 font-semibold">
            Insight Explorer
          </CardTitle>
        </div>
        <div className="flex items-center">
          {graph.nodes.length > 0 && (
            <Badge variant="outline" className="bg-blue-950/40 text-xs border-blue-800/50 flex items-center gap-1 rounded-full px-3">
              <span className="text-blue-300 font-medium">{graph.nodes.length}</span>
              <span className="text-gray-400">nodes</span>
              <span className="mx-1 text-gray-600">·</span>
              <span className="text-indigo-300 font-medium">{graph.links.length}</span>
              <span className="text-gray-400">relationships</span>
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-grow relative">
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 space-y-4 bg-gray-950/50">
            <div className="relative">
              <div className="h-20 w-20 rounded-full border-4 border-indigo-600/30 border-t-indigo-500 animate-spin"></div>
              <div className="absolute -inset-4 bg-indigo-500/10 rounded-full blur-xl animate-pulse-slow"></div>
              <Network className="h-10 w-10 text-indigo-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="text-center mt-6">
              <p className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 font-semibold text-lg">Generating Knowledge Graph</p>
              <p className="text-gray-400 text-sm mt-2">Extracting entities and mapping relationships...</p>
              
              {/* Visual Processing indicator */}
              <div className="flex flex-col items-center mt-8 max-w-xs">
                <div className="w-full bg-gray-800/60 h-1.5 rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 animate-pulse-slow rounded-full" style={{width: '75%'}}></div>
                </div>
                <div className="grid grid-cols-3 w-full gap-1">
                  <div className="flex items-center justify-center text-xs bg-blue-900/20 rounded py-1 border border-blue-900/30">
                    <span className="text-blue-400">Extracting</span>
                  </div>
                  <div className="flex items-center justify-center text-xs bg-indigo-900/20 rounded py-1 border border-indigo-900/30">
                    <span className="text-indigo-400">Mapping</span>
                  </div>
                  <div className="flex items-center justify-center text-xs bg-purple-900/20 rounded py-1 border border-purple-900/30">
                    <span className="text-purple-300">Visualizing</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : graph.nodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 relative">
            {/* Decorative background elements */}
            <div className="absolute top-1/4 left-1/4 w-24 h-24 rounded-full bg-blue-600/5 blur-xl"></div>
            <div className="absolute bottom-1/3 right-1/3 w-32 h-32 rounded-full bg-indigo-600/5 blur-xl"></div>
            
            {/* Empty state illustration */}
            <div className="relative mb-8">
              <div className="p-6 rounded-full bg-gradient-to-br from-blue-900/30 to-indigo-900/30 border border-blue-800/40 relative mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 rounded-full animate-pulse-slow"></div>
                <Network className="h-20 w-20 text-blue-400 relative z-10" />
              </div>
              
              {/* Animated graph nodes */}
              <div className="absolute -inset-12 flex items-center justify-center">
                <div className="w-full h-full absolute">
                  {[0, 1, 2, 3, 4, 5].map(i => {
                    const angle = (i * 60) * (Math.PI / 180);
                    const distance = 80;
                    const x = Math.cos(angle) * distance;
                    const y = Math.sin(angle) * distance;
                    
                    return (
                      <div key={i} className="absolute" style={{
                        transform: `translate(${x}px, ${y}px)`
                      }}>
                        <div className="w-3 h-3 rounded-full animate-pulse-slow" style={{
                          backgroundColor: getNodeColor(i),
                          animationDelay: `${i * 0.2}s`,
                          opacity: 0.7
                        }}></div>
                        <div className="absolute -inset-1 rounded-full opacity-50 blur-sm" style={{
                          backgroundColor: getNodeColor(i)
                        }}></div>
                        
                        {/* Connection line to center */}
                        <div className="absolute top-1/2 left-1/2 h-0.5 origin-left" style={{
                          backgroundColor: `${getNodeColor(i)}40`,
                          width: distance - 10,
                          transform: `rotate(${angle * (180 / Math.PI) - 180}deg)`,
                          transformOrigin: '0 0'
                        }}></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            <div className="space-y-4 max-w-md relative z-10">
              <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-indigo-300">
                Interactive Knowledge Graph
              </h3>
              <p className="text-gray-400 text-sm">
                Process your information sources to transform unstructured data into a visual network of entities and relationships.
              </p>
              
              <div className="flex justify-center mt-4">
                <div className="inline-flex items-center rounded-full bg-blue-900/20 border border-blue-900/40 px-4 py-2 text-sm text-blue-300">
                  <ZoomIn className="h-4 w-4 mr-2" />
                  Process sources to generate your graph
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-hidden flex flex-col">
            {/* Tab Navigation */}
            <div className="flex border-b border-[#1e2943]/50 bg-[#0e182f]">
              <button 
                className={`flex items-center px-4 py-2 text-sm font-medium ${activeTab === 'overview' 
                  ? 'text-blue-400 border-b-2 border-blue-500' 
                  : 'text-gray-400 hover:text-gray-300'}`}
                onClick={() => setActiveTab('overview')}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Overview
              </button>
              <button 
                className={`flex items-center px-4 py-2 text-sm font-medium ${activeTab === 'entities' 
                  ? 'text-indigo-400 border-b-2 border-indigo-500' 
                  : 'text-gray-400 hover:text-gray-300'}`}
                onClick={() => setActiveTab('entities')}
              >
                <Database className="h-4 w-4 mr-2" />
                Entities
              </button>
              <button 
                className={`flex items-center px-4 py-2 text-sm font-medium ${activeTab === 'connections' 
                  ? 'text-purple-400 border-b-2 border-purple-500' 
                  : 'text-gray-400 hover:text-gray-300'}`}
                onClick={() => setActiveTab('connections')}
              >
                <Braces className="h-4 w-4 mr-2" />
                Relationships
              </button>
            </div>
            
            {/* Tab Content */}
            <div className="flex-grow overflow-auto custom-scrollbar-dark p-4">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className={`space-y-4 ${animate ? 'animate-fade-in' : ''}`}>
                  {/* Entity Distribution Visualization */}
                  <div className="rounded-xl border border-[#1e2943]/50 bg-[#0e182f]/40 p-4 shadow-sm">
                    <h3 className="text-md font-medium text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 mb-4 flex items-center">
                      <div className="w-1 h-4 rounded bg-gradient-to-b from-blue-500 to-indigo-600 mr-2"></div>
                      Entity Distribution
                    </h3>
                    <EntityRadarChart nodes={graph.nodes} />
                  </div>
                  
                  {/* Quick Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-[#1e2943]/50 bg-[#0e182f]/40 p-3 shadow-sm text-center">
                      <span className="text-xs text-blue-400 uppercase mb-1 block">Entities</span>
                      <span className="text-2xl font-bold text-blue-300">{graph.nodes.length}</span>
                    </div>
                    <div className="rounded-xl border border-[#1e2943]/50 bg-[#0e182f]/40 p-3 shadow-sm text-center">
                      <span className="text-xs text-indigo-400 uppercase mb-1 block">Relationships</span>
                      <span className="text-2xl font-bold text-indigo-300">{graph.links.length}</span>
                    </div>
                    <div className="rounded-xl border border-[#1e2943]/50 bg-[#0e182f]/40 p-3 shadow-sm text-center">
                      <span className="text-xs text-purple-400 uppercase mb-1 block">Sources</span>
                      <span className="text-2xl font-bold text-purple-300">
                        {new Set(graph.nodes.map(n => n.properties?.sourceId || 'unknown')).size}
                      </span>
                    </div>
                  </div>
                  
                  {/* Top Entities */}
                  <div className="rounded-xl border border-[#1e2943]/50 bg-[#0e182f]/40 p-4 shadow-sm">
                    <h3 className="text-md font-medium text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 mb-3 flex items-center">
                      <div className="w-1 h-4 rounded bg-gradient-to-b from-blue-500 to-indigo-600 mr-2"></div>
                      Key Entities
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {graph.nodes
                        .sort((a, b) => {
                          // Sort by source count (descending)
                          const sourceCountA = a.properties?.sourceCount || 0;
                          const sourceCountB = b.properties?.sourceCount || 0;
                          return sourceCountB - sourceCountA;
                        })
                        .slice(0, 6)
                        .map((node) => (
                          <div key={node.id} className="bg-[#131f38]/30 rounded-lg border border-[#1e2943]/40 hover:border-[#1e2943]/60 transition-colors duration-150 p-2">
                            <div className="flex items-center mb-1">
                              <div 
                                className="flex-shrink-0 w-4 h-4 rounded-full mr-2 shadow-sm" 
                                style={{ backgroundColor: getNodeColor(node.group || 0) }}
                              />
                              <span className="text-sm text-gray-300 font-medium">{node.name}</span>
                              <span className="ml-auto text-xs bg-[#131f38]/50 py-0.5 px-2 rounded-full text-blue-300 border border-blue-900/30 whitespace-nowrap">
                                {node.properties?.sourceCount || 1} {(node.properties?.sourceCount || 1) > 1 ? 'sources' : 'source'}
                              </span>
                            </div>
                            <div className="text-xs text-gray-400 pl-6">
                              {node.properties?.description && 
                                <div className="truncate max-w-full">{node.properties.description}</div>
                              }
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                  
                  {/* Relations Visualization */}
                  <div className="rounded-xl border border-[#1e2943]/50 bg-[#0e182f]/40 p-4 shadow-sm">
                    <h3 className="text-md font-medium text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 mb-3 flex items-center">
                      <div className="w-1 h-4 rounded bg-gradient-to-b from-blue-500 to-indigo-600 mr-2"></div>
                      Relationship Types
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {Array.from(new Set(graph.links.map(link => link.relationship)))
                        .sort()
                        .slice(0, 10)
                        .map((relationship, index) => {
                          const count = graph.links.filter(link => link.relationship === relationship).length;
                          const percentage = Math.round((count / graph.links.length) * 100);
                          return (
                            <div key={index} className="bg-[#131f38]/30 rounded-lg border border-[#1e2943]/40 p-2">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-indigo-300 truncate max-w-[180px]">{relationship || 'Unknown'}</span>
                                <span className="text-xs text-gray-400 ml-2">{count}</span>
                              </div>
                              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Entities Tab */}
              {activeTab === 'entities' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#1e2943]/50 bg-[#0e182f]/40 p-4 shadow-sm">
                    <h3 className="text-md font-medium text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mb-3 flex items-center">
                      <div className="w-1 h-4 rounded bg-gradient-to-b from-indigo-500 to-purple-600 mr-2"></div>
                      Entity Explorer
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                      {graph.nodes
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .slice(0, 20)
                        .map((node) => (
                          <div 
                            key={node.id} 
                            className="bg-[#131f38]/30 rounded-lg border border-[#1e2943]/40 p-3 hover:border-[#1e2943]/60 transition-all duration-200 hover:shadow-md hover:shadow-indigo-900/10"
                          >
                            <div className="mb-3">
                              <div className="flex items-center mb-1">
                                <div 
                                  className="w-5 h-5 rounded-full mr-2 shadow-sm flex-shrink-0" 
                                  style={{ backgroundColor: getNodeColor(node.group || 0) }}
                                />
                                <h4 className="text-sm font-medium text-indigo-300 break-words">{node.name}</h4>
                              </div>
                              <div className="ml-7 -mt-1">
                                <Badge 
                                  variant="outline" 
                                  className="text-[10px] bg-indigo-900/20 border-indigo-900/40 text-indigo-400"
                                >
                                  {getGroupLabel(node.group || 0)}
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="text-xs text-gray-400 border-t border-[#1e2943]/30 pt-2">
                              {node.properties && Object.entries(node.properties)
                                .filter(([key]) => !['sourceId', 'sourceCount', 'provenance'].includes(key))
                                .map(([key, value]) => (
                                  <div key={key} className="mb-1.5">
                                    <span className="text-gray-500 block mb-0.5">{key}:</span>
                                    <span className="text-gray-300 block pl-2 break-words">{String(value).substring(0, 100)}{String(value).length > 100 ? '...' : ''}</span>
                                  </div>
                                ))}
                              
                              <div className="flex justify-between mt-2 pt-2 border-t border-[#1e2943]/30">
                                <span className="text-indigo-400 flex items-center">
                                  <Database className="h-3 w-3 mr-1 opacity-70" />
                                  {node.properties?.sourceCount || 1} source{(node.properties?.sourceCount || 1) > 1 ? 's' : ''}
                                </span>
                                <span className="text-blue-400 flex items-center">
                                  <Network className="h-3 w-3 mr-1 opacity-70" />
                                  {graph.links.filter(l => l.source === node.id || l.target === node.id).length} connections
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Connections Tab */}
              {activeTab === 'connections' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#1e2943]/50 bg-[#0e182f]/40 p-4 shadow-sm">
                    <h3 className="text-md font-medium text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 mb-3 flex items-center">
                      <div className="w-1 h-4 rounded bg-gradient-to-b from-purple-500 to-blue-600 mr-2"></div>
                      Relationship Explorer
                    </h3>
                    
                    <div className="space-y-3 mt-4">
                      {graph.links
                        .slice(0, 20)
                        .map((link, index) => {
                          const sourceNode = graph.nodes.find(n => n.id === link.source);
                          const targetNode = graph.nodes.find(n => n.id === link.target);
                          
                          if (!sourceNode || !targetNode) return null;
                          
                          return (
                            <div 
                              key={index} 
                              className="bg-[#131f38]/30 rounded-lg border border-[#1e2943]/40 p-3 hover:border-[#1e2943]/60 transition-all duration-200 hover:shadow-md hover:shadow-purple-900/10"
                            >
                              <div className="flex flex-col space-y-3">
                                {/* Source Node */}
                                <div className="flex items-start p-2 bg-[#131f38]/50 rounded-lg border border-[#1e2943]/30">
                                  <div 
                                    className="w-4 h-4 rounded-full mr-2 flex-shrink-0 mt-0.5" 
                                    style={{ backgroundColor: getNodeColor(sourceNode.group || 0) }}
                                  />
                                  <div className="flex-grow">
                                    <div className="text-sm text-gray-300 font-medium">{sourceNode.name}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">{getGroupLabel(sourceNode.group || 0)}</div>
                                  </div>
                                </div>
                                
                                {/* Relationship */}
                                <div className="flex items-center justify-center">
                                  <div className="px-4 py-1.5 bg-purple-900/20 rounded-full border border-purple-900/40 text-purple-300 text-sm font-medium shadow-sm">
                                    {link.relationship}
                                  </div>
                                </div>
                                
                                {/* Target Node */}
                                <div className="flex items-start p-2 bg-[#131f38]/50 rounded-lg border border-[#1e2943]/30">
                                  <div 
                                    className="w-4 h-4 rounded-full mr-2 flex-shrink-0 mt-0.5" 
                                    style={{ backgroundColor: getNodeColor(targetNode.group || 0) }}
                                  />
                                  <div className="flex-grow">
                                    <div className="text-sm text-gray-300 font-medium">{targetNode.name}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">{getGroupLabel(targetNode.group || 0)}</div>
                                  </div>
                                </div>
                              </div>
                              
                              {link.properties && Object.keys(link.properties).length > 0 && (
                                <div className="mt-2 pt-2 border-t border-[#1e2943]/30 text-xs text-gray-400">
                                  <div className="flex flex-wrap gap-2">
                                    {Object.entries(link.properties)
                                      .filter(([key]) => !['sourceId', 'sourceCount'].includes(key))
                                      .map(([key, value]) => (
                                        <span key={key} className="bg-gray-800/40 px-2 py-0.5 rounded border border-gray-700/30">
                                          {key}: {String(value).substring(0, 15)}{String(value).length > 15 ? '...' : ''}
                                        </span>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GraphPanel;