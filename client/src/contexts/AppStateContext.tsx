import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { KnowledgeGraph } from '@shared/schema';

// Define the shape of our app state
interface AppState {
  // Generate page state
  generatePage: {
    knowledgeGraph: KnowledgeGraph | null;
    originalGraph: KnowledgeGraph | null;
    enrichedGraph: KnowledgeGraph | null;
    text: string;
    selectedModel: string;
    inputType: 'text' | 'document';
    extractResult: any | null;
  };
  // Hybrid page state
  hybridPage: {
    knowledgeGraph: KnowledgeGraph | null;
    text: string;
    selectedModel: string;
    inputType: 'text' | 'document';
    processingStage: string;
  };
  // Subgraphs page state
  subgraphsPage: {
    selectedGraph: KnowledgeGraph | null;
    selectedGraphId: number | null;
  };
  // OntoMaker page state
  ontomakerPage: {
    selectedOntology: any | null;
    selectedOntologyId: number | null;
    ontologyName: string;
    ontologyDescription: string;
    selectedTab: string;
  };
  // Extract page state
  extractPage: {
    url: string;
    selectedSource: string;
    extractedGraph: KnowledgeGraph | null;
    isExtracting: boolean;
  };
  // Merge page state
  mergePage: {
    selectedGraphs: number[];
    mergedGraph: KnowledgeGraph | null;
    mergeAlgorithm: string;
    similarityThreshold: number;
  };
  // Insights page state
  insightsPage: {
    selectedGraph: KnowledgeGraph | null;
    selectedGraphId: number | null;
    analysisType: string;
    selectedModel: string;
    searchTerm: string;
  };
  // Multimodal page state
  multimodalPage: {
    sources: any[];
    combinedGraph: KnowledgeGraph | null;
    activeSource: string;
  };
  // Load page state
  loadPage: {
    selectedGraph: KnowledgeGraph | null;
    selectedGraphId: number | null;
    searchTerm: string;
  };
}

// Define initial state
const initialState: AppState = {
  generatePage: {
    knowledgeGraph: null,
    originalGraph: null,
    enrichedGraph: null,
    text: '',
    selectedModel: 'mistral', // default model
    inputType: 'text',
    extractResult: null,
  },
  hybridPage: {
    knowledgeGraph: null,
    text: '',
    selectedModel: 'gpt-4o',
    inputType: 'text',
    processingStage: '',
  },
  subgraphsPage: {
    selectedGraph: null,
    selectedGraphId: null,
  },
  ontomakerPage: {
    selectedOntology: null,
    selectedOntologyId: null,
    ontologyName: '',
    ontologyDescription: '',
    selectedTab: 'create',
  },
  extractPage: {
    url: '',
    selectedSource: 'general',
    extractedGraph: null,
    isExtracting: false,
  },
  mergePage: {
    selectedGraphs: [],
    mergedGraph: null,
    mergeAlgorithm: 'string-similarity',
    similarityThreshold: 0.7,
  },
  insightsPage: {
    selectedGraph: null,
    selectedGraphId: null,
    analysisType: 'overview',
    selectedModel: 'openai',
    searchTerm: '',
  },
  multimodalPage: {
    sources: [],
    combinedGraph: null,
    activeSource: 'text',
  },
  loadPage: {
    selectedGraph: null,
    selectedGraphId: null,
    searchTerm: '',
  },
};

// Create the context
interface AppStateContextType {
  appState: AppState;
  updateGeneratePage: (updates: Partial<AppState['generatePage']>) => void;
  updateHybridPage: (updates: Partial<AppState['hybridPage']>) => void;
  updateSubgraphsPage: (updates: Partial<AppState['subgraphsPage']>) => void;
  updateOntomakerPage: (updates: Partial<AppState['ontomakerPage']>) => void;
  updateExtractPage: (updates: Partial<AppState['extractPage']>) => void;
  updateMergePage: (updates: Partial<AppState['mergePage']>) => void;
  updateInsightsPage: (updates: Partial<AppState['insightsPage']>) => void;
  updateMultimodalPage: (updates: Partial<AppState['multimodalPage']>) => void;
  updateLoadPage: (updates: Partial<AppState['loadPage']>) => void;
  resetGeneratePage: () => void;
  resetAllState: () => void;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

// Create a provider component
export function AppStateProvider({ children }: { children: ReactNode }) {
  const [appState, setAppState] = useState<AppState>(() => {
    // Try to load state from localStorage on initial load
    const savedState = localStorage.getItem('appState');
    return savedState ? JSON.parse(savedState) : initialState;
  });

  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('appState', JSON.stringify(appState));
  }, [appState]);

  // Update functions for different pages
  const updateGeneratePage = (updates: Partial<AppState['generatePage']>) => {
    setAppState(prevState => ({
      ...prevState,
      generatePage: {
        ...prevState.generatePage,
        ...updates
      }
    }));
  };

  const updateHybridPage = (updates: Partial<AppState['hybridPage']>) => {
    setAppState(prevState => ({
      ...prevState,
      hybridPage: {
        ...prevState.hybridPage,
        ...updates
      }
    }));
  };

  const updateSubgraphsPage = (updates: Partial<AppState['subgraphsPage']>) => {
    setAppState(prevState => ({
      ...prevState,
      subgraphsPage: {
        ...prevState.subgraphsPage,
        ...updates
      }
    }));
  };

  const updateOntomakerPage = (updates: Partial<AppState['ontomakerPage']>) => {
    setAppState(prevState => ({
      ...prevState,
      ontomakerPage: {
        ...prevState.ontomakerPage,
        ...updates
      }
    }));
  };

  const updateExtractPage = (updates: Partial<AppState['extractPage']>) => {
    setAppState(prevState => ({
      ...prevState,
      extractPage: {
        ...prevState.extractPage,
        ...updates
      }
    }));
  };

  const updateMergePage = (updates: Partial<AppState['mergePage']>) => {
    setAppState(prevState => ({
      ...prevState,
      mergePage: {
        ...prevState.mergePage,
        ...updates
      }
    }));
  };

  const updateInsightsPage = (updates: Partial<AppState['insightsPage']>) => {
    setAppState(prevState => ({
      ...prevState,
      insightsPage: {
        ...prevState.insightsPage,
        ...updates
      }
    }));
  };

  const updateMultimodalPage = (updates: Partial<AppState['multimodalPage']>) => {
    setAppState(prevState => ({
      ...prevState,
      multimodalPage: {
        ...prevState.multimodalPage,
        ...updates
      }
    }));
  };

  const updateLoadPage = (updates: Partial<AppState['loadPage']>) => {
    setAppState(prevState => ({
      ...prevState,
      loadPage: {
        ...prevState.loadPage,
        ...updates
      }
    }));
  };

  // Reset functions
  const resetGeneratePage = () => {
    setAppState(prevState => ({
      ...prevState,
      generatePage: initialState.generatePage
    }));
  };

  const resetAllState = () => {
    localStorage.removeItem('appState');
    setAppState(initialState);
  };

  return (
    <AppStateContext.Provider
      value={{
        appState,
        updateGeneratePage,
        updateHybridPage,
        updateSubgraphsPage,
        updateOntomakerPage,
        updateExtractPage,
        updateMergePage,
        updateInsightsPage,
        updateMultimodalPage,
        updateLoadPage,
        resetGeneratePage,
        resetAllState
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

// Custom hook for using the app state
export function useAppState() {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}