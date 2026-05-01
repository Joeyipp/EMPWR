import { FC } from 'react';
import { AlertCircle, InfoIcon, CheckCircle, Clock, ArrowUpRight, Brain, Sparkles, Terminal } from 'lucide-react';
import { Message } from '@/types/multimodal';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface ProcessingLogNextProps {
  messages: Message[];
  isProcessing: boolean;
  streamingContent?: string;
  logsRef: React.RefObject<HTMLDivElement>;
}

const ProcessingLogNext: FC<ProcessingLogNextProps> = ({
  messages,
  isProcessing,
  streamingContent = "",
  logsRef
}) => {
  // Format timestamp
  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  
  // Check if there are error messages
  const hasError = messages.some(msg => 
    msg.content.toLowerCase().includes('error') || 
    msg.role === 'system' && msg.content.toLowerCase().includes('error')
  );
  
  // Calculate progress for the progress bar
  const calculateProgress = () => {
    if (!isProcessing) {
      return messages.length > 0 ? 100 : 0;
    }
    
    if (!streamingContent) return 20;
    const minProgress = 25;
    const maxProgress = 90;
    const contentLength = streamingContent.length;
    return Math.min(maxProgress, minProgress + (contentLength / 50));
  };
  
  // Get message icon based on content and role
  const getMessageIcon = (message: Message) => {
    if (message.content.toLowerCase().includes('error')) {
      return <AlertCircle className="h-3.5 w-3.5" />;
    }
    
    switch (message.role) {
      case 'system':
        return <Terminal className="h-3.5 w-3.5" />;
      case 'user':
        return <Brain className="h-3.5 w-3.5" />;
      default:
        return <Sparkles className="h-3.5 w-3.5" />;
    }
  };
  
  // Get badge text based on message content and role
  const getMessageBadgeText = (message: Message) => {
    if (message.content.toLowerCase().includes('error')) {
      return 'ERROR';
    }
    
    switch (message.role) {
      case 'system':
        return 'SYSTEM';
      case 'user':
        return 'REQUEST';
      default:
        return 'RESULT';
    }
  };
  
  // Get theme color based on message type
  const getMessageTheme = (message: Message) => {
    if (message.content.toLowerCase().includes('error')) {
      return {
        border: 'border-rose-900/40',
        bg: 'bg-rose-950/30',
        text: 'text-rose-300',
        icon: 'bg-rose-900/50 text-rose-400',
        badge: 'bg-rose-900/50 text-rose-300 border-rose-800/40',
        dot: 'bg-rose-500'
      };
    }
    
    switch (message.role) {
      case 'system':
        return {
          border: 'border-sky-900/40',
          bg: 'bg-sky-950/30',
          text: 'text-sky-300',
          icon: 'bg-sky-900/50 text-sky-400',
          badge: 'bg-sky-900/50 text-sky-300 border-sky-800/40',
          dot: 'bg-sky-500'
        };
      case 'user':
        return {
          border: 'border-violet-900/40',
          bg: 'bg-violet-950/30',
          text: 'text-violet-300',
          icon: 'bg-violet-900/50 text-violet-400',
          badge: 'bg-violet-900/50 text-violet-300 border-violet-800/40',
          dot: 'bg-violet-500'
        };
      default:
        return {
          border: 'border-emerald-900/40',
          bg: 'bg-emerald-950/30',
          text: 'text-emerald-300',
          icon: 'bg-emerald-900/50 text-emerald-400',
          badge: 'bg-emerald-900/50 text-emerald-300 border-emerald-800/40',
          dot: 'bg-emerald-500'
        };
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Processing Status Card */}
      {messages.length > 0 && (
        <div className={`rounded-xl border p-4 shadow-md bg-gradient-to-br mb-4 ${
          hasError ? 'from-rose-950/40 to-gray-950 border-rose-900/60' : 
          isProcessing ? 'from-amber-950/40 to-gray-950 border-amber-900/60' : 
          'from-emerald-950/40 to-gray-950 border-emerald-900/60'
        }`}>
          <div className="flex items-center">
            <div className={`rounded-xl p-2 mr-3 ${
              hasError ? 'bg-rose-900/30 text-rose-400' : 
              isProcessing ? 'bg-amber-900/30 text-amber-400' : 
              'bg-emerald-900/30 text-emerald-400'
            }`}>
              {hasError ? <AlertCircle className="h-5 w-5" /> : 
               isProcessing ? <Clock className="h-5 w-5" /> : 
               <CheckCircle className="h-5 w-5" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h4 className={`text-sm font-medium ${
                  hasError ? 'text-rose-400' : 
                  isProcessing ? 'text-amber-400' : 
                  'text-emerald-400'
                }`}>
                  {hasError ? 'Processing Error' : 
                   isProcessing ? 'Processing in Progress' : 
                   'Processing Complete'}
                </h4>
                <div className="text-xs text-gray-400">
                  {Math.round(calculateProgress())}%
                </div>
              </div>
              
              <Progress 
                value={calculateProgress()} 
                className={`h-1.5 rounded-full ${
                  hasError ? 'bg-rose-950/50' : 
                  isProcessing ? 'bg-amber-950/50' : 
                  'bg-emerald-950/50'
                } [&>div]:${
                  hasError ? 'bg-rose-600' : 
                  isProcessing ? 'bg-amber-600' : 
                  'bg-emerald-600'
                }`}
              />
              
              <p className="text-xs mt-2 text-gray-400">
                {hasError ? 'There was an error processing your sources. Check the logs below.' : 
                 isProcessing ? 'Your sources are being analyzed and transformed into a knowledge graph. Please wait...' : 
                 'All sources have been successfully processed into a knowledge graph.'}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Processing Logs - Simplified direct scrolling approach */}
      <div 
        className="flex-1 border border-gray-800/60 rounded-xl bg-[#050915]/70 overflow-y-auto"
        style={{
          minHeight: "300px",
          maxHeight: messages.length > 0 ? "calc(100vh - 240px)" : "calc(100vh - 160px)"
        }}
      >
        <div className="p-3 space-y-2.5">
          {messages.map((message, index) => {
            const theme = getMessageTheme(message);
            
            return (
              <div 
                key={index} 
                style={{animationDelay: `${index * 0.05}s`}}
                className={`p-3 rounded-lg border ${theme.border} ${theme.bg} ${theme.text} text-xs shadow-md animate-fadeIn transition-all duration-150 hover:shadow-lg hover:translate-y-[-1px]`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-mono text-gray-500 flex items-center text-[11px]">
                    <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${theme.dot}`}></div>
                    {formatTimestamp(message.timestamp)}
                  </span>
                  <Badge variant="outline" className={`${theme.badge} text-[10px] px-2 py-0.5 rounded-full h-5 font-medium flex items-center gap-1 uppercase`}>
                    {getMessageIcon(message)}
                    {getMessageBadgeText(message)}
                  </Badge>
                </div>
                <div className="font-mono whitespace-pre-wrap text-[11px] leading-relaxed opacity-90 max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-900/30">
                  {message.content}
                </div>
              </div>
            );
          })}
          
          {/* Current Processing Status */}
          {isProcessing && streamingContent && (
            <div className="p-3 rounded-lg border border-blue-900/40 bg-blue-950/20 text-blue-300 text-xs shadow-md animate-fadeIn relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-blue-600/5 to-blue-600/0 bg-[length:200%_100%] animate-shimmer"></div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-mono text-gray-500 flex items-center text-[11px]">
                  <div className="w-1.5 h-1.5 rounded-full mr-1.5 bg-blue-500 animate-pulse"></div>
                  {formatTimestamp(new Date())}
                </span>
                <Badge variant="outline" className="bg-blue-900/50 text-blue-300 border-blue-800/40 text-[10px] px-2 py-0.5 rounded-full h-5 font-medium flex items-center gap-1 uppercase animate-pulse">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  LIVE
                </Badge>
              </div>
              <div className="font-mono whitespace-pre-wrap text-[11px] leading-relaxed opacity-90 max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-900/30">
                {streamingContent}
              </div>
            </div>
          )}
          
          <div ref={logsRef} />
        </div>
      </div>
    </div>
  );
};

export default ProcessingLogNext;