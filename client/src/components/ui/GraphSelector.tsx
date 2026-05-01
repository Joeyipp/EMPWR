import React from 'react';
import { 
  Select, 
  SelectContent, 
  SelectGroup, 
  SelectItem, 
  SelectLabel, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

interface Graph {
  id: number;
  name: string;
  entityCount: number;
  relationCount: number;
  createdAt?: string;
}

interface GraphSelectorProps {
  graphs: Graph[];
  selectedGraphId: number | null;
  onSelectGraph: (graphId: number) => void;
  className?: string;
}

export function GraphSelector({ graphs, selectedGraphId, onSelectGraph, className }: GraphSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  
  const selectedGraph = graphs.find(graph => graph.id === selectedGraphId);
  
  const filteredGraphs = React.useMemo(() => {
    if (!searchValue) return graphs;
    
    return graphs.filter(graph => 
      graph.name.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [graphs, searchValue]);
  
  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };
  
  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-gray-800 border-gray-700 font-normal group"
          >
            {selectedGraph ? (
              <div className="flex items-center space-x-2 text-left max-w-full">
                <span className="font-medium truncate max-w-[200px]" title={selectedGraph.name}>
                  {selectedGraph.name}
                </span>
                <div className="flex items-center space-x-1 flex-shrink-0">
                  <Badge
                    variant="secondary"
                    className="text-xs bg-indigo-600/30 text-indigo-200 hover:bg-indigo-600/30"
                  >
                    {selectedGraph.entityCount} entities
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="text-xs bg-indigo-600/30 text-indigo-200 hover:bg-indigo-600/30"
                  >
                    {selectedGraph.relationCount} relations
                  </Badge>
                </div>
              </div>
            ) : (
              "Select a graph..."
            )}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50 group-hover:text-primary transition-colors" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 max-h-[500px]" style={{ width: 'var(--radix-popover-trigger-width)' }}>
          <Command className="bg-gray-900 border-gray-800">
            <div className="flex items-center border-b border-gray-800 px-3">
              <CommandInput 
                placeholder="Search graphs..." 
                className="flex-1 bg-transparent border-0 outline-none focus:ring-0 placeholder:text-gray-500 h-9"
                onValueChange={setSearchValue}
              />
            </div>
            <CommandList className="max-h-[380px] overflow-auto scrollbar-hide hover:scrollbar-default">
              <CommandEmpty>No graphs found.</CommandEmpty>
              <CommandGroup>
                {filteredGraphs.map((graph) => (
                  <CommandItem
                    key={graph.id}
                    onSelect={() => {
                      onSelectGraph(graph.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex items-start py-3 px-3 cursor-pointer",
                      selectedGraphId === graph.id ? "bg-primary/10" : "hover:bg-gray-800/70"
                    )}
                  >
                    <div className="flex-1">
                      <div className="flex items-center w-full">
                        <div className="font-medium mr-1 truncate max-w-[300px]" title={graph.name}>{graph.name}</div>
                        {selectedGraphId === graph.id && (
                          <Check className="ml-auto h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex flex-wrap items-center mt-1 gap-1">
                        <span className="text-xs text-gray-400">
                          #{graph.id} • {formatDate(graph.createdAt)}
                        </span>
                        <div className="flex items-center space-x-1">
                          <Badge
                            variant="secondary"
                            className="text-xs bg-gray-800/80 text-gray-300"
                          >
                            {graph.entityCount} entities
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="text-xs bg-gray-800/80 text-gray-300"
                          >
                            {graph.relationCount} relations
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default GraphSelector;