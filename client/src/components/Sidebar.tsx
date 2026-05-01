import { FC, useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { 
  Home, 
  FileText, 
  Upload, 
  Download, 
  BarChart, 
  GitMerge, 
  Settings as SettingsIcon,
  HelpCircle,
  Network,
  ChevronLeft,
  ChevronRight,
  Link as LinkIcon,
  LogOut,
  User,
  ShieldAlert,
  Boxes,
  Database,
  PlayCircle,
  Mail,
  BookOpen
} from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

interface SidebarProps {
  onToggleHelp?: () => void;
  active?: string;
}

const Sidebar: FC<SidebarProps> = ({ onToggleHelp, active }) => {
  const [location, setLocation] = useLocation();
  const { state, setState } = useSidebar();
  const { user, logout, isAuthenticated } = useAuth();
  
  // Force component to update when user auth state changes
  const [forceUpdate, setForceUpdate] = useState(0);
  
  // This effect will run when user auth state changes
  useEffect(() => {
    if (user) {
      // If user is authenticated, increment to trigger re-render
      setForceUpdate(prev => prev + 1);
      console.log('Auth state changed - user detected');
    }
  }, [user, isAuthenticated]);
  
  // Use active prop if provided, otherwise use location
  const activePath = active || location;
  
  const isExpanded = state === "expanded";
  
  const toggleSidebar = () => {
    setState(state === "expanded" ? "collapsed" : "expanded");
  };
  
  const handleLogout = async () => {
    try {
      // Clear all potential error sources before logout
      if (typeof window !== 'undefined') {
        // Clear known error sources
        sessionStorage.removeItem('SES_UNCAUGHT_EXCEPTION');
        
        // Clear any checkout-related data that might cause the isCheckout error
        localStorage.removeItem('checkout_data');
        localStorage.removeItem('checkout_session');
        sessionStorage.removeItem('checkout_data');
        
        // Set a cleanup flag to handle async operations during page transitions
        sessionStorage.setItem('cleanup_in_progress', 'true');
      }
      
      // Call the logout API
      await logout();
      
      // Cleanup all storage completely
      if (typeof window !== 'undefined') {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (e) {
          console.error('Error clearing storage:', e);
        }
      }
      
      // Redirect to the home page instead of login page after logout
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      // Force redirect on error to ensure user is logged out of UI
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  };
  
  const mainNavItems: NavItem[] = [
    { path: "/dashboard", label: "Dashboard", icon: <Home className="w-5 h-5" /> },
    { path: "/generate", label: "Generate", icon: <FileText className="w-5 h-5" /> },
    { 
      path: "/hybrid", 
      label: "Hybrid", 
      icon: <GitMerge className="w-5 h-5" />, 
      badge: "NEW"
    },
    { path: "/extract", label: "Extract", icon: <Upload className="w-5 h-5" /> },
    { path: "/merge", label: "Merge", icon: <GitMerge className="w-5 h-5" /> },
    { path: "/load", label: "Load", icon: <Download className="w-5 h-5" /> },
    { path: "/subgraphs", label: "Subgraphs", icon: <Network className="w-5 h-5" /> },
    { path: "/insights", label: "Insights", icon: <BarChart className="w-5 h-5" /> },
    { 
      path: "/multimodal", 
      label: "Multimodal", 
      icon: <LinkIcon className="w-5 h-5" />, 
      badge: "NEW"
    },
    { 
      path: "/ontomaker", 
      label: "OntoMaker", 
      icon: <Boxes className="w-5 h-5" />, 
      badge: "NEW"
    },
    { path: "/tutorials", label: "Tutorials", icon: <PlayCircle className="w-5 h-5" /> },
    { path: "/settings", label: "Settings", icon: <SettingsIcon className="w-5 h-5" /> },
    { 
      path: "/google-scholar", 
      label: "Google Scholar", 
      icon: <BookOpen className="w-5 h-5" />, 
      badge: "NEW"
    }
  ];
  
  // Admin nav items - only visible to admin users
  const adminNavItems: NavItem[] = [
    { path: "/admin", label: "Admin Dashboard", icon: <ShieldAlert className="w-5 h-5" /> },
  ];

  const prototypeNavItems: NavItem[] = [
    { 
      path: "/bulk", 
      label: "Bulk", 
      icon: <Database className="w-5 h-5" />, 
      badge: "COMING SOON" 
    },
    // Schema.org page hidden per request
    // { path: "/schema-org", label: "Schema.org", icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    //   <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    //   <polyline points="14 2 14 8 20 8" />
    //   <line x1="12" y1="18" x2="12" y2="12" />
    //   <line x1="9" y1="15" x2="15" y2="15" />
    // </svg> },
  ];
  
  // Debug logs removed to prevent constant re-rendering
  
  return (
    <div
      className={`
        fixed inset-y-0 left-0 z-20 flex flex-col bg-gray-900 text-white
        transition-all duration-300 ease-in-out shadow-xl
        ${isExpanded ? 'w-64' : 'w-20'}
      `}
    >
      <div className="flex flex-col border-b border-gray-800">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            {isExpanded && (
              <span className="text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-indigo-600">
                EMPWR
              </span>
            )}
          </div>
          <button
            onClick={toggleSidebar}
            className="p-1 rounded-md hover:bg-gray-800 focus:outline-none"
          >
            {isExpanded ? (
              <ChevronLeft className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </button>
        </div>
        
        {/* User greeting - debug mode to check when user is set */}
        {user && (
          <div className={`px-4 pb-4 flex items-center ${isExpanded ? 'justify-start' : 'justify-center'}`} 
               data-testid="user-greeting">
            <div className="h-9 w-9 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg">
              <User className="h-5 w-5 text-white" />
            </div>
            {isExpanded && (
              <div className="ml-3">
                <p className="text-sm font-medium text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500">
                  Hello, {user.fullName || user.username}
                </p>
                <p className="text-xs text-gray-400 truncate max-w-[150px]">{user.email}</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {mainNavItems.slice(0, -1).map((item) => (
            <li key={item.path}>
              <Link
                href={item.path}
                className={`
                  flex items-center p-3 rounded-md cursor-pointer
                  ${activePath === item.path ? 'bg-primary text-white' : 'hover:bg-gray-800'}
                  ${isExpanded ? 'justify-start' : 'justify-center'}
                `}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {isExpanded && (
                  <div className="flex items-center ml-3">
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold bg-blue-600 text-white rounded-md">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
        
        {/* Use Cases Section with Divider */}
        {isExpanded && (
          <div className="mt-6 px-2">
            <div className="flex items-center px-3 mb-2">
              <div className="h-px bg-gray-700 flex-grow"></div>
              <span className="px-2 text-xs font-semibold text-gray-500 uppercase">Use Cases</span>
              <div className="h-px bg-gray-700 flex-grow"></div>
            </div>
          </div>
        )}
        {!isExpanded && (
          <div className="mt-6 px-2">
            <div className="h-px bg-gray-700 w-full my-2"></div>
          </div>
        )}
        
        <ul className="space-y-1 px-2 mt-2">
          {mainNavItems.slice(-1).map((item) => (
            <li key={item.path}>
              <Link
                href={item.path}
                className={`
                  flex items-center p-3 rounded-md cursor-pointer
                  ${activePath === item.path ? 'bg-primary text-white' : 'hover:bg-gray-800'}
                  ${isExpanded ? 'justify-start' : 'justify-center'}
                `}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {isExpanded && (
                  <div className="flex items-center ml-3">
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold bg-blue-600 text-white rounded-md">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
        
        {/* Prototype Section with Divider */}
        {isExpanded && (
          <div className="mt-6 px-2">
            <div className="flex items-center px-3 mb-2">
              <div className="h-px bg-gray-700 flex-grow"></div>
              <span className="px-2 text-xs font-semibold text-gray-500 uppercase">Coming Soon</span>
              <div className="h-px bg-gray-700 flex-grow"></div>
            </div>
          </div>
        )}
        {!isExpanded && (
          <div className="mt-6 px-2">
            <div className="h-px bg-gray-700 w-full my-2"></div>
          </div>
        )}
        
        <ul className="space-y-1 px-2">
          {prototypeNavItems.map((item) => (
            <li key={item.path}>
              <Link
                href={item.path}
                className={`
                  flex items-center p-3 rounded-md cursor-pointer
                  ${activePath === item.path ? 'bg-primary text-white' : 'hover:bg-gray-800'}
                  ${isExpanded ? 'justify-start' : 'justify-center'}
                `}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {isExpanded && (
                  <div className="flex items-center ml-3">
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold bg-blue-600 text-white rounded-md">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
          
        {/* Admin Section - Only visible to admin users */}
        {user?.isAdmin && (
          <>
            {isExpanded && (
              <div className="mt-6 px-2">
                <div className="flex items-center px-3 mb-2">
                  <div className="h-px bg-gray-700 flex-grow"></div>
                  <span className="px-2 text-xs font-semibold text-gray-500 uppercase">Admin</span>
                  <div className="h-px bg-gray-700 flex-grow"></div>
                </div>
              </div>
            )}
            {!isExpanded && user?.isAdmin && (
              <div className="mt-6 px-2">
                <div className="h-px bg-gray-700 w-full my-2"></div>
              </div>
            )}
            
            <ul className="space-y-1 px-2">
              {adminNavItems.map((item) => (
                <li key={item.path}>
                  <Link
                    href={item.path}
                    className={`
                      flex items-center p-3 rounded-md cursor-pointer
                      ${activePath === item.path ? 'bg-red-700 text-white' : 'hover:bg-gray-800 text-red-400'}
                      ${isExpanded ? 'justify-start' : 'justify-center'}
                    `}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    {isExpanded && (
                      <div className="flex items-center ml-3">
                        <span>{item.label}</span>
                        {item.badge && (
                          <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold bg-red-600 text-white rounded-md">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </nav>
      
      <div className="p-4 border-t border-gray-800 space-y-2">
        {onToggleHelp && (
          <button
            onClick={onToggleHelp}
            className={`
              flex items-center p-2 w-full rounded-md hover:bg-gray-800
              ${isExpanded ? 'justify-start' : 'justify-center'}
            `}
          >
            <HelpCircle className="w-5 h-5" />
            {isExpanded && <span className="ml-2">Help</span>}
          </button>
        )}
        
        {/* Contact Us button */}
        <a
          href="mailto:joey@knoesis.org"
          className={`
            flex items-center p-2 w-full rounded-md hover:bg-gray-800
            ${isExpanded ? 'justify-start' : 'justify-center'}
          `}
        >
          <Mail className="w-5 h-5" />
          {isExpanded && <span className="ml-2">Contact Us</span>}
        </a>
        
        {/* Logout button - debug data attribute */}
        {user && (
          <button
            onClick={handleLogout}
            className={`
              flex items-center p-2.5 w-full rounded-md text-white hover:bg-gradient-to-r hover:from-purple-700 hover:to-indigo-700 transition-colors duration-300
              ${isExpanded ? 'justify-start' : 'justify-center'} bg-gradient-to-r from-purple-600 to-indigo-600
            `}
            data-testid="logout-button"
          >
            <LogOut className="w-5 h-5" />
            {isExpanded && <span className="ml-2 font-medium">Logout</span>}
          </button>
        )}
      </div>
    </div>
  );
};

export default Sidebar;