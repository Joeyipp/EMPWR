import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface GraphMetricsProps {
  graphMetrics: any;
}

const GraphMetricsPanel: React.FC<GraphMetricsProps> = ({ graphMetrics }) => {
  if (!graphMetrics) return null;
  
  return (
    <div className="w-80 pl-4 h-full">
      <ScrollArea className="h-full pr-4">
        <div className="space-y-4 pb-4">
          {/* Density metric */}
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 hover:border-gray-600 transition-colors">
            <h3 className="text-sm font-medium mb-1 text-gray-300">Graph Density</h3>
            <div className="flex items-center">
              <div className="bg-primary/20 h-2 flex-grow rounded-full overflow-hidden">
                <div 
                  className="bg-primary h-full" 
                  style={{ width: `${Math.min(graphMetrics.density * 100, 100)}%` }}
                />
              </div>
              <span className="text-sm ml-2 font-mono">{(graphMetrics.density * 100).toFixed(1)}%</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {graphMetrics.density < 0.1 ? 'Sparse graph' : 
              graphMetrics.density < 0.3 ? 'Moderately connected' : 'Densely connected'}
            </p>
          </div>
          
          {/* Connected components */}
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 hover:border-gray-600 transition-colors">
            <h3 className="text-sm font-medium mb-1 text-gray-300">Connected Components</h3>
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <span className="text-xl font-bold text-primary mr-2">{graphMetrics.connectedComponentsCount}</span>
              </div>
              <span className="text-xs text-gray-400">
                {graphMetrics.connectedComponentsCount === 1 
                  ? 'Fully connected graph' 
                  : graphMetrics.connectedComponentsCount > 5 
                    ? 'Highly fragmented' 
                    : 'Partially connected'}
              </span>
            </div>
          </div>
          
          {/* Average connections */}
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 hover:border-gray-600 transition-colors">
            <h3 className="text-sm font-medium mb-1 text-gray-300">Average Connections</h3>
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <span className="text-xl font-bold text-primary mr-2">{graphMetrics.averageConnections.toFixed(1)}</span>
              </div>
              <span className="text-xs text-gray-400">Links per entity</span>
            </div>
          </div>
          
          {/* Most connected entities */}
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 hover:border-gray-600 transition-colors">
            <h3 className="text-sm font-medium mb-2 text-gray-300">Most Connected Entities</h3>
            <div className="space-y-2">
              {graphMetrics.mostConnectedEntities.slice(0, 5).map((entity: {id: number, name: string, connectionCount: number}) => (
                <div 
                  key={entity.id} 
                  className="flex justify-between items-center text-sm cursor-pointer hover:bg-gray-700/50 p-1 rounded transition-colors"
                  onClick={() => {
                    // Node highlighting disabled in this view
                  }}
                >
                  <span className="text-gray-300 truncate max-w-[140px]">{entity.name}</span>
                  <span className="text-primary font-mono">{entity.connectionCount}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Entity types distribution */}
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 hover:border-gray-600 transition-colors">
            <h3 className="text-sm font-medium mb-2 text-gray-300">Entity Types</h3>
            <div className="space-y-2">
              {graphMetrics.entityTypes.map((type: {type: string, count: number}) => (
                <div key={type.type} className="flex justify-between items-center text-sm">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    type.type === "Person" ? "bg-blue-500/20 text-blue-300" :
                    type.type === "Place" ? "bg-amber-500/20 text-amber-300" :
                    type.type === "Concept" ? "bg-emerald-500/20 text-emerald-300" :
                    type.type === "Organization" ? "bg-purple-500/20 text-purple-300" :
                    type.type === "Date" ? "bg-pink-500/20 text-pink-300" :
                    "bg-gray-500/20 text-gray-300"
                  }`}>{type.type}</span>
                  <span className="text-gray-300">{type.count}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Isolated entities */}
          {graphMetrics.isolatedEntities.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 hover:border-gray-600 transition-colors">
              <h3 className="text-sm font-medium mb-1 text-gray-300">Isolated Entities</h3>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center">
                  <span className="text-primary font-bold mr-2">{graphMetrics.isolatedEntities.length}</span>
                  <span className="text-xs text-gray-400">Entities with no connections</span>
                </div>
              </div>
              {graphMetrics.isolatedEntities.length > 0 && (
                <ScrollArea className="max-h-24">
                  <div className="space-y-1">
                    {graphMetrics.isolatedEntities.slice(0, 3).map((entity: {id: number, name: string}) => (
                      <div 
                        key={entity.id} 
                        className="text-xs text-gray-400 truncate cursor-pointer hover:text-gray-300 hover:bg-gray-700/30 p-1 rounded transition-colors"
                        onClick={() => {
                          // Node highlighting disabled in this view
                        }}
                      >
                        {entity.name}
                      </div>
                    ))}
                    {graphMetrics.isolatedEntities.length > 3 && (
                      <div className="text-xs text-gray-500 p-1">
                        +{graphMetrics.isolatedEntities.length - 3} more
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default GraphMetricsPanel;