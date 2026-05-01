import { InsertGraph, KnowledgeGraph, Graph } from '../shared/schema';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { IStorage } from './storage';
import { parseCSV, parseExcel } from './parsers/spreadsheet-parser';
import { parseRDF } from './parsers/rdf-parser';
import * as webParser from './parsers/web-parser';
import { createAIService } from './ai-services';
import { PDFService } from './pdf-service';
import { PDFOCRService } from './pdf-ocr-service';

interface ExtractionResult {
  graph: Graph & {
    nodes: KnowledgeGraph['nodes'];
    links: KnowledgeGraph['links'];
  };
  stats: {
    entityCount: number;
    relationCount: number;
    sourceType: string;
    processingTime: number;
    sourceName: string;
    topEntities: Array<{name: string; count: number}>;
    topRelations: Array<{name: string; count: number}>;
  };
  graphId: number; // Add the graph ID to the result
}

/**
 * Service for extracting knowledge graphs from various sources
 */
export class ExtractionService {
  private storage: IStorage;
  private openai: OpenAI | null = null;
  private model: string = 'openai';

  constructor(storage: IStorage, apiKey?: string, model: string = 'openai') {
    this.storage = storage;
    this.model = model;
    
    if (apiKey) {
      if (model === 'mistral') {
        // Don't initialize OpenAI for Mistral AI
        console.log("Initialized with Mistral API key");
      } else {
        // Default to OpenAI
        this.openai = new OpenAI({ apiKey });
      }
    }
  }

  /**
   * Extract a knowledge graph from a web page
   * @param url The URL of the web page
   * @param sourceSystem The knowledge source system (wikidata, dbpedia, schema, general)
   * @param model Optional model to use for extraction (openai or mistral)
   * @returns Extraction result with graph and statistics
   */
  async extractFromWeb(url: string, sourceSystem: string, model?: string): Promise<ExtractionResult> {
    const startTime = Date.now();
    
    try {
      // Validate URL format first
      try {
        new URL(url);
      } catch (urlError) {
        throw new Error('Invalid URL format. Please provide a valid URL including the protocol (http:// or https://)');
      }
      
      // Use the model parameter or the class property
      const selectedModel = model || this.model;
      
      // Get the appropriate API key based on the model
      let apiKey;
      if (selectedModel === 'mistral') {
        apiKey = process.env.MISTRAL_API_KEY || '';
      } else {
        apiKey = this.openai ? this.openai.apiKey : (process.env.OPENAI_API_KEY || '');
      }
      
      console.log(`Extracting from web: ${url} using model: ${selectedModel} and source system: ${sourceSystem}`);
      
      // Extract content from web using appropriate parser based on source system
      const { graph, metadata } = await webParser.extractFromWeb(url, sourceSystem, apiKey, selectedModel);
      
      // Calculate processing time
      const processingTime = (Date.now() - startTime) / 1000;
      
      // Generate statistics
      const stats = this.generateStats(graph, 'Web', processingTime, url);
      
      // Store graph in database
      const graphName = `Web Extract: ${url.substring(0, 50)}${url.length > 50 ? '...' : ''}`;
      const insertedGraph = await this.storage.createGraph({
        name: graphName,
        inputText: `Extracted from URL: ${url} using ${sourceSystem} on ${new Date().toISOString()}`,
        nodes: graph.nodes || [],
        links: graph.links || [],
        entityCount: graph.nodes?.length || 0,
        relationCount: graph.links?.length || 0,
        createdAt: new Date().toISOString()
      });
      
      // Return the graph with statistics and graph ID
      return {
        graph: {
          ...insertedGraph,
          nodes: graph.nodes,
          links: graph.links
        },
        stats,
        graphId: insertedGraph.id // Add graph ID to the result
      };
    } catch (error) {
      console.error('Error extracting from web:', error);
      throw new Error(`Failed to extract knowledge graph from web: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract a knowledge graph from a file
   * @param filePath The path to the file
   * @param fileType The type of file (csv, txt, rdf)
   * @returns Extraction result with graph and statistics
   */
  async extractFromFile(filePath: string, fileType: string): Promise<ExtractionResult> {
    const startTime = Date.now();
    
    try {
      let graph: KnowledgeGraph;
      const fileName = path.basename(filePath);
      
      // Use the API key provided in the constructor or fallback to environment variable
      const apiKey = this.openai ? this.openai.apiKey : (process.env.OPENAI_API_KEY || '');
      
      // Process file based on type
      if (fileType === 'csv') {
        // Determine if it's a CSV or Excel file based on extension
        const extension = path.extname(filePath).toLowerCase();
        
        if (['.xlsx', '.xls'].includes(extension)) {
          graph = await parseExcel(filePath);
        } else {
          graph = await parseCSV(filePath);
        }
      } else if (fileType === 'txt') {
        // For text files, use the AI service to process the content
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const aiService = createAIService('openai', apiKey);
        graph = await aiService.processText(fileContent, filePath);
      } else if (fileType === 'rdf') {
        graph = await parseRDF(filePath);
      } else if (fileType === 'pdf') {
        // For PDF files, extract text and then generate knowledge graph
        // First, try using standard PDF extraction
        const pdfService = new PDFService();
        let pdfText = '';
        let extractionSuccess = false;
        let ocrProcessed = false;
        
        console.log(`Processing PDF file: ${filePath} directly with ${this.model}`);
        
        try {
          // Try to extract text using PDF.js first
          const result = await pdfService.extractTextFromPDF(filePath);
          pdfText = result.text;
          console.log(`PDF text extracted: ${pdfText.length} characters, ${result.pageCount || 0} pages`);
          
          // Check if standard extraction got enough text
          if (pdfText.length > 100 && !pdfText.includes('[PDF processing failed:')) {
            extractionSuccess = true;
          } else {
            console.log('Standard PDF extraction produced limited results, trying OCR...');
          }
        } catch (pdfError) {
          console.error('PDF extraction failed, trying OCR extraction:', pdfError);
        }
        
        // If standard extraction failed, try OCR approach
        if (!extractionSuccess) {
          // Ensure we have an API key
          const apiKeyToUse = apiKey || process.env.OPENAI_API_KEY;
          if (!apiKeyToUse) {
            console.error('No API key available for OCR processing');
            throw new Error('OpenAI API key is required for PDF OCR processing');
          }
          
          try {
            console.log('Using enhanced OCR processing with multi-stage pipeline...');
            // Create the PDFOCRService with the API key
            const pdfOcrService = new PDFOCRService(apiKeyToUse);
            
            // Convert PDF to images, then perform OCR on each page
            const imagePaths = await pdfOcrService.convertPDFToImages(filePath);
            pdfText = await pdfOcrService.performOCR(imagePaths);
            console.log(`PDF OCR extraction successful: ${pdfText.length} characters, ${imagePaths.length} pages`);
            
            // Set flag to indicate OCR was used
            ocrProcessed = true;
            extractionSuccess = true;
            
            // Clean up temporary image files
            for (const imagePath of imagePaths) {
              if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
              }
            }
          } catch (ocrError) {
            console.error('OCR extraction failed:', ocrError);
            pdfText = `[PDF OCR processing failed: ${ocrError instanceof Error ? ocrError.message : 'Unknown error'}]`;
          }
        }
        
        // Use AI service to process the extracted text
        const aiService = createAIService(this.model, apiKey);
        console.log(`Successfully processed PDF content with ${this.model}`);
        graph = await aiService.processText(pdfText, filePath);
        
        // Store the extracted text in the graph as a property 
        // Since we've updated the KnowledgeGraph interface, this is now type-safe
        if (!graph.inputText) {
          graph.inputText = pdfText;
          console.log(`Stored ${pdfText.length} characters of PDF text in graph.inputText property`);
        }
        
        // Also store whether OCR was used
        graph.ocrProcessed = ocrProcessed;
      } else if (fileType === 'image') {
        // For image files, extract text using OCR and then generate knowledge graph
        const apiKeyToUse = apiKey || process.env.OPENAI_API_KEY || '';
        const pdfOcrService = new PDFOCRService(apiKeyToUse);
        const imageText = await pdfOcrService.performOCROnImage(filePath);
        console.log(`Image OCR text extracted: ${imageText.length} characters`);
        
        // Use AI service to process the extracted OCR text
        const aiService = createAIService(this.model, apiKey);
        graph = await aiService.processText(imageText, filePath);
        
        // Store the extracted image OCR text in the graph
        if (!graph.inputText) {
          graph.inputText = imageText;
          console.log(`Stored ${imageText.length} characters of OCR text in graph.inputText property`);
        }
      } else {
        throw new Error(`Unsupported file type: ${fileType}`);
      }
      
      // Calculate processing time
      const processingTime = (Date.now() - startTime) / 1000;
      
      // Generate statistics
      const stats = this.generateStats(
        graph, 
        fileType.toUpperCase(),
        processingTime,
        fileName
      );
      
      // Store graph in database with the actual extracted text
      const graphName = `File Extract: ${fileName}`;
      
      // Determine the actual text content to store based on file type
      let extractedContent = '';
      
      // Instead of trying to access variables from different scopes,
      // we can use the actual graph object that contains our parsed text
      if (fileType === 'pdf' || fileType === 'image') {
        // For PDF and image files, use the inputText from the processed graph if available
        // This is populated by the AI service based on the text extraction
        if (graph.inputText && typeof graph.inputText === 'string' && graph.inputText.length > 10) {
          // Use the input text if it's reasonably long (more than a few characters)
          extractedContent = graph.inputText;
          console.log(`Using extracted ${fileType} content from graph.inputText (${extractedContent.length} chars)`);
        } else {
          // Fallback if no text was extracted
          extractedContent = `Extracted from file: ${fileName} (${fileType.toUpperCase()}) on ${new Date().toISOString()}`;
          console.log(`No valid content found in graph.inputText, using fallback text`);
        }
      } else {
        // For other file types
        extractedContent = `Extracted from file: ${fileName} (${fileType.toUpperCase()}) on ${new Date().toISOString()}`;
      }
      
      // Limit content length if needed to avoid DB issues (some DBs have VARCHAR limits)
      const maxInputLength = 10000; // Adjust based on DB constraints
      const trimmedContent = extractedContent.length > maxInputLength 
        ? extractedContent.substring(0, maxInputLength) + '...(trimmed)' 
        : extractedContent;
      
      console.log(`Storing extracted content in graph: ${trimmedContent.substring(0, 100)}...`);
      
      const insertedGraph = await this.storage.createGraph({
        name: graphName,
        inputText: trimmedContent,
        nodes: graph.nodes || [],
        links: graph.links || [],
        entityCount: graph.nodes?.length || 0,
        relationCount: graph.links?.length || 0,
        createdAt: new Date().toISOString(),
        userId: undefined // This will be populated by the route handler
      });
      
      // Return the graph with statistics and graph ID
      return {
        graph: {
          ...insertedGraph,
          nodes: graph.nodes,
          links: graph.links
        },
        stats,
        graphId: insertedGraph.id // Add graph ID to the result
      };
    } catch (error) {
      console.error('Error extracting from file:', error);
      throw new Error(`Failed to extract knowledge graph from file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate statistics for an extracted knowledge graph
   * @param graph The knowledge graph
   * @param sourceType The type of source (Web, CSV, TXT, RDF)
   * @param processingTime Processing time in seconds
   * @param sourceName Name of the source (URL or filename)
   * @returns Statistics about the extraction
   */
  private generateStats(
    graph: KnowledgeGraph, 
    sourceType: string,
    processingTime: number,
    sourceName: string
  ) {
    // Count entities and relations
    const entityCount = graph.nodes.length;
    const relationCount = graph.links.length;
    
    // Get top entities by connection count
    const entityConnections = new Map<number, number>();
    graph.links.forEach(link => {
      entityConnections.set(link.source, (entityConnections.get(link.source) || 0) + 1);
      entityConnections.set(link.target, (entityConnections.get(link.target) || 0) + 1);
    });
    
    const topEntities = Array.from(entityConnections.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => {
        const node = graph.nodes.find(n => n.id === id);
        return {
          name: node ? node.name : `Entity #${id}`,
          count
        };
      });
    
    // Get top relations by occurrence
    const relationTypes = new Map<string, number>();
    graph.links.forEach(link => {
      relationTypes.set(link.label, (relationTypes.get(link.label) || 0) + 1);
    });
    
    const topRelations = Array.from(relationTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
    
    return {
      entityCount,
      relationCount,
      sourceType,
      processingTime,
      sourceName,
      topEntities,
      topRelations
    };
  }
}

export const getExtractionService = (storage: IStorage, apiKey?: string, model: string = 'openai'): ExtractionService => {
  return new ExtractionService(storage, apiKey, model);
};