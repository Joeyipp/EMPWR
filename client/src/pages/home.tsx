import Sidebar from '@/components/Sidebar';
import HelpModal from '@/components/HelpModal';
import { useState, useEffect } from 'react';
import { useSidebar } from '@/components/ui/sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardFooter, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BarChart3Icon, 
  DatabaseIcon, 
  NetworkIcon, 
  GitMergeIcon, 
  AlignStartHorizontalIcon,
  ArrowRightIcon,
  HardDriveIcon,
  BrainCircuitIcon,
  LinkIcon,
  Sparkles,
  ExternalLink,
  FileText,
  Zap,
  ChevronUp
} from 'lucide-react';
import { Link } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
  const { state, isMobile, openMobile } = useSidebar();
  const { user, isAuthenticated } = useAuth();
  const [scrollPosition, setScrollPosition] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  // Handle scroll for parallax effects and scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      const currentPosition = window.scrollY;
      setScrollPosition(currentPosition);
      setShowScrollTop(currentPosition > 500);
    };
    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Toggle help modal
  const toggleHelpModal = () => {
    setIsHelpModalOpen(!isHelpModalOpen);
  };

  // Calculate content margin based on sidebar state
  const getContentMargin = () => {
    if (isMobile) {
      return openMobile ? 'ml-0' : 'ml-0';
    }
    return state === 'expanded' ? 'lg:ml-64' : 'lg:ml-20';
  };

  // Tool cards for organized display
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

  // Only show sidebar if user is authenticated
  const showSidebar = isAuthenticated;
  
  return (
    <div className="min-h-screen flex flex-col bg-black text-white">
      {showSidebar && <Sidebar onToggleHelp={toggleHelpModal} />}
      
      <div className={`flex-1 transition-all duration-300 ${showSidebar ? getContentMargin() : 'ml-0'} z-10`}>
        {isAuthenticated ? (
          // Authenticated user view - Available Tools
          <div className="container mx-auto px-4 py-8 mt-10">
            <h1 className="text-3xl font-bold mb-2 text-white">Available Tools</h1>
            <p className="text-gray-400 mb-8">Select a tool to start working with your knowledge graphs</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {toolCards.map(tool => (
                <div key={tool.id} className="bg-gray-900 border-gray-800 overflow-hidden shadow-xl transition-all duration-300 hover:transform hover:scale-[1.02] group rounded-xl">
                  <div className={`h-2 w-full bg-gradient-to-r ${tool.color}`}></div>
                  <div className="p-5">
                    <div className="flex justify-between items-center mb-4">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br ${tool.color}`}>
                        {tool.icon}
                      </div>
                      {tool.isNew && (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-indigo-900 text-indigo-200">
                          NEW
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">{tool.title}</h3>
                    <p className="text-gray-400 text-sm mb-2">{tool.description}</p>
                    <p className="text-gray-300 text-sm mb-4">{tool.content}</p>
                    <Link href={tool.path}>
                      <Button className={`w-full bg-gradient-to-r ${tool.color} text-white hover:opacity-90`}>
                        Access Tool <ArrowRightIcon className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Non-authenticated user view (marketing landing page)
          <div className="relative min-h-screen">
          {/* SVG Background Pattern */}
          <div className="absolute inset-0 opacity-5 overflow-hidden pointer-events-none">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                </pattern>
                <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
                  <circle cx="10" cy="10" r="1" fill="white" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              <rect width="100%" height="100%" fill="url(#dots)" />
              
              {/* Random connecting lines to simulate a graph */}
              <g className="graph-lines" stroke="white" strokeWidth="0.3" opacity="0.4">
                <line x1="10%" y1="30%" x2="30%" y2="10%" />
                <line x1="30%" y1="10%" x2="50%" y2="20%" />
                <line x1="50%" y1="20%" x2="70%" y2="5%" />
                <line x1="70%" y1="5%" x2="90%" y2="30%" />
                <line x1="20%" y1="60%" x2="40%" y2="80%" />
                <line x1="40%" y1="80%" x2="60%" y2="70%" />
                <line x1="60%" y1="70%" x2="80%" y2="90%" />
                <line x1="30%" y1="40%" x2="50%" y2="60%" />
                <line x1="50%" y1="20%" x2="50%" y2="60%" />
                <line x1="60%" y1="70%" x2="70%" y2="50%" />
                <line x1="70%" y1="5%" x2="70%" y2="50%" />
              </g>

              {/* Random nodes */}
              <g className="graph-nodes" fill="white">
                <circle cx="10%" cy="30%" r="3" />
                <circle cx="30%" cy="10%" r="2" />
                <circle cx="50%" cy="20%" r="4" />
                <circle cx="70%" cy="5%" r="2" />
                <circle cx="90%" cy="30%" r="3" />
                <circle cx="20%" cy="60%" r="2" />
                <circle cx="40%" cy="80%" r="3" />
                <circle cx="60%" cy="70%" r="2" />
                <circle cx="80%" cy="90%" r="4" />
                <circle cx="30%" cy="40%" r="2" />
                <circle cx="50%" cy="60%" r="3" />
                <circle cx="70%" cy="50%" r="2" />
              </g>
            </svg>
          </div>
          
          {/* Navigation header for public home */}
          {!showSidebar && (
            <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 animate-fade-in" 
                    style={{ 
                      backgroundColor: scrollPosition > 50 ? 'rgba(0, 0, 0, 0.8)' : 'transparent',
                      backdropFilter: scrollPosition > 50 ? 'blur(8px)' : 'none',
                      boxShadow: scrollPosition > 50 ? '0 4px 30px rgba(0, 0, 0, 0.3)' : 'none'
                    }}>
              <div className="container mx-auto px-6 py-4">
                <div className="flex justify-between items-center w-full">
                  {/* Left Logo */}
                  <div className="flex items-center">
                    <div className="overflow-hidden rounded-full mr-2 p-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-lg">
                      <div className="bg-black rounded-full p-1">
                        <NetworkIcon className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300">
                      EMPWR
                    </span>
                  </div>
                  
                  {/* Center Navigation */}
                  <nav className="hidden md:flex items-center justify-center space-x-6 absolute left-1/2 transform -translate-x-1/2">
                    <a href="#features" className="text-lg text-gray-300 hover:text-white transition-colors" onClick={(e) => {
                      e.preventDefault();
                      document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                    }}>Features</a>
                    <a href="#tools" className="text-lg text-gray-300 hover:text-white transition-colors" onClick={(e) => {
                      e.preventDefault();
                      document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' });
                    }}>Tools</a>
                    <a href="mailto:joey@knoesis.org" className="text-lg text-gray-300 hover:text-white transition-colors">Contact Us</a>
                  </nav>
                  
                  {/* Right Auth Buttons */}
                  <div className="flex items-center space-x-4">
                    <Link href="/login">
                      <Button variant="ghost" className="text-gray-300 hover:text-white transition-colors">
                        Log In
                      </Button>
                    </Link>
                    <Link href="/signup">
                      <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg transition-all">
                        Sign Up Free
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </header>
          )}
          
          {/* Hero Section */}
          <section className="relative z-10 min-h-[80vh] flex flex-col justify-center items-center text-center px-4 pb-24 pt-20 overflow-hidden">
            <div 
              className="absolute inset-0 -z-10 bg-gradient-to-br from-gray-900 via-gray-950 to-black"
              style={{ 
                transform: `translateY(${scrollPosition * 0.2}px)`,
                transition: 'transform 0.1s ease-out'
              }}
            />
            
            <div className="flex-1"></div>
            
            <div className="relative overflow-hidden rounded-full mb-6 p-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-lg">
              <div className="bg-black rounded-full p-3">
                <NetworkIcon className="h-10 w-10 text-white" />
              </div>
            </div>
            
            <h1 className="relative text-4xl md:text-6xl lg:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 animate-fade-in">
              <span className="uppercase tracking-tight">EMPWR</span>
            </h1>
            
            <div className="relative max-w-3xl animate-slide-up mb-10">
              <h2 className="text-xl md:text-2xl lg:text-3xl text-gray-300 mb-6 leading-relaxed">
                Unleash the Power of Knowledge Graphs <span className="text-primary">|</span> Visual Knowledge Discovery
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Transform unstructured data into interactive knowledge graphs with our cutting-edge AI technology.
                Automatically extract entities, relationships, and insights from text, websites, and documents.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 z-10 animate-fade-in justify-center mb-8">
              <Link href={isAuthenticated ? "/generate" : "/login"}>
                <Button size="lg" className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg transition-all px-8 py-6 rounded-xl font-medium text-lg">
                  {isAuthenticated ? "Get Started" : "Log In to Start"} 
                  <Zap className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
            
            <div className="flex-1"></div>
            
            {/* Animated scroll indicator */}
            <div 
              className="absolute bottom-10 left-1/2 transform -translate-x-1/2 animate-bounce"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 5L12 19M12 19L19 12M12 19L5 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </section>
          
          {/* Features Section */}
          <section id="features" className="py-20 px-4 bg-gray-950 relative">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Powerful Knowledge Discovery</h2>
                <p className="text-gray-400 max-w-3xl mx-auto">
                  Our AI-powered platform transforms unstructured data into interactive, visually engaging knowledge graphs.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* Feature Cards */}
                <FeatureCard 
                  icon={<BrainCircuitIcon className="h-8 w-8" />}
                  title="AI-Powered Analysis"
                  description="Leverage cutting-edge AI models to automatically extract entities and relationships from your text data."
                />
                <FeatureCard 
                  icon={<NetworkIcon className="h-8 w-8" />}
                  title="Interactive Visualization"
                  description="Explore your data through intuitive, interactive graph visualizations with customizable layouts."
                />
                <FeatureCard 
                  icon={<LinkIcon className="h-8 w-8" />}
                  title="Multi-Source Integration"
                  description="Combine data from websites, documents, and other sources into unified knowledge graphs."
                />
                <FeatureCard 
                  icon={<GitMergeIcon className="h-8 w-8" />}
                  title="Entity Resolution"
                  description="Automatically identify and merge similar entities across different data sources."
                />
                <FeatureCard 
                  icon={<BrainCircuitIcon className="h-8 w-8" />}
                  title="Insight Generation"
                  description="Discover hidden patterns and relationships in your data through advanced graph analytics."
                />
                <FeatureCard 
                  icon={<Sparkles className="h-8 w-8" />}
                  title="Extensible Platform"
                  description="Customize and extend the platform with your own data sources and visualization techniques."
                />
              </div>
            </div>
          </section>
          
          {/* Tools Section */}
          <section id="tools" className="py-16 px-4 bg-black relative">
            <div className="absolute inset-0 bg-gradient-to-b from-gray-950 to-black" />
            
            <div className="relative max-w-7xl mx-auto z-10">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-white mb-4">Powerful Tools at Your Fingertips</h2>
                <p className="text-gray-400 max-w-2xl mx-auto">
                  Our comprehensive suite of knowledge graph tools helps you extract, analyze, and visualize complex information.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {toolCards.map(tool => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            </div>
          </section>
          
          {/* Call to Action */}
          <section className="py-20 px-4 bg-gradient-to-br from-gray-900 to-black relative overflow-hidden">
            <div className="max-w-4xl mx-auto text-center relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
                Ready to Transform Your Data?
              </h2>
              <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
                Join thousands of data scientists, researchers, and knowledge workers who use EMPWR
                to extract meaningful insights from complex information.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link href={isAuthenticated ? "/generate" : "/signup"}>
                  <Button size="lg" className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium py-6 px-8 rounded-xl">
                    {isAuthenticated ? "Start Creating" : "Sign Up for Free"} <Sparkles className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <a href="mailto:joey@knoesis.org">
                  <Button size="lg" variant="outline" className="border-gray-700 text-white hover:bg-gray-800 font-medium py-6 px-8 rounded-xl">
                    Contact Us <ExternalLink className="ml-2 h-5 w-5" />
                  </Button>
                </a>
              </div>
            </div>
            
            {/* Background decoration */}
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-purple-900 opacity-20 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-indigo-900 opacity-20 rounded-full blur-3xl" />
          </section>
        </div>
        )}
      </div>
      
      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-50 p-2 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg transition-all duration-300 hover:scale-110 focus:outline-none animate-fade-in"
          aria-label="Scroll to top"
        >
          <ChevronUp className="h-6 w-6" />
        </button>
      )}
      
      {isHelpModalOpen && <HelpModal onClose={toggleHelpModal} />}
    </div>
  );
}

// Feature Card Component
function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-all hover:-translate-y-2 duration-300">
      <div className="w-12 h-12 mb-4 rounded-lg bg-gray-800 flex items-center justify-center text-purple-400">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2 text-white">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}

// Tool Card Component
function ToolCard({ tool }: { tool: any }) {
  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-800 bg-gray-900 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
      {tool.isNew && (
        <div className="absolute top-0 right-0 bg-gradient-to-r from-purple-600 to-pink-600 text-xs font-medium text-white px-2 py-1 rounded-bl-md z-10">
          NEW
        </div>
      )}
      
      <div className={`h-1.5 w-full bg-gradient-to-r ${tool.color}`}></div>
      
      <CardHeader className="pt-6 pb-2">
        <CardTitle className="text-lg font-bold text-white flex items-center">
          <div className={`mr-3 p-2 rounded-md bg-gradient-to-br ${tool.color} text-white`}>
            {tool.icon}
          </div>
          {tool.title}
        </CardTitle>
        <CardDescription className="text-gray-400">
          {tool.description}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="text-sm text-gray-300">
        {tool.content}
      </CardContent>
      
      <CardFooter className="pt-2 pb-4">
        <Link href={tool.path}>
          <Button className={`w-full bg-gradient-to-r ${tool.color} text-white hover:opacity-90 transition-opacity`}>
            Go to {tool.title} <ArrowRightIcon className="ml-2 w-4 h-4" />
          </Button>
        </Link>
      </CardFooter>
    </div>
  );
}

// Add these animation classes to your global CSS
const globalCss = `
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in {
  animation: fadeIn 1s ease-out forwards;
}

.animate-slide-up {
  animation: slideUp 0.8s ease-out forwards;
}
`;