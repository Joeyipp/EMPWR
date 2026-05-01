import * as fs from 'fs';
import * as path from 'path';

/**
 * Service for extracting text from PDF files using pdf-parse
 */
export class PDFService {
  /**
   * Extracts text from a PDF file
   * @param filePath Path to the PDF file
   * @returns The extracted text and metadata
   */
  async extractTextFromPDF(filePath: string): Promise<{
    text: string;
    pageCount: number;
    success: boolean;
  }> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      // Get file information
      const fileStats = fs.statSync(filePath);
      const fileSizeKB = Math.round(fileStats.size / 1024);
      const fileName = path.basename(filePath);
      
      console.log(`Processing PDF file: ${fileName} (${fileSizeKB}KB)`);
      
      // Read the PDF file
      const dataBuffer = fs.readFileSync(filePath);
      
      // Load pdf-parse with dynamic import
      try {
        // Use dynamic import for ESM compatibility
        const pdfParseModule = await import('pdf-parse');
        // Get the default export whether it's CommonJS or ESM
        const pdfParse = pdfParseModule.default || pdfParseModule;
        
        // Pass the buffer directly to pdfParse
        const pdfData = await pdfParse(dataBuffer);
        
        console.log(`PDF extraction completed: ${pdfData.text.length} characters, ${pdfData.numpages} pages`);
        
        return {
          text: pdfData.text,
          pageCount: pdfData.numpages,
          success: true
        };
      } catch (parseError) {
        console.error('PDF parsing error:', parseError);
        throw new Error(`PDF parsing failed: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }
    } catch (error) {
      console.error('PDF extraction error:', error);
      return {
        text: `[PDF processing failed: ${error instanceof Error ? error.message : 'Unknown error'}]`,
        pageCount: 0,
        success: false
      };
    }
  }
}

// Singleton instance
let pdfService: PDFService | null = null;

export function getPDFService(): PDFService {
  if (!pdfService) {
    pdfService = new PDFService();
  }
  return pdfService;
}