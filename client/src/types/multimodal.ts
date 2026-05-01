/**
 * Types for the multimodal interface
 */

export type SourceType = 'youtube' | 'website' | 'text' | 'image' | 'pdf';

export interface Source {
  id: string;
  type: SourceType;
  title: string;
  content: string;
  isProcessed: boolean;
  isProcessing: boolean;
  processingTime?: number;
  error?: string;
  metadata?: any;
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
}

export interface Message {
  role: 'system' | 'assistant' | 'user';
  content: string;
  timestamp: Date;
}

export interface KnowledgeGraphNode {
  id: number;
  name: string;
  type?: string;
  group?: number;
  properties?: Record<string, any>;
}

export interface KnowledgeGraphLink {
  source: number;
  target: number;
  label?: string;
  relationship?: string;
  properties?: Record<string, any>;
}

export interface KnowledgeGraph {
  nodes: KnowledgeGraphNode[];
  links: KnowledgeGraphLink[];
}

export interface AssistantSession {
  assistantId: string;
  threadId: string;
  created: Date;
}

export interface MultimodalState {
  sources: Source[];
  connections: Connection[];
  messages: Message[];
  graph: KnowledgeGraph;
  assistantSession?: AssistantSession;
  isProcessing: boolean;
  error?: string;
  apiKey?: string;
  streamingContent?: string;
}

export interface SourcePanelProps {
  source: Source;
  onDelete: (id: string) => void;
  onEdit: (id: string, updates: Partial<Source>) => void;
  onProcess: (id: string) => void;
  isActive: boolean;
  onConnect: (id: string) => void;
  index: number;
  onDragStart?: (e: React.DragEvent, id: string, index: number) => void;
  onDragOver?: (e: React.DragEvent, id: string, index: number) => void;
  onDrop?: (e: React.DragEvent, id: string, index: number) => void;
  isDragging?: boolean;
}

export interface ConnectionPanelProps {
  connection: Connection;
  sources: Source[];
  onDelete: (id: string) => void;
  onEdit: (id: string, updates: Partial<Connection>) => void;
}

export interface AssistantPanelProps {
  messages: Message[];
  isProcessing: boolean;
  onSendMessage: (message: string) => void;
  onClearMessages: () => void;
  onProcessAllSources?: () => void;
  streamingContent?: string;
}

export interface GraphPanelProps {
  graph: KnowledgeGraph;
  isLoading: boolean;
}