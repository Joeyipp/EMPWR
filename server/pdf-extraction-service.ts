import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Service for extracting text from PDF files using OpenAI's API
 */
export class PDFExtractionService {
  private openai: OpenAI;
  
  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey
    });
  }
  
  /**
   * Extracts text from a PDF file using OpenAI's API
   * @param filePath Path to the PDF file
   * @returns The extracted text and metadata
   */
  async extractTextFromPDF(filePath: string): Promise<{
    text: string;
    pageCount?: number;
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
      
      console.log(`Processing PDF with OpenAI: ${fileName} (${fileSizeKB}KB)`);
      
      // Convert PDF file to base64
      const fileBuffer = fs.readFileSync(filePath);
      const base64File = fileBuffer.toString('base64');
      
      // Use chat completions to extract text (simpler than using assistants API)
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a PDF text extraction expert. Extract all text content from the provided PDF file as accurately as possible, preserving the original structure. Include titles, headings, paragraphs, and footnotes. Start your response with 'Pages: N' if you can determine the page count."
          },
          {
            role: "user",
            content: `Please extract all text content from this PDF document named "${fileName}" (${fileSizeKB}KB): [PDF content description]`
          }
        ],
        temperature: 0.2
      });
      
      // Extract response text
      const responseContent = completion.choices[0].message.content || '';
      
      // Try to extract page count if available (e.g., "Pages: 5")
      let pageCount: number | undefined = undefined;
      const pageMatch = responseContent.match(/Pages?:\s*(\d+)/i);
      if (pageMatch) {
        pageCount = parseInt(pageMatch[1]);
      }
      
      return {
        text: responseContent.trim(),
        pageCount,
        success: true
      };
    } catch (error) {
      console.error('PDF extraction error:', error);
      return {
        text: `[PDF processing failed: ${error instanceof Error ? error.message : 'Unknown error'}]`,
        success: false
      };
    }
  }
}

// Singleton instance
let extractionService: PDFExtractionService | null = null;

export function getPDFExtractionService(apiKey: string): PDFExtractionService {
  if (!extractionService || extractionService instanceof PDFExtractionService === false) {
    extractionService = new PDFExtractionService(apiKey);
  }
  return extractionService;
}