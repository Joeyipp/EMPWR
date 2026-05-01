import { FC, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface HelpModalProps {
  isOpen?: boolean; // Optional to maintain backwards compatibility
  onClose: () => void;
  title?: string;
  content?: string | ReactNode;
}

const HelpModal: FC<HelpModalProps> = ({ onClose, title, content }) => {
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-4">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xl font-semibold text-gray-800">{title || "How to Use the Knowledge Graph Generator"}</h3>
            <button 
              className="text-gray-500 hover:text-gray-700 focus:outline-none" 
              onClick={onClose}
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          {content ? (
            <div className="space-y-4 text-gray-700 whitespace-pre-wrap">
              {content}
            </div>
          ) : (
            <div className="space-y-4 text-gray-700">
              <div>
                <h4 className="font-medium text-gray-800 mb-2">Getting Started</h4>
                <p>This tool helps you visualize entities and relationships from unstructured text in the form of a knowledge graph.</p>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-800 mb-2">Step-by-Step Guide</h4>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Paste your text in the input area. The text can be from any source: articles, research papers, notes, etc.</li>
                  <li>Click the "Generate Knowledge Graph" button to process the text.</li>
                  <li>Wait for the system to extract entities and relationships.</li>
                  <li>Explore the generated knowledge graph in the visualization area.</li>
                </ol>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-800 mb-2">Interacting with the Graph</h4>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Click and drag any node to reposition it.</li>
                  <li>Scroll to zoom in and out.</li>
                  <li>Click and drag the background to pan around the visualization.</li>
                  <li>Hover over nodes and edges to see more details.</li>
                  <li>Use the control buttons to zoom in, zoom out, or reset the view.</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-800 mb-2">Tips for Better Results</h4>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Use clear, well-structured text for better entity and relationship extraction.</li>
                  <li>Longer texts may result in more complex graphs.</li>
                  <li>The system works best with factual content rather than highly abstract concepts.</li>
                  <li>If the graph is too dense, consider breaking your text into smaller chunks.</li>
                </ul>
              </div>
            </div>
          )}
        </div>
        <div className="bg-gray-50 px-6 py-4 rounded-b-lg">
          <Button onClick={onClose}>
            Got it, thanks!
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
