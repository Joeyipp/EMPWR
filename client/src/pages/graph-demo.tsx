import { useRef, useState, useCallback } from 'react';
import { ForceGraph2D } from 'react-force-graph';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ZoomIn, ZoomOut, Maximize2, Play, Pause } from 'lucide-react';

interface DemoNode {
  id: number;
  name: string;
  group: number;
  x?: number;
  y?: number;
}

interface DemoLink {
  source: number;
  target: number;
  label: string;
}

const GraphDemo = () => {
  const graphRef = useRef<any>();
  const [isPaused, setIsPaused] = useState(false);

  const demoData = {
    nodes: [
      { id: 1, name: "Albert Einstein", group: 1 },
      { id: 2, name: "Physics", group: 3 },
      { id: 3, name: "Germany", group: 2 },
      { id: 4, name: "United States", group: 2 },
      { id: 5, name: "Princeton University", group: 4 },
      { id: 6, name: "Nobel Prize", group: 3 },
      { id: 7, name: "Theory of Relativity", group: 3 },
      { id: 8, name: "Marie Curie", group: 1 },
      { id: 9, name: "Chemistry", group: 3 },
      { id: 10, name: "France", group: 2 },
      { id: 11, name: "Radioactivity", group: 3 },
      { id: 12, name: "Isaac Newton", group: 1 },
      { id: 13, name: "England", group: 2 },
      { id: 14, name: "Calculus", group: 3 },
      { id: 15, name: "Gravity", group: 3 },
    ] as DemoNode[],
    links: [
      { source: 1, target: 2, label: "field of work" },
      { source: 1, target: 3, label: "place of birth" },
      { source: 1, target: 4, label: "country of citizenship" },
      { source: 1, target: 5, label: "employer" },
      { source: 1, target: 6, label: "award received" },
      { source: 1, target: 7, label: "notable work" },
      { source: 8, target: 9, label: "field of work" },
      { source: 8, target: 10, label: "country of citizenship" },
      { source: 8, target: 6, label: "award received" },
      { source: 8, target: 11, label: "notable work" },
      { source: 12, target: 2, label: "field of work" },
      { source: 12, target: 13, label: "place of birth" },
      { source: 12, target: 14, label: "notable work" },
      { source: 12, target: 15, label: "discovered" },
      { source: 7, target: 2, label: "part of" },
      { source: 11, target: 2, label: "part of" },
      { source: 14, target: 2, label: "part of" },
    ] as DemoLink[],
  };

  const getNodeColor = (node: DemoNode) => {
    switch (node.group) {
      case 1: return "#3B82F6";
      case 2: return "#F59E0B";
      case 3: return "#10B981";
      case 4: return "#8B5CF6";
      case 5: return "#EC4899";
      default: return "#6B7280";
    }
  };

  const handleZoomIn = () => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom();
      graphRef.current.zoom(currentZoom * 1.2, 500);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom();
      graphRef.current.zoom(currentZoom / 1.2, 500);
    }
  };

  const handleCenter = () => {
    if (graphRef.current) {
      graphRef.current.centerAt(0, 0, 1000);
      graphRef.current.zoom(1.5, 1000);
    }
  };

  const togglePause = () => {
    if (graphRef.current) {
      if (isPaused) {
        graphRef.current.resumeAnimation();
      } else {
        graphRef.current.pauseAnimation();
      }
      setIsPaused(!isPaused);
    }
  };

  const handleNodeClick = useCallback((node: DemoNode) => {
    if (graphRef.current && node.x !== undefined && node.y !== undefined) {
      graphRef.current.centerAt(node.x, node.y, 1000);
      graphRef.current.zoom(2.5, 1000);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <Card className="border-gray-700 bg-gray-900/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-white">
              Graph Visualization Demo
            </CardTitle>
            <CardDescription className="text-gray-400">
              Interactive knowledge graph using react-force-graph
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex gap-2">
              <Button
                onClick={handleZoomIn}
                variant="outline"
                size="sm"
                className="bg-gray-800 border-gray-700 hover:bg-gray-700"
                data-testid="button-zoom-in"
              >
                <ZoomIn className="w-4 h-4 mr-2" />
                Zoom In
              </Button>
              <Button
                onClick={handleZoomOut}
                variant="outline"
                size="sm"
                className="bg-gray-800 border-gray-700 hover:bg-gray-700"
                data-testid="button-zoom-out"
              >
                <ZoomOut className="w-4 h-4 mr-2" />
                Zoom Out
              </Button>
              <Button
                onClick={handleCenter}
                variant="outline"
                size="sm"
                className="bg-gray-800 border-gray-700 hover:bg-gray-700"
                data-testid="button-center"
              >
                <Maximize2 className="w-4 h-4 mr-2" />
                Center
              </Button>
              <Button
                onClick={togglePause}
                variant="outline"
                size="sm"
                className="bg-gray-800 border-gray-700 hover:bg-gray-700"
                data-testid="button-toggle-animation"
              >
                {isPaused ? (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </>
                )}
              </Button>
            </div>

            <div className="bg-gray-950 rounded-lg border border-gray-800 overflow-hidden">
              <ForceGraph2D
                ref={graphRef}
                graphData={demoData}
                width={1200}
                height={700}
                backgroundColor="#030712"
                nodeId="id"
                nodeLabel="name"
                nodeColor={getNodeColor}
                nodeVal={(node: any) => 8}
                nodeCanvasObject={(node: any, ctx, globalScale) => {
                  const label = node.name;
                  const fontSize = 12 / globalScale;
                  const nodeRadius = 8;

                  ctx.beginPath();
                  ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI);
                  ctx.fillStyle = getNodeColor(node);
                  ctx.fill();
                  ctx.strokeStyle = '#fff';
                  ctx.lineWidth = 2 / globalScale;
                  ctx.stroke();

                  ctx.font = `${fontSize}px Sans-Serif`;
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillStyle = '#fff';
                  ctx.fillText(label, node.x, node.y + nodeRadius + fontSize);
                }}
                linkLabel="label"
                linkColor={() => "#4B5563"}
                linkWidth={1.5}
                linkDirectionalArrowLength={4}
                linkDirectionalArrowRelPos={1}
                linkCanvasObjectMode={() => "after"}
                linkCanvasObject={(link: any, ctx, globalScale) => {
                  const label = link.label;
                  if (!label) return;

                  const fontSize = 10 / globalScale;
                  ctx.font = `${fontSize}px Sans-Serif`;
                  ctx.fillStyle = '#9CA3AF';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';

                  const start = link.source;
                  const end = link.target;
                  if (start && end && start.x !== undefined && end.x !== undefined) {
                    const textPos = {
                      x: start.x + (end.x - start.x) / 2,
                      y: start.y + (end.y - start.y) / 2,
                    };

                    const relLink = { x: end.x - start.x, y: end.y - start.y };
                    const textAngle = Math.atan2(relLink.y, relLink.x);
                    
                    ctx.save();
                    ctx.translate(textPos.x, textPos.y);
                    ctx.rotate(textAngle);
                    
                    ctx.fillStyle = 'rgba(17, 24, 39, 0.8)';
                    const textWidth = ctx.measureText(label).width;
                    ctx.fillRect(-textWidth / 2 - 2, -fontSize / 2 - 1, textWidth + 4, fontSize + 2);
                    
                    ctx.fillStyle = '#9CA3AF';
                    ctx.fillText(label, 0, 0);
                    ctx.restore();
                  }
                }}
                onNodeClick={handleNodeClick}
                cooldownTicks={100}
                d3VelocityDecay={0.3}
                enableZoomInteraction={true}
                enablePanInteraction={true}
                enableNodeDrag={true}
              />
            </div>

            <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-[#3B82F6]"></div>
                <span className="text-sm text-gray-300">Person</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-[#F59E0B]"></div>
                <span className="text-sm text-gray-300">Place</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-[#10B981]"></div>
                <span className="text-sm text-gray-300">Concept</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-[#8B5CF6]"></div>
                <span className="text-sm text-gray-300">Organization</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-[#EC4899]"></div>
                <span className="text-sm text-gray-300">Date</span>
              </div>
            </div>

            <div className="mt-6 text-sm text-gray-400">
              <p className="mb-2"><strong className="text-gray-300">Features:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Interactive node dragging and repositioning</li>
                <li>Zoom and pan controls</li>
                <li>Click nodes to focus and zoom</li>
                <li>Force-directed graph layout</li>
                <li>Labeled relationships with directional arrows</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GraphDemo;
