import { FC, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Edit, ArrowRight } from 'lucide-react';
import { ConnectionPanelProps } from '@/types/multimodal';

const ConnectionPanel: FC<ConnectionPanelProps> = ({ 
  connection, 
  sources, 
  onDelete, 
  onEdit 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(connection.label || '');

  const handleSaveEdit = () => {
    onEdit(connection.id, { label });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setLabel(connection.label || '');
    setIsEditing(false);
  };

  // Find the source and target sources by ID
  const sourceSource = sources.find(s => s.id === connection.sourceId);
  const targetSource = sources.find(s => s.id === connection.targetId);

  if (!sourceSource || !targetSource) {
    return null; // Don't render if we can't find the source or target
  }

  return (
    <Card className="border border-gray-800 bg-gray-900 transition-all hover:bg-gray-800">
      <CardHeader className="p-3 pb-2 flex flex-row items-start justify-between">
        <CardTitle className="text-sm text-gray-200">
          Connection
        </CardTitle>
        <div className="flex space-x-1">
          {!isEditing && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing(true)}
                className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-700"
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(connection.id)}
                className="h-7 w-7 text-gray-400 hover:text-red-500 hover:bg-gray-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label htmlFor={`label-${connection.id}`} className="block text-xs font-medium text-gray-300 mb-1">
                Label (optional)
              </label>
              <Input
                id={`label-${connection.id}`}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Describe the connection"
                className="text-sm"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" size="sm" onClick={handleCancelEdit} className="text-xs px-2 py-1 h-7">
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveEdit} className="text-xs px-2 py-1 h-7">
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-sm">
            <div className="flex items-center space-x-2">
              <div className="bg-gray-800 px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">
                {sourceSource.title}
              </div>
              <ArrowRight className="h-3 w-3 text-gray-500 flex-shrink-0" />
              <div className="bg-gray-800 px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">
                {targetSource.title}
              </div>
            </div>
            
            {connection.label && (
              <div className="mt-2 text-xs text-gray-400 italic">
                {connection.label}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ConnectionPanel;