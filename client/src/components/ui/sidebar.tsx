import {
  createContext,
  useContext,
  useState,
  ReactNode,
  Dispatch,
  SetStateAction,
  useEffect,
} from "react";

type SidebarState = "expanded" | "collapsed";

interface SidebarContextValue {
  state: SidebarState;
  setState: Dispatch<SetStateAction<SidebarState>>;
  isMobile: boolean;
  openMobile: boolean;
  setOpenMobile: Dispatch<SetStateAction<boolean>>;
  width: number; // Sidebar width in pixels for layout calculations
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SidebarState>("expanded");
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [openMobile, setOpenMobile] = useState<boolean>(false);

  // Check if the screen is mobile size
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    
    // Check on mount
    checkIfMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkIfMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Calculate sidebar width based on state and mobile view
  const width = isMobile ? 0 : (state === "expanded" ? 256 : 80); // 256px for expanded, 80px for collapsed, 0 for mobile
  
  return (
    <SidebarContext.Provider value={{ state, setState, isMobile, openMobile, setOpenMobile, width }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}