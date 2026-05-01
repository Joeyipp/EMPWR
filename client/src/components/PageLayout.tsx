import { ReactNode, useState } from "react";
import Sidebar from "./Sidebar";
import { useSidebar } from "@/components/ui/sidebar";

interface PageLayoutProps {
  children: ReactNode;
  title?: string;
  header?: ReactNode;
}

const PageLayout = ({ children, title, header }: PageLayoutProps) => {
  const [showHelp, setShowHelp] = useState(false);
  
  // Using the sidebar context to get width (added after sidebar.tsx update)
  // Since the width property might not exist yet (from the LSP error), we'll handle it gracefully
  const sidebar = useSidebar();
  const sidebarState = sidebar.state;
  // Get width from context or calculate it based on state
  const sidebarWidth = (sidebar as any).width || (sidebarState === 'expanded' ? 256 : 80);
  
  const toggleHelp = () => {
    setShowHelp(!showHelp);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar onToggleHelp={toggleHelp} />
      
      <div
        className={`
          flex-1 transition-all duration-300 ease-in-out
        `}
        style={{ marginLeft: `${sidebarWidth}px` }}
      >
        {(title || header) && (
          <header className="bg-gray-900 border-b border-gray-800">
            <div className="container mx-auto px-4 py-4 flex justify-between items-center">
              {title && <h1 className="text-xl font-semibold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">{title}</h1>}
              {header}
            </div>
          </header>
        )}
        
        <main>
          {children}
        </main>
      </div>
      
      {/* Help dialog/overlay would go here if needed */}
      {showHelp && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          onClick={toggleHelp}
        >
          <div 
            className="bg-gray-900 p-6 rounded-lg max-w-2xl mx-4 text-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold mb-4">Help</h2>
            <p className="mb-4">
              This application allows you to generate, analyze, and manage knowledge graphs from text.
            </p>
            
            <h3 className="text-lg font-medium mt-4 mb-2">Core Features:</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Generate:</strong> Create knowledge graphs from text input or documents</li>
              <li><strong>Extract:</strong> Process documents to extract text for graph generation</li>
              <li><strong>Merge:</strong> Combine multiple knowledge graphs with intelligent entity resolution</li>
              <li><strong>Load:</strong> View and manage previously saved knowledge graphs</li>
              <li><strong>Insights:</strong> Analyze graphs and extract valuable insights</li>
              <li><strong>Settings:</strong> Manage API keys and application preferences</li>
            </ul>
            
            <div className="mt-6 text-right">
              <button 
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-md"
                onClick={toggleHelp}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PageLayout;