import { FC } from 'react';
import { Trash2, Link as LinkIcon, Link2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Source, Connection, SourceType } from '@/types/multimodal';

interface ConnectionCardNextProps {
  connection: Connection;
  sources: Source[];
  onDelete: (id: string) => void;
}

const ConnectionCardNext: FC<ConnectionCardNextProps> = ({
  connection,
  sources,
  onDelete
}) => {
  const sourceItem = sources.find(s => s.id === connection.sourceId);
  const targetItem = sources.find(s => s.id === connection.targetId);
  
  if (!sourceItem || !targetItem) return null;
  
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
    <div className="border border-[#1b1e29]/50 bg-[#0e182f]/60 rounded-lg p-3 shadow-sm hover:border-[#1b1e29] transition-colors duration-200">
      <div className="mb-2 flex justify-between items-start">
        <h4 className="text-sm font-medium text-purple-300 flex items-center">
          <Link2 className="h-3.5 w-3.5 mr-1.5" />
          {connection.label || 'Connection'}
        </h4>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(connection.id)}
          className="h-6 w-6 text-gray-400 hover:text-red-400 hover:bg-gray-700/50 -mt-1 -mr-1"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      
      <div className="flex flex-col space-y-2">
        <div className="flex items-center">
          <div className={`${getSourceTypeColor(sourceItem.type)} h-2 w-2 rounded-full mr-1.5`}></div>
          <div className="text-xs text-gray-300 truncate flex-1">
            {sourceItem.title}
          </div>
        </div>
        
        <div className="flex justify-center">
          <div className="w-0.5 h-3 bg-purple-700/50"></div>
        </div>
        
        <div className="flex items-center">
          <div className={`${getSourceTypeColor(targetItem.type)} h-2 w-2 rounded-full mr-1.5`}></div>
          <div className="text-xs text-gray-300 truncate flex-1">
            {targetItem.title}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionCardNext;