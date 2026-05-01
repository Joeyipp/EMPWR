import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import { useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { 
  GitMergeIcon, 
  FileText, 
  Database, 
  AlignStartHorizontal,
  HardDrive,
  Network,
  BarChart3,
  Link as LinkIcon,
  ArrowRight,
  Boxes,
  FileUp,
  PlayCircle,
  BookOpen
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [isHelpModalOpen, setIsHelpModalOpen] = React.useState(false);
  
  // Toggle help modal
  const toggleHelpModal = () => {
    setIsHelpModalOpen(!isHelpModalOpen);
  };

  // Get sidebar width for proper spacing
  const { state, width: sidebarWidth } = useSidebar() as any;

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      <Sidebar onToggleHelp={toggleHelpModal} />
      
      <div 
        className="flex-1 overflow-auto transition-all duration-300 ease-in-out"
        style={{ marginLeft: `${sidebarWidth || (state === 'expanded' ? 256 : 80)}px` }}
      >
        <main className="max-w-6xl mx-auto px-4 py-8">
          {/* Dashboard Header */}
          <div className="mb-6 border border-gray-800 rounded-lg p-6 bg-gray-900 shadow-lg">
            <h1 className="text-2xl font-semibold mb-4 flex items-center text-indigo-400">
              <BarChart3 className="mr-2 h-6 w-6" /> Welcome to EMPWR
            </h1>
            <p className="text-gray-400 mb-2">
              Turn unstructured text into interactive knowledge graphs
            </p>
            <p className="text-gray-400 mb-4">
              EMPWR helps you understand complex information by automatically extracting entities and relationships from text
              and visualizing them as interactive knowledge graphs.
            </p>
            <div className="flex justify-between items-center pt-2 border-t border-gray-800 mt-2">
              <div>
                <span className="text-sm font-medium text-gray-400">New to EMPWR?</span>
                <h3 className="text-lg font-medium text-blue-400 mt-1 flex items-center">
                  <PlayCircle className="mr-2 h-5 w-5" /> Check out our tutorials
                </h3>
              </div>
              <Link href="/tutorials">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  View Tutorials <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
          
          {/* Tools Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-white">Available Tools</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Generate Tool */}
              <div className="border border-gray-800 rounded-lg p-6 bg-gray-900 hover:bg-gray-800 transition-all">
                <h3 className="text-lg font-medium text-indigo-400 flex items-center mb-2">
                  <FileText className="mr-2 h-5 w-5" /> Generate
                </h3>
                <p className="text-sm text-gray-400 mb-1">Turn text into knowledge graphs</p>
                <p className="text-sm text-gray-400 mb-4">
                  Process natural language text and automatically extract entities and relationships to create an interactive knowledge graph.
                </p>
                <Link href="/generate">
                  <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    Go to Generate <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              
              {/* Hybrid Tool with NEW badge */}
              <div className="border border-gray-800 rounded-lg p-6 bg-gray-900 hover:bg-gray-800 transition-all relative">
                <div className="absolute top-4 right-4 bg-orange-600 text-xs font-medium py-1 px-2 rounded text-white">
                  NEW
                </div>
                <h3 className="text-lg font-medium text-orange-400 flex items-center mb-2">
                  <GitMergeIcon className="mr-2 h-5 w-5" /> Hybrid
                </h3>
                <p className="text-sm text-gray-400 mb-1">Ontology-guided knowledge graphs</p>
                <p className="text-sm text-gray-400 mb-4">
                  Upload ontologies (RDF, OWL, TTL, JSON-LD) and generate knowledge graphs that conform to your schema using AI models.
                </p>
                <Link href="/hybrid">
                  <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white">
                    Go to Hybrid <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              
              {/* Extract Tool */}
              <div className="border border-gray-800 rounded-lg p-6 bg-gray-900 hover:bg-gray-800 transition-all">
                <h3 className="text-lg font-medium text-blue-400 flex items-center mb-2">
                  <Database className="mr-2 h-5 w-5" /> Extract
                </h3>
                <p className="text-sm text-gray-400 mb-1">Extract data from websites</p>
                <p className="text-sm text-gray-400 mb-4">
                  Extract structured data from websites and web pages automatically, without needing to create custom rules.
                </p>
                <Link href="/extract">
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                    Go to Extract <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              
              {/* Merge Tool */}
              <div className="border border-gray-800 rounded-lg p-6 bg-gray-900 hover:bg-gray-800 transition-all">
                <h3 className="text-lg font-medium text-cyan-400 flex items-center mb-2">
                  <GitMergeIcon className="mr-2 h-5 w-5" /> Merge
                </h3>
                <p className="text-sm text-gray-400 mb-1">Combine knowledge graphs</p>
                <p className="text-sm text-gray-400 mb-4">
                  Merge multiple knowledge graphs with automatic entity resolution to create a unified, comprehensive representation.
                </p>
                <Link href="/merge">
                  <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white">
                    Go to Merge <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              
              {/* Align Tool */}
              <div className="border border-gray-800 rounded-lg p-6 bg-gray-900 hover:bg-gray-800 transition-all">
                <h3 className="text-lg font-medium text-teal-400 flex items-center mb-2">
                  <AlignStartHorizontal className="mr-2 h-5 w-5" /> Align
                </h3>
                <p className="text-sm text-gray-400 mb-1">Align different ontologies</p>
                <p className="text-sm text-gray-400 mb-4">
                  Map and align entities between knowledge graphs with different structures and ontologies for more effective data integration.
                </p>
                <Link href="/align">
                  <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white">
                    Go to Align <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              
              {/* Load Tool */}
              <div className="border border-gray-800 rounded-lg p-6 bg-gray-900 hover:bg-gray-800 transition-all">
                <h3 className="text-lg font-medium text-purple-400 flex items-center mb-2">
                  <HardDrive className="mr-2 h-5 w-5" /> Load
                </h3>
                <p className="text-sm text-gray-400 mb-1">Retrieve saved knowledge graphs</p>
                <p className="text-sm text-gray-400 mb-4">
                  Access and visualize your previously saved knowledge graphs. Browse, search, and interact with your graph collection.
                </p>
                <Link href="/load">
                  <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white">
                    Go to Load <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              
              {/* Subgraphs Tool */}
              <div className="border border-gray-800 rounded-lg p-6 bg-gray-900 hover:bg-gray-800 transition-all">
                <h3 className="text-lg font-medium text-pink-400 flex items-center mb-2">
                  <Network className="mr-2 h-5 w-5" /> Subgraphs
                </h3>
                <p className="text-sm text-gray-400 mb-1">Extract focused subgraphs</p>
                <p className="text-sm text-gray-400 mb-4">
                  Create focused subgraphs by selecting specific entities and exploring their connections with flexible traversal depth.
                </p>
                <Link href="/subgraphs">
                  <Button size="sm" className="bg-pink-600 hover:bg-pink-700 text-white">
                    Go to Subgraphs <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              
              {/* Insights Tool */}
              <div className="border border-gray-800 rounded-lg p-6 bg-gray-900 hover:bg-gray-800 transition-all">
                <h3 className="text-lg font-medium text-green-400 flex items-center mb-2">
                  <BarChart3 className="mr-2 h-5 w-5" /> Insights
                </h3>
                <p className="text-sm text-gray-400 mb-1">Analyze your knowledge graphs</p>
                <p className="text-sm text-gray-400 mb-4">
                  Discover patterns, trends, and hidden relationships in your knowledge graphs through advanced analytics and visualization.
                </p>
                <Link href="/insights">
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                    Go to Insights <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              
              {/* Multimodal Tool with NEW badge */}
              <div className="border border-gray-800 rounded-lg p-6 bg-gray-900 hover:bg-gray-800 transition-all relative">
                <div className="absolute top-4 right-4 bg-violet-600 text-xs font-medium py-1 px-2 rounded text-white">
                  NEW
                </div>
                <h3 className="text-lg font-medium text-violet-400 flex items-center mb-2">
                  <LinkIcon className="mr-2 h-5 w-5" /> Multimodal
                </h3>
                <p className="text-sm text-gray-400 mb-1">Chain multiple data sources</p>
                <p className="text-sm text-gray-400 mb-4">
                  Build comprehensive knowledge graphs by chaining and combining different information sources like websites, videos, PDFs, and images.
                </p>
                <Link href="/multimodal">
                  <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
                    Go to Multimodal <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              
              {/* OntoMaker Tool with NEW badge */}
              <div className="border border-gray-800 rounded-lg p-6 bg-gray-900 hover:bg-gray-800 transition-all relative">
                <div className="absolute top-4 right-4 bg-amber-600 text-xs font-medium py-1 px-2 rounded text-white">
                  NEW
                </div>
                <h3 className="text-lg font-medium text-amber-400 flex items-center mb-2">
                  <Boxes className="mr-2 h-5 w-5" /> OntoMaker
                </h3>
                <p className="text-sm text-gray-400 mb-1">Design and manage ontologies</p>
                <p className="text-sm text-gray-400 mb-4">
                  Create, upload, visualize, and enrich ontologies with AI assistance. Manage versions and track changes over time.
                </p>
                <Link href="/ontomaker">
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
                    Go to OntoMaker <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              
              {/* Google Scholar Tool with NEW badge */}
              <div className="border border-gray-800 rounded-lg p-6 bg-gray-900 hover:bg-gray-800 transition-all relative">
                <div className="absolute top-4 right-4 bg-emerald-600 text-xs font-medium py-1 px-2 rounded text-white">
                  NEW
                </div>
                <h3 className="text-lg font-medium text-emerald-400 flex items-center mb-2">
                  <BookOpen className="mr-2 h-5 w-5" /> Google Scholar
                </h3>
                <p className="text-sm text-gray-400 mb-1">Academic profile search</p>
                <p className="text-sm text-gray-400 mb-4">
                  Search academic profiles using Google Scholar integration to explore research publications, citations, and metrics.
                </p>
                <Link href="/use-cases">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    Go to Google Scholar <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              
              {/* Bulk Tool with COMING SOON badge */}
              <div className="border border-gray-800 rounded-lg p-6 bg-gray-900 hover:bg-gray-800 transition-all relative">
                <div className="absolute top-4 right-4 bg-yellow-600 text-xs font-medium py-1 px-2 rounded text-white">
                  COMING SOON
                </div>
                <h3 className="text-lg font-medium text-yellow-400 flex items-center mb-2">
                  <FileUp className="mr-2 h-5 w-5" /> Bulk Upload
                </h3>
                <p className="text-sm text-gray-400 mb-1">Process multiple sources at once</p>
                <p className="text-sm text-gray-400 mb-4">
                  Upload and process multiple files simultaneously to create interconnected knowledge graphs with automatic entity resolution.
                </p>
                <Link href="/bulk">
                  <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-white">
                    Go to Bulk <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}