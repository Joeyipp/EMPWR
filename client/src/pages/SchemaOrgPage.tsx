import React, { useState } from 'react';
import SchemaOrgComparison from '../components/SchemaOrgComparison';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import AnimatedGradientBackground from '@/components/AnimatedGradientBackground';
import PageLayout from '@/components/PageLayout';
import { ScrollArea } from '@/components/ui/scroll-area';
import HelpModal from '@/components/HelpModal';
import { 
  HelpCircleIcon, 
  Code, 
  Link, 
  FileJson, 
  ListTree, 
  Settings, 
  Sparkles
} from 'lucide-react';

const SchemaOrgPage: React.FC = () => {
  const { toast } = useToast();
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);

  // Toggle help modal
  const toggleHelpModal = () => {
    setIsHelpModalOpen(!isHelpModalOpen);
  };

  return (
    <PageLayout 
      title="Schema.org Advanced Extractor" 
      header={
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="border-blue-500 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">
            Prototype
          </Badge>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={toggleHelpModal}
          >
            <HelpCircleIcon className="h-5 w-5" />
          </Button>
        </div>
      }
    >
      <AnimatedGradientBackground>
        {/* Children content required for AnimatedGradientBackground */}
        <div className="hidden"></div>  
      </AnimatedGradientBackground>
      
      <div className="container mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left sidebar */}
          <div className="lg:col-span-1">
            <Card className="border-gray-800 bg-gray-900/50 mb-4">
              <CardHeader>
                <CardTitle className="text-lg">Schema.org Tools</CardTitle>
                <CardDescription>
                  Tools for structured data extraction
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-3">
                    <Card className="border-gray-700 bg-gray-800/30 hover:bg-gray-800/50 cursor-pointer">
                      <CardContent className="p-3 flex items-center">
                        <Link className="h-5 w-5 text-blue-400 mr-3" />
                        <div>
                          <h4 className="font-medium">URL Extractor</h4>
                          <p className="text-xs text-gray-400">Extract data from any webpage</p>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-gray-700 bg-gray-800/30 hover:bg-gray-800/50 cursor-pointer">
                      <CardContent className="p-3 flex items-center">
                        <FileJson className="h-5 w-5 text-emerald-400 mr-3" />
                        <div>
                          <h4 className="font-medium">JSON-LD</h4>
                          <p className="text-xs text-gray-400">Extract JSON-LD formatted data</p>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-gray-700 bg-gray-800/30 hover:bg-gray-800/50 cursor-pointer">
                      <CardContent className="p-3 flex items-center">
                        <Code className="h-5 w-5 text-purple-400 mr-3" />
                        <div>
                          <h4 className="font-medium">Microdata</h4>
                          <p className="text-xs text-gray-400">Extract Microdata formatted markup</p>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-gray-700 bg-gray-800/30 hover:bg-gray-800/50 cursor-pointer">
                      <CardContent className="p-3 flex items-center">
                        <ListTree className="h-5 w-5 text-orange-400 mr-3" />
                        <div>
                          <h4 className="font-medium">RDFa</h4>
                          <p className="text-xs text-gray-400">Extract RDFa formatted markup</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
            
            <Card className="border-gray-800 bg-gray-900/50">
              <CardHeader>
                <CardTitle className="text-lg">Extraction Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <Card className="border-gray-700 bg-gray-800/30 hover:bg-gray-800/50 cursor-pointer">
                  <CardContent className="p-3 flex items-center">
                    <Settings className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <h4 className="font-medium">Advanced Options</h4>
                      <p className="text-xs text-gray-400">Configure extraction parameters</p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border-gray-700 bg-gray-800/30 hover:bg-gray-800/50 cursor-pointer">
                  <CardContent className="p-3 flex items-center">
                    <Sparkles className="h-5 w-5 text-amber-400 mr-3" />
                    <div>
                      <h4 className="font-medium">AI Enhancement</h4>
                      <p className="text-xs text-gray-400">Use AI to improve extraction quality</p>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </div>
          
          {/* Main content area - Schema.org Comparison component */}
          <div className="lg:col-span-2">
            <SchemaOrgComparison />
          </div>
        </div>
      </div>
      
      {/* Help Modal */}
      {isHelpModalOpen && (
        <HelpModal
          isOpen={isHelpModalOpen}
          onClose={toggleHelpModal}
          title="Schema.org Extractor Help"
          content={
            <>
              <p className="mb-4">
                The Schema.org Advanced Extractor allows you to extract structured data from any webpage 
                and convert it into a knowledge graph. Schema.org is a collaborative, community activity 
                that creates, maintains, and promotes schemas for structured data on the Internet.
              </p>
              
              <h3 className="text-lg font-medium mt-4 mb-2">Key Features:</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>URL Extraction:</strong> Extract Schema.org data from any webpage by entering its URL</li>
                <li><strong>Multiple Formats:</strong> Support for JSON-LD, Microdata, and RDFa formatted data</li>
                <li><strong>Visualization:</strong> See the extracted entities and relationships in a graph visualization</li>
                <li><strong>Analytics:</strong> View statistics and metrics about the extracted data</li>
              </ul>
              
              <div className="mt-4 p-3 bg-blue-900/20 rounded-md border border-blue-700/40">
                <p className="text-sm text-blue-200">
                  This feature works best on websites that implement Schema.org markup, such as online stores, 
                  recipe sites, news sites, and other content-rich websites.
                </p>
              </div>
            </>
          }
        />
      )}
    </PageLayout>
  );
};

export default SchemaOrgPage;