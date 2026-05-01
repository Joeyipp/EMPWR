import * as fs from 'fs';
import * as path from 'path';
import { fromPath } from 'pdf2pic';
import * as tesseract from 'node-tesseract-ocr';
import { exec } from 'child_process';
import { promisify } from 'util';
import OpenAI from 'openai';
import { createAIService } from './ai-services';
import { KnowledgeGraph } from '@shared/schema';

const execAsync = promisify(exec);

/**
 * Progress update callback function type
 */
export type ProgressCallback = (pageNumber: number, totalPages: number) => void;

/**
 * Service for extracting text from PDF files using OCR
 */
export class PDFOCRService {
  private openai: OpenAI;
  private progressCallback?: ProgressCallback;
  
  /**
   * Creates a new PDF OCR service
   * @param apiKey OpenAI API key
   * @param progressCallback Optional callback function to report progress updates
   */
  constructor(private apiKey: string, progressCallback?: ProgressCallback) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required for PDF OCR processing');
    }
    
    this.openai = new OpenAI({
      apiKey: apiKey
    });
    this.progressCallback = progressCallback;
  }
  
  /**
   * Converts a PDF file to images
   * @param filePath Path to the PDF file
   * @returns Array of paths to the generated images
   */
  async convertPDFToImages(filePath: string): Promise<string[]> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    try {
      // Create temp directory for images if it doesn't exist
      const tempDir = path.join(process.cwd(), 'temp-images');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const baseFilename = path.basename(filePath, '.pdf');
      
      console.log(`Converting PDF to images: ${filePath}`);
      
      // First, try using poppler directly with pdftoppm instead of pdf2pic
      try {
        // Get PDF page count using pdfinfo (from poppler)
        const { stdout } = await execAsync(`pdfinfo "${filePath}"`);
        const pageCountMatch = stdout.match(/Pages:\s*(\d+)/);
        const pageCount = pageCountMatch ? parseInt(pageCountMatch[1], 10) : 1;
        
        console.log(`PDF has ${pageCount} pages, converting to images using pdftoppm...`);
        
        // Convert PDF to image(s) using pdftoppm (part of poppler-utils)
        const imagePaths: string[] = [];
        for (let i = 1; i <= pageCount; i++) {
          // Report progress if callback is provided
          if (this.progressCallback) {
            this.progressCallback(i, pageCount);
          }
          
          try {
            const outputImageBase = path.join(tempDir, `${baseFilename}-page`);
            
            // Use pdftoppm to convert PDF to PNG with specific page
            await execAsync(`pdftoppm -f ${i} -l ${i} -png -r 150 "${filePath}" "${outputImageBase}"`);
            
            // The pdftoppm tool names files like "filename-1.png"
            const possibleFileName = `${baseFilename}-page-${i}.png`;
            const alternativeFileName = `${baseFilename}-page-${String(i).padStart(1, '0')}.png`;
            
            // Check if either file exists
            let actualFilePath = '';
            if (fs.existsSync(path.join(tempDir, possibleFileName))) {
              actualFilePath = path.join(tempDir, possibleFileName);
            } else if (fs.existsSync(path.join(tempDir, alternativeFileName))) {
              actualFilePath = path.join(tempDir, alternativeFileName);
            } else {
              // Look for any file matching the pattern in the temp directory
              const dirFiles = fs.readdirSync(tempDir);
              const matchingFile = dirFiles.find(file => 
                file.startsWith(`${baseFilename}-page`) && 
                file.endsWith('.png')
              );
              
              if (matchingFile) {
                actualFilePath = path.join(tempDir, matchingFile);
              }
            }
            
            if (actualFilePath && fs.existsSync(actualFilePath) && fs.statSync(actualFilePath).size > 0) {
              imagePaths.push(actualFilePath);
              console.log(`Converted page ${i}/${pageCount} to image: ${actualFilePath}`);
            } else {
              console.warn(`No image file found for page ${i}`);
            }
          } catch (pageError) {
            console.error(`Error converting page ${i} with pdftoppm:`, pageError);
          }
        }
        
        // If we got at least one image, return them
        if (imagePaths.length > 0) {
          return imagePaths;
        }
        
        // If direct pdftoppm failed, fall back to pdf2pic with extremely conservative settings
        console.log('Direct pdftoppm conversion failed, trying pdf2pic with conservative settings...');
      } catch (popplerError) {
        console.error('Error using direct pdftoppm conversion:', popplerError);
        console.log('Falling back to pdf2pic...');
      }
      
      // Fall back to pdf2pic with very conservative settings
      const pdf2picOptions = {
        density: 100,          // Very low density
        saveFilename: `${baseFilename}-page`,
        savePath: tempDir,
        format: "png",
        width: 800,            // Smaller width
        height: 1000,          // Smaller height
        quality: 70            // Lower quality
      };
      
      const convert = fromPath(filePath, pdf2picOptions);
      
      // Get PDF page count using pdfinfo (from poppler)
      const { stdout } = await execAsync(`pdfinfo "${filePath}"`);
      const pageCountMatch = stdout.match(/Pages:\s*(\d+)/);
      const pageCount = pageCountMatch ? parseInt(pageCountMatch[1], 10) : 1;
      
      console.log(`PDF has ${pageCount} pages, converting to images with pdf2pic...`);
      
      // Convert each page
      const imagePaths: string[] = [];
      for (let i = 1; i <= pageCount; i++) {
        // Report progress if callback is provided
        if (this.progressCallback) {
          this.progressCallback(i, pageCount);
        }
        
        try {
          const result = await convert(i, { responseType: "buffer" });
          const pageFilePath = path.join(tempDir, `${baseFilename}-page-${i}.png`);
          
          // Make sure the buffer exists before writing to file
          if (result && result.buffer && result.buffer.length > 0) {
            fs.writeFileSync(pageFilePath, result.buffer);
            
            // Verify the image was written correctly
            if (fs.existsSync(pageFilePath) && fs.statSync(pageFilePath).size > 0) {
              imagePaths.push(pageFilePath);
              console.log(`Converted page ${i}/${pageCount} to image with pdf2pic: ${pageFilePath}`);
            } else {
              console.warn(`Written image file is empty or corrupt: ${pageFilePath}`);
            }
          } else {
            console.warn(`Failed to convert page ${i}/${pageCount} with pdf2pic - no buffer returned`);
          }
        } catch (pageError) {
          console.error(`Error converting page ${i} with pdf2pic:`, pageError);
          // Continue with other pages
        }
      }
      
      if (imagePaths.length === 0) {
        throw new Error('No pages could be converted to images');
      }
      
      return imagePaths;
    } catch (error) {
      console.error('Error converting PDF to images:', error);
      throw new Error(`Failed to convert PDF to images: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Performs OCR on a list of images
   * @param imagePaths Paths to the images
   * @returns Extracted text from all images
   */
  async performOCR(imagePaths: string[]): Promise<string> {
    try {
      console.log(`Performing OCR on ${imagePaths.length} images...`);
      
      // OCR configuration - using more conservative settings
      const config = {
        lang: "eng",
        oem: 3,             // Changed from 1 to 3 (more compatible default)
        psm: 1,             // Changed from 3 to 1 (auto page segmentation)
        dpi: 150,           // Add explicit DPI
        skip_diagnostics: 1 // Skip diagnostic steps that might cause issues
      };
      
      // Process each image and combine the results
      let combinedText = '';
      for (let i = 0; i < imagePaths.length; i++) {
        // Report progress if callback is provided
        if (this.progressCallback) {
          this.progressCallback(i + 1, imagePaths.length);
        }
        
        const imagePath = imagePaths[i];
        console.log(`OCR processing image ${i + 1}/${imagePaths.length}: ${imagePath}`);
        
        // Check if the image file exists and has content
        if (fs.existsSync(imagePath) && fs.statSync(imagePath).size > 0) {
          try {
            // Process each image in a try-catch to continue even if one fails
            const text = await tesseract.recognize(imagePath, config);
            combinedText += `\n--- Page ${i + 1} ---\n${text}\n`;
          } catch (pageOcrError) {
            console.error(`OCR error on page ${i + 1}:`, pageOcrError);
            
            // If regular OCR failed, try a fallback approach using exec directly
            try {
              console.log(`Trying alternative OCR method for page ${i + 1}...`);
              const { stdout } = await execAsync(`tesseract "${imagePath}" stdout -l eng`);
              if (stdout && stdout.length > 0) {
                combinedText += `\n--- Page ${i + 1} ---\n${stdout}\n`;
              } else {
                combinedText += `\n--- Page ${i + 1} ---\n[OCR failed with alternative method]\n`;
              }
            } catch (fallbackError) {
              console.error(`Alternative OCR method also failed for page ${i + 1}:`, fallbackError);
              combinedText += `\n--- Page ${i + 1} ---\n[OCR processing failed]\n`;
            }
          }
        } else {
          console.warn(`Image file not found or empty: ${imagePath}`);
          combinedText += `\n--- Page ${i + 1} ---\n[Image processing failed - file not found or empty]\n`;
        }
      }
      
      // If we got no text at all, throw an error
      if (combinedText.trim().length === 0) {
        throw new Error('OCR processing failed to extract any text from all images');
      }
      
      return combinedText;
    } catch (error) {
      console.error('Error performing OCR:', error);
      throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Processes the extracted text with OpenAI to generate a knowledge graph
   * @param text Text extracted from the PDF
   * @returns Knowledge graph
   * @deprecated This method should not be used directly. Extract text separately and then
   * process it with the desired model in the main API flow to avoid redundant processing.
   */
  private async processTextWithOpenAI(text: string): Promise<KnowledgeGraph> {
    try {
      console.log(`Processing ${text.length} characters with OpenAI...`);
      console.warn('WARNING: Using deprecated direct text processing. This may cause redundant OCR processing.');
      
      // Use the AI service to process the text
      const aiService = createAIService('openai', this.apiKey);
      return await aiService.processText(text);
    } catch (error) {
      console.error('Error processing text with OpenAI:', error);
      throw new Error(`OpenAI processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Performs OCR on an image file and extracts text
   * @param imagePath Path to the image file
   * @returns Extracted text from the image
   */
  async performOCROnImage(imagePath: string): Promise<string> {
    try {
      console.log(`Performing OCR on image: ${imagePath}`);
      
      // OCR configuration
      const config = {
        lang: "eng",
        oem: 3,             // Default OCR Engine Mode
        psm: 1,             // Auto page segmentation
        dpi: 150,           // Explicit DPI
        skip_diagnostics: 1 // Skip diagnostic steps
      };
      
      // Check if the image file exists and has content
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
      }
      
      if (fs.statSync(imagePath).size === 0) {
        throw new Error(`Image file is empty: ${imagePath}`);
      }
      
      // Process the image with tesseract OCR
      try {
        const text = await tesseract.recognize(imagePath, config);
        return text;
      } catch (ocrError) {
        console.error(`OCR error on image:`, ocrError);
        
        // Try a fallback approach using exec directly
        try {
          console.log(`Trying alternative OCR method...`);
          const { stdout } = await execAsync(`tesseract "${imagePath}" stdout -l eng`);
          if (stdout && stdout.length > 0) {
            return stdout;
          } else {
            throw new Error('Alternative OCR method returned empty result');
          }
        } catch (fallbackError) {
          const errorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          throw new Error(`All OCR methods failed: ${errorMessage}`);
        }
      }
    } catch (error) {
      console.error('Error performing OCR on image:', error);
      throw new Error(`Failed to perform OCR on image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Extracts text from a PDF file using OCR
   * @param filePath Path to the PDF file
   * @returns Extracted text from the PDF
   */
  async extractTextFromPDF(filePath: string): Promise<string> {
    const result = await this.processOCRText(filePath);
    return result.text;
  }
  
  /**
   * Extracts text from a PDF file using OCR
   * @param filePath Path to the PDF file
   * @returns Extracted text and success status
   */
  async processOCRText(filePath: string): Promise<{
    text: string;
    graph?: KnowledgeGraph; // Made optional since we'll prefer not to process text here
    pageCount: number;
    success: boolean;
  }> {
    try {
      // Step 1: Convert PDF to images (with progress reporting)
      // Report starting PDF conversion
      if (this.progressCallback) {
        this.progressCallback(0, 1); // Start at 0 of unknown total
      }
      
      const imagePaths = await this.convertPDFToImages(filePath);
      
      // Step 2: Perform OCR on the images (progress reporting happens inside the method)
      if (this.progressCallback) {
        this.progressCallback(0, imagePaths.length);
      }
      
      const extractedText = await this.performOCR(imagePaths);
      
      // Notify we're done with text extraction
      if (this.progressCallback) {
        this.progressCallback(imagePaths.length, imagePaths.length);
      }
      
      // Clean up temporary image files
      for (const imagePath of imagePaths) {
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
      
      // Return without creating a graph - let the main API flow use the extracted text
      // with the user's chosen model instead
      return {
        text: extractedText,
        pageCount: imagePaths.length,
        success: true
      };
    } catch (error) {
      console.error('PDF OCR processing error:', error);
      return {
        text: `[PDF OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}]`,
        pageCount: 0,
        success: false
      };
    }
  }
}

// Singleton instance - note: we're no longer using a singleton because of the progress callback
export function getPDFOCRService(apiKey: string, progressCallback?: ProgressCallback): PDFOCRService {
  return new PDFOCRService(apiKey, progressCallback);
}