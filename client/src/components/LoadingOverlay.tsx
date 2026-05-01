import { FC, useEffect, useState, useRef } from "react";
import {
  Brain,
  Database,
  Network,
  Sparkles,
  Loader2,
  Clock,
  FileText,
  Camera,
  Image,
  FileCode,
  Scan,
} from "lucide-react";

interface LoadingOverlayProps {
  stage?: string;
  modelName?: string; // Added to display the selected model name
  documentProcessing?: boolean; // Flag to indicate we're processing a document/PDF
  pageCount?: number; // Number of pages in the document being processed
  currentPage?: number; // Current page being processed
  textExtractionOnly?: boolean; // Flag to indicate if we're only extracting text (not generating graph)
  percentComplete?: number; // Percentage of completion for the current process
  documentType?: string; // Type of document being processed (PDF, Image, etc.)
  processingStage?: string; // Current processing stage (initialization, preparation, processing, etc.)
}

const LoadingOverlay: FC<LoadingOverlayProps> = ({
  stage = "",
  modelName,
  documentProcessing = false,
  pageCount = 0,
  currentPage = 0,
  textExtractionOnly = false,
  percentComplete,
  documentType,
  processingStage,
}) => {
  const [progress, setProgress] = useState<number>(0);
  const [currentStage, setCurrentStage] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [estimatedTotalTime, setEstimatedTotalTime] = useState<number>(20); // Start with 20 seconds as default estimate
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Stages of processing - regular text processing stages
  const regularProcessingStages = [
    {
      name: "Starting analysis...",
      icon: <Loader2 className="h-5 w-5 mr-2 text-blue-400" />,
    },
    {
      name: "Extracting entities...",
      icon: <Brain className="h-5 w-5 mr-2 text-purple-400" />,
    },
    {
      name: "Building relationships...",
      icon: <Network className="h-5 w-5 mr-2 text-green-400" />,
    },
    {
      name: "Constructing knowledge graph...",
      icon: <Database className="h-5 w-5 mr-2 text-amber-400" />,
    },
    {
      name: "Finalizing results...",
      icon: <Sparkles className="h-5 w-5 mr-2 text-pink-400" />,
    },
  ];

  // Stages for document/PDF processing
  const documentProcessingStages = [
    {
      name: "Loading document...",
      icon: <FileText className="h-5 w-5 mr-2 text-blue-400" />,
    },
    {
      name: "Converting to images...",
      icon: <Image className="h-5 w-5 mr-2 text-purple-400" />,
    },
    {
      name: "Extracting text with OCR...",
      icon: <Scan className="h-5 w-5 mr-2 text-green-400" />,
    },
    {
      name: "Processing extracted text...",
      icon: <FileCode className="h-5 w-5 mr-2 text-amber-400" />,
    },
  ];

  // Choose the appropriate stages based on whether we're processing a document
  const processingStages = documentProcessing
    ? documentProcessingStages
    : regularProcessingStages;

  // Start the timer when component mounts
  useEffect(() => {
    startTimeRef.current = Date.now();

    // Update elapsed time every second
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedTime(elapsed);

      // Adjust estimated total time based on current progress and elapsed time
      if (elapsed > 5 && progress > 10) {
        const estimatedTotal = Math.ceil((elapsed / progress) * 100);
        setEstimatedTotalTime(estimatedTotal);
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [progress]);

  // Determine the current stage based on the provided stage prop
  useEffect(() => {
    // Match the stage prop to our predefined stages, or default to the appropriate stage
    let stageIndex = 0;
    const stageLower = stage.toLowerCase();

    if (documentProcessing) {
      // Logic for document processing stages (now with only 4 stages)
      if (stageLower.includes("loading") || stageLower.includes("preparing")) {
        stageIndex = 0;
      } else if (stageLower.includes("convert") || stageLower.includes("image")) {
        stageIndex = 1;
      } else if (stageLower.includes("ocr") || (stageLower.includes("extract") && stageLower.includes("text"))) {
        stageIndex = 2;
      } else if (stageLower.includes("process") && stageLower.includes("text")) {
        stageIndex = 3;
      }
      
      // Specific page indicators
      if (stageLower.includes("page")) {
        // If we're mentioning pages, we're likely in the OCR stage
        stageIndex = 2;
      }
      
      // Clamp the stage index to valid range
      stageIndex = Math.min(stageIndex, documentProcessingStages.length - 1);
    } else {
      // Logic for regular text processing stages
      if (stageLower.includes("start") || stageLower.includes("analyz")) {
        stageIndex = 0;
      } else if (stageLower.includes("extract") || stageLower.includes("entity")) {
        stageIndex = 1;
      } else if (stageLower.includes("relation") || stageLower.includes("build")) {
        stageIndex = 2;
      } else if (stageLower.includes("graph") || stageLower.includes("construct")) {
        stageIndex = 3;
      } else if (stageLower.includes("final") || stageLower.includes("complet")) {
        stageIndex = 4;
      }
    }

    setCurrentStage(stageIndex);

    // Calculate progress based on stage
    const newProgress = Math.min(
      100,
      ((stageIndex + 1) / processingStages.length) * 100,
    );
    setProgress(newProgress);

    // Add a subtle animation to the progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        // Add a bit of randomness to the progress within the current stage range
        const stageProgress =
          ((stageIndex + 1) / processingStages.length) * 100;
        const minProgress =
          stageIndex === 0 ? 5 : (stageIndex / processingStages.length) * 100;

        const randomProgress = Math.min(
          stageProgress - 2, // Don't quite reach the next stage
          minProgress + Math.random() * 10, // Add some randomness
        );

        return randomProgress;
      });
    }, 800);

    return () => clearInterval(interval);
  }, [stage]);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 loading-overlay-active">
      <div className="bg-gray-900 p-8 rounded-lg shadow-xl flex flex-col items-center border border-gray-800 max-w-md w-full mx-4">
        {/* Animated logo/spinner */}
        <div className="relative mb-6">
          <div className="animate-spin rounded-full h-20 w-20 border-4 border-gray-700 border-t-primary"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Network className="h-8 w-8 text-primary" />
          </div>
        </div>

        {/* Main title with larger font */}
        <h2 className="text-xl font-semibold text-white mb-2">
          {documentProcessing
            ? "Document Text Extraction"
            : textExtractionOnly
              ? "Extracting Text Content"
              : "Building Your Knowledge Graph"}
        </h2>

        {/* Display model name if provided and we're not in text extraction mode */}
        {modelName && !textExtractionOnly && (
          <div className="bg-primary/10 border border-primary/30 rounded-full px-3 py-1 text-primary text-xs font-medium mb-3">
            Using {modelName}
          </div>
        )}

        <p className="text-gray-400 text-sm mb-6 text-center">
          {documentProcessing
            ? "Processing document to extract text content"
            : textExtractionOnly
              ? "Extracting text content - this will be displayed in the text area when complete"
              : "Analyzing content and extracting meaningful entities and relationships"}
        </p>

        {/* Progress bar */}
        <div className="w-full bg-gray-800 rounded-full h-3 mb-6 overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-500 to-primary h-3 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${typeof percentComplete === 'number' ? percentComplete : progress}%` }}
          ></div>
        </div>

        {/* Stages display */}
        <div className="w-full space-y-2 mb-4">
          {processingStages.map((processStage, index) => (
            <div
              key={index}
              className={`flex items-center ${
                index === currentStage
                  ? "text-white"
                  : index < currentStage
                    ? "text-gray-400"
                    : "text-gray-600"
              }`}
            >
              <div
                className={`w-5 h-5 flex items-center justify-center mr-3 
                ${index === currentStage ? "text-primary" : ""}`}
              >
                {index === currentStage ? (
                  <div className="animate-pulse">{processStage.icon}</div>
                ) : index < currentStage ? (
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                ) : (
                  <div className="w-2 h-2 bg-gray-700 rounded-full"></div>
                )}
              </div>
              <span
                className={`text-sm ${
                  index === currentStage ? "font-medium" : "font-normal"
                }`}
              >
                {processStage.name}
              </span>
            </div>
          ))}
        </div>

        {/* Status area with custom stage message and time estimation */}
        <div className="mt-6 flex flex-col items-center space-y-4">
          {/* Document processing progress - only shown when processing a document */}
          {documentProcessing && pageCount > 0 && (
            <div className="bg-gray-800/80 px-4 py-3 rounded-lg text-gray-300 text-sm w-full mb-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-400">
                  Processing document
                </span>
                <span className="text-xs font-medium text-primary">
                  {currentPage > 0
                    ? `Page ${currentPage} of ${pageCount}`
                    : `${pageCount} pages`}
                </span>
              </div>

              {/* Document page progress bar - Always show, even when currentPage is 0 */}
              <div className="w-full bg-gray-700/50 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.min(100, ((currentPage || 0) / Math.max(1, pageCount)) * 100)}%`,
                  }}
                ></div>
              </div>
            </div>
          )}

          {/* Custom stage message from prop - always show for better visibility */}
          <div className="bg-gray-800/60 px-4 py-2 rounded-lg text-gray-300 text-sm font-medium inline-flex items-center">
            <span className="w-2 h-2 bg-primary rounded-full mr-2 animate-pulse"></span>
            {stage || processingStages[currentStage].name}
          </div>
          
          {/* Document type indicator - if we have one */}
          {documentType && (
            <div className="bg-slate-800/60 px-3 py-1 rounded-lg text-slate-300 text-xs font-medium inline-flex items-center">
              {documentType === 'PDF' ? (
                <FileText className="h-3.5 w-3.5 mr-1.5 text-red-400" />
              ) : documentType === 'Image' ? (
                <Image className="h-3.5 w-3.5 mr-1.5 text-blue-400" />
              ) : (
                <FileCode className="h-3.5 w-3.5 mr-1.5 text-green-400" />
              )}
              {documentType} document
            </div>
          )}
          
          {/* Processing stage indicator - if provided */}
          {processingStage && (
            <div className="bg-primary/20 px-3 py-1 rounded-lg text-primary/90 text-xs font-medium inline-flex items-center">
              <span className="w-1.5 h-1.5 bg-primary rounded-full mr-1.5 animate-pulse"></span>
              Stage: {processingStage}
            </div>
          )}

          {/* Show page-specific OCR message when processing a document */}
          {documentProcessing && currentPage > 0 && pageCount > 0 && currentStage === 2 && (
            <div className="bg-primary/10 px-4 py-2 rounded-lg text-primary text-sm font-medium mt-2 inline-flex items-center">
              <Scan className="h-4 w-4 mr-2" />
              Performing OCR on page {currentPage} of {pageCount}...
            </div>
          )}

          {/* Time estimation */}
          <div className="flex items-center justify-center text-xs text-gray-400">
            <Clock className="h-3.5 w-3.5 mr-1.5" />
            <span>
              {elapsedTime}s elapsed ·
              {progress < 100 ? (
                <span> ~{estimatedTotalTime - elapsedTime}s remaining</span>
              ) : (
                <span> Finishing up...</span>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;
