import { FC, useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { KnowledgeGraph, Node } from '@shared/schema';
import { Badge } from '@/components/ui/badge';
import { CircleCheck, CircleAlert, Upload, FileText, FileIcon, CheckCircle, Database, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';

type InputType = 'text' | 'document';

interface TextInputPanelProps {
  text: string;
  knowledgeGraph: KnowledgeGraph | null;
  onTextChange: (text: string) => void;
  onClearText: () => void;
  onGenerateGraph: () => void;
  onEntityClick?: (nodeId: number) => void;
  inputType?: InputType;
  setInputType?: (type: InputType) => void;
  selectedFile?: File | null;
  setSelectedFile?: (file: File | null) => void;
  onFileUpload?: () => Promise<void>;
  isHybridMode?: boolean;
  highlightedEntityName?: string;
}

const TextInputPanel: FC<TextInputPanelProps> = ({
  text,
  knowledgeGraph,
  onTextChange,
  onClearText,
  onGenerateGraph,
  onEntityClick = () => {},
  inputType = 'text',
  setInputType = () => {},
  selectedFile = null,
  setSelectedFile = () => {},
  onFileUpload = async () => {},
  isHybridMode = false,
  highlightedEntityName = ''
}) => {
  const textDisplayRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [entityCounts, setEntityCounts] = useState<Record<string, number>>({});
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  // Generate entity-colored text when knowledge graph changes
  useEffect(() => {
    if (!knowledgeGraph || !textDisplayRef.current || !text) return;
    
    // Count entities by type
    const counts: Record<string, number> = {};
    knowledgeGraph.nodes.forEach(node => {
      const typeName = getEntityTypeName(node.group);
      counts[typeName] = (counts[typeName] || 0) + 1;
    });
    setEntityCounts(counts);
    
    highlightEntitiesInText();
  }, [knowledgeGraph, text]);

  // Get color for entity type based on group
  const getEntityColor = (group: number): string => {
    switch (group) {
      case 1: return "#3B82F6"; // Person - blue
      case 2: return "#F59E0B"; // Place - amber
      case 3: return "#10B981"; // Concept - green
      case 4: return "#8B5CF6"; // Organization - purple
      case 5: return "#EC4899"; // Date - pink
      default: return "#6B7280"; // Other - gray
    }
  };

  // Get entity type name based on group
  const getEntityTypeName = (group: number): string => {
    switch (group) {
      case 1: return "Person";
      case 2: return "Place"; 
      case 3: return "Concept";
      case 4: return "Organization";
      case 5: return "Date";
      default: return "Other";
    }
  };
  
  // Helper function to find a good breaking point in text
  const findBreakPoint = (text: string, maxLength: number): number => {
    // If text is shorter than maxLength, return the end
    if (text.length <= maxLength) return text.length;
    
    // Try to find a paragraph break near the maxLength
    const paragraphBreak = text.lastIndexOf('\n\n', maxLength);
    if (paragraphBreak !== -1 && paragraphBreak > maxLength * 0.5) {
      return paragraphBreak;
    }
    
    // Try to find a line break
    const lineBreak = text.lastIndexOf('\n', maxLength);
    if (lineBreak !== -1 && lineBreak > maxLength * 0.7) {
      return lineBreak;
    }
    
    // Try to find a sentence end
    const sentenceEnd = text.lastIndexOf('. ', maxLength);
    if (sentenceEnd !== -1 && sentenceEnd > maxLength * 0.8) {
      return sentenceEnd + 1; // Include the period
    }
    
    // If we can't find a good breaking point, just use maxLength
    return maxLength;
  };

  // Common file processing logic (file validation, size check, etc.)
  const processFile = (file: File, fileType: 'document' | 'image'): boolean => {
    try {
      // Set the selected file for reference
      if (setSelectedFile) {
        setSelectedFile(file);
      }
      
      // Check file size (15MB limit for Generate page)
      if (file.size > 15 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: `Please upload a file smaller than 15MB. Current file size: ${(file.size / 1024 / 1024).toFixed(1)}MB`,
          variant: "destructive"
        });
        setIsUploading(false);
        return false;
      }
      
      // Get file extension
      const fileExtension = file.name.toLowerCase().split('.').pop() || '';
      
      // Process based on file type
      if (fileType === 'document') {
        const isTxtFile = fileExtension === 'txt';
        const isPdfFile = fileExtension === 'pdf';
        const isDocFile = /^(doc|docx)$/i.test(fileExtension);
        const isValidDocType = file.type.match('text/plain|application/pdf|application/msword|application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        
        if (!isTxtFile && !isPdfFile && !isDocFile && !isValidDocType) {
          toast({
            title: "Unsupported document format",
            description: "Please upload a .txt, .pdf, .doc, or .docx file.",
            variant: "destructive"
          });
          return false;
        }
        
        // Process .txt files directly in the browser
        if (isTxtFile || file.type === 'text/plain') {
          const reader = new FileReader();
          reader.onload = (e) => {
            const content = e.target?.result as string;
            onTextChange(content);
            setInputType('text');
            toast({
              title: "Text file uploaded",
              description: `Uploaded ${file.name} successfully. Will use selected language model for processing.`
            });
            setIsUploading(false);
          };
          reader.onerror = () => {
            toast({
              title: "Upload failed",
              description: "Failed to read the text file.",
              variant: "destructive"
            });
            setIsUploading(false);
          };
          reader.readAsText(file);
          return true;
        }
        // For PDF files
        else if (isPdfFile) {
          setInputType('document');
          toast({
            title: "PDF Document Selected",
            description: `${file.name} will be processed when you click "Process Document".`,
          });
          setIsUploading(false);
          return true;
        }
        // For other document types
        else {
          setInputType('document');
          toast({
            title: "Document Selected",
            description: `${file.name} will be processed when you click "Process Document".`,
          });
          setIsUploading(false);
          return true;
        }
      } 
      else if (fileType === 'image') {
        // Validate image type
        const isImageFile = /^(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileExtension);
        const isValidImageType = file.type.match('image/jpeg|image/png|image/gif|image/bmp|image/webp');
        
        if (!isImageFile && !isValidImageType) {
          toast({
            title: "Unsupported Image Format",
            description: "Please upload a valid image file (.jpg, .jpeg, .png, .gif, .bmp, .webp).",
            variant: "destructive"
          });
          return false;
        }
        
        setInputType('document');
        toast({
          title: "Image Selected for OCR",
          description: `${file.name} will be processed for text extraction when you click "Process Document".`,
        });
        setIsUploading(false);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error processing file:', error);
      toast({
        title: "Processing Failed",
        description: "Failed to process the file. Please try again.",
        variant: "destructive"
      });
      setIsUploading(false);
      return false;
    }
  };
  
  // Handle document file upload (PDF, DOC, DOCX, TXT)
  const handleDocumentUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || isUploading) return;
    
    const file = files[0];
    
    // Check file size before setting uploading state
    if (file.size > 15 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: `Please upload a file smaller than 15MB. Current file size: ${(file.size / 1024 / 1024).toFixed(1)}MB`,
        variant: "destructive"
      });
      // Reset file input
      if (documentInputRef.current) {
        documentInputRef.current.value = '';
      }
      return;
    }
    
    setIsUploading(true);
    processFile(file, 'document');
    
    // Reset file input
    if (documentInputRef.current) {
      documentInputRef.current.value = '';
    }
  };
  
  // Handle image file upload (JPG, PNG, etc.)
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || isUploading) return;
    
    const file = files[0];
    
    // Check file size before setting uploading state
    if (file.size > 15 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: `Please upload a file smaller than 15MB. Current file size: ${(file.size / 1024 / 1024).toFixed(1)}MB`,
        variant: "destructive"
      });
      // Reset file input
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
      return;
    }
    
    setIsUploading(true);
    processFile(file, 'image');
    
    // Reset file input
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };
  
  // Trigger document input click
  const triggerDocumentUpload = () => {
    if (documentInputRef.current) {
      documentInputRef.current.click();
    }
  };
  
  // Trigger image input click
  const triggerImageUpload = () => {
    if (imageInputRef.current) {
      imageInputRef.current.click();
    }
  };

  // Render text with highlighting for clicked entity
  const renderTextWithHighlight = () => {
    if (!highlightedEntityName || !text) {
      return text;
    }

    // Create a more flexible regex to find the entity name (handles partial matches)
    const entityRegex = new RegExp(`(${highlightedEntityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    
    // Split text by the entity matches and wrap matches with highlight spans
    const parts = text.split(entityRegex);
    const result: (string | JSX.Element)[] = [];
    
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        // Non-matching part
        result.push(parts[i]);
      } else {
        // Matching part - wrap with highlight
        result.push(
          <span 
            key={i} 
            className="bg-yellow-400/70 text-white px-2 py-1 rounded font-bold border-2 border-yellow-500"
            style={{
              animation: 'highlight-pulse 2s ease-in-out infinite',
              background: 'linear-gradient(45deg, rgba(250, 204, 21, 0.8), rgba(251, 191, 36, 0.9))',
              boxShadow: '0 0 15px rgba(250, 204, 21, 0.9), 0 0 25px rgba(250, 204, 21, 0.6)',
              textShadow: '0 0 3px rgba(0, 0, 0, 0.8)'
            }}
          >
            {parts[i]}
          </span>
        );
      }
    }
    
    return result;
  };

  // Single useEffect for text display without pagination
  useEffect(() => {
    if (knowledgeGraph && textDisplayRef.current && text) {
      highlightEntitiesInText();
    }
  }, [knowledgeGraph, text, highlightedEntityName]);
  
  const highlightEntitiesInText = () => {
    if (!knowledgeGraph || !textDisplayRef.current) return;
    
    // Sort entities by length (longest first) to handle overlapping entities correctly
    const entities = [...knowledgeGraph.nodes].sort((a, b) => {
      return b.name.length - a.name.length;
    });
    
    // Process the entire text without pagination
    const textToDisplay = text;
    
    // First, create a "safe" version of the text for display
    // by converting it to HTML-safe format
    let displayText = textToDisplay
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    
    // Clean text for better entity matching - similar to what server might do
    const cleanTextForMatching = (input: string): string => {
      return input
        // Fix common OCR issues by normalizing spaces and removing non-standard whitespace
        .replace(/\s+/g, ' ')
        // Normalize dashes and hyphens
        .replace(/[\u2010-\u2015\u2212]/g, '-')
        // Fix hyphenated words that span lines in OCR text
        .replace(/(\w+)-\s+(\w+)/g, '$1$2')
        // Remove isolated single characters that might be OCR artifacts
        .replace(/\s+(\w)\s+/g, ' ')
        // Fix common OCR issues with punctuation
        .replace(/([.,;:!?])\s+/g, '$1 ')
        // Fix spacing around brackets and parentheses
        .replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
        .replace(/\[\s+/g, '[').replace(/\s+\]/g, ']')
        .trim();
    };
    
    // Clean the text for better entity matching (use same algorithm as server)
    const cleanedText = cleanTextForMatching(text);
    
    // Now we need to identify the positions of entities in the text for the current page
    // First, find all entities in the full text
    const allEntityPositions: {
      entity: Node,
      startPos: number,
      endPos: number
    }[] = [];
    
    // Find all occurrences of each entity in the text - more robust for OCR-processed text
    entities.forEach(entity => {
      // For each entity, find all its occurrences in the text
      const entityName = entity.name;
      
      // Skip empty entity names or single characters (common false positives in OCR)
      if (!entityName || entityName.length < 2) return;
      
      // Define interface for entity match result
      interface EntityMatch {
        entity: Node;
        startPos: number;
        endPos: number;
        confidence: number;
      }
      
      // Helper function for fuzzy matching - Levenshtein distance
      const levenshteinDistance = (a: string, b: string): number => {
        // Create a matrix of size (a.length+1) x (b.length+1)
        const matrix: number[][] = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));

        // Fill the first row and column
        for (let i = 0; i <= a.length; i++) {
          matrix[i][0] = i;
        }
        for (let j = 0; j <= b.length; j++) {
          matrix[0][j] = j;
        }

        // Calculate distances
        for (let i = 1; i <= a.length; i++) {
          for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
              matrix[i - 1][j] + 1, // deletion
              matrix[i][j - 1] + 1, // insertion
              matrix[i - 1][j - 1] + cost // substitution
            );
          }
        }

        // Return the distance
        return matrix[a.length][b.length];
      };
      
      // Use a progressive search strategy for best results with OCR text
      const searchStrategies = [
        // Strategy 1: Exact match with word boundaries (most precise)
        (): EntityMatch[] => {
          try {
            const escapedEntityName = entityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const entityRegex = new RegExp(`(^|[\\s.,;:!?()\\[\\]{}'"<>\\/\\\\-])${escapedEntityName}([\\s.,;:!?()\\[\\]{}'"<>\\/\\\\-]|$)`, 'gi');
            
            let match;
            let matches: EntityMatch[] = [];
            // Use the cleaned text for regex search, which should match what the NLP model processed
            const textToSearch = String(cleanedText);
            
            while ((match = entityRegex.exec(textToSearch)) !== null) {
              const startPos = match.index + match[1].length;
              const endPos = startPos + entityName.length;
              
              matches.push({
                entity,
                startPos,
                endPos,
                confidence: 1.0 // Highest confidence for exact matches
              });
            }
            
            return matches;
          } catch (e) {
            console.warn(`Regex search failed for entity "${entityName}":`, e);
            return [];
          }
        },
        
        // Strategy 2: Case-insensitive search (medium precision)
        (): EntityMatch[] => {
          try {
            let matches: EntityMatch[] = [];
            let lowerText = cleanedText.toLowerCase();
            let lowerEntityName = entityName.toLowerCase();
            let startIndex = 0;
            let pos = -1;
            
            while ((pos = lowerText.indexOf(lowerEntityName, startIndex)) !== -1) {
              // Check word boundaries
              const prevChar = pos > 0 ? cleanedText[pos - 1] : ' ';
              const nextChar = pos + entityName.length < cleanedText.length ? 
                              cleanedText[pos + entityName.length] : ' ';
              
              const isPrevBoundary = /[\s.,;:!?()\[\]{}'"<>\/\\-]/.test(prevChar);
              const isNextBoundary = /[\s.,;:!?()\[\]{}'"<>\/\\-]/.test(nextChar);
              
              if (isPrevBoundary && isNextBoundary) {
                matches.push({
                  entity,
                  startPos: pos,
                  endPos: pos + entityName.length,
                  confidence: 0.9 // High confidence for case-insensitive with boundaries
                });
              }
              
              startIndex = pos + 1;
            }
            
            return matches;
          } catch (e) {
            console.warn(`Case-insensitive search failed for entity "${entityName}":`, e);
            return [];
          }
        },
        
        // Strategy 3: Improved fuzzy search for OCR errors
        (): EntityMatch[] => {
          // Only use fuzzy matching for longer entity names (4+ chars) to avoid false positives
          if (entityName.length < 4) return [];
          
          try {
            let matches: EntityMatch[] = [];
            // Break the text into words
            const words = cleanedText.split(/\s+/);
            
            // For each word, check if it's similar to our entity name
            for (let i = 0; i < words.length; i++) {
              const word = words[i].replace(/[.,;:!?()\[\]{}'"<>\/\\-]*/g, ''); // Remove punctuation
              
              // Skip very short words
              if (word.length < 3) continue;
              
              // Improved similarity check for OCR text
              // For multi-word entities, try to match against consecutive words
              let matchFound = false;
              
              // If the entity has multiple words, check against consecutive word groups
              if (entityName.includes(' ') && i < words.length - 1) {
                const entityWords = entityName.split(/\s+/);
                let sequenceMatch = true;
                
                // Try to match a sequence of words
                for (let w = 0; w < entityWords.length && i + w < words.length; w++) {
                  const entityWord = entityWords[w].toLowerCase();
                  const textWord = words[i + w].toLowerCase().replace(/[.,;:!?()\[\]{}'"<>\/\\-]*/g, '');
                  
                  // Allow for some character variation (80% similarity)
                  const similarity = 1 - (levenshteinDistance(entityWord, textWord) / Math.max(entityWord.length, textWord.length));
                  if (similarity < 0.8) {
                    sequenceMatch = false;
                    break;
                  }
                }
                
                if (sequenceMatch) {
                  // Calculate position in original text
                  let pos = 0;
                  for (let j = 0; j < i; j++) {
                    pos += words[j].length + 1; // +1 for the space
                  }
                  
                  // Calculate end position - might span multiple words
                  let posEnd = pos;
                  for (let w = 0; w < entityWords.length && i + w < words.length; w++) {
                    posEnd += words[i + w].length;
                    if (w < entityWords.length - 1) posEnd += 1; // +1 for spaces between words
                  }
                  
                  matches.push({
                    entity,
                    startPos: pos,
                    endPos: posEnd,
                    confidence: 0.85 // High confidence for multi-word match
                  });
                  
                  matchFound = true;
                }
              }
              
              // For single word entities or if multi-word matching failed, do simple character similarity
              if (!matchFound && (word.length >= entityName.length * 0.8 && word.length <= entityName.length * 1.2)) {
                // For single words, use Levenshtein distance
                const similarity = 1 - (levenshteinDistance(word.toLowerCase(), entityName.toLowerCase()) / 
                                      Math.max(word.length, entityName.length));
                
                if (similarity >= 0.8) { // 80% similarity threshold
                  // Calculate position in original text
                  let pos = 0;
                  for (let j = 0; j < i; j++) {
                    pos += words[j].length + 1; // +1 for the space
                  }
                  
                  matches.push({
                    entity,
                    startPos: pos,
                    endPos: pos + word.length,
                    confidence: similarity * 0.8 // Scale confidence by similarity
                  });
                }
              }
            }
            
            return matches;
          } catch (e) {
            console.warn(`Fuzzy search failed for entity "${entityName}":`, e);
            return [];
          }
        }
      ];
      
      // Apply all search strategies and collect results
      let allMatches: EntityMatch[] = [];
      for (const strategy of searchStrategies) {
        const results = strategy() as EntityMatch[];
        allMatches = [...allMatches, ...results];
      }
      
      // Sort by confidence (highest first)
      allMatches.sort((a, b) => b.confidence - a.confidence);
      
      // Filter out overlapping matches, preferring higher confidence ones
      const filteredMatches = allMatches.filter((match, index) => {
        // Check if this match overlaps with any higher confidence match that came before it
        return !allMatches.slice(0, index).some(prevMatch => 
          (match.startPos >= prevMatch.startPos && match.startPos < prevMatch.endPos) || 
          (match.endPos > prevMatch.startPos && match.endPos <= prevMatch.endPos)
        );
      });
      
      // Add filtered matches to positions
      filteredMatches.forEach(match => {
        // Map the positions from cleaned text back to original display text
        // For simplicity, we're assuming the character count is similar enough
        const cleanTextBeforeMatch = cleanedText.substring(0, match.startPos);
        const cleanTextMatch = cleanedText.substring(match.startPos, match.endPos);
        
        // Get character counts to make a rough mapping back to original text
        const wordCount = cleanTextBeforeMatch.split(/\s+/).length;
        
        // Find the approximate position in the original text
        const originalWords = text.split(/\s+/);
        let approxStartPos = 0;
        for (let i = 0; i < Math.min(wordCount, originalWords.length); i++) {
          if (i > 0) approxStartPos += 1; // Add space
          approxStartPos += originalWords[i].length;
        }
        
        // Refine the position by searching for the exact match near the approximate position
        const searchWindow = 100; // Characters to look before and after approximate position
        const searchStart = Math.max(0, approxStartPos - searchWindow);
        const searchEnd = Math.min(text.length, approxStartPos + searchWindow);
        const searchText = text.substring(searchStart, searchEnd);
        
        let exactStartPos = searchText.indexOf(cleanTextMatch);
        if (exactStartPos === -1) {
          // If exact match fails, try a case-insensitive search
          exactStartPos = searchText.toLowerCase().indexOf(cleanTextMatch.toLowerCase());
        }
        
        if (exactStartPos !== -1) {
          // Found a match within the search window
          const finalStartPos = searchStart + exactStartPos;
          const finalEndPos = finalStartPos + cleanTextMatch.length;
          
          allEntityPositions.push({
            entity: match.entity,
            startPos: finalStartPos,
            endPos: finalEndPos
          });
        } else {
          // Fallback to approximate position if no exact match found
          const approxEndPos = approxStartPos + cleanTextMatch.length;
          
          allEntityPositions.push({
            entity: match.entity,
            startPos: approxStartPos,
            endPos: approxEndPos
          });
        }
      });
    });
    
    // Sort all positions by their start position (from beginning to end of text)
    allEntityPositions.sort((a, b) => a.startPos - b.startPos);
    
    // Use all entity positions since we're showing the full text
    const entityPositions = allEntityPositions.map(pos => {
      return {
        entity: pos.entity,
        startPos: pos.startPos,
        endPos: pos.endPos
      };
    });
    
    // Now build the highlighted HTML content
    let htmlContent = '';
    let currentPos = 0;
    
    entityPositions.forEach(position => {
      // Add text before this entity
      if (position.startPos > currentPos) {
        htmlContent += displayText.substring(currentPos, position.startPos);
      }
      
      // Skip this entity if it overlaps with a previously processed one
      if (position.startPos < currentPos) {
        return;
      }
      
      // Add the highlighted entity
      const entity = position.entity;
      const color = getEntityColor(entity.group);
      const entityType = getEntityTypeName(entity.group);
      const entityText = displayText.substring(position.startPos, position.endPos);
      
      // Check if this entity matches the clicked entity for pulsing effect
      const isClickedEntity = highlightedEntityName && 
        (entity.name.toLowerCase() === highlightedEntityName.toLowerCase() ||
         entity.name.toLowerCase().includes(highlightedEntityName.toLowerCase()) ||
         highlightedEntityName.toLowerCase().includes(entity.name.toLowerCase()));
      
      const pulsingStyle = isClickedEntity ? 
        `animation: highlight-pulse 2s ease-in-out infinite; 
         box-shadow: 0 0 15px rgba(250, 204, 21, 0.9), 0 0 25px rgba(250, 204, 21, 0.6);
         background: linear-gradient(45deg, rgba(250, 204, 21, 0.8), rgba(251, 191, 36, 0.9)) !important;
         color: white !important; 
         border: 2px solid rgba(250, 204, 21, 1) !important;
         text-shadow: 0 0 3px rgba(0, 0, 0, 0.8);` : '';
      
      htmlContent += `<span class="entity-highlight cursor-pointer" 
                      data-entity-id="${entity.id}" 
                      data-entity-type="${entityType}" 
                      data-entity-color="${color}" 
                      style="background-color: ${color}15; border: 1px solid ${color}50; color: ${color}; 
                      padding: 1px 4px; border-radius: 3px; font-weight: 500; transition: all 0.2s; ${pulsingStyle}" 
                      title="${entityType}: ${entity.name}">${entityText}</span>`;
      
      // Update our current position
      currentPos = position.endPos;
    });
    
    // Add any remaining text
    if (currentPos < displayText.length) {
      htmlContent += displayText.substring(currentPos);
    }
    
    // Set the HTML content
    textDisplayRef.current.innerHTML = htmlContent;
    
    // Auto-scroll to highlighted entity if it exists and is not visible
    if (highlightedEntityName) {
      setTimeout(() => {
        const highlightedElement = textDisplayRef.current?.querySelector('.entity-highlight[style*="highlight-pulse"]');
        if (highlightedElement) {
          highlightedElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }
      }, 100); // Small delay to ensure DOM is updated
    }
    
    // Add event listeners for entity clicks and hover effects
    const entityElements = textDisplayRef.current.querySelectorAll('.entity-highlight');
    entityElements.forEach(el => {
      // Click event
      el.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const entityId = target.getAttribute('data-entity-id');
        if (entityId) {
          onEntityClick(parseInt(entityId, 10));
          
          // Add a flash effect to the clicked entity
          target.style.transition = 'background-color 0.3s';
          const originalBg = target.style.backgroundColor;
          target.style.backgroundColor = getEntityColor(parseInt(entityId, 10)) + '60';
          setTimeout(() => {
            target.style.backgroundColor = originalBg;
          }, 1000);
        }
      });
      
      // Mouse over event
      el.addEventListener('mouseover', (e) => {
        const target = e.currentTarget as HTMLElement;
        const color = target.getAttribute('data-entity-color');
        if (color) {
          target.style.backgroundColor = `${color}30`;
          target.style.boxShadow = `0 0 0 1px ${color}70`;
        }
      });
      
      // Mouse out event
      el.addEventListener('mouseout', (e) => {
        const target = e.currentTarget as HTMLElement;
        const color = target.getAttribute('data-entity-color');
        if (color) {
          target.style.backgroundColor = `${color}15`;
          target.style.boxShadow = 'none';
        }
      });
    });
  };

  return (
    <div className="w-full">
      <div className="p-4 bg-gray-900 rounded-lg border border-gray-800 h-[700px] flex flex-col">
        {/* Input Type Selector */}
        <div className="mb-4 border-b border-gray-800 pb-4">
          <div className="flex items-center mb-4">
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <Button
                  variant={inputType === 'text' ? 'default' : 'outline'}
                  onClick={() => setInputType('text')}
                  className={`${inputType === 'text' ? 'bg-primary text-white' : 'bg-transparent border-gray-700 text-gray-300'}`}
                  size="sm"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Text Input
                </Button>
                
                <Button
                  variant={inputType === 'document' ? 'default' : 'outline'}
                  onClick={() => setInputType('document')}
                  className={`${inputType === 'document' ? 'bg-primary text-white' : 'bg-transparent border-gray-700 text-gray-300'}`}
                  size="sm"
                >
                  <FileIcon className="mr-2 h-4 w-4" />
                  Document Upload
                </Button>
              </div>
            </div>
          </div>
          
          {/* Entity Count Display - Moved to its own row */}
          {knowledgeGraph && Object.keys(entityCounts).length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {Object.entries(entityCounts).sort().map(([type, count]) => {
                let color = "#6B7280";
                switch (type) {
                  case "Person": color = "#3B82F6"; break;
                  case "Place": color = "#F59E0B"; break;
                  case "Concept": color = "#10B981"; break;
                  case "Organization": color = "#8B5CF6"; break;
                  case "Date": color = "#EC4899"; break;
                  default: color = "#6B7280";
                }
                
                return (
                  <div 
                    key={type}
                    className="flex items-center px-2 py-1 rounded-full text-xs font-medium"
                    style={{ 
                      backgroundColor: `${color}20`, 
                      color: color,
                      border: `1px solid ${color}40`
                    }}
                  >
                    <span>{type}</span>
                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs" style={{ backgroundColor: `${color}30` }}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Upload Area */}
        {inputType === 'document' && !knowledgeGraph && (
          <div className="mb-4">
            {selectedFile ? (
              /* Selected File Card */
              <Card className="bg-gray-800/60 border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Selected File
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 border border-gray-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-8 h-8 text-green-500" />
                      <div>
                        <p className="text-sm text-gray-300 font-medium">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || 'application/octet-stream'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Determine if this is a document or image based on file type or extension
                        const fileType = selectedFile?.type || '';
                        const fileExt = selectedFile?.name.split('.').pop()?.toLowerCase() || '';
                        const isImage = fileType.startsWith('image/') || 
                                      ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileExt);
                        
                        console.log("Change File button clicked", { isImage });
                        
                        // Make sure the file inputs have been created and clear their values
                        if (isImage && imageInputRef.current) {
                          imageInputRef.current.value = '';
                          setTimeout(() => imageInputRef.current?.click(), 0);
                        } else if (documentInputRef.current) {
                          documentInputRef.current.value = '';
                          setTimeout(() => documentInputRef.current?.click(), 0);
                        }
                      }}
                      className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 text-sm"
                      size="sm"
                    >
                      Change File
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* Upload Options Cards */
              <div className="grid grid-cols-2 gap-4">
                {/* Document Upload Card */}
                <Card className="bg-gray-800/60 border-gray-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      <FileIcon className="w-4 h-4 text-primary" />
                      Document Upload
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div 
                      className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center cursor-pointer hover:border-gray-500 transition-colors"
                      onClick={triggerDocumentUpload}
                    >
                      <div className="flex flex-col items-center justify-center">
                        <FileIcon className="w-10 h-10 mb-3 text-gray-500" />
                        <p className="mb-1 text-sm text-gray-400">
                          Click to upload document
                        </p>
                        <p className="text-xs text-gray-500">PDF, DOC, DOCX, TXT (max. 15MB)</p>
                      </div>
                    </div>
                    {/* File input is now centralized at the bottom of the component */}
                  </CardContent>
                </Card>
                
                {/* Image Upload Card */}
                <Card className="bg-gray-800/60 border-gray-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      <Upload className="w-4 h-4 text-amber-500" />
                      Image OCR
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div 
                      className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center cursor-pointer hover:border-gray-500 transition-colors"
                      onClick={triggerImageUpload}
                    >
                      <div className="flex flex-col items-center justify-center">
                        <Upload className="w-10 h-10 mb-3 text-gray-500" />
                        <p className="mb-1 text-sm text-gray-400">
                          Click to upload image
                        </p>
                        <p className="text-xs text-gray-500">JPG, PNG, GIF, BMP (max. 15MB)</p>
                      </div>
                    </div>
                    {/* File input is now centralized at the bottom of the component */}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
        
        {/* Text Display Area - Using flex-grow to fill available space */}
        <div className={`flex-grow overflow-hidden ${!knowledgeGraph && inputType === 'document' ? 'hidden' : 'mb-4'} relative`}>
          {!knowledgeGraph ? (
            // Show textarea when no graph is generated and input type is text
            <Textarea
              ref={textareaRef}
              id="text-input"
              className="w-full h-full resize-none bg-gray-800 border-gray-700 text-gray-200"
              placeholder="Paste your unstructured text here..."
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
            />
          ) : (
            // Show highlighted text when graph is generated
            <div className="relative flex flex-col h-full">
              {/* No pagination controls anymore */}
              
              {/* Text display area - explicitly set height and scrollable */}
              {inputType === 'document' ? (
                // For document uploads, show the extracted text but don't highlight entities
                <div className="flex-grow w-full overflow-y-auto p-4 bg-gray-800 border border-gray-700 rounded-md text-gray-200 leading-relaxed h-full">
                  <div className="mb-4 pb-3 border-b border-gray-700">
                    <div className="flex items-center space-x-2 mb-2">
                      <FileIcon className="w-5 h-5 text-primary" />
                      <h3 className="text-sm font-medium text-gray-300">Extracted Document Text</h3>
                    </div>
                    <p className="text-xs text-gray-400">
                      The text below was extracted from your document using OCR technology. The knowledge graph was generated based on this text.
                    </p>
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{text}</div>
                </div>
              ) : (
                // For text input, show highlighted entities
                <div className="flex-grow w-full overflow-y-auto p-4 bg-gray-800 border border-gray-700 rounded-md text-gray-200 leading-relaxed h-full">
                  <div 
                    ref={textDisplayRef}
                    className="text-sm"
                    style={{ whiteSpace: 'pre-wrap' }}
                  >
                    {text}
                  </div>
                </div>
              )}
              
              {/* Text length info */}
              {text && (
                <div className="absolute bottom-2 right-2 bg-gray-900/90 backdrop-blur px-3 py-1.5 rounded-md text-xs border border-gray-700 shadow-md">
                  <p className="flex items-center gap-1.5">
                    <FileText size={14} className="text-primary" />
                    <span>{Math.round(text.length / 1000)}k characters</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Knowledge Graph Statistics */}
        {knowledgeGraph && (
          <div className="mb-4">
            <div className="grid grid-cols-3 gap-3 mb-2">
              <div className="bg-gray-800/60 p-3 rounded-lg border border-gray-700 flex flex-col items-center justify-center">
                <div className="flex items-center gap-1.5 mb-1">
                  <Database size={16} className="text-primary" />
                  <span className="text-sm font-medium text-gray-300">Entities</span>
                </div>
                <div className="text-xl font-bold text-white">{knowledgeGraph.nodes.length}</div>
              </div>
              
              <div className="bg-gray-800/60 p-3 rounded-lg border border-gray-700 flex flex-col items-center justify-center">
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap size={16} className="text-amber-500" />
                  <span className="text-sm font-medium text-gray-300">Relations</span>
                </div>
                <div className="text-xl font-bold text-white">{knowledgeGraph.links.length}</div>
              </div>
              
              <div className="bg-gray-800/60 p-3 rounded-lg border border-gray-700 flex flex-col items-center justify-center">
                <div className="flex items-center gap-1.5 mb-1">
                  <CircleCheck size={16} className="text-green-500" />
                  <span className="text-sm font-medium text-gray-300">Triples</span>
                </div>
                <div className="text-xl font-bold text-white">{knowledgeGraph.links.length}</div>
              </div>
            </div>
            
            <div className="text-xs text-gray-400 mb-1">
              {inputType === 'document' ? 
                'Document processed and entities extracted' : 
                'Click on any highlighted entity to locate it in the knowledge graph'}
            </div>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex justify-between items-center gap-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClearText}
              className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
            >
              Clear
            </Button>
            
            {/* Hidden input elements (moved here but kept) */}
            <input
              type="file"
              ref={documentInputRef}
              onChange={handleDocumentUpload}
              className="hidden"
              accept=".txt,.pdf,.doc,.docx"
            />
            
            <input
              type="file"
              ref={imageInputRef}
              onChange={handleImageUpload}
              className="hidden"
              accept=".jpg,.jpeg,.png,.gif,.bmp,.webp"
            />
          </div>
          <Button
            onClick={(e) => {
              // If there's a file selected, upload and process it first
              if (inputType === 'document' && selectedFile) {
                e.preventDefault();
                setIsUploading(true);
                onFileUpload().then(() => {
                  setIsUploading(false);
                  // After file is uploaded and text is extracted, generate the graph
                  onGenerateGraph();
                }).catch(error => {
                  setIsUploading(false);
                  console.error('Error uploading file:', error);
                });
              } else {
                // If using text input, go straight to graph generation
                onGenerateGraph();
              }
            }}
            className="bg-primary hover:bg-primary/90"
            disabled={(inputType === 'text' && !text.trim()) || 
                     (inputType === 'document' && !selectedFile) || 
                     isUploading}
          >
            {isUploading ? 'Processing...' : inputType === 'document' ? 'Process Document' : isHybridMode ? 'Generate Hybrid Graph' : 'Generate Knowledge Graph'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TextInputPanel;