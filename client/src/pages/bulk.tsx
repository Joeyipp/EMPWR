import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Database, Upload, BarChart2, FileUp, AlertCircle, HelpCircleIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import AnimatedGradientBackground from '@/components/AnimatedGradientBackground';
import PageLayout from '@/components/PageLayout';
import { ScrollArea } from '@/components/ui/scroll-area';
import HelpModal from '@/components/HelpModal';

export default function BulkPage() {
  const { toast } = useToast();
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);

  // Toggle help modal
  const toggleHelpModal = () => {
    setIsHelpModalOpen(!isHelpModalOpen);
  };

  return (
    <PageLayout 
      title="Bulk Processing" 
      header={
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="border-amber-500 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20">
            Coming Soon
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
                <CardTitle className="text-lg">Bulk Processing Tools</CardTitle>
                <CardDescription>
                  Tools for batch knowledge graph creation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-3">
                    <Card className="border-gray-700 bg-gray-800/30 hover:bg-gray-800/50 cursor-not-allowed">
                      <CardContent className="p-3 flex items-center">
                        <FileUp className="h-5 w-5 text-blue-400 mr-3" />
                        <div>
                          <h4 className="font-medium">Batch Upload</h4>
                          <p className="text-xs text-gray-400">Upload multiple files at once</p>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-gray-700 bg-gray-800/30 hover:bg-gray-800/50 cursor-not-allowed">
                      <CardContent className="p-3 flex items-center">
                        <Database className="h-5 w-5 text-emerald-400 mr-3" />
                        <div>
                          <h4 className="font-medium">Auto-Merge</h4>
                          <p className="text-xs text-gray-400">Merge multiple datasets</p>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-gray-700 bg-gray-800/30 hover:bg-gray-800/50 cursor-not-allowed">
                      <CardContent className="p-3 flex items-center">
                        <BarChart2 className="h-5 w-5 text-purple-400 mr-3" />
                        <div>
                          <h4 className="font-medium">Batch Analytics</h4>
                          <p className="text-xs text-gray-400">Analyze trends across sources</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
            
            <Card className="border-gray-800 bg-gray-900/50">
              <CardHeader>
                <CardTitle className="text-lg">Import Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="flex items-center space-x-2 bg-amber-900/20 p-3 rounded-md border border-amber-700/40">
                  <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  <p className="text-sm text-amber-200">
                    Settings configuration will be available when bulk processing is released
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Main content area */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-gray-800 bg-gray-900/50">
              <CardHeader>
                <CardTitle>Bulk Data Processing</CardTitle>
                <CardDescription>
                  Transform multiple datasets into interconnected knowledge graphs simultaneously
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-center flex-col space-y-6 py-16">
                  <div className="flex items-center justify-center flex-col space-y-4">
                    <div className="rounded-full bg-gray-800/70 p-6">
                      <Upload className="h-12 w-12 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-300">Bulk Upload and Processing</h3>
                  </div>
                  <p className="text-center text-gray-400 max-w-lg">
                    This feature will allow you to upload and process multiple files simultaneously,
                    automatically identifying connections between datasets and merging them into
                    comprehensive knowledge graphs.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="border-t border-gray-800 pt-4">
                <Button variant="secondary" className="w-full" disabled>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Coming Soon
                </Button>
              </CardFooter>
            </Card>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-gray-700 bg-gray-800/30">
                <CardContent className="pt-6 flex flex-col items-center text-center">
                  <FileUp className="h-8 w-8 text-blue-400 mb-3" />
                  <h4 className="font-medium mb-1">Batch Upload</h4>
                  <p className="text-sm text-gray-400">
                    Upload multiple files of different formats at once
                  </p>
                </CardContent>
              </Card>
              <Card className="border-gray-700 bg-gray-800/30">
                <CardContent className="pt-6 flex flex-col items-center text-center">
                  <Database className="h-8 w-8 text-emerald-400 mb-3" />
                  <h4 className="font-medium mb-1">Auto-Merge</h4>
                  <p className="text-sm text-gray-400">
                    Intelligently combine related information across datasets
                  </p>
                </CardContent>
              </Card>
              <Card className="border-gray-700 bg-gray-800/30">
                <CardContent className="pt-6 flex flex-col items-center text-center">
                  <BarChart2 className="h-8 w-8 text-purple-400 mb-3" />
                  <h4 className="font-medium mb-1">Batch Analytics</h4>
                  <p className="text-sm text-gray-400">
                    Process and analyze trends across multiple sources
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
      
      {/* Help Modal */}
      {isHelpModalOpen && (
        <HelpModal
          isOpen={isHelpModalOpen}
          onClose={toggleHelpModal}
          title="Bulk Processing Help"
          content={
            <>
              <p className="mb-4">
                The Bulk Processing feature allows you to process multiple files and datasets 
                simultaneously to create comprehensive knowledge graphs.
              </p>
              
              <h3 className="text-lg font-medium mt-4 mb-2">Key Features:</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Batch Upload:</strong> Upload multiple files of different formats at once</li>
                <li><strong>Auto-Merge:</strong> Automatically merge related information across datasets</li>
                <li><strong>Batch Analytics:</strong> Analyze trends and patterns across multiple sources</li>
              </ul>
              
              <div className="mt-4 p-3 bg-amber-900/20 rounded-md border border-amber-700/40">
                <p className="text-sm text-amber-200">
                  This feature is currently under development and will be available soon.
                </p>
              </div>
            </>
          }
        />
      )}
    </PageLayout>
  );
}