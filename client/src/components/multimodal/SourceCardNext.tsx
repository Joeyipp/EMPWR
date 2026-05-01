import { FC, useState } from 'react';
import { 
  Trash2, Edit, ExternalLink, PlayCircle, 
  Link as LinkIcon, GripVertical, RefreshCw, 
  CheckCircle, Share2, ChevronDown 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Source, SourceType } from '@/types/multimodal';

interface SourceCardNextProps {
  source: Source;
  index: number;
  onDelete: (id: string) => void;
  onEdit: (id: string, updates: Partial<Source>) => void;
  onProcess: (id: string) => void;
  onConnect: (id: string) => void;
  isActive: boolean;
  onSelect: (id: string) => void;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent, id: string, index: number) => void;
  onDragOver?: (e: React.DragEvent, id: string, index: number) => void;
  onDrop?: (e: React.DragEvent, id: string, index: number) => void;
}

const SourceCardNext: FC<SourceCardNextProps> = ({
  source, 
  index,
  onDelete, 
  onEdit, 
  onProcess, 
  onConnect,
  isActive,
  onSelect,
  isDragging = false,
  onDragStart,
  onDragOver,
  onDrop
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(source.title);
  const [content, setContent] = useState(source.content);

  const handleSaveEdit = () => {
    onEdit(source.id, { title, content });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setTitle(source.title);
    setContent(source.content);
    setIsEditing(false);
  };

  const getSourceTypeLabel = (type: SourceType) => {
    switch (type) {
      case 'youtube': return 'YouTube';
      case 'website': return 'Website';
      case 'text': return 'Text';
      case 'image': return 'Image';
      case 'pdf': return 'PDF';
      default: return 'Source';
    }
  };

  const getSourceTypeColor = (type: SourceType) => {
    switch (type) {
      case 'youtube': return 'bg-red-500';
      case 'website': return 'bg-blue-500';
      case 'text': return 'bg-gray-500';
      case 'image': return 'bg-green-500';
      case 'pdf': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div 
      className={`
        rounded-lg border border-[#1b1e29]/50 
        ${isActive ? 'bg-[#131f38] ring-2 ring-primary' : 'bg-[#0d1016]'}
        ${isDragging ? 'opacity-50 ring-2 ring-blue-500' : ''}
        shadow-md transition-all duration-200 cursor-grab isolate relative
        hover:border-[#1b1e29]
      `}
      draggable={!isEditing}
      onDragStart={(e) => onDragStart?.(e, source.id, index)}
      onDragOver={(e) => onDragOver?.(e, source.id, index)}
      onDrop={(e) => onDrop?.(e, source.id, index)}
      onClick={() => onSelect(source.id)}
    >
      <div className="p-4 pb-2">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-start gap-2">
            <div className="mt-1 text-gray-500 cursor-grab">
              <ChevronDown className="h-5 w-5" />
            </div>
            <div>
              <Badge className={`${getSourceTypeColor(source.type)} mb-2`}>
                {getSourceTypeLabel(source.type)}
              </Badge>
              {isEditing ? (
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter title"
                  className="w-full mb-2"
                />
              ) : (
                <h3 className="text-base font-medium text-gray-200">
                  {source.title}
                </h3>
              )}
            </div>
          </div>
          
          <div className="flex space-x-1">
            {!isEditing ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                  }}
                  className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-700"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(source.id);
                  }}
                  className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-gray-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            ) : null}
          </div>
        </div>
        
        {isEditing ? (
          <div className="space-y-3">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter content"
              className="w-full h-24"
            />
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelEdit();
                }}
              >
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleSaveEdit();
                }}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div>
            {source.type === 'image' ? (
              <div className="mt-2">
                <div className="w-full aspect-video bg-gray-800 rounded-md overflow-hidden">
                  {source.content.startsWith('http') || source.content.startsWith('data:') ? (
                    <img
                      src={source.content}
                      alt={source.title}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      Image preview not available
                    </div>
                  )}
                </div>
              </div>
            ) : source.type === 'youtube' || source.type === 'website' ? (
              <div className="mt-2">
                <a
                  href={source.content}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:underline flex items-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  {source.content.length > 40 ? `${source.content.substring(0, 40)}...` : source.content}
                </a>
              </div>
            ) : (
              <div className="mt-2">
                <div className="text-sm text-gray-300 line-clamp-3">
                  {source.content}
                </div>
              </div>
            )}
            
            {source.isProcessing && (
              <div className="mt-4">
                <div className="flex items-center mb-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-500 mr-2"></div>
                  <span className="text-sm font-medium text-amber-400">Processing...</span>
                </div>
                <div className="w-full bg-gray-800/50 rounded-full h-1.5 mb-1">
                  <div 
                    className="bg-gradient-to-r from-amber-500 to-amber-600 h-1.5 rounded-full" 
                    style={{ width: `${Math.min(90, 20 + Math.random() * 60)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500">Extracting entities and relationships</p>
              </div>
            )}
            
            {source.isProcessed && !source.isProcessing && !source.error && (
              <div className="mt-3 flex items-center text-xs text-emerald-400">
                <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                <span>Processed</span>
                {source.processingTime && (
                  <span className="ml-1 text-gray-500">in {source.processingTime.toFixed(2)}s</span>
                )}
              </div>
            )}
            
            {source.error && (
              <div className="mt-2 p-2 bg-red-900/30 border border-red-800 rounded-md">
                <p className="text-xs text-red-400">{source.error}</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Process button removed as requested */}
    </div>
  );
};

export default SourceCardNext;