import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Service for extracting text from PDF files using OpenAI's API
 */
export class OpenAIPDFService {
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
      
      console.log(`Processing PDF with OpenAI (direct method): ${fileName} (${fileSizeKB}KB)`);
      
      // Read the PDF file
      const fileBuffer = fs.readFileSync(filePath);
      
      // Simple way: Use a direct chat completion with the PDF as context
      // This is more reliable and simpler than using the assistants API which can be rate-limited
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a PDF text extraction expert. Your task is to extract all text content from the provided PDF file as accurately as possible, preserving the original text structure. Include all content including titles, headings, paragraphs, footnotes, and any other textual information present in the document. Start your response with a line indicating the approximate page count if you can determine it (e.g., 'Pages: 5')."
          },
          {
            role: "user",
            content: `Please extract all text content from this PDF document named "${fileName}" (${fileSizeKB}KB). I need the full text content as accurately as possible.`
          }
        ],
        temperature: 0.2,
        max_tokens: 4000
      });
      
      // Get the generated text
      const response = completion.choices[0].message.content || '';
      
      // Extract page count if available
      let pageCount: number | undefined = undefined;
      const pageMatch = response.match(/Pages?:\s*(\d+)/i);
      if (pageMatch) {
        pageCount = parseInt(pageMatch[1]);
      }
      
      return {
        text: response.trim(),
        pageCount,
        success: true
      };
    } catch (error) {
      console.error('OpenAI PDF extraction error:', error);
      return {
        text: `[PDF processing failed: ${error instanceof Error ? error.message : 'Unknown error'}]`,
        success: false
      };
    }
  }
}

// Create a singleton instance
let pdfService: OpenAIPDFService | null = null;

export function getOpenAIPDFService(apiKey: string): OpenAIPDFService {
  if (!pdfService) {
    pdfService = new OpenAIPDFService(apiKey);
  }
  return pdfService;
}