import Sidebar from '@/components/Sidebar';
import HelpModal from '@/components/HelpModal';
import { useState } from 'react';
import { useSidebar } from '@/components/ui/sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlignStartHorizontalIcon } from 'lucide-react';

export default function Align() {
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
  
  // Get sidebar information including width for responsive layout
  const sidebar = useSidebar();
  const { isMobile, openMobile } = sidebar;
  
  // Get width from context or calculate it based on state
  // Using type assertion to handle potential missing width property
  const sidebarWidth = (sidebar as any).width || 
                      (sidebar.state === 'expanded' ? 256 : 80);

  // Toggle help modal
  const toggleHelpModal = () => {
    setIsHelpModalOpen(!isHelpModalOpen);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      <Sidebar onToggleHelp={toggleHelpModal} />
      
      <div 
        className="flex-1 transition-all duration-300 ease-in-out"
        style={{ marginLeft: `${sidebarWidth}px` }}>
        <div className="min-h-screen flex flex-col">
          <header className="bg-gray-900 border-b border-gray-800">
            <div className="container mx-auto px-4 py-4 flex justify-between items-center">
              <h1 className="text-xl font-semibold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                Align Knowledge Graphs
              </h1>
            </div>
          </header>
          
          <main className="flex-grow container mx-auto px-4 py-6 text-gray-200">
            <div className="grid place-items-center h-full">
              <Card className="w-full max-w-xl bg-gray-900 border-gray-800 shadow-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl font-bold text-white flex items-center">
                    <AlignStartHorizontalIcon className="w-6 h-6 mr-2 text-primary" /> 
                    Align Feature
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Align and map entities between different ontologies and knowledge graph structures.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-300 mb-6">
                    This feature will be implemented in a future update. The Align feature allows you to map entities and relationships between different knowledge graphs with varying ontologies.
                  </p>
                  <div className="flex justify-end">
                    <Button disabled className="bg-gray-800 text-gray-400 hover:bg-gray-700">
                      Coming Soon
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
      
      {isHelpModalOpen && <HelpModal onClose={toggleHelpModal} />}
    </div>
  );
}