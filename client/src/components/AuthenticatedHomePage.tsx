import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardFooter, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileText,
  DatabaseIcon, 
  NetworkIcon, 
  GitMergeIcon, 
  AlignStartHorizontalIcon,
  ArrowRightIcon,
  HardDriveIcon,
  BrainCircuitIcon,
  LinkIcon
} from 'lucide-react';
import { Link } from 'wouter';

// Tool card component for authenticated home page
const ToolCard = ({ tool }: { tool: any }) => {
  return (
    <Card className="bg-gray-900 border-gray-800 overflow-hidden shadow-xl transition-all duration-300 hover:transform hover:scale-[1.02] group">
      <div className={`h-2 w-full bg-gradient-to-r ${tool.color}`}></div>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div className={`flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br ${tool.color} mb-1`}>
            {tool.icon}
          </div>
          {tool.isNew && (
            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-indigo-900 text-indigo-200">
              NEW
            </span>
          )}
        </div>
        <CardTitle className="text-lg font-bold text-white">{tool.title}</CardTitle>
        <CardDescription className="text-gray-400">{tool.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-gray-300 text-sm mb-4">{tool.content}</p>
      </CardContent>
      <CardFooter className="pt-0">
        <Link href={tool.path}>
          <Button className={`w-full bg-gradient-to-r ${tool.color} text-white hover:opacity-90`}>
            Access Tool <ArrowRightIcon className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
};

// Main authenticated home page component showing available tools
const AuthenticatedHomePage = () => {
  // Tool cards data
  const toolCards = [
    {
      id: 1,
      title: 'Generate',
      description: 'Turn text into knowledge graphs',
      icon: <FileText className="w-5 h-5" />,
      content: 'Process natural language text and automatically extract entities and relationships to create an interactive knowledge graph.',
      path: '/generate',
      color: 'from-indigo-500 to-purple-600'
    },
    {
      id: 2,
      title: 'Extract',
      description: 'Extract data from websites',
      icon: <DatabaseIcon className="w-5 h-5" />,
      content: 'Extract structured data from websites and web pages automatically, without needing to create custom rules.',
      path: '/extract',
      color: 'from-blue-500 to-indigo-600'
    },
    {
      id: 3,
      title: 'Merge',
      description: 'Combine knowledge graphs',
      icon: <GitMergeIcon className="w-5 h-5" />,
      content: 'Merge multiple knowledge graphs with automatic entity resolution to create a unified, comprehensive representation.',
      path: '/merge',
      color: 'from-cyan-500 to-blue-600'
    },
    {
      id: 4,
      title: 'Align',
      description: 'Align different ontologies',
      icon: <AlignStartHorizontalIcon className="w-5 h-5" />,
      content: 'Map and align entities between knowledge graphs with different structures and ontologies for more effective data integration.',
      path: '/align',
      color: 'from-green-500 to-teal-600'
    },
    {
      id: 5,
      title: 'Load',
      description: 'Retrieve saved knowledge graphs',
      icon: <HardDriveIcon className="w-5 h-5" />,
      content: 'Access and visualize your previously saved knowledge graphs. Browse, search, and interact with your graph collection.',
      path: '/load',
      color: 'from-purple-500 to-pink-600'
    },
    {
      id: 6,
      title: 'Subgraphs',
      description: 'Extract focused subgraphs',
      icon: <NetworkIcon className="w-5 h-5" />,
      content: 'Create focused subgraphs by selecting specific entities and exploring their connections with flexible traversal depth.',
      path: '/subgraphs',
      color: 'from-pink-500 to-rose-600'
    },
    {
      id: 7,
      title: 'Insights',
      description: 'Analyze knowledge graph patterns',
      icon: <BrainCircuitIcon className="w-5 h-5" />,
      content: 'Discover patterns, insights, and hidden connections in your knowledge graphs with advanced analytics and AI-powered assistants.',
      path: '/insights',
      color: 'from-amber-500 to-orange-600'
    },
    {
      id: 8,
      title: 'Multimodal',
      description: 'Chain multiple data sources',
      icon: <LinkIcon className="w-5 h-5" />,
      content: 'Build comprehensive knowledge graphs by chaining and combining different information sources like websites, YouTube videos, PDFs, and images.',
      path: '/multimodal',
      color: 'from-violet-500 to-purple-600',
      isNew: true
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8 mt-10">
      <h1 className="text-3xl font-bold mb-2 text-white">Available Tools</h1>
      <p className="text-gray-400 mb-8">Select a tool to start working with your knowledge graphs</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {toolCards.map(tool => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </div>
  );
};

export default AuthenticatedHomePage;