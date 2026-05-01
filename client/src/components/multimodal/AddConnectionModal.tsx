import { FC, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Connection, Source } from '@/types/multimodal';
import { ArrowRight } from 'lucide-react';

interface AddConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddConnection: (connection: Omit<Connection, 'id'>) => void;
  sources: Source[];
  initialSourceId?: string;
}

const AddConnectionModal: FC<AddConnectionModalProps> = ({ 
  isOpen, 
  onClose, 
  onAddConnection, 
  sources,
  initialSourceId
}) => {
  const [sourceId, setSourceId] = useState<string>(initialSourceId || '');
  const [targetId, setTargetId] = useState<string>('');
  const [label, setLabel] = useState<string>('');
  
  // Reset the form when the modal opens with an initial source
  useEffect(() => {
    if (isOpen && initialSourceId) {
      setSourceId(initialSourceId);
      setTargetId('');
    }
  }, [isOpen, initialSourceId]);
  
  const handleSubmit = () => {
    if (!sourceId || !targetId) return;
    
    const newConnection: Omit<Connection, 'id'> = {
      sourceId,
      targetId,
      label: label || undefined
    };
    
    onAddConnection(newConnection);
    resetForm();
    onClose();
  };
  
  const resetForm = () => {
    if (!initialSourceId) {
      setSourceId('');
    }
    setTargetId('');
    setLabel('');
  };
  
  // Filter out sources that are not processed yet
  const processedSources = sources.filter(source => source.isProcessed);
  
  // Get available target sources (must be processed and not the source itself)
  const availableTargets = processedSources.filter(source => source.id !== sourceId);
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
        if (!initialSourceId) {
          resetForm();
        }
      }
    }}>
      <DialogContent className="sm:max-w-[425px] bg-gray-900 border-gray-800 text-gray-200">
        <DialogHeader>
          <DialogTitle>Create Connection</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="source">Source</Label>
            <Select
              value={sourceId}
              onValueChange={setSourceId}
              disabled={!!initialSourceId}
            >
              <SelectTrigger id="source" className="w-full">
                <SelectValue placeholder="Select a source" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {processedSources.map(source => (
                    <SelectItem key={source.id} value={source.id}>
                      {source.title}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex justify-center">
            <ArrowRight className="text-gray-500" />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="target">Target</Label>
            <Select
              value={targetId}
              onValueChange={setTargetId}
              disabled={!sourceId || availableTargets.length === 0}
            >
              <SelectTrigger id="target" className="w-full">
                <SelectValue placeholder="Select a target" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {availableTargets.map(source => (
                    <SelectItem key={source.id} value={source.id}>
                      {source.title}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="label">
              Label <span className="text-gray-500 text-sm">(optional)</span>
            </Label>
            <Input
              id="label"
              placeholder="Describe the connection"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!sourceId || !targetId || sourceId === targetId}
          >
            Create Connection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddConnectionModal;