import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Check, AlertCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SchemaClass {
  name: string;
  description: string;
  properties: SchemaProperty[];
  relations?: SchemaRelation[];
}

interface SchemaProperty {
  name: string;
  type: string;
  description: string;
}

interface SchemaRelation {
  name: string;
  target: string;
  description: string;
}

interface SchemaOrgSuggestionsProps {
  ontologyId: number;
  onComplete?: (ontology: any) => void;
}

const SchemaOrgSuggestions: React.FC<SchemaOrgSuggestionsProps> = ({ ontologyId, onComplete }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemaClasses, setSchemaClasses] = useState<SchemaClass[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<Record<string, boolean>>({});
  const [integrationType, setIntegrationType] = useState<'extend' | 'replace' | 'annotate'>('extend');
  const [hasProcessed, setHasProcessed] = useState(false);
  const { toast } = useToast();

  // Simulate loading schema classes based on ontology domain
  // In a real implementation, this would come from the server
  useEffect(() => {
    // Load schema classes that would be used for suggestions
    const loadSchemaClasses = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // This would be a real API call in production
        // For now, we'll simulate with a timeout and predefined classes
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const baseClasses = [
          {
            name: 'Thing',
            description: 'The most generic type of item in Schema.org.',
            properties: [
              { name: 'name', type: 'string', description: 'The name of the item.' },
              { name: 'description', type: 'string', description: 'A description of the item.' },
              { name: 'url', type: 'string', description: 'URL of the item.' },
              { name: 'image', type: 'string', description: 'An image of the item.' }
            ],
            relations: []
          },
          {
            name: 'Person',
            description: 'A person (alive, dead, undead, or fictional).',
            properties: [
              { name: 'givenName', type: 'string', description: 'Given name. In the U.S., the first name of a Person.' },
              { name: 'familyName', type: 'string', description: 'Family name. In the U.S., the last name of a Person.' },
              { name: 'email', type: 'string', description: 'Email address.' },
              { name: 'birthDate', type: 'date', description: 'Date of birth.' }
            ],
            relations: [
              { name: 'memberOf', target: 'Organization', description: 'An Organization to which this Person belongs.' }
            ]
          },
          {
            name: 'Organization',
            description: 'An organization such as a school, NGO, corporation, club, etc.',
            properties: [
              { name: 'legalName', type: 'string', description: 'The official name of the organization.' },
              { name: 'foundingDate', type: 'date', description: 'The date that this organization was founded.' },
              { name: 'address', type: 'string', description: 'Physical address of the item.' }
            ],
            relations: [
              { name: 'member', target: 'Person', description: 'A member of this organization.' },
              { name: 'subOrganization', target: 'Organization', description: 'A relationship between two organizations.' }
            ]
          },
          {
            name: 'Place',
            description: 'Entities that have a somewhat fixed, physical extension.',
            properties: [
              { name: 'address', type: 'string', description: 'Physical address of the item.' },
              { name: 'latitude', type: 'number', description: 'The latitude of a location.' },
              { name: 'longitude', type: 'number', description: 'The longitude of a location.' }
            ],
            relations: [
              { name: 'containedIn', target: 'Place', description: 'The basic containment relation between places.' }
            ]
          }
        ];
        
        setSchemaClasses(baseClasses);
        
        // Initialize all classes as selected by default
        const initialSelected = baseClasses.reduce((acc, curr) => {
          acc[curr.name] = true;
          return acc;
        }, {} as Record<string, boolean>);
        
        setSelectedClasses(initialSelected);
      } catch (err) {
        console.error('Error loading schema classes:', err);
        setError('Failed to load Schema.org classes. Please try again.');
        toast({
          title: 'Error',
          description: 'Failed to load Schema.org classes',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSchemaClasses();
  }, [ontologyId, toast]);

  const handleToggleClass = (className: string) => {
    setSelectedClasses(prev => ({
      ...prev,
      [className]: !prev[className]
    }));
  };

  const handleToggleAll = (value: boolean) => {
    const newSelected = schemaClasses.reduce((acc, curr) => {
      acc[curr.name] = value;
      return acc;
    }, {} as Record<string, boolean>);
    
    setSelectedClasses(newSelected);
  };

  const countSelectedClasses = () => {
    return Object.values(selectedClasses).filter(Boolean).length;
  };

  const handleIntegrate = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Get the selected class names
      const selectedClassNames = Object.entries(selectedClasses)
        .filter(([_, isSelected]) => isSelected)
        .map(([className]) => className);
        
      // Use a standard fetch call instead of the apiRequest from queryClient
      const response = await fetch('/api/ontologies/schema-integrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ontologyId,
          mappingType: 'suggested',
          integrationType,
          classes: selectedClassNames
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setHasProcessed(true);
        
        toast({
          title: 'Schema.org Integration Complete',
          description: `Successfully added ${data.data.entityCount || 0} entities and ${data.data.relationCount || 0} relationships.`,
        });
        
        // Call the callback if provided
        if (onComplete && data.data.ontology) {
          onComplete(data.data.ontology);
        }
      } else {
        throw new Error(data.message || 'Unknown error occurred');
      }
    } catch (err) {
      console.error('Integration error:', err);
      
      const errorMessage = 
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? (err as any).message
            : 'An unknown error occurred';
      
      setError(errorMessage);
      toast({
        title: 'Integration Failed',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Schema.org Integration</CardTitle>
          <CardDescription>
            Enhance your ontology with standard Schema.org classes and properties
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Integration Type Selection */}
            <div>
              <h3 className="text-lg font-medium mb-2">Integration Mode</h3>
              <RadioGroup 
                value={integrationType} 
                onValueChange={(value) => setIntegrationType(value as 'extend' | 'replace' | 'annotate')}
                className="space-y-3"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="extend" id="extend" />
                  <Label htmlFor="extend" className="flex flex-col">
                    <span className="font-medium">Extend Ontology</span>
                    <span className="text-sm text-muted-foreground">Add new Schema.org classes and properties to your ontology</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="replace" id="replace" />
                  <Label htmlFor="replace" className="flex flex-col">
                    <span className="font-medium">Replace Matching Entities</span>
                    <span className="text-sm text-muted-foreground">Map existing entities to Schema.org classes based on similarity</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="annotate" id="annotate" />
                  <Label htmlFor="annotate" className="flex flex-col">
                    <span className="font-medium">Add Annotations Only</span>
                    <span className="text-sm text-muted-foreground">Add Schema.org annotations to existing entities and properties</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>
            
            <Separator />
            
            {/* Schema Classes Selection */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Schema.org Classes</h3>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleToggleAll(true)}
                  >
                    Select All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleToggleAll(false)}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>
              
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <Skeleton className="h-6 w-[120px] mb-2" />
                        <Skeleton className="h-5 w-[50px]" />
                      </div>
                      <Skeleton className="h-4 w-full my-2" />
                      <div className="space-y-2 mt-4">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {schemaClasses.map((schemaClass) => (
                    <div key={schemaClass.name} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{schemaClass.name}</h4>
                          <p className="text-sm text-muted-foreground">{schemaClass.description}</p>
                        </div>
                        <Switch
                          checked={selectedClasses[schemaClass.name] || false}
                          onCheckedChange={() => handleToggleClass(schemaClass.name)}
                        />
                      </div>
                      
                      <Tabs defaultValue="properties" className="mt-4">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="properties">Properties ({schemaClass.properties.length})</TabsTrigger>
                          <TabsTrigger value="relations">{schemaClass.relations?.length ? `Relations (${schemaClass.relations.length})` : 'Relations (0)'}</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="properties" className="max-h-[200px] overflow-y-auto mt-2">
                          <ul className="space-y-2">
                            {schemaClass.properties.map((prop) => (
                              <li key={prop.name} className="text-sm flex items-start">
                                <Badge variant="outline" className="mr-2 shrink-0">{prop.type}</Badge>
                                <div>
                                  <span className="font-medium">{prop.name}</span>
                                  <p className="text-xs text-muted-foreground">{prop.description}</p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </TabsContent>
                        
                        <TabsContent value="relations" className="max-h-[200px] overflow-y-auto mt-2">
                          {schemaClass.relations && schemaClass.relations.length > 0 ? (
                            <ul className="space-y-2">
                              {schemaClass.relations.map((relation) => (
                                <li key={relation.name} className="text-sm flex items-start">
                                  <Badge variant="outline" className="mr-2 shrink-0">{relation.target}</Badge>
                                  <div>
                                    <span className="font-medium">{relation.name}</span>
                                    <p className="text-xs text-muted-foreground">{relation.description}</p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="text-sm text-muted-foreground py-2">No relations available for this class</div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            <Badge variant="outline">{countSelectedClasses()} of {schemaClasses.length} classes selected</Badge>
          </div>
          <Button 
            onClick={handleIntegrate} 
            disabled={isLoading || countSelectedClasses() === 0 || hasProcessed}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : hasProcessed ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Completed
              </>
            ) : (
              'Integrate Schema.org Classes'
            )}
          </Button>
        </CardFooter>
      </Card>
      
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Integration Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {hasProcessed && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Integration Complete</AlertTitle>
          <AlertDescription>
            Schema.org classes have been successfully integrated into your ontology according to the selected mode.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default SchemaOrgSuggestions;