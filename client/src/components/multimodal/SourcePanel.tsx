import { FC, useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Trash2, Edit, ExternalLink, PlayCircle, Link as LinkIcon, GripVertical } from 'lucide-react';
import { SourcePanelProps } from '@/types/multimodal';
import { Badge } from '@/components/ui/badge';

const SourcePanel: FC<SourcePanelProps> = ({ 
  source, 
  onDelete, 
  onEdit, 
  onProcess, 
  isActive,
  onConnect,
  index = 0,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging = false
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

  const getSourceTypeLabel = () => {
    switch (source.type) {
      case 'youtube': return 'YouTube';
      case 'website': return 'Website';
      case 'text': return 'Text';
      case 'image': return 'Image';
      case 'pdf': return 'PDF';
      default: return 'Source';
    }
  };

  const getSourceTypeColor = () => {
    switch (source.type) {
      case 'youtube': return 'bg-red-500';
      case 'website': return 'bg-blue-500';
      case 'text': return 'bg-gray-500';
      case 'image': return 'bg-green-500';
      case 'pdf': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const renderContent = () => {
    if (isEditing) {
      return (
        <div className="space-y-4">
          <div>
            <label htmlFor={`title-${source.id}`} className="block text-sm font-medium text-gray-200 mb-1">
              Title
            </label>
            <Input
              id={`title-${source.id}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter title"
              className="w-full"
            />
          </div>
          <div>
            <label htmlFor={`content-${source.id}`} className="block text-sm font-medium text-gray-200 mb-1">
              Content
            </label>
            <Textarea
              id={`content-${source.id}`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter content"
              className="w-full h-24"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" size="sm" onClick={handleCancelEdit}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveEdit}>
              Save
            </Button>
          </div>
        </div>
      );
    }

    if (source.type === 'image') {
      // For image type, display the image if content is a valid URL or Base64
      return (
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
          {source.content.startsWith('http') && (
            <div className="mt-2">
              <a
                href={source.content}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:underline flex items-center"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                View original
              </a>
            </div>
          )}
        </div>
      );
    }

    if (source.type === 'youtube' || source.type === 'website') {
      // For website and YouTube, show a link
      return (
        <div className="mt-2">
          <a
            href={source.content}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:underline flex items-center"
          >
            <ExternalLink className="w-4 h-4 mr-1" />
            {source.content.length > 40 ? `${source.content.substring(0, 40)}...` : source.content}
          </a>
        </div>
      );
    }

    // For text and other types
    return (
      <div className="mt-2">
        <div className="text-sm text-gray-300 line-clamp-3">
          {source.content}
        </div>
      </div>
    );
  };

  return (
    <Card 
      className={`
        border border-[#1b1e29]/50
        ${isActive ? 'bg-[#131f38] ring-2 ring-primary' : 'bg-[#0d1016]'}
        ${isDragging ? 'opacity-50 ring-2 ring-blue-500' : ''}
        cursor-grab isolate relative shadow-md
      `}
      draggable={!isEditing}
      onDragStart={(e) => onDragStart && onDragStart(e, source.id, index)}
      onDragOver={(e) => onDragOver && onDragOver(e, source.id, index)}
      onDrop={(e) => onDrop && onDrop(e, source.id, index)}
    >
      <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between">
        <div className="flex items-start gap-2">
          <div className="text-gray-500 mt-1 cursor-grab">
            <GripVertical className="h-5 w-5" />
          </div>
          <div>
            <Badge className={`${getSourceTypeColor()} mb-2`}>{getSourceTypeLabel()}</Badge>
            <CardTitle className="text-base text-gray-200">
              {source.title}
            </CardTitle>
          </div>
        </div>
        <div className="flex space-x-1">
          {!isEditing && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing(true)}
                className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-700"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(source.id)}
                className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-gray-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {renderContent()}

        {source.isProcessing && (
          <div className="mt-4 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="ml-2 text-sm text-gray-400">Processing...</span>
          </div>
        )}

        {source.error && (
          <div className="mt-2 p-2 bg-red-900/30 border border-red-800 rounded-md">
            <p className="text-xs text-red-400">{source.error}</p>
          </div>
        )}
      </CardContent>
      {/* Footer content removed as per user request */}
    </Card>
  );
};

export default SourcePanel;