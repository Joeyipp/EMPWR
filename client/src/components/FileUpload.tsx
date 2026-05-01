import { useState, useRef, ReactNode } from 'react';
import { 
  Upload, 
  FileX,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  accept: string;
  maxSize: number; // in MB
  onFileSelected: (file: File | null) => void;
  label?: string;
  description?: string;
  icon?: ReactNode;
}

export const FileUpload = ({
  accept,
  maxSize,
  onFileSelected,
  label = "Upload a file",
  description = "Drag and drop or click to upload",
  icon = <Upload className="h-10 w-10 text-muted-foreground mb-2" />
}: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const validateFile = (file: File): boolean => {
    setError(null);

    // Check file type
    const fileType = file.type;
    const acceptTypes = accept.split(',').map(type => type.trim());
    const isValidType = acceptTypes.some(type => {
      if (type.startsWith('.')) {
        // Extension-based check
        return file.name.toLowerCase().endsWith(type.toLowerCase());
      } else {
        // MIME type check
        return fileType.match(new RegExp(type.replace('*', '.*')));
      }
    });

    if (!isValidType) {
      setError(`Invalid file type. Accepted types: ${accept}`);
      return false;
    }

    // Check file size
    const fileSizeInMB = file.size / (1024 * 1024);
    if (fileSizeInMB > maxSize) {
      setError(`File size exceeds the ${maxSize}MB limit`);
      return false;
    }

    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  };

  const handleFile = (selectedFile: File) => {
    if (validateFile(selectedFile)) {
      setFile(selectedFile);
      onFileSelected(selectedFile);
      
      // Simulate progress for better UX
      setProgress(0);
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 10;
        });
      }, 100);
      
      toast({
        title: "File added",
        description: `${selectedFile.name} has been added successfully`,
      });
    } else {
      onFileSelected(null);
      setFile(null);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setProgress(0);
    setError(null);
    onFileSelected(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full">
      {!file ? (
        <Card
          className={`border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
            isDragging 
              ? 'border-primary bg-primary/10' 
              : error 
                ? 'border-destructive bg-destructive/10' 
                : 'border-muted-foreground/30 hover:border-primary hover:bg-primary/5'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center justify-center space-y-2">
            {icon}
            <h3 className="text-lg font-medium">{label}</h3>
            <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
            
            {error && (
              <div className="flex items-center mt-2 text-destructive">
                <AlertTriangle className="h-4 w-4 mr-1" />
                <span className="text-sm">{error}</span>
              </div>
            )}
          </div>
          <input
            type="file"
            accept={accept}
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
        </Card>
      ) : (
        <Card className="p-4 border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveFile}
              className="h-8 w-8 p-0"
            >
              <FileX className="h-4 w-4" />
              <span className="sr-only">Remove file</span>
            </Button>
          </div>
          
          <Progress value={progress} className="h-1.5 mt-3" />
        </Card>
      )}
    </div>
  );
};