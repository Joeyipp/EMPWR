import { FC, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Source, SourceType } from '@/types/multimodal';
import { YoutubeIcon, Globe, FileText, Image, FileType } from 'lucide-react';

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSource: (source: Omit<Source, 'id'>) => void;
}

const AddSourceModal: FC<AddSourceModalProps> = ({ isOpen, onClose, onAddSource }) => {
  const [selectedTab, setSelectedTab] = useState<SourceType>('text');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  
  const handleSubmit = () => {
    // Title is always required
    if (!title) return;
    
    // Content is required for most source types but not for uploaded files
    // where content might be empty and handled separately
    if (!content && selectedTab !== 'pdf' && selectedTab !== 'image') return;
    
    const newSource: Omit<Source, 'id'> = {
      type: selectedTab,
      title,
      content,
      isProcessed: false,
      isProcessing: false
    };
    
    onAddSource(newSource);
    resetForm();
    onClose();
  };
  
  const resetForm = () => {
    setTitle('');
    setContent('');
    setSelectedTab('text');
  };
  
  const handleTabChange = (value: string) => {
    setSelectedTab(value as SourceType);
    setContent('');
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
        resetForm();
      }
    }}>
      <DialogContent className="sm:max-w-[525px] bg-gray-900 border-gray-800 text-gray-200">
        <DialogHeader>
          <DialogTitle>Add New Source</DialogTitle>
        </DialogHeader>
        
        <Tabs value={selectedTab} onValueChange={handleTabChange} className="mt-4">
          <TabsList className="grid grid-cols-5 mb-4">
            <TabsTrigger value="text" className="flex items-center space-x-1">
              <FileText className="h-4 w-4" />
              <span>Text</span>
            </TabsTrigger>
            <TabsTrigger value="website" className="flex items-center space-x-1">
              <Globe className="h-4 w-4" />
              <span>Web</span>
            </TabsTrigger>
            <TabsTrigger value="youtube" className="flex items-center space-x-1">
              <YoutubeIcon className="h-4 w-4" />
              <span>YouTube</span>
            </TabsTrigger>
            <TabsTrigger value="image" className="flex items-center space-x-1">
              <Image className="h-4 w-4" />
              <span>Image</span>
            </TabsTrigger>
            <TabsTrigger value="pdf" className="flex items-center space-x-1">
              <FileType className="h-4 w-4" />
              <span>PDF</span>
            </TabsTrigger>
          </TabsList>
          
          {/* Common title field for all tabs */}
          <div className="mb-4">
            <Label htmlFor="source-title">Title</Label>
            <Input
              id="source-title"
              placeholder="Enter a title for this source"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
            />
          </div>
          
          <TabsContent value="text" className="space-y-4">
            <div>
              <Label htmlFor="text-content">Text Content</Label>
              <Textarea
                id="text-content"
                placeholder="Enter or paste text content..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="mt-1 min-h-[200px]"
              />
            </div>
          </TabsContent>
          
          <TabsContent value="website" className="space-y-4">
            <div>
              <Label htmlFor="website-url">Website URL</Label>
              <Input
                id="website-url"
                placeholder="https://example.com"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-gray-400 mt-1">
                Enter the full URL including https://
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="youtube" className="space-y-4">
            <div>
              <Label htmlFor="youtube-url">YouTube URL</Label>
              <Input
                id="youtube-url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-gray-400 mt-1">
                Enter the full YouTube video URL
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="image" className="space-y-4">
            <div>
              <Label htmlFor="image-url">Image URL</Label>
              <Input
                id="image-url"
                placeholder="https://example.com/image.jpg"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-gray-400 mt-1">
                Enter the URL of an image to analyze
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="pdf" className="space-y-4">
            <div>
              <Label htmlFor="pdf-url">PDF URL</Label>
              <Input
                id="pdf-url"
                placeholder="https://example.com/document.pdf"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-gray-400 mt-1">
                Enter the URL of a PDF document to analyze
              </p>
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!title || (!content && selectedTab !== 'pdf' && selectedTab !== 'image')}
          >
            Add Source
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddSourceModal;