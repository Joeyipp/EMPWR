import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiRequest } from '@/lib/queryClient';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Info } from 'lucide-react';

interface ExtractionStats {
  entityCount: number;
  relationCount: number;
  sourceType: string;
  processingTime: number;
  sourceName: string;
  topEntities: Array<{name: string; count: number}>;
  topRelations: Array<{name: string; count: number}>;
}

interface ExtractionResult {
  graph: {
    id: number;
    name: string;
    nodes: Array<{
      id: number;
      name: string;
      group: number;
      properties: Record<string, any>;
    }>;
    links: Array<{
      source: number;
      target: number;
      value: number;
      label: string;
      dataSource: string;
    }>;
  };
  stats: ExtractionStats;
  graphId: number;
}

const SchemaOrgComparison: React.FC = () => {
  const [url, setUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const handleExtraction = async () => {
    if (!url) {
      toast({
        title: 'URL Required',
        description: 'Please enter a URL to extract Schema.org data from.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsExtracting(true);
      setError('');
      
      // Make the API request to extract Schema.org data
      const response = await fetch('/api/extract/web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          sourceSystem: 'schema'
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || response.statusText);
      }
      
      const responseData = await response.json();
      // Check if data has the expected format or if it's nested in a data property
      const data = responseData.data ? responseData.data : responseData;
      
      // Validate that the data has the expected structure
      if (!data || !data.stats || !data.graph) {
        throw new Error('Invalid response format from the server');
      }
      
      setExtractionResult(data as ExtractionResult);
      
      toast({
        title: 'Extraction Successful',
        description: `Extracted ${data.stats.entityCount || 0} entities and ${data.stats.relationCount || 0} relationships in ${data.stats.processingTime ? data.stats.processingTime.toFixed(2) : "0.00"}s.`,
      });
    } catch (err) {
      console.error('Extraction error:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      toast({
        title: 'Extraction Failed',
        description: err instanceof Error ? err.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Advanced Schema.org Extractor</CardTitle>
          <CardDescription>
            Extract structured data from any webpage with our enhanced Schema.org extractor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2">
            <Input
              placeholder="Enter a URL (e.g., https://example.com)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={handleExtraction} 
              disabled={isExtracting}
            >
              {isExtracting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extracting...
                </>
              ) : (
                'Extract'
              )}
            </Button>
          </div>
          
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Extraction Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          <div className="flex items-center">
            <Info className="h-4 w-4 mr-2" />
            Try websites that use Schema.org markup like online stores, recipe sites, news sites, etc.
          </div>
        </CardFooter>
      </Card>

      {isExtracting && (
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-[250px]" />
            <Skeleton className="h-4 w-[350px]" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </CardContent>
        </Card>
      )}

      {extractionResult && !isExtracting && (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="entities">Entities</TabsTrigger>
            <TabsTrigger value="relationships">Relationships</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>Extraction Results</CardTitle>
                <CardDescription>
                  {extractionResult?.stats?.sourceName ? 
                    `Extracted from ${extractionResult.stats.sourceName}` : 
                    'Enter a URL to extract Schema.org data'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-card border rounded-lg p-4">
                    <div className="text-2xl font-bold">{extractionResult?.stats?.entityCount || 0}</div>
                    <div className="text-sm text-muted-foreground">Entities Extracted</div>
                  </div>
                  <div className="bg-card border rounded-lg p-4">
                    <div className="text-2xl font-bold">{extractionResult?.stats?.relationCount || 0}</div>
                    <div className="text-sm text-muted-foreground">Relationships Found</div>
                  </div>
                  <div className="bg-card border rounded-lg p-4">
                    <div className="text-2xl font-bold">{extractionResult?.stats?.processingTime ? extractionResult.stats.processingTime.toFixed(2) : "0.00"}s</div>
                    <div className="text-sm text-muted-foreground">Processing Time</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-medium mb-2">Top Entities</h3>
                    <ul className="space-y-2">
                      {extractionResult?.stats?.topEntities?.map((entity, index) => (
                        <li key={index} className="flex justify-between">
                          <span className="truncate">{entity.name}</span>
                          <Badge variant="outline">{entity.count} connections</Badge>
                        </li>
                      )) || <li className="text-muted-foreground">No entities available</li>}
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-2">Top Relationships</h3>
                    <ul className="space-y-2">
                      {extractionResult?.stats?.topRelations?.map((relation, index) => (
                        <li key={index} className="flex justify-between">
                          <span className="truncate">{relation.name}</span>
                          <Badge variant="outline">{relation.count} occurrences</Badge>
                        </li>
                      )) || <li className="text-muted-foreground">No relationships available</li>}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="entities">
            <Card>
              <CardHeader>
                <CardTitle>Entities ({extractionResult?.graph?.nodes?.length || 0})</CardTitle>
                <CardDescription>
                  All entities extracted from the Schema.org data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[500px] overflow-y-auto">
                  {extractionResult?.graph?.nodes?.length > 0 ? 
                    extractionResult.graph.nodes.map((node) => (
                      <div key={node.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <h3 className="font-medium">{node.name}</h3>
                          <Badge>{`Group ${node.group}`}</Badge>
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground">
                          {node.properties?.schemaType && (
                            <div><span className="font-medium">Type:</span> {node.properties.schemaType}</div>
                          )}
                          {node.properties?.propertyName && (
                            <div><span className="font-medium">Property:</span> {node.properties.propertyName}</div>
                          )}
                          {node.properties?.source && (
                            <div><span className="font-medium">Source:</span> {node.properties.source}</div>
                          )}
                        </div>
                      </div>
                    ))
                    : <div className="text-center p-4 text-muted-foreground">No entities available</div>
                  }
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="relationships">
            <Card>
              <CardHeader>
                <CardTitle>Relationships ({extractionResult?.graph?.links?.length || 0})</CardTitle>
                <CardDescription>
                  All relationships between entities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[500px] overflow-y-auto">
                  {extractionResult?.graph?.links?.length > 0 ? 
                    extractionResult.graph.links.map((link, index) => {
                      const sourceNode = extractionResult.graph.nodes.find(n => n.id === link.source);
                      const targetNode = extractionResult.graph.nodes.find(n => n.id === link.target);
                      
                      return (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="font-medium truncate max-w-[200px]">
                              {sourceNode ? sourceNode.name : `Node ${link.source}`}
                            </span>
                            <Badge className="mx-2">{link.label}</Badge>
                            <span className="font-medium truncate max-w-[200px]">
                              {targetNode ? targetNode.name : `Node ${link.target}`}
                            </span>
                          </div>
                        </div>
                      );
                    })
                    : <div className="text-center p-4 text-muted-foreground">No relationships available</div>
                  }
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default SchemaOrgComparison;