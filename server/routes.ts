import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { createStorage } from "./storage";
import { processTextSchema, enrichGraphSchema, insertGraphSchema, mergeGraphsSchema, Graph, Node, Link, insertUserSchema, SYSTEM_SETTINGS } from "@shared/schema";
import { translateWikidataPropertyLabels } from "@shared/wikidata-utils";
import { createAIService, type OntologyConstraints } from "./ai-services";
import { wikidataService } from "./wikidata-service";
import { getPDFService } from "./pdf-service";
import { getPDFOCRService, type ProgressCallback } from "./pdf-ocr-service";
import { getExtractionService } from "./extract-services-fixed";
import { ZodError, z } from "zod";
import { fromZodError } from "zod-validation-error";
import { checkAlgorithmApiKey, getApiKeyForAlgorithm } from './helper/algorithm-key-check';
import { cmfService } from './cmf-service';
import multer from "multer";
import * as fs from "fs";
import * as path from "path";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { hashPassword, verifyPassword, isAuthenticated, isAdmin } from "./auth-utils";
import { emailService } from "./email-service";

// PDF parser will be loaded dynamically when needed
let pdfParseModule: any = null;

// Helper function to load pdf-parse dynamically
async function getPdfParser() {
  if (pdfParseModule === null) {
    try {
      // Dynamic import for ESM compatibility
      pdfParseModule = await import('pdf-parse');
    } catch (error) {
      console.error('Error loading pdf-parse module:', error);
      pdfParseModule = false; // Mark as failed to avoid repeated attempts
    }
  }
  return pdfParseModule && pdfParseModule.default ? pdfParseModule.default : null;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes with /api prefix
  const apiRouter = express.Router();
  
  // Note: The /save-graph endpoint is implemented below with consolidated functionality.
  
  // Process all sources and generate a knowledge graph
  apiRouter.post("/process-sources", async (req, res) => {
    try {
      const { sources } = req.body;
      
      if (!sources || !Array.isArray(sources) || sources.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No sources provided or invalid sources format'
        });
      }

      // Check if we have an API key in the settings
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        return res.status(400).json({
          success: false,
          error: 'OpenAI API key not found in environment variables'
        });
      }

      try {
        // Initialize the OpenAI client with proper error handling
        const openai = new OpenAI({ apiKey: openaiKey });

        // First analyze each source individually and stream analysis thoughts
        const analysisPrompt = `I'm going to analyze multiple sources of information to construct a comprehensive knowledge graph. Let me examine each source carefully and identify connections between them:\n\n`;
        
        // Process each source in sequence to provide analysis
        let sourceAnalyses: string[] = [];
        for (let i = 0; i < sources.length; i++) {
          const source = sources[i];
          console.log(`Analyzing source ${i + 1}: ${source.title}`);
          
          const sourceAnalysisPrompt = `
Source ${i + 1} of ${sources.length} (${source.type}): "${source.title}"
Content: ${source.content}

Please provide the following:
1. A brief summary (2-3 sentences) of this source content
2. Key entities: Identify the important named entities, concepts, people, places, organizations, etc.
3. Relationships: Map out explicit and implicit relationships between these entities with specific relation types
4. Metadata: Note any temporal information, categories, or classifications that apply to these entities
5. Knowledge structure: How this information could be organized in a knowledge graph

${i > 0 ? `IMPORTANT: Consider potential connections with previously analyzed sources (Sources 1-${i}):
${sources.slice(0, i).map((prevSource, idx) => `- Source ${idx + 1}: "${prevSource.title}" (${prevSource.type})`).join('\n')}

Identify any entities, concepts, or relationships that connect this source to previous ones.` : ''}

Format your response with clearly labeled sections:
=== SUMMARY ===
(Your brief summary here)

=== ANALYSIS ===
(Your detailed analysis here)

${i > 0 ? `=== CONNECTIONS ===
(Discuss potential connections to previously analyzed sources here)` : ''}
`;
          
          const analysisCompletion = await openai.chat.completions.create({
            model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
            messages: [
              { role: "system", content: "You are a knowledge graph extraction specialist. Think step by step and analyze the content deeply." },
              { role: "user", content: sourceAnalysisPrompt }
            ],
          });
          
          const sourceAnalysis = analysisCompletion.choices[0]?.message?.content || 
            `Unable to analyze source ${i + 1}: ${source.title}`;
          
          sourceAnalyses.push(`### Analysis of Source ${i + 1}: ${source.title} (${source.type})\n${sourceAnalysis}\n\n`);
        }
        
        // Combine all analyses
        const combinedAnalysis = sourceAnalyses.join('\n');
        
        // Create a prompt with all the sources for generating the final knowledge graph
        let graphPrompt = `Generate a unified knowledge graph based on the following sources, identifying connections between them:\n\n`;
        
        // Add each source to the prompt
        sources.forEach((source, index) => {
          graphPrompt += `Source ${index + 1} (${source.type}): ${source.title}\n`;
          graphPrompt += `Content: ${source.content}\n\n`;
        });
        
        // Add instructions for the knowledge graph format
        graphPrompt += `
Please analyze all of these sources together to create a comprehensive knowledge graph that:

1. Identifies key entities, concepts, and topics across all sources
2. Discovers connections and relationships between information in different sources
3. Creates a unified representation of the combined knowledge from all sources

Format the knowledge graph as a JSON object with the following structure:

{
  "nodes": [
    {
      "id": 1,
      "name": "Entity Name",
      "group": 0,  // A number (0-5) representing the category of the entity:
                   // 0: Person, 1: Organization, 2: Location, 3: Concept, 4: Event, 5: Other
      "properties": {  // Optional additional properties about the entity
        "description": "Brief description",
        "sourceCount": 2,  // Number of sources this entity appears in
        "provenance": [  // List of sources where this entity appears
          {
            "sourceId": 1,
            "sourceTitle": "Source Title",
            "sourceType": "web/pdf/text",
            "timestamp": "2025-04-09"
          }
        ]
      }
    },
    ...
  ],
  "links": [
    {
      "source": 1,  // ID of the source node
      "target": 2,  // ID of the target node
      "relationship": "specific relationship type",  // Descriptive relationship label
      "properties": {  // Optional additional properties about the relationship
        "strength": 0.8,  // Number between 0-1 indicating relationship strength
        "sourceCount": 2,  // Number of sources this relationship appears in
        "provenance": [  // List of sources where this relationship appears
          {
            "sourceId": 1,
            "sourceTitle": "Source Title",
            "sourceType": "web/pdf/text",
            "timestamp": "2025-04-09"
          }
        ]
      }
    },
    ...
  ]
}

Important guidelines:
1. All node IDs must be unique integers
2. All links must reference valid node IDs
3. Similar entities must be consolidated into a single node, even if they appear in different sources
4. Links should represent specific, meaningful relationships (not just "related to")
5. Prioritize cross-source connections that link information between different sources
6. Include "sourceCount" in properties to show how many sources mention each entity/relationship
7. Add provenance information to ALL nodes and links, indicating which source each came from
8. Include timestamps (today's date) in the provenance information
9. Use descriptive, informative names for entities and specific relationship types

Reply ONLY with the JSON object and nothing else.
`;

        console.log("Generating final knowledge graph...");
        
        // Call the OpenAI API for chat completion to generate the graph
        const completion = await openai.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
          messages: [
            { role: "system", content: "You are a knowledge graph extraction specialist. Your task is to analyze content and produce structured knowledge graphs in JSON format." },
            { role: "user", content: graphPrompt }
          ],
          response_format: { type: "json_object" }
        });
        
        // Get the response content
        const content = completion.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response from OpenAI API');
        }
        
        // Parse the JSON from the response
        let graph;
        try {
          graph = JSON.parse(content);
          
          // Validate the graph structure
          if (!graph.nodes || !Array.isArray(graph.nodes) || !graph.links || !Array.isArray(graph.links)) {
            throw new Error('Invalid graph structure');
          }
          
        } catch (error: any) {
          console.error('Error parsing graph JSON:', error);
          return res.status(500).json({
            success: false,
            error: 'Failed to parse knowledge graph from AI response'
          });
        }
        
        // Return the processed graph and the analysis
        return res.json({
          success: true,
          data: {
            graph,
            analysis: combinedAnalysis,
            summary: `Generated knowledge graph with ${graph.nodes.length} nodes and ${graph.links.length} links`
          }
        });
      } catch (openaiError: any) {
        console.error('OpenAI API error:', openaiError);
        
        // Check if it's an authentication error
        const errorMessage = openaiError.message || '';
        const isAuthError = 
          errorMessage.includes('authentication') || 
          errorMessage.includes('API key') || 
          errorMessage.includes('401') ||
          errorMessage.includes('403');
        
        if (isAuthError) {
          return res.status(401).json({
            success: false,
            error: 'Invalid OpenAI API key. Please check your environment variables.'
          });
        }
        
        return res.status(500).json({
          success: false,
          error: `OpenAI API error: ${errorMessage}`
        });
      }
    } catch (error: any) {
      console.error('Error processing sources:', error);
      
      return res.status(500).json({
        success: false,
        error: error.message || 'An error occurred while processing sources'
      });
    }
  });

  // Process text and generate knowledge graph
  apiRouter.post("/process-text", async (req, res) => {
    try {
      // Log the raw request for debugging
      console.log("Raw process-text request body:", JSON.stringify({
        textLength: req.body.text?.length || 0,
        model: req.body.model,
        hasApiKey: !!req.body.apiKey,
        hasFilePath: !!req.body.filePath,
        filePathValue: req.body.filePath ? req.body.filePath.substring(0, 20) + '...' : 'none',
        ocrProcessed: !!req.body.ocrProcessed
      }));

      // Check if we have a filePath but empty text - this is likely an error
      // Also check if ocrProcessed flag is true but text is empty - this is definitely an error
      if ((req.body.filePath && (!req.body.text || req.body.text.trim() === '')) ||
          (req.body.ocrProcessed === true && (!req.body.text || req.body.text.trim() === ''))) {
        console.error('Validation error: Empty text with filePath or ocrProcessed flag');
        console.error('Request details:', {
          hasFilePath: !!req.body.filePath,
          textLength: req.body.text?.length || 0,
          ocrProcessed: !!req.body.ocrProcessed
        });
        return res.status(400).json({ 
          success: false, 
          message: "No text content provided for processing. Please extract text first."
        });
      }
      
      // Validate input
      const { text, model, apiKey, filePath, ocrProcessed, ontologyText } = processTextSchema.parse(req.body);
      
      // Create the appropriate AI service based on the model
      let aiService;
      try {
        aiService = createAIService(model, apiKey);
        console.log(`Using model: ${model}`);
      } catch (serviceError) {
        console.error(`Error creating AI service for model ${model}:`, serviceError);
        
        // Special handling for models that require API keys when processing PDF files
        if ((model === 'openai' || model === 'mistral') && filePath && fs.existsSync(filePath) && 
            serviceError instanceof Error && serviceError.message.includes('API key is required')) {
          const modelDisplayName = model === 'openai' ? 'OpenAI' : 'Mistral AI';
          return res.status(400).json({ 
            success: false, 
            message: `${modelDisplayName} API key is required for PDF document processing`,
            requiresApiKey: true,
            model: model
          });
        }
        
        return res.status(400).json({ 
          success: false, 
          message: serviceError instanceof Error ? serviceError.message : "Invalid model or missing API key"
        });
      }
      
      // Process the text using the chosen service
      let knowledgeGraph;
      let documentText = text;
      
      // Check if we need to process a document file
      if (filePath && fs.existsSync(filePath)) {
        console.log(`Processing file with ${model}: ${filePath}`);
        
        // For models requiring API keys, ensure API key is present
        if ((model === 'openai' || model === 'mistral') && (!apiKey || apiKey.trim() === '')) {
          const modelDisplayName = model === 'openai' ? 'OpenAI' : 'Mistral AI';
          console.error(`API key required for ${modelDisplayName} document processing`);
          return res.status(400).json({
            success: false,
            message: `${modelDisplayName} API key is required for PDF document analysis`,
            requiresApiKey: true,
            model: model
          });
        }
        
        // Extract text from document if needed
        // If we have proper text content longer than 100 chars, avoid re-processing the PDF
        // Also skip document processing if ocrProcessed flag is true, indicating OCR was already done
        const hasExtractedText = (documentText && documentText.trim().length > 100 && 
                                !documentText.startsWith('[PDF Document:') && 
                                !documentText.startsWith('[Document:')) || 
                                ocrProcessed === true;
        
        if (!hasExtractedText) {
          try {
            console.log('Getting text from document file...');
            
            if (fs.existsSync(filePath)) {
              const fileExt = path.extname(filePath).toLowerCase();
              
              if (fileExt === '.pdf') {
                console.log('Processing PDF file...');
                
                // Try different PDF extraction methods
                let extractionSuccess = false;
                
                // 1. First try standard pdf-parse
                try {
                  const pdfService = getPDFService();
                  const result = await pdfService.extractTextFromPDF(filePath);
                  
                  if (result.success && result.text.length > 50) {
                    documentText = result.text;
                    console.log(`Successfully extracted ${documentText.length} characters from PDF with standard parser`);
                    extractionSuccess = true;
                  } else {
                    console.log('Standard PDF extraction produced limited results, trying OCR...');
                  }
                } catch (pdfError) {
                  console.error('Error with standard PDF extraction:', pdfError);
                }
                
                // 2. If standard extraction failed or produced little text, try OCR
                // Check if we have an OpenAI API key from user input or environment
                let openaiApiKey = apiKey || process.env.OPENAI_API_KEY;
                
                if (!extractionSuccess && openaiApiKey) {
                  try {
                    console.log('Trying OCR-based extraction...');
                    
                    // Set up WebSocket to provide progress updates
                    let currentSocketId = '';
                    const progressCallback = (currentPage: number, totalPages: number) => {
                      // If there's a valid socket connection, send progress updates
                      if (req.headers['x-socket-id'] && typeof req.headers['x-socket-id'] === 'string') {
                        currentSocketId = req.headers['x-socket-id'];
                        // Get the Socket.IO instance from the app
                        const io = req.app.get('socketio') as SocketIOServer;
                        if (io) {
                          const socket = io.sockets.sockets.get(currentSocketId);
                          if (socket) {
                            // Determine the current stage in more detail
                            let stageMessage = 'Processing document...';
                            let percentComplete = Math.round((currentPage / totalPages) * 100);
                            
                            if (currentPage === 0) {
                              stageMessage = 'Preparing document for processing...';
                            } else if (currentPage === totalPages) {
                              stageMessage = 'Finalizing OCR extraction...';
                            } else {
                              const progressIndicator = percentComplete < 33 ? 'starting' : 
                                                        percentComplete < 66 ? 'halfway through' : 
                                                        'almost finished';
                              stageMessage = `Converting page ${currentPage} to image (${progressIndicator})...`;
                            }
                            
                            socket.emit('pdf-progress', { 
                              currentPage, 
                              totalPages, 
                              stage: stageMessage,
                              percentComplete
                            });
                          }
                        }
                      }
                    };
                    
                    // Make sure we have a valid API key
                    if (openaiApiKey) {
                      const pdfOcrService = getPDFOCRService(openaiApiKey, progressCallback);
                      const imagePaths = await pdfOcrService.convertPDFToImages(filePath);
                      const ocrText = await pdfOcrService.performOCR(imagePaths);
                      
                      if (ocrText && ocrText.length > 0) {
                        documentText = ocrText;
                        console.log(`OCR extraction successful: ${documentText.length} characters`);
                        extractionSuccess = true;
                        
                        // Log that we'll be using this extracted text with the selected model
                        console.log(`Using OCR-extracted text with ${model} model`);
                      }
                      
                      // Clean up temporary image files
                      for (const imagePath of imagePaths) {
                        if (fs.existsSync(imagePath)) {
                          fs.unlinkSync(imagePath);
                        }
                      }
                    }
                  } catch (ocrError) {
                    console.error('OCR extraction failed:', ocrError);
                  }
                }
                
                // 3. If all extraction methods failed, use a placeholder
                if (!extractionSuccess) {
                  const fileName = path.basename(filePath);
                  const fileStats = fs.statSync(filePath);
                  const fileSizeKB = Math.round(fileStats.size / 1024);
                  documentText = `[PDF Document Content: ${fileName} (${fileSizeKB}KB) - Text extraction failed]`;
                  console.warn('All PDF extraction methods failed');
                }
              } else {
                // For non-PDF files, use a placeholder
                const fileName = path.basename(filePath);
                documentText = `[Document Content: ${fileName}]`;
              }
            } else {
              console.error('Document file not found:', filePath);
              documentText = `[Document not found]`;
            }
          } catch (extractError) {
            console.error('Error accessing document file:', extractError);
            documentText = `[Document - Access Error: ${extractError instanceof Error ? extractError.message : 'Unknown error'}]`;
          }
        }
        
        // Process the extracted document text
        console.log(`Processing text with ${model} model. Text length: ${documentText.length}, OCR processed: ${ocrProcessed ? 'Yes' : 'No'}, ontology provided: ${!!ontologyText}`);
        try {
          // If ontology text is provided, use ontology-guided generation
          if (ontologyText && ontologyText.trim().length > 0 && aiService.processTextWithOntology) {
            console.log(`Using ontology-guided generation (ontology length: ${ontologyText.length})`);
            const ontologyConstraints: OntologyConstraints = {
              entities: [],
              relations: [],
              rawContent: ontologyText
            };
            knowledgeGraph = await aiService.processTextWithOntology(documentText, ontologyConstraints);
          } else if (ocrProcessed || hasExtractedText) {
            // Always skip file processing if text was already extracted
            console.log('Using pre-extracted text - skipping file OCR processing');
            knowledgeGraph = await aiService.processText(documentText);
          } else {
            knowledgeGraph = await aiService.processText(documentText, filePath);
          }
        } catch (aiError) {
          console.error(`AI Service (${model}) error:`, aiError);
          
          // Check if this is an API key related error
          const errorMessage = aiError instanceof Error ? aiError.message : "Error processing text with AI service";
          const isApiKeyError = errorMessage.toLowerCase().includes('api key') || 
                               errorMessage.toLowerCase().includes('auth') || 
                               errorMessage.toLowerCase().includes('401');
                               
          return res.status(400).json({
            success: false,
            message: errorMessage,
            requiresApiKey: isApiKeyError,
            model: model,
            errorDetails: {
              model: model,
              errorType: isApiKeyError ? "api_key_error" : "ai_processing_error"
            }
          });
        }
      } else {
        // Standard text processing
        try {
          // If ontology text is provided, use ontology-guided generation
          if (ontologyText && ontologyText.trim().length > 0 && aiService.processTextWithOntology) {
            console.log(`Using ontology-guided generation for text (ontology length: ${ontologyText.length})`);
            const ontologyConstraints: OntologyConstraints = {
              entities: [],
              relations: [],
              rawContent: ontologyText
            };
            knowledgeGraph = await aiService.processTextWithOntology(text, ontologyConstraints);
          } else {
            knowledgeGraph = await aiService.processText(text);
          }
        } catch (aiError) {
          console.error(`AI Service (${model}) error:`, aiError);
          
          // Check if this is an API key related error
          const errorMessage = aiError instanceof Error ? aiError.message : "Error processing text with AI service";
          const isApiKeyError = errorMessage.toLowerCase().includes('api key') || 
                               errorMessage.toLowerCase().includes('auth') || 
                               errorMessage.toLowerCase().includes('401');
                               
          return res.status(400).json({
            success: false,
            message: errorMessage,
            requiresApiKey: isApiKeyError,
            model: model,
            errorDetails: {
              model: model,
              errorType: isApiKeyError ? "api_key_error" : "ai_processing_error"
            }
          });
        }
      }
      
      // Translate Wikidata property IDs to human-readable labels before saving
      if (knowledgeGraph && knowledgeGraph.links && Array.isArray(knowledgeGraph.links)) {
        knowledgeGraph.links = translateWikidataPropertyLabels(knowledgeGraph.links);
      }
      
      // Create a record of the graph with the user ID if authenticated
      const graph = await app.locals.storage.createGraph({
        userId: req.session.userId || null, // Use the authenticated user's ID if available
        inputText: text, // Use the text that was processed (original or extracted)
        nodes: knowledgeGraph.nodes,
        links: knowledgeGraph.links,
        entityCount: knowledgeGraph.nodes.length,
        relationCount: knowledgeGraph.links.length,
        createdAt: new Date().toISOString(),
      });
      
      // Verify that a valid graph ID was returned from the database
      if (!graph || typeof graph.id !== 'number') {
        console.error("Error: No valid graph ID returned from database:", graph);
        return res.status(500).json({
          success: false,
          message: "Failed to generate a valid graph ID in the database"
        });
      }
      
      console.log(`Successfully created graph with ID ${graph.id} in the database`);

      // CMF lineage log (fire-and-forget)
      cmfService.logExtraction({
        model:      model || 'unknown',
        provider:   (model || '').includes('gpt') || model === 'openai' ? 'openai'
                    : (model || '').includes('mistral') ? 'mistral'
                    : model === 'spacy' ? 'spacy' : model || 'unknown',
        textLength: text?.length || 0,
        sourceType: 'text',
        sourceRef:  text?.substring(0, 200),
        graphId:    graph.id,
        graphName:  graph.name || '',
        nodeCount:  knowledgeGraph.nodes.length,
        linkCount:  knowledgeGraph.links.length,
        userId:     req.session.userId,
      });

      // Return knowledge graph data with the graph ID
      return res.status(200).json({
        success: true,
        data: {
          graphId: graph.id,
          nodes: knowledgeGraph.nodes,
          links: knowledgeGraph.links,
          entityCount: knowledgeGraph.nodes.length,
          relationCount: knowledgeGraph.links.length,
          model: model,
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          success: false, 
          message: validationError.message
        });
      }
      
      console.error("Error processing text:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred while processing the text.",
      });
    }
  });

  // Hybrid processing endpoint - combines ontology constraints with text processing
  apiRouter.post("/hybrid-process", async (req, res) => {
    try {
      const { text, model, ontologyId, useOntologyConstraints, rawOntologyText, mode = 'strict' } = req.body;

      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "Text content is required for hybrid processing"
        });
      }

      // Either ontologyId or rawOntologyText must be provided
      if (!ontologyId && !rawOntologyText) {
        return res.status(400).json({
          success: false,
          message: "Either ontology ID or raw ontology text is required for hybrid processing"
        });
      }

      // Check if we have a valid API key for the selected model
      const apiKey = await getApiKeyForAlgorithm(model);
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          message: `API key not found for model: ${model}. Please configure the API key in Settings.`,
          requiresApiKey: true,
          model: model
        });
      }

      // Create AI service for the selected model
      const aiService = createAIService(model, apiKey);

      let knowledgeGraph;
      let ontologyConstraints: any;
      
      try {
        if (rawOntologyText) {
          // Use raw ontology text directly - no parsing needed
          ontologyConstraints = {
            entities: [],
            relations: [],
            description: 'User-provided ontology schema',
            domain: '',
            rawContent: rawOntologyText
          };
        } else if (ontologyId) {
          // Get the ontology from storage
          const ontology = await app.locals.storage.getOntology(ontologyId);
          if (!ontology) {
            return res.status(404).json({
              success: false,
              message: "Ontology not found"
            });
          }
          
          // Parse the ontology data safely
          const entities = ontology.entities ? 
            (typeof ontology.entities === 'string' ? JSON.parse(ontology.entities) : ontology.entities) : [];
          const relations = ontology.relations ? 
            (typeof ontology.relations === 'string' ? JSON.parse(ontology.relations) : ontology.relations) : [];
          
          ontologyConstraints = {
            entities: Array.isArray(entities) ? entities : [],
            relations: Array.isArray(relations) ? relations : [],
            description: ontology.description || '',
            domain: ontology.domain || '',
            rawContent: (ontology as any).rawContent || ''
          };
        }

        if (mode === 'enhance') {
          // ENHANCE MODE: Generate both unconstrained and ontology-guided graphs, then merge
          
          // Step 1: Generate unconstrained knowledge graph
          const unconstrainedGraph = await aiService.processText(text);
          
          // Step 2: Generate ontology-constrained knowledge graph
          let ontologyGraph;
          if (aiService.processTextWithOntology) {
            ontologyGraph = await aiService.processTextWithOntology(text, ontologyConstraints);
          } else {
            ontologyGraph = await aiService.processText(text);
          }
          
          // Step 3: Merge both graphs (deduplicate by node name)
          const nodeMap = new Map<string, any>();
          const allLinks: any[] = [];
          
          // Add unconstrained nodes first
          if (unconstrainedGraph?.nodes) {
            unconstrainedGraph.nodes.forEach((node: any) => {
              const key = node.name.toLowerCase().trim();
              if (!nodeMap.has(key)) {
                nodeMap.set(key, { ...node, source: 'unconstrained' });
              }
            });
          }
          
          // Add ontology nodes (may update existing with ontology type info)
          if (ontologyGraph?.nodes) {
            ontologyGraph.nodes.forEach((node: any) => {
              const key = node.name.toLowerCase().trim();
              if (nodeMap.has(key)) {
                // Update with ontology type info if present
                const existing = nodeMap.get(key);
                if (node.type) existing.type = node.type;
                existing.source = 'merged';
              } else {
                nodeMap.set(key, { ...node, source: 'ontology' });
              }
            });
          }
          
          // Reassign IDs to merged nodes
          const mergedNodes = Array.from(nodeMap.values());
          const nameToNewId = new Map<string, number>();
          mergedNodes.forEach((node, index) => {
            nameToNewId.set(node.name.toLowerCase().trim(), index);
            node.id = index;
          });
          
          // Collect and deduplicate links
          const linkSet = new Set<string>();
          
          const addLinks = (links: any[], sourceGraph: any) => {
            if (!links) return;
            links.forEach((link: any) => {
              // Find source and target node names
              const sourceNode = sourceGraph?.nodes?.find((n: any) => n.id === link.source);
              const targetNode = sourceGraph?.nodes?.find((n: any) => n.id === link.target);
              if (!sourceNode || !targetNode) return;
              
              const newSourceId = nameToNewId.get(sourceNode.name.toLowerCase().trim());
              const newTargetId = nameToNewId.get(targetNode.name.toLowerCase().trim());
              if (newSourceId === undefined || newTargetId === undefined) return;
              
              const relationship = link.relationship || link.label || 'related_to';
              const linkKey = `${newSourceId}-${newTargetId}-${relationship.toLowerCase()}`;
              
              if (!linkSet.has(linkKey)) {
                linkSet.add(linkKey);
                allLinks.push({
                  source: newSourceId,
                  target: newTargetId,
                  relationship: relationship,
                  label: relationship,
                  value: 1
                });
              }
            });
          };
          
          addLinks(unconstrainedGraph?.links, unconstrainedGraph);
          addLinks(ontologyGraph?.links, ontologyGraph);
          
          knowledgeGraph = {
            nodes: mergedNodes,
            links: allLinks
          };
        } else {
          // STRICT MODE: Only generate with ontology constraints
          if (aiService.processTextWithOntology) {
            knowledgeGraph = await aiService.processTextWithOntology(text, ontologyConstraints);
          } else {
            knowledgeGraph = await aiService.processText(text);
          }
        }

        // Post-process the knowledge graph to ensure it conforms to the ontology
        if (knowledgeGraph && knowledgeGraph.nodes && knowledgeGraph.links) {
          // Helper function to get entity type name
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

          // Only filter if we have ontology constraints with entities
          if (ontologyConstraints.entities && ontologyConstraints.entities.length > 0) {
            // Filter entities to match ontology entity types
            const allowedEntityNames = ontologyConstraints.entities.map((e: any) => e.name.toLowerCase());
            knowledgeGraph.nodes = knowledgeGraph.nodes.filter((node: any) => {
              const nodeTypeName = getEntityTypeName(node.group || 1).toLowerCase();
              return allowedEntityNames.includes(nodeTypeName) || allowedEntityNames.includes((node.name || '').toLowerCase());
            });
          }

          // Only filter relations if we have ontology constraints with relations
          if (ontologyConstraints.relations && ontologyConstraints.relations.length > 0) {
            // Filter relationships to match ontology relation types
            const allowedRelationNames = ontologyConstraints.relations.map((r: any) => r.name.toLowerCase());
              knowledgeGraph.links = knowledgeGraph.links.filter((link: any) => {
                return allowedRelationNames.includes((link.relationship || '').toLowerCase());
              });
            }

          // Update node IDs after filtering
          const nodeIdMap = new Map();
          knowledgeGraph.nodes.forEach((node: any, index: number) => {
            nodeIdMap.set(node.id, index);
            node.id = index;
          });

          // Update link references after node filtering and ensure label property exists
          knowledgeGraph.links = knowledgeGraph.links.filter((link: any) => {
            return nodeIdMap.has(link.source) && nodeIdMap.has(link.target);
          }).map((link: any) => ({
            ...link,
            source: nodeIdMap.get(link.source),
            target: nodeIdMap.get(link.target),
            label: link.label || link.relationship || 'related_to',
            value: link.value || 1
          }));
        }
        
        // Ensure all links have both label and relationship properties
        if (knowledgeGraph?.links) {
          knowledgeGraph.links = knowledgeGraph.links.map((link: any) => ({
            ...link,
            label: link.label || link.relationship || 'related_to',
            relationship: link.relationship || link.label || 'related_to',
            value: link.value || 1
          }));
        }
      } catch (aiError) {
        console.error('AI service error during hybrid processing:', aiError);
        const errorMessage = aiError instanceof Error ? aiError.message : "Failed to process text with ontology constraints";
        const isApiKeyError = errorMessage.toLowerCase().includes('api') || 
                             errorMessage.toLowerCase().includes('key') || 
                             errorMessage.toLowerCase().includes('auth') || 
                             errorMessage.toLowerCase().includes('401');
                             
        return res.status(400).json({
          success: false,
          message: errorMessage,
          requiresApiKey: isApiKeyError,
          model: model,
          errorDetails: {
            model: model,
            errorType: isApiKeyError ? "api_key_error" : "ai_processing_error"
          }
        });
      }

      // Translate Wikidata property IDs to human-readable labels before saving
      if (knowledgeGraph && knowledgeGraph.links && Array.isArray(knowledgeGraph.links)) {
        knowledgeGraph.links = translateWikidataPropertyLabels(knowledgeGraph.links);
      }

      // Create a record of the graph with the user ID if authenticated
      const graph = await app.locals.storage.createGraph({
        userId: req.session.userId || null,
        inputText: text,
        nodes: knowledgeGraph.nodes,
        links: knowledgeGraph.links,
        entityCount: knowledgeGraph.nodes.length,
        relationCount: knowledgeGraph.links.length,
        createdAt: new Date().toISOString(),
      });

      // Verify that a valid graph ID was returned from the database
      if (!graph || typeof graph.id !== 'number') {
        console.error("Error: No valid graph ID returned from database:", graph);
        return res.status(500).json({
          success: false,
          message: "Failed to generate a valid graph ID in the database"
        });
      }

      // Return knowledge graph data with the graph ID
      return res.status(200).json({
        success: true,
        data: {
          graphId: graph.id,
          nodes: knowledgeGraph.nodes,
          links: knowledgeGraph.links,
          entityCount: knowledgeGraph.nodes.length,
          relationCount: knowledgeGraph.links.length,
          ontologyId: ontologyId || null,
          conformsToOntology: true
        }
      });

    } catch (error) {
      console.error('Error in hybrid processing:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during hybrid processing'
      });
    }
  });

  // Set up file upload with multer
  const uploadDir = path.join(process.cwd(), 'temp-uploads');
  
  // Create upload directory if it doesn't exist
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  // Configure storage
  const multerStorage = multer.diskStorage({
    destination: function(req, file, cb) {
      cb(null, uploadDir);
    },
    filename: function(req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  });
  
  // Use a different variable name to avoid conflict
  const fileUpload = multer({ 
    storage: multerStorage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: function(req, file, cb) {
      // Allow specific MIME types
      const allowedMimeTypes = [
        'text/plain',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/bmp',
        'image/webp',
        // CSV/Excel mime types
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        // RDF mime types
        'application/rdf+xml',
        'text/turtle',
        'application/n-triples',
        'application/ld+json',
        'application/n3'
      ];
      
      // Allow specific file extensions
      const allowedExtensions = /\.txt$|\.pdf$|\.doc$|\.docx$|\.jpg$|\.jpeg$|\.png$|\.gif$|\.bmp$|\.webp$|\.csv$|\.xlsx$|\.xls$|\.rdf$|\.owl$|\.ttl$|\.n3$|\.jsonld$/i;
      const hasValidExtension = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
      const hasValidMimeType = allowedMimeTypes.includes(file.mimetype);
      
      // Special case for .txt files which might have various MIME types
      const isTxtFile = /\.txt$/i.test(path.extname(file.originalname).toLowerCase());
      
      // Special case for image files which might have various MIME types
      const isImageFile = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(path.extname(file.originalname).toLowerCase());
      
      // Special case for CSV/Excel files which might have various MIME types
      const isCsvFile = /\.(csv|xlsx|xls)$/i.test(path.extname(file.originalname).toLowerCase());
      
      // Special case for RDF files which might have various MIME types
      const isRdfFile = /\.(rdf|owl|ttl|n3|jsonld)$/i.test(path.extname(file.originalname).toLowerCase());
      
      if (hasValidMimeType || hasValidExtension || isTxtFile || isImageFile || isCsvFile || isRdfFile) {
        return cb(null, true);
      }
      
      cb(new Error('Only .txt, .pdf, .doc, .docx, .jpg, .jpeg, .png, .gif, .bmp, .webp, .csv, .xlsx, .xls, .rdf, .owl, .ttl, .n3, and .jsonld files are allowed'));
    }
  });
  
  // Skip pdf parsing in this implementation to avoid the CommonJS/ESM conflicts
  // We'll just extract content directly
  
  // Route for extracting text from uploaded documents
  apiRouter.post('/extract-text', fileUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }
      
      const filePath = req.file.path;
      const fileExtension = path.extname(req.file.originalname).toLowerCase();
      
      // For text files, read directly
      if (fileExtension === '.txt') {
        const text = fs.readFileSync(filePath, 'utf8');
        
        // Clean up the temp file
        fs.unlinkSync(filePath);
        
        return res.status(200).json({
          success: true,
          text: text
        });
      }
      
      // For PDF files, extract text using our PDF service
      if (fileExtension === '.pdf') {
        // Get file information
        const fileStats = fs.statSync(filePath);
        const fileSizeKB = Math.round(fileStats.size / 1024);
        
        console.log(`Processing PDF file: ${req.file.originalname} (${fileSizeKB}KB)`);
        
        try {
          // Try the regular PDF extraction first (using pdf-parse)
          let extractionMethod = 'standard';
          const pdfService = getPDFService();
          let result = await pdfService.extractTextFromPDF(filePath);
          
          // If regular extraction failed or produced little text, check for OpenAI API key to try OCR
          if (!result.success || result.text.length < 100) {
            // Check for OpenAI API key from request body or process.env
            const openaiApiKey = req.body.apiKey || process.env.OPENAI_API_KEY;
            
            // If we have an OpenAI API key, try OCR-based extraction as a fallback
            if (openaiApiKey) {
              console.log('Standard PDF extraction produced limited results. Trying OCR-based extraction...');
              try {
                extractionMethod = 'ocr';
                // Set up progress tracking via WebSocket if socket ID is provided in headers
                let progressCallback: ProgressCallback | undefined = undefined;
                if (req.headers['x-socket-id'] && typeof req.headers['x-socket-id'] === 'string') {
                  const socketId = req.headers['x-socket-id'];
                  // Access the io instance directly from the app property we set in index.ts
                  const io = (req.app as any).io;
                  if (io) {
                    console.log(`Setting up progress callback for socket ID: ${socketId}`);
                    
                    // Send initial progress update to indicate processing is starting
                    io.emit('pdf-progress', { 
                      currentPage: 0, 
                      totalPages: 1, 
                      stage: 'Initializing document extraction...',
                      percentComplete: 0,
                      documentType: 'PDF',
                      processingStage: 'initialization'
                    });
                    
                    progressCallback = (currentPage: number, totalPages: number) => {
                      try {
                        // Calculate progress percentage and determine stage
                        const percentComplete = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
                        
                        let stageMessage = 'Processing document...';
                        let processingStage = 'processing';
                        
                        if (currentPage === 0) {
                          stageMessage = 'Preparing PDF for OCR extraction...';
                          processingStage = 'preparation';
                        } else if (currentPage === totalPages) {
                          stageMessage = 'Finalizing text extraction...';
                          processingStage = 'finalizing';
                        } else {
                          // Provide more detailed status based on progress
                          const progressPhase = percentComplete < 25 ? 'beginning' : 
                                              percentComplete < 50 ? 'quarter way through' :
                                              percentComplete < 75 ? 'halfway through' :
                                              'nearly complete';
                                              
                          stageMessage = `OCR processing page ${currentPage} of ${totalPages} (${progressPhase})...`;
                          processingStage = 'ocr_processing';
                        }
                        
                        // Enhanced progress data with more details
                        const progressData = { 
                          currentPage, 
                          totalPages, 
                          stage: stageMessage,
                          percentComplete,
                          documentType: 'PDF',
                          processingStage
                        };
                        
                        io.emit('pdf-progress', progressData);
                        console.log(`Sent progress update: ${percentComplete}% complete - ${stageMessage}`);
                      } catch (error) {
                        console.error('Error sending progress update:', error);
                      }
                    };
                  } else {
                    console.warn('Socket.IO instance not available');
                  }
                }
                
                const pdfOcrService = getPDFOCRService(openaiApiKey, progressCallback);
                
                // Use a more robust approach by using the full OCR service
                try {
                  // First try the complete convertPDFToImages and performOCR pipeline
                  const ocrResult = await pdfOcrService.convertPDFToImages(filePath);
                  const ocrText = await pdfOcrService.performOCR(ocrResult);
                  
                  // If OCR produced text, use that instead
                  if (ocrText && ocrText.length > 0) {
                    result = {
                      text: ocrText,
                      pageCount: ocrResult.length,
                      success: true
                    };
                    console.log(`OCR extraction successful: ${result.text.length} characters, ${result.pageCount} pages`);
                  
                    // Clean up temporary image files
                    for (const imagePath of ocrResult) {
                      if (fs.existsSync(imagePath)) {
                        fs.unlinkSync(imagePath);
                      }
                    }
                  }
                } catch (ocrStepError) {
                  console.error('Step-by-step OCR extraction failed:', ocrStepError);
                  
                  // If the step-by-step approach failed, try the complete process function
                  try {
                    console.log('Trying complete OCR text extraction instead...');
                    const ocrProcessResult = await pdfOcrService.processOCRText(filePath);
                    
                    if (ocrProcessResult.success && ocrProcessResult.text.length > 0) {
                      result = {
                        text: ocrProcessResult.text,
                        pageCount: ocrProcessResult.pageCount,
                        success: true
                      };
                      console.log(`Complete OCR extraction successful: ${result.text.length} characters, ${result.pageCount} pages`);
                    }
                  } catch (completeOcrError) {
                    console.error('Complete OCR process also failed:', completeOcrError);
                  }
                }
              } catch (ocrError) {
                console.error('All OCR extraction methods failed:', ocrError);
                // Continue with whatever result we got from standard extraction
              }
            } else {
              console.log('No OpenAI API key available for OCR fallback. Using standard extraction results.');
            }
          }
          
          if (result.success && result.text.length > 0) {
            console.log(`PDF extraction successful (${extractionMethod}): ${result.text.length} characters, ${result.pageCount} pages`);
            return res.status(200).json({
              success: true,
              text: result.text,
              pageCount: result.pageCount,
              isDocument: true,
              documentType: 'pdf',
              filePath: filePath,
              fileName: req.file.originalname,
              extractionMethod: extractionMethod,
              ocrProcessed: extractionMethod === 'ocr' // Flag indicating if text was processed with OCR
            });
          } else {
            // If extraction fails, return a failure message
            console.log('PDF extraction failed');
            
            return res.status(200).json({
              success: true,
              text: `[PDF Document: ${req.file.originalname} - Text extraction failed]`,
              isDocument: true,
              documentType: 'pdf',
              filePath: filePath,
              fileName: req.file.originalname,
              extractionFailed: true,
              requiresApiKey: extractionMethod === 'standard' // If standard method failed, we might need an API key
            });
          }
        } catch (error) {
          console.error('Error with PDF extraction services:', error);
          
          // Return with error message
          return res.status(200).json({
            success: true,
            text: `[PDF Document: ${req.file.originalname} - Text extraction error: ${error instanceof Error ? error.message : 'Unknown error'}]`,
            isDocument: true,
            documentType: 'pdf',
            filePath: filePath,
            fileName: req.file.originalname,
            extractionFailed: true
          });
        }
      }
      
      // For image files, perform OCR
      const isImageFile = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileExtension);
      if (isImageFile) {
        console.log(`Processing image file: ${req.file.originalname}`);
        
        try {
          // Check for OpenAI API key from request body or process.env
          const openaiApiKey = req.body.apiKey || process.env.OPENAI_API_KEY;
          
          if (!openaiApiKey) {
            return res.status(200).json({
              success: true,
              text: `[Image OCR requires an OpenAI API key]`,
              isDocument: true,
              documentType: 'image',
              filePath: filePath,
              fileName: req.file.originalname,
              extractionFailed: true,
              requiresApiKey: true
            });
          }
          
          // Set up progress tracking via WebSocket if socket ID is provided in headers
          let progressCallback: ProgressCallback | undefined = undefined;
          if (req.headers['x-socket-id'] && typeof req.headers['x-socket-id'] === 'string') {
            const socketId = req.headers['x-socket-id'];
            const io = (req.app as any).io;
            if (io) {
              console.log(`Setting up progress callback for socket ID: ${socketId}`);
              
              // Send initial progress update to indicate processing is starting
              io.emit('pdf-progress', { 
                currentPage: 0, 
                totalPages: 1, 
                stage: 'Initializing image OCR processing...',
                percentComplete: 0,
                documentType: 'Image',
                processingStage: 'initialization'
              });
              
              progressCallback = (currentPage: number, totalPages: number) => {
                try {
                  // For images, we simplify progress since it's usually a single page
                  const percentComplete = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
                  
                  let stageMessage = 'Processing image...';
                  let processingStage = 'processing';
                  
                  if (currentPage === 0) {
                    stageMessage = 'Preparing image for OCR extraction...';
                    processingStage = 'preparation';
                  } else if (currentPage === totalPages) {
                    stageMessage = 'Finalizing image text extraction...';
                    processingStage = 'finalizing';
                  } else {
                    stageMessage = `Performing OCR analysis on image (${percentComplete}% complete)...`;
                    processingStage = 'ocr_processing';
                  }
                  
                  // Enhanced progress data with more details
                  const progressData = { 
                    currentPage, 
                    totalPages, 
                    stage: stageMessage,
                    percentComplete,
                    documentType: 'Image',
                    processingStage
                  };
                  
                  io.emit('pdf-progress', progressData);
                  console.log(`Image OCR progress: ${percentComplete}% complete - ${stageMessage}`);
                } catch (error) {
                  console.error('Error sending progress update:', error);
                }
              };
            }
          }
          
          // Perform OCR on the image using the OCR service
          const pdfOcrService = getPDFOCRService(openaiApiKey, progressCallback);
          
          // For images we can directly call the OCR service on a single image
          const ocrText = await pdfOcrService.performOCR([filePath]);
          
          if (ocrText && ocrText.length > 0) {
            console.log(`Image OCR extraction successful: ${ocrText.length} characters`);
            
            return res.status(200).json({
              success: true,
              text: ocrText,
              isDocument: true,
              documentType: 'image',
              filePath: filePath,
              fileName: req.file.originalname,
              extractionMethod: 'ocr',
              ocrProcessed: true
            });
          } else {
            return res.status(200).json({
              success: true,
              text: `[Image OCR extraction failed to extract any text]`,
              isDocument: true,
              documentType: 'image',
              filePath: filePath,
              fileName: req.file.originalname,
              extractionFailed: true
            });
          }
        } catch (error) {
          console.error('Error performing OCR on image:', error);
          
          return res.status(200).json({
            success: true,
            text: `[Image OCR error: ${error instanceof Error ? error.message : 'Unknown error'}]`,
            isDocument: true,
            documentType: 'image',
            filePath: filePath,
            fileName: req.file.originalname,
            extractionFailed: true
          });
        }
      }
      
      // For other document types (docx, etc.)
      // Clean up the temp file
      fs.unlinkSync(filePath);
      
      return res.status(200).json({
        success: true,
        text: `[Document content from ${req.file.originalname}] - This document will be analyzed using OpenAI.`,
        isDocument: true,
        documentType: fileExtension.substring(1) // Remove the leading dot
      });
      
    } catch (error) {
      console.error('Error extracting text from file:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred while processing the file.'
      });
    }
  });

  // Enrich knowledge graph with Wikidata
  apiRouter.post("/enrich-graph", async (req, res) => {
    try {
      // Validate input
      const { graph, maxEnrichments } = enrichGraphSchema.parse(req.body);
      
      console.log(`Enriching knowledge graph with ${graph.nodes.length} nodes and ${graph.links.length} links...`);
      
      // Translate any existing Wikidata property IDs in the input graph
      if (graph.links && Array.isArray(graph.links)) {
        graph.links = translateWikidataPropertyLabels(graph.links);
      }
      
      // Enrich the graph using the WikidataService
      const startTime = Date.now();
      const result = await wikidataService.enrichGraph(graph, maxEnrichments);
      const enrichmentTime = Date.now() - startTime;
      
      // Log the enrichment results
      console.log(`Graph enrichment complete in ${enrichmentTime}ms. Added ${
        result.enrichedGraph.nodes.length - result.originalGraph.nodes.length
      } new nodes and ${
        result.enrichedGraph.links.length - result.originalGraph.links.length
      } new links.`);
      
      // Translate Wikidata property IDs to human-readable labels in the enriched graph
      if (result.enrichedGraph.links && Array.isArray(result.enrichedGraph.links)) {
        result.enrichedGraph.links = translateWikidataPropertyLabels(result.enrichedGraph.links);
      }
      
      // CMF lineage log (fire-and-forget)
      cmfService.logEnrichment({
        graphId:           (graph as any).id ?? 0,
        maxEnrichments:    maxEnrichments,
        newNodesAdded:     result.enrichedGraph.nodes.length - result.originalGraph.nodes.length,
        newLinksAdded:     result.enrichedGraph.links.length - result.originalGraph.links.length,
        enrichmentTimeMs:  enrichmentTime,
        userId:            req.session.userId,
      });

      // Return both the original and enriched graphs
      return res.status(200).json({
        success: true,
        data: {
          originalGraph: result.originalGraph,
          enrichedGraph: result.enrichedGraph,
          newEntityCount: result.enrichedGraph.nodes.length - result.originalGraph.nodes.length,
          newRelationCount: result.enrichedGraph.links.length - result.originalGraph.links.length,
          enrichmentTime: enrichmentTime
        }
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          success: false, 
          message: validationError.message
        });
      }
      
      console.error("Error enriching knowledge graph:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred while enriching the knowledge graph."
      });
    }
  });

  // Save knowledge graph with a name
  apiRouter.post("/save-graph", async (req, res) => {
    try {
      console.log('Save Graph Request Body Keys:', Object.keys(req.body));
      
      // Check if the user is authenticated using session
      if (!req.session || !req.session.isAuthenticated) {
        return res.status(401).json({
          success: false,
          message: "Authentication required to save graphs"
        });
      }
      
      // Handle both formats: flat graph data or nested inside 'graph' property
      let graphData;
      
      // Check if data is in the nested format: { graph: {...}, name: "...", description: "..." }
      if (req.body.graph && req.body.name) {
        console.log('Processing nested graph format with separate name/description properties');
        
        // Extract graph, name, and description
        const { graph, name, description } = req.body;
        
        // Validate that the graph has nodes and links
        if (!graph.nodes || !graph.links) {
          console.error('Invalid nested graph data structure:', graph);
          return res.status(400).json({
            success: false,
            error: 'Invalid graph data - missing nodes or links arrays'
          });
        }
        
        // Create a combined object with the expected structure for storage
        graphData = {
          ...graph,              // Include all graph properties
          name,                  // Use the separate name
          description,           // Use the separate description
          inputText: description || 'Generated from the Generate page',
          entityCount: graph.nodes.length,
          relationCount: graph.links.length
        };
      } else {
        console.log('Processing direct graph format');
        
        // Create a schema for validating a flat graph structure
        const saveGraphSchema = insertGraphSchema.extend({
          name: z.string().min(1, "Please provide a name for your graph"),
        });
        
        // Validate the input directly
        graphData = saveGraphSchema.parse(req.body);
      }
      
      // Add the user ID from the session to associate the graph with the user
      graphData.userId = req.session.userId;
      
      console.log(`Saving graph for user ID: ${graphData.userId}`);
      
      // Translate Wikidata property IDs to human-readable labels before saving
      if (graphData.links && Array.isArray(graphData.links)) {
        graphData.links = translateWikidataPropertyLabels(graphData.links);
      }
      
      // Make sure required fields are present
      if (!graphData.createdAt) {
        graphData.createdAt = new Date().toISOString();
      }
      
      // Save the graph
      const graph = await app.locals.storage.createGraph(graphData);
      
      return res.status(200).json({
        success: true,
        data: {
          graphId: graph.id,
          name: graph.name,
          entityCount: graph.entityCount,
          relationCount: graph.relationCount,
          createdAt: graph.createdAt
        }
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          success: false, 
          message: validationError.message
        });
      }
      
      console.error("Error saving knowledge graph:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred while saving the knowledge graph."
      });
    }
  });

  // Get all saved graphs (filtered by current user)
  apiRouter.get("/graphs", async (req, res) => {
    try {
      // Check if the user is authenticated using session
      if (!req.session || !req.session.isAuthenticated) {
        return res.status(401).json({
          success: false,
          message: "Authentication required"
        });
      }
      
      // Get user ID from session
      const userId = req.session.userId;
      
      // Get only graphs that belong to the current user
      const graphs = await app.locals.storage.getGraphsByUser(userId);
      
      // Translate any Wikidata property IDs to human-readable labels in each graph
      const processedGraphs = graphs.map((graph: any) => {
        // Only process graphs with links data
        if (graph.links && Array.isArray(graph.links)) {
          return {
            ...graph,
            links: translateWikidataPropertyLabels(graph.links)
          };
        }
        return graph;
      });
      
      // Get user data for the owner display
      const userMap = new Map();
      try {
        // If there are users associated with graphs, fetch their information
        const userIds = Array.from(new Set(processedGraphs.map((graph: any) => graph.userId).filter(Boolean)));
        for (const userId of userIds) {
          if (userId) {
            const user = await app.locals.storage.getUser(userId);
            if (user) {
              userMap.set(userId, user.username);
            }
          }
        }
      } catch (e) {
        console.error("Error fetching user data for graphs:", e);
      }

      return res.status(200).json({
        success: true,
        data: processedGraphs.map((graph: any) => ({
          id: graph.id,
          name: graph.name,
          entityCount: graph.entityCount,
          relationCount: graph.relationCount,
          createdAt: graph.createdAt,
          userId: graph.userId,
          // Include owner username if available
          ownerName: graph.userId ? userMap.get(graph.userId) || 'Unknown User' : 'No owner'
        }))
      });
    } catch (error) {
      console.error("Error fetching graphs:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred while fetching the graphs."
      });
    }
  });

  // Get a specific saved graph by ID (only if it belongs to the authenticated user)
  apiRouter.get("/graphs/:id", async (req, res) => {
    try {
      // Check if the user is authenticated using session
      if (!req.session || !req.session.isAuthenticated) {
        return res.status(401).json({
          success: false,
          message: "Authentication required"
        });
      }
      
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid graph ID"
        });
      }
      
      const graph = await app.locals.storage.getGraph(id);
      
      if (!graph) {
        return res.status(404).json({
          success: false,
          message: "Graph not found"
        });
      }
      
      // Check if the graph belongs to the authenticated user
      if (graph.userId !== req.session.userId) {
        return res.status(403).json({
          success: false,
          message: "Access denied: You don't have permission to view this graph"
        });
      }
      
      // Translate any Wikidata property IDs to human-readable labels before returning
      if (graph.links && Array.isArray(graph.links)) {
        graph.links = translateWikidataPropertyLabels(graph.links);
      }
      
      return res.status(200).json({
        success: true,
        data: graph
      });
    } catch (error) {
      console.error("Error fetching graph:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred while fetching the graph."
      });
    }
  });

  // Update graph name (PUT to update a resource)
  apiRouter.put("/graphs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid graph ID"
        });
      }
      
      // Validate request body
      const schema = z.object({
        name: z.string().min(1, "Graph name cannot be empty")
      });
      
      const { name } = schema.parse(req.body);
      
      // Update the graph name
      const updatedGraph = await app.locals.storage.updateGraphName(id, name);
      
      if (!updatedGraph) {
        return res.status(404).json({
          success: false,
          message: "Graph not found"
        });
      }
      
      return res.status(200).json({
        success: true,
        data: {
          id: updatedGraph.id,
          name: updatedGraph.name,
          entityCount: updatedGraph.entityCount,
          relationCount: updatedGraph.relationCount,
          createdAt: updatedGraph.createdAt
        },
        message: "Graph renamed successfully"
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          success: false, 
          message: validationError.message
        });
      }
      
      console.error("Error renaming graph:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred while renaming the graph."
      });
    }
  });
  
  // Update a graph's content (nodes and links)
  apiRouter.put("/graphs/:id/content", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid graph ID"
        });
      }
      
      // Validate request body
      const schema = z.object({
        nodes: z.array(
          z.object({
            id: z.number(),
            name: z.string(),
            group: z.number(),
            enriched: z.boolean().optional(),
            description: z.string().optional(),
            wikidataId: z.string().optional(),
            properties: z.record(z.any()).optional(),
            dataSource: z.string().optional(),
            timestamp: z.string().optional()
          })
        ),
        links: z.array(
          z.object({
            source: z.number(),
            target: z.number(),
            value: z.number(),
            label: z.string(),
            enriched: z.boolean().optional(),
            wikidataId: z.string().optional(),
            dataSource: z.string().optional(),
            timestamp: z.string().optional()
          })
        )
      });
      
      const { nodes, links } = schema.parse(req.body);
      
      // Update the graph content
      const updatedGraph = await app.locals.storage.updateGraphContent(id, nodes, links);
      
      if (!updatedGraph) {
        return res.status(404).json({
          success: false,
          message: "Graph not found"
        });
      }
      
      return res.status(200).json({
        success: true,
        data: {
          id: updatedGraph.id,
          name: updatedGraph.name,
          entityCount: updatedGraph.entityCount,
          relationCount: updatedGraph.relationCount,
          nodes: updatedGraph.nodes,
          links: updatedGraph.links,
          createdAt: updatedGraph.createdAt
        },
        message: "Graph content updated successfully"
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          success: false, 
          message: validationError.message
        });
      }
      
      console.error("Error updating graph content:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred while updating the graph content."
      });
    }
  });
  
  // Update a specific node within a graph
  apiRouter.put("/graphs/:graphId/nodes/:nodeId", async (req, res) => {
    try {
      const graphId = parseInt(req.params.graphId);
      const nodeId = parseInt(req.params.nodeId);
      
      if (isNaN(graphId) || isNaN(nodeId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid graph ID or node ID"
        });
      }
      
      // Validate request body
      const schema = z.object({
        id: z.number(),
        name: z.string(),
        group: z.number(),
        enriched: z.boolean().optional(),
        description: z.string().optional(),
        wikidataId: z.string().optional(),
        properties: z.record(z.any()).optional(),
        dataSource: z.string().optional(),
        timestamp: z.string().optional()
      });
      
      const updatedNode = schema.parse(req.body);
      
      // Ensure the node ID matches the URL
      if (updatedNode.id !== nodeId) {
        return res.status(400).json({
          success: false,
          message: "Node ID in request body does not match URL parameter"
        });
      }
      
      // Update the node
      const updatedGraph = await app.locals.storage.updateNode(graphId, nodeId, updatedNode);
      
      if (!updatedGraph) {
        return res.status(404).json({
          success: false,
          message: "Graph or node not found"
        });
      }
      
      return res.status(200).json({
        success: true,
        data: {
          graphId: updatedGraph.id,
          node: updatedNode,
          entityCount: updatedGraph.entityCount,
          relationCount: updatedGraph.relationCount
        },
        message: "Node updated successfully"
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          success: false, 
          message: validationError.message
        });
      }
      
      console.error("Error updating node:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred while updating the node."
      });
    }
  });
  
  // Update a specific link within a graph
  apiRouter.put("/graphs/:graphId/links", async (req, res) => {
    try {
      const graphId = parseInt(req.params.graphId);
      
      if (isNaN(graphId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid graph ID"
        });
      }
      
      // Validate request body
      const schema = z.object({
        originalSource: z.number(),
        originalTarget: z.number(),
        updatedLink: z.object({
          source: z.number(),
          target: z.number(),
          value: z.number(),
          label: z.string(),
          enriched: z.boolean().optional(),
          wikidataId: z.string().optional(),
          dataSource: z.string().optional(),
          timestamp: z.string().optional()
        })
      });
      
      const { originalSource, originalTarget, updatedLink } = schema.parse(req.body);
      
      // Update the link
      const updatedGraph = await app.locals.storage.updateLink(graphId, originalSource, originalTarget, updatedLink);
      
      if (!updatedGraph) {
        return res.status(404).json({
          success: false,
          message: "Graph or link not found"
        });
      }
      
      return res.status(200).json({
        success: true,
        data: {
          graphId: updatedGraph.id,
          link: updatedLink,
          entityCount: updatedGraph.entityCount,
          relationCount: updatedGraph.relationCount
        },
        message: "Link updated successfully"
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          success: false, 
          message: validationError.message
        });
      }
      
      console.error("Error updating link:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred while updating the link."
      });
    }
  });
  
  // Delete a node from a graph
  apiRouter.delete("/graphs/:graphId/nodes/:nodeId", async (req, res) => {
    try {
      const graphId = parseInt(req.params.graphId);
      const nodeId = parseInt(req.params.nodeId);
      
      if (isNaN(graphId) || isNaN(nodeId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid graph ID or node ID"
        });
      }
      
      // Delete the node
      const updatedGraph = await app.locals.storage.deleteNode(graphId, nodeId);
      
      if (!updatedGraph) {
        return res.status(404).json({
          success: false,
          message: "Graph or node not found"
        });
      }
      
      return res.status(200).json({
        success: true,
        data: {
          graphId: updatedGraph.id,
          entityCount: updatedGraph.entityCount,
          relationCount: updatedGraph.relationCount
        },
        message: "Node deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting node:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred while deleting the node."
      });
    }
  });
  
  // Delete a link from a graph
  apiRouter.delete("/graphs/:graphId/links", async (req, res) => {
    try {
      const graphId = parseInt(req.params.graphId);
      
      if (isNaN(graphId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid graph ID"
        });
      }
      
      // Validate request query
      const schema = z.object({
        source: z.string().transform(Number),
        target: z.string().transform(Number)
      });
      
      const { source, target } = schema.parse(req.query);
      
      if (isNaN(source) || isNaN(target)) {
        return res.status(400).json({
          success: false,
          message: "Invalid source or target ID"
        });
      }
      
      // Delete the link
      const updatedGraph = await app.locals.storage.deleteLink(graphId, source, target);
      
      if (!updatedGraph) {
        return res.status(404).json({
          success: false,
          message: "Graph or link not found"
        });
      }
      
      return res.status(200).json({
        success: true,
        data: {
          graphId: updatedGraph.id,
          entityCount: updatedGraph.entityCount,
          relationCount: updatedGraph.relationCount
        },
        message: "Link deleted successfully"
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          success: false, 
          message: validationError.message
        });
      }
      
      console.error("Error deleting link:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred while deleting the link."
      });
    }
  });
  
  // Add a new node to a graph
  apiRouter.post("/graphs/:graphId/nodes", async (req, res) => {
    try {
      const graphId = parseInt(req.params.graphId);
      
      if (isNaN(graphId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid graph ID"
        });
      }
      
      // Validate request body
      const schema = z.object({
        id: z.number().optional(), // Optional since we'll auto-assign if not provided
        name: z.string(),
        group: z.number(),
        enriched: z.boolean().optional(),
        description: z.string().optional(),
        wikidataId: z.string().optional(),
        properties: z.record(z.any()).optional(),
        dataSource: z.string().optional(),
        timestamp: z.string().optional()
      });
      
      let newNode = schema.parse(req.body);
      
      // Add timestamp if not provided
      if (!newNode.timestamp) {
        newNode.timestamp = new Date().toISOString();
      }
      
      // Make sure node has an ID - provide -1 if none is specified
      // (the storage implementation will replace this with the next available ID)
      if (typeof newNode.id !== 'number') {
        newNode.id = -1;
      }
      
      // Add the node
      const updatedGraph = await app.locals.storage.addNode(graphId, newNode as Node);
      
      if (!updatedGraph) {
        return res.status(404).json({
          success: false,
          message: "Graph not found"
        });
      }
      
      // Find the newly added node (it would be the last one with the name we specified)
      const nodes = updatedGraph.nodes as Node[];
      const addedNode = nodes.find(node => node.name === newNode.name);
      
      return res.status(201).json({
        success: true,
        data: {
          graphId: updatedGraph.id,
          node: addedNode,
          entityCount: updatedGraph.entityCount,
          relationCount: updatedGraph.relationCount
        },
        message: "Node added successfully"
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          success: false, 
          message: validationError.message
        });
      }
      
      console.error("Error adding node:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred while adding the node."
      });
    }
  });
  
  // Add a new link to a graph
  apiRouter.post("/graphs/:graphId/links", async (req, res) => {
    try {
      const graphId = parseInt(req.params.graphId);
      
      if (isNaN(graphId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid graph ID"
        });
      }
      
      // Validate request body
      const schema = z.object({
        source: z.number(),
        target: z.number(),
        value: z.number().default(1),
        label: z.string(),
        enriched: z.boolean().optional(),
        wikidataId: z.string().optional(),
        dataSource: z.string().optional(),
        timestamp: z.string().optional()
      });
      
      let newLink = schema.parse(req.body);
      
      // Add timestamp if not provided
      if (!newLink.timestamp) {
        newLink.timestamp = new Date().toISOString();
      }
      
      try {
        // Add the link
        const updatedGraph = await app.locals.storage.addLink(graphId, newLink as Link);
        
        if (!updatedGraph) {
          return res.status(404).json({
            success: false,
            message: "Graph not found"
          });
        }
        
        return res.status(201).json({
          success: true,
          data: {
            graphId: updatedGraph.id,
            link: newLink,
            entityCount: updatedGraph.entityCount,
            relationCount: updatedGraph.relationCount
          },
          message: "Link added successfully"
        });
      } catch (linkError) {
        // Check if this is a source/target not found error
        if (linkError instanceof Error && linkError.message.includes('Source or target node does not exist')) {
          return res.status(400).json({
            success: false,
            message: linkError.message
          });
        }
        throw linkError;
      }
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          success: false, 
          message: validationError.message
        });
      }
      
      console.error("Error adding link:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred while adding the link."
      });
    }
  });
  
  // Keep the old endpoint for backwards compatibility
  apiRouter.patch("/graphs/:id/rename", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid graph ID"
        });
      }
      
      // Validate request body
      const schema = z.object({
        name: z.string().min(1, "Graph name cannot be empty")
      });
      
      const { name } = schema.parse(req.body);
      
      // Update the graph name
      const updatedGraph = await app.locals.storage.updateGraphName(id, name);
      
      if (!updatedGraph) {
        return res.status(404).json({
          success: false,
          message: "Graph not found"
        });
      }
      
      return res.status(200).json({
        success: true,
        data: {
          id: updatedGraph.id,
          name: updatedGraph.name,
          entityCount: updatedGraph.entityCount,
          relationCount: updatedGraph.relationCount,
          createdAt: updatedGraph.createdAt
        },
        message: "Graph renamed successfully"
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          success: false, 
          message: validationError.message
        });
      }
      
      console.error("Error renaming graph:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred while renaming the graph."
      });
    }
  });

  // Delete a specific saved graph by ID
  apiRouter.delete("/graphs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid graph ID"
        });
      }
      
      // Check if the graph exists
      const graph = await app.locals.storage.getGraph(id);
      
      if (!graph) {
        return res.status(404).json({
          success: false,
          message: "Graph not found"
        });
      }
      
      // Delete the graph
      await app.locals.storage.deleteGraph(id);
      
      return res.status(200).json({
        success: true,
        message: "Graph deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting graph:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred while deleting the graph."
      });
    }
  });
  
  // Add new endpoint for saving knowledge graphs from the multimodal page
  apiRouter.post("/knowledge-graphs", async (req, res) => {
    try {
      // Check if the user is authenticated using session
      if (!req.session || !req.session.isAuthenticated) {
        return res.status(401).json({
          success: false,
          message: "Authentication required to save graphs"
        });
      }
      
      const { graph, name, description } = req.body;
      
      if (!graph || !graph.nodes || !graph.links) {
        return res.status(400).json({
          success: false,
          error: 'Invalid graph data'
        });
      }
      
      // Check if we have a storage instance
      if (!app.locals.storage) {
        return res.status(500).json({
          success: false,
          error: 'Storage not available'
        });
      }

      // Add timestamps to all nodes and links if they don't already have one
      const timestamp = new Date().toISOString();
      const graphWithTimestamps = {
        ...graph,
        nodes: graph.nodes.map((node: any) => ({
          ...node,
          properties: {
            ...node.properties,
            timestamp: node.properties?.timestamp || timestamp
          }
        })),
        links: graph.links.map((link: any) => ({
          ...link,
          properties: {
            ...link.properties,
            timestamp: link.properties?.timestamp || timestamp
          }
        }))
      };
      
      // Save the graph
      try {
        // Get the user ID from session to associate the graph with the user
        const userId = req.session.userId;
        console.log(`Saving knowledge graph for user ID: ${userId}`);
        
        const createdGraph = await app.locals.storage.createGraph({
          name: name || `Knowledge Graph ${new Date().toLocaleDateString()}`,
          description: description || 'Generated from multiple sources',
          nodes: graphWithTimestamps.nodes,
          links: graphWithTimestamps.links,
          inputText: description || "Generated from multiple sources",
          userId: userId,
          entityCount: graphWithTimestamps.nodes.length,
          relationCount: graphWithTimestamps.links.length,
          createdAt: new Date().toISOString()
        });
        const graphId = createdGraph.id;
        return res.json({
          success: true,
          data: {
            graphId,
            message: 'Graph saved successfully'
          }
        });
      } catch (storageError) {
        console.error('Error saving graph to storage:', storageError);
        return res.status(500).json({
          success: false,
          error: storageError instanceof Error ? storageError.message : 'Failed to save graph'
        });
      }
    } catch (error) {
      console.error('Error in knowledge-graphs endpoint:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred processing your request'
      });
    }
  });

  // Delete multiple graphs with POST method (preferred for operations with request body)
  apiRouter.post("/graphs/delete-multiple", async (req, res) => {
    try {
      // Validate request body
      const schema = z.object({
        ids: z.array(z.number().int().positive())
      });
      
      const { ids } = schema.parse(req.body);
      
      if (ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No graph IDs provided for deletion"
        });
      }
      
      // Delete the graphs
      const result = await app.locals.storage.deleteMultipleGraphs(ids);
      
      return res.status(200).json({
        success: true,
        deleted: result.success,
        failed: result.failed,
        message: `${result.success.length} graph(s) deleted successfully${
          result.failed.length > 0 ? `, ${result.failed.length} failed` : ''
        }`
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          success: false, 
          message: validationError.message
        });
      }
      
      console.error("Error deleting multiple graphs:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred while deleting graphs."
      });
    }
  });
  
  // Keep the old endpoint for backwards compatibility (DELETE method)
  apiRouter.delete("/graphs/bulk-delete", async (req, res) => {
    return res.status(400).json({
      success: false,
      message: "Please use POST /api/graphs/delete-multiple instead for bulk operations"
    });
  });

  // Analyze the potential merge without executing it
  apiRouter.post("/graphs/analyze-merge", async (req, res) => {
    try {
      // Validate request body
      const { graphIds, similarityThreshold, algorithm } = mergeGraphsSchema.parse(req.body);
      
      // Validate that we have at least 2 graphs
      if (graphIds.length < 2) {
        return res.status(400).json({
          success: false,
          message: "At least 2 graphs are required for merging analysis"
        });
      }
      
      // Check if the required API key for the algorithm is available
      const keyCheck = checkAlgorithmApiKey(algorithm);
      if (!keyCheck.success) {
        return res.status(400).json({
          success: false,
          message: keyCheck.message
        });
      }
      
      try {
        // Get all the graphs to be merged
        const graphs = await Promise.all(
          graphIds.map((id: number) => app.locals.storage.getGraph(id))
        );
        
        // Filter out any undefined graphs
        const validGraphs = graphs.filter(g => g !== undefined) as Graph[];
        
        // Make sure we still have at least 2 valid graphs
        if (validGraphs.length < 2) {
          return res.status(400).json({
            success: false,
            message: "At least 2 valid graphs are required for merging analysis"
          });
        }
        
        // Import the enhanced merge function
        const { enhancedMergeGraphs } = await import('./enhanced-merge');
        
        // Run the analysis without creating a new graph
        const { mergeStats } = await enhancedMergeGraphs(
          validGraphs,
          "Analysis only",
          similarityThreshold,
          algorithm,
          getApiKeyForAlgorithm(algorithm)
        );
        
        // Return just the analysis results
        return res.status(200).json({
          success: true,
          data: {
            unifiedEntities: mergeStats.unifiedEntities.map(entity => ({
              originalIds: entity.originalIds,
              originalNames: entity.originalNames,
              mergedName: entity.mergedName,
              algorithm: entity.algorithm,
              originalSources: entity.originalIds.map((id, index) => {
                // Find the source graph for this entity
                let sourceGraphId = 0;
                let sourceGraph = null;
                
                // Find which graph contains this entity by ID
                for (let i = 0; i < graphIds.length; i++) {
                  const graphId = graphIds[i];
                  const graph = graphs[i];
                  if (graph && graph.nodes) {
                    const hasNode = Array.isArray(graph.nodes) && graph.nodes.some((node: any) => node.id === id);
                    if (hasNode) {
                      sourceGraphId = graphId;
                      sourceGraph = graph;
                      break;
                    }
                  }
                }
                
                return {
                  id,
                  name: entity.originalNames[index],
                  graphId: sourceGraphId,
                  graphName: sourceGraph?.name || "Unknown source"
                };
              })
            })),
            newRelationships: mergeStats.newRelationships.map(rel => ({
              sourceId: rel.sourceId,
              sourceName: rel.sourceName,
              targetId: rel.targetId,
              targetName: rel.targetName,
              relationship: rel.relationship
            }))
          }
        });
      } catch (analyzeError) {
        console.error("Error analyzing potential graph merge:", analyzeError);
        return res.status(400).json({
          success: false,
          message: analyzeError instanceof Error ? analyzeError.message : "Error analyzing potential merge"
        });
      }
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          success: false, 
          message: validationError.message
        });
      }
      
      console.error("Error in analyze merge endpoint:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred while analyzing potential merge"
      });
    }
  });

  // Merge multiple graphs into a new one with entity resolution
  // Graph analysis routes (restricted to authenticated user's graphs)
  apiRouter.get("/graphs/analyze/:id", async (req, res) => {
    try {
      // Check if the user is authenticated using session
      if (!req.session || !req.session.isAuthenticated) {
        return res.status(401).json({
          success: false,
          message: "Authentication required"
        });
      }
      
      const graphId = parseInt(req.params.id);
      if (isNaN(graphId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid graph ID"
        });
      }

      // Get the graph from storage
      const graph = await app.locals.storage.getGraph(graphId);
      if (!graph) {
        return res.status(404).json({
          success: false,
          message: "Graph not found"
        });
      }
      
      // Check if the graph belongs to the authenticated user
      if (graph.userId !== req.session.userId) {
        return res.status(403).json({
          success: false,
          message: "Access denied: You don't have permission to analyze this graph"
        });
      }

      // Analyze the graph
      const graphAnalyzer = await import('./graph-analysis').then(m => m.getGraphAnalyzer());
      const metrics = graphAnalyzer.analyzeGraph(graph);

      return res.status(200).json({
        success: true,
        data: metrics
      });
    } catch (error) {
      console.error("Error analyzing graph:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred while analyzing the graph"
      });
    }
  });

  // GET endpoint to retrieve cached insights (restricted to authenticated user's graphs)
  apiRouter.get("/graphs/insights/:id", async (req, res) => {
    try {
      // Check if the user is authenticated using session
      if (!req.session || !req.session.isAuthenticated) {
        return res.status(401).json({
          success: false,
          message: "Authentication required"
        });
      }
      
      const graphId = parseInt(req.params.id);
      if (isNaN(graphId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid graph ID"
        });
      }
      
      // Get the graph to check ownership
      const graph = await app.locals.storage.getGraph(graphId);
      if (!graph) {
        return res.status(404).json({
          success: false,
          message: "Graph not found"
        });
      }
      
      // Check if the graph belongs to the authenticated user
      if (graph.userId !== req.session.userId) {
        return res.status(403).json({
          success: false,
          message: "Access denied: You don't have permission to view insights for this graph"
        });
      }

      // In a real implementation, we would fetch cached insights from storage
      // For now, just return an empty object - insights will be populated by the POST endpoint
      return res.status(200).json({
        success: true,
        data: null
      });
    } catch (error) {
      console.error("Error fetching insights:", error);
      return res.status(500).json({
        success: false,
        message: "Error fetching insights"
      });
    }
  });

  apiRouter.post("/graphs/generate-insights/:id", async (req, res) => {
    try {
      // Check if the user is authenticated
      if (!req.session || !req.session.isAuthenticated) {
        return res.status(401).json({
          success: false,
          message: "Authentication required"
        });
      }

      const graphId = parseInt(req.params.id);
      if (isNaN(graphId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid graph ID"
        });
      }

      // Get the graph from storage
      const graph = await app.locals.storage.getGraph(graphId);
      if (!graph) {
        return res.status(404).json({
          success: false,
          message: "Graph not found"
        });
      }

      // Check if the graph belongs to the authenticated user
      if (graph.userId !== req.session.userId) {
        return res.status(403).json({
          success: false,
          message: "Access denied: You don't have permission to generate insights for this graph"
        });
      }

      // Validate the API key and model selection
      const { apiKey, model = 'openai' } = req.body;
      
      // Check if the model is supported
      if (!['openai', 'mistral'].includes(model.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: `Unsupported model: ${model}. Please use 'openai' or 'mistral'.`
        });
      }

      // Use the user's API key from the database instead of the one sent in the request
      const provider = model.toLowerCase();
      const userApiKey = await app.locals.storage.getActiveApiKey(provider, req.session.userId);
      
      // Check if the user has a valid API key
      if (!userApiKey) {
        return res.status(400).json({
          success: false,
          message: `No ${provider} API key found for your account. Please add an API key in the Settings page.`,
          requiresApiKey: true
        });
      }

      // Use the user's API key from the database for security

      // Generate insights using the selected model
      const graphAnalyzer = await import('./graph-analysis').then(m => m.getGraphAnalyzer());
      console.log(`Using ${model} model for insights generation with user ${req.session.userId}'s API key`);
      const insights = await graphAnalyzer.generateAIInsights(graph, userApiKey.key, model);

      return res.status(200).json({
        success: true,
        data: insights
      });
    } catch (error) {
      console.error("Error generating insights:", error);
      
      // Check if this is an API key related error
      const errorMessage = error instanceof Error ? error.message : "Error generating insights";
      const isApiKeyError = errorMessage.toLowerCase().includes('api key') || 
                          errorMessage.toLowerCase().includes('auth') || 
                          errorMessage.toLowerCase().includes('401');
                          
      return res.status(500).json({
        success: false,
        message: errorMessage,
        requiresApiKey: isApiKeyError,
        errorDetails: {
          errorType: isApiKeyError ? "api_key_error" : "ai_processing_error"
        }
      });
    }
  });

  apiRouter.post("/graphs/create-assistant/:id", async (req, res) => {
    try {
      // Check if the user is authenticated
      if (!req.session || !req.session.isAuthenticated) {
        return res.status(401).json({
          success: false,
          message: "Authentication required"
        });
      }

      const graphId = parseInt(req.params.id);
      if (isNaN(graphId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid graph ID"
        });
      }

      // Get the graph from storage
      const graph = await app.locals.storage.getGraph(graphId);
      if (!graph) {
        return res.status(404).json({
          success: false,
          message: "Graph not found"
        });
      }

      // Check if the graph belongs to the authenticated user
      if (graph.userId !== req.session.userId) {
        return res.status(403).json({
          success: false,
          message: "Access denied: You don't have permission to create an assistant for this graph"
        });
      }

      // Extract provider from request
      const { provider = 'openai' } = req.body;
      
      // Check if the model/provider is supported
      if (!['openai', 'mistral'].includes(provider.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: `Unsupported provider: ${provider}. Please use 'openai' or 'mistral'.`
        });
      }

      // Use the user's API key from the database
      const userApiKey = await app.locals.storage.getActiveApiKey(provider.toLowerCase(), req.session.userId);
      
      // Check if the user has a valid API key
      if (!userApiKey) {
        return res.status(400).json({
          success: false,
          message: `No ${provider} API key found for your account. Please add an API key in the Settings page.`,
          requiresApiKey: true
        });
      }

      // Create the assistant with the user's API key
      const graphAnalyzer = await import('./graph-analysis').then(m => m.getGraphAnalyzer());
      console.log(`Creating assistant for graph ${graphId} using ${provider} key for user ${req.session.userId}`);
      const assistant = await graphAnalyzer.createGraphAssistant(graph, userApiKey.key);

      return res.status(200).json({
        success: true,
        data: assistant
      });
    } catch (error) {
      console.error("Error creating assistant:", error);
      
      // Check if this is an API key related error
      const errorMessage = error instanceof Error ? error.message : "Error creating assistant";
      const isApiKeyError = errorMessage.toLowerCase().includes('api key') || 
                          errorMessage.toLowerCase().includes('auth') || 
                          errorMessage.toLowerCase().includes('401');
                          
      return res.status(500).json({
        success: false,
        message: errorMessage,
        requiresApiKey: isApiKeyError,
        errorDetails: {
          errorType: isApiKeyError ? "api_key_error" : "ai_processing_error"
        }
      });
    }
  });

  apiRouter.post("/graphs/assistant-message", async (req, res) => {
    try {
      // Check if the user is authenticated
      if (!req.session || !req.session.isAuthenticated) {
        return res.status(401).json({
          success: false,
          message: "Authentication required"
        });
      }

      // Validate the required parameters
      const { message, assistantId, threadId, model = 'openai' } = req.body;
      
      // Check required fields
      if (!message || !assistantId || !threadId) {
        return res.status(400).json({
          success: false,
          message: "Message, assistantId, and threadId are required"
        });
      }
      
      // Check if the model/provider is supported
      if (!['openai'].includes(model.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: `Unsupported model: ${model}. Currently only OpenAI assistants are supported.`
        });
      }

      // Use the user's API key from the database
      const userApiKey = await app.locals.storage.getActiveApiKey(model.toLowerCase(), req.session.userId);
      
      // Check if the user has a valid API key
      if (!userApiKey) {
        return res.status(400).json({
          success: false,
          message: `No ${model} API key found for your account. Please add an API key in the Settings page.`,
          requiresApiKey: true
        });
      }

      // Send message to assistant using the GraphAnalyzer service
      const graphAnalyzer = await import('./graph-analysis').then(m => m.getGraphAnalyzer());
      console.log(`Sending message to assistant using ${model} key for user ${req.session.userId}`);
      const response = await graphAnalyzer.sendMessageToAssistant(message, assistantId, threadId, userApiKey.key);

      return res.status(200).json({
        success: true,
        data: response
      });
    } catch (error) {
      console.error("Error sending message to assistant:", error);
      
      // Check if this is an API key related error
      const errorMessage = error instanceof Error ? error.message : "Error sending message";
      const isApiKeyError = errorMessage.toLowerCase().includes('api key') || 
                          errorMessage.toLowerCase().includes('auth') || 
                          errorMessage.toLowerCase().includes('401');
                          
      return res.status(500).json({
        success: false,
        message: errorMessage,
        requiresApiKey: isApiKeyError,
        errorDetails: {
          errorType: isApiKeyError ? "api_key_error" : "ai_processing_error"
        }
      });
    }
  });

  apiRouter.post("/graphs/merge", async (req, res) => {
    try {
      // Extract basic fields from request body
      const { 
        graphIds, 
        newName, 
        similarityThreshold, 
        algorithm,
        approvedEntities,
        approvedRelationships 
      } = req.body;
      
      // Validate base required fields
      mergeGraphsSchema.parse({ graphIds, newName, similarityThreshold, algorithm });
      
      // Validate that we have at least 2 graphs
      if (graphIds.length < 2) {
        return res.status(400).json({
          success: false,
          message: "At least 2 graphs are required for merging"
        });
      }
      
      // Check if the required API key for the algorithm is available
      const keyCheck = checkAlgorithmApiKey(algorithm);
      if (!keyCheck.success) {
        return res.status(400).json({
          success: false,
          message: keyCheck.message
        });
      }
      
      try {
        // Check if we're using the approved entities/relationships workflow
        if (approvedEntities && approvedRelationships) {
          // Get all the graphs to be merged
          const graphs = await Promise.all(
            graphIds.map((id: number) => app.locals.storage.getGraph(id))
          );
          
          // Filter out any undefined graphs
          const validGraphs = graphs.filter(g => g !== undefined) as Graph[];
          
          // Make sure we still have at least 2 valid graphs
          if (validGraphs.length < 2) {
            return res.status(400).json({
              success: false,
              message: "At least 2 valid graphs are required for merging"
            });
          }
          
          // Import the enhanced merge function
          const { enhancedMergeGraphs } = await import('./enhanced-merge');
          
          // Use the enhancedMergeGraphs with approved entities and relationships
          console.log('Using approved entities from review');
          const result = await enhancedMergeGraphs(
            validGraphs,
            newName,
            similarityThreshold,
            algorithm,
            getApiKeyForAlgorithm(algorithm),
            { 
              approvedEntities: approvedEntities.map((entity: any) => {
                // For single entity items, they don't need merging, so mark them as approved
                // For multi-entity items, respect the user's approval decision
                return {
                  ...entity,
                  approved: entity.originalIds.length === 1 ? true : !!entity.approved
                };
              }),
              approvedRelationships: approvedRelationships.map((rel: any) => {
                // Only include relationships that have been explicitly approved
                return {
                  ...rel,
                  approved: !!rel.approved
                };
              })
            }
          );
          
          // Create a new graph record with the merged result
          const nodes = result.mergedGraph.nodes || [];
          const links = result.mergedGraph.links || [];
          
          const newGraph = await app.locals.storage.createGraph({
            name: newName,
            nodes: nodes,
            links: links,
            inputText: result.mergedGraph.inputText || '',
            entityCount: Array.isArray(nodes) ? nodes.length : 0,
            relationCount: Array.isArray(links) ? links.length : 0,
            createdAt: new Date().toISOString(),
            userId: req.session && req.session.isAuthenticated ? req.session.userId : null
          });

          // CMF lineage log (fire-and-forget)
          cmfService.logMerge({
            inputGraphIds:       graphIds,
            mergedGraphId:       newGraph.id,
            mergedGraphName:     newName,
            algorithm:           algorithm || 'enhanced',
            similarityThreshold: similarityThreshold || 0.8,
            originalNodeCount:   result.mergeStats?.originalNodeCount || 0,
            mergedNodeCount:     nodes.length,
            unifiedEntities:     result.mergeStats?.unifiedEntities?.length || 0,
            newRelationships:    result.mergeStats?.newLinks || 0,
            userId:              req.session.userId,
          });

          return res.status(200).json({
            success: true,
            data: {
              graphId: newGraph.id,
              name: newGraph.name,
              entityCount: newGraph.entityCount,
              relationCount: newGraph.relationCount,
              stats: result.mergeStats,
              createdAt: newGraph.createdAt
            }
          });
        } else {
          // Traditional merge through storage interface
          const result = await app.locals.storage.mergeGraphs(
            graphIds, 
            newName, 
            similarityThreshold,
            algorithm,
            getApiKeyForAlgorithm(algorithm)
          );
          
          return res.status(200).json({
            success: true,
            data: {
              graphId: result.graph.id,
              name: result.graph.name,
              entityCount: result.graph.entityCount,
              relationCount: result.graph.relationCount,
              stats: result.mergeStats,
              createdAt: result.graph.createdAt
            }
          });
        }
      } catch (mergeError) {
        console.error("Error merging graphs:", mergeError);
        return res.status(400).json({
          success: false,
          message: mergeError instanceof Error ? mergeError.message : "Error merging graphs"
        });
      }
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          success: false, 
          message: validationError.message
        });
      }
      
      console.error("Error in merge graphs endpoint:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred while merging graphs"
      });
    }
  });
  
  // API Key Management Endpoints
  apiRouter.get("/api-keys/:provider", async (req, res) => {
    try {
      const { provider } = req.params;
      
      if (!provider) {
        return res.status(400).json({
          success: false,
          message: "Provider parameter is required"
        });
      }
      
      // Only return API keys for the authenticated user or all keys for admins
      let apiKeys;
      
      if (req.session && req.session.isAuthenticated) {
        // Check if user is admin
        const user = await app.locals.storage.getUser(req.session.userId);
        if (user && user.isAdmin) {
          // Admin can see all keys
          apiKeys = await app.locals.storage.getApiKeysByProvider(provider);
        } else {
          // Regular user can only see their own keys
          apiKeys = await app.locals.storage.getApiKeysByProviderAndUser(provider, req.session.userId);
        }
      } else {
        // No authenticated user, return empty array
        apiKeys = [];
      }
      
      // Mask the key values for security
      const maskedKeys = apiKeys.map((key: any) => ({
        ...key,
        key: `${key.key.substring(0, 4)}...${key.key.substring(key.key.length - 4)}`
      }));
      
      return res.status(200).json({
        success: true,
        data: maskedKeys
      });
    } catch (error) {
      console.error("Error fetching API keys:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred while fetching API keys"
      });
    }
  });
  
  // Endpoint to check API key balance
  apiRouter.get("/api-keys/:provider/:id/balance", async (req, res) => {
    try {
      const { provider, id } = req.params;
      
      if (!provider || !id) {
        return res.status(400).json({
          success: false,
          message: "Provider and API key ID are required"
        });
      }
      
      const keyId = parseInt(id);
      if (isNaN(keyId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid API key ID"
        });
      }
      
      // Get the API key
      const apiKey = await app.locals.storage.getApiKeyById(keyId);
      
      if (!apiKey) {
        return res.status(404).json({
          success: false,
          message: `API key with ID ${keyId} not found`
        });
      }
      
      // Check if the provider matches
      if (apiKey.provider !== provider) {
        return res.status(400).json({
          success: false,
          message: `API key with ID ${keyId} is not for provider ${provider}`
        });
      }
      
      let balance = null;
      let error = null;
      
      try {
        // Check balance based on provider
        if (provider === 'openai') {
          const openai = new OpenAI({ apiKey: apiKey.key });
          
          try {
            // First try to get billing info
            // Check if organization is available
            let response;
            if (openai.organization) {
              try {
                // @ts-ignore - TypeScript doesn't know about this method
                response = await openai.organizations.retrieve(openai.organization);
              } catch (err) {
                console.log("Could not retrieve organization info:", err);
              }
            }
            
            // Get credit balance if it exists
            if (response && response.usage_object) {
              balance = {
                totalCredits: response.usage_object.hard_limit_usd,
                usedCredits: response.usage_object.total_usage / 100, // Convert from cents to dollars
                remainingCredits: response.usage_object.hard_limit_usd - (response.usage_object.total_usage / 100)
              };
            } else {
              // Alternate method - make a small API call to verify key is working
              await openai.models.list();
              balance = {
                status: "Active",
                message: "API key is valid. Usage data not available for this key/organization."
              };
            }
          } catch (error) {
            console.error("Error checking OpenAI balance:", error);
            balance = {
              status: "Error",
              message: "Failed to retrieve balance information. API key may be invalid or organization doesn't expose usage data."
            };
          }
        } else if (provider === 'anthropic') {
          const anthropic = new Anthropic({ apiKey: apiKey.key });
          // Anthropic doesn't have a direct balance check endpoint
          // Let's use a lightweight request to verify the key is working
          try {
            await anthropic.messages.create({
              model: "claude-3-haiku-20240307",
              max_tokens: 1,
              messages: [{ role: "user", content: "Test" }]
            });
            
            balance = {
              status: "Active",
              message: "Anthropic doesn't provide direct balance information. Key is valid and active."
            };
          } catch (error) {
            console.error("Error checking Anthropic API key:", error);
            balance = {
              status: "Error",
              message: "Failed to validate Anthropic API key."
            };
          }
        } else if (provider === 'cohere') {
          // Cohere doesn't have a direct balance check endpoint
          // We could make a lightweight request to verify the key is valid
          balance = {
            status: "Unknown",
            message: "Balance checking not currently supported for Cohere. Please check your account on their website."
          };
        }
        
        // Update last used timestamp for the API key
        await app.locals.storage.updateApiKeyLastUsed(keyId, new Date().toISOString());
        
        return res.status(200).json({
          success: true,
          data: {
            provider,
            keyId,
            balance
          }
        });
      } catch (balanceError) {
        console.error(`Error checking ${provider} API key balance:`, balanceError);
        
        return res.status(200).json({
          success: false,
          data: {
            provider,
            keyId,
            error: balanceError instanceof Error ? balanceError.message : `Failed to check ${provider} API key balance`
          }
        });
      }
    } catch (error) {
      console.error("Error checking API key balance:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred while checking API key balance"
      });
    }
  });
  
  // Endpoint to get a single API key with the full (unmasked) key value
  apiRouter.get("/api-keys/:provider/active", async (req, res) => {
    try {
      const { provider } = req.params;
      
      if (!provider) {
        return res.status(400).json({
          success: false,
          message: "Provider parameter is required"
        });
      }
      
      // Get the most recently added key for the provider and user if authenticated
      let activeKey;
      
      if (req.session && req.session.isAuthenticated) {
        // Get active key for this user
        activeKey = await app.locals.storage.getActiveApiKey(provider, req.session.userId);
        
        // If no user-specific key is found, fall back to checking if user is admin
        if (!activeKey) {
          const user = await app.locals.storage.getUser(req.session.userId);
          if (user && user.isAdmin) {
            // Admin can use any key
            activeKey = await app.locals.storage.getActiveApiKey(provider);
          }
        }
      } else {
        // For unauthenticated users, check if there's a "system" key (not associated with any user)
        const keys = await app.locals.storage.getApiKeysByProvider(provider);
        const systemKeys = keys.filter((key: any) => key.userId === null);
        
        if (systemKeys.length > 0) {
          // Sort by newest first
          activeKey = systemKeys.sort((a: any, b: any) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          })[0];
        }
      }
      
      if (!activeKey) {
        return res.status(404).json({
          success: false,
          message: `No API key found for provider: ${provider}`
        });
      }
      
      // Return the active key with the full key value
      return res.status(200).json({
        success: true,
        data: activeKey
      });
    } catch (error) {
      console.error("Error fetching active API key:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred while fetching API key"
      });
    }
  });
  
  apiRouter.post("/api-keys", async (req, res) => {
    try {
      const { provider, key, label } = req.body;
      
      if (!provider || !key) {
        return res.status(400).json({
          success: false,
          message: "Provider and key are required"
        });
      }
      
      // Get the user ID from the session
      const userId = req.session && req.session.isAuthenticated ? req.session.userId : null;
      
      // Create the API key with user association
      const apiKey = await app.locals.storage.createApiKey({
        provider,
        key,
        label: label || null,
        userId: userId, // Associate with the authenticated user
        createdAt: new Date().toISOString(),
        lastUsed: null
      });
      
      // Update the cached key for immediate use
      const { updateApiKey } = await import('./helper/algorithm-key-check');
      updateApiKey(provider, key);
      
      // Mask the key in the response
      const maskedKey = {
        ...apiKey,
        key: `${apiKey.key.substring(0, 4)}...${apiKey.key.substring(apiKey.key.length - 4)}`
      };
      
      return res.status(201).json({
        success: true,
        data: maskedKey
      });
    } catch (error) {
      console.error("Error creating API key:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred while creating API key"
      });
    }
  });
  
  apiRouter.delete("/api-keys/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid API key ID"
        });
      }
      
      // Get the API key before deleting to know its provider
      const apiKey = await app.locals.storage.getApiKey(id);
      if (!apiKey) {
        return res.status(404).json({
          success: false,
          message: `API key with ID ${id} not found`
        });
      }
      
      // Check if the user is authorized to delete this key
      // Only the key owner or an admin can delete the key
      if (req.session && req.session.isAuthenticated) {
        // If the key has a userId and it doesn't match the current user
        if (apiKey.userId && apiKey.userId !== req.session.userId) {
          // Check if the user is an admin
          const user = await app.locals.storage.getUser(req.session.userId);
          if (!user || !user.isAdmin) {
            return res.status(403).json({
              success: false,
              message: "You do not have permission to delete this API key"
            });
          }
        }
      } else {
        // Unauthenticated users can only delete keys that don't have a userId (null)
        if (apiKey.userId !== null) {
          return res.status(403).json({
            success: false,
            message: "Authentication required to delete this API key"
          });
        }
      }
      
      const deleted = await app.locals.storage.deleteApiKey(id);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: `API key with ID ${id} not found`
        });
      }
      
      // Check if there are other keys for this provider
      const remainingKeys = await app.locals.storage.getApiKeysByProvider(apiKey.provider);
      
      // Update the cached key
      const { updateApiKey } = await import('./helper/algorithm-key-check');
      if (remainingKeys.length > 0) {
        // Sort by newest first
        const sortedKeys = [...remainingKeys].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        updateApiKey(apiKey.provider, sortedKeys[0].key);
      } else {
        // No keys left for this provider
        updateApiKey(apiKey.provider, undefined);
      }
      
      return res.status(200).json({
        success: true,
        message: `API key with ID ${id} deleted successfully`
      });
    } catch (error) {
      console.error("Error deleting API key:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred while deleting API key"
      });
    }
  });
  
  // Create an OpenAI assistant for the graph
  
  // NEW ENDPOINTS FOR MULTIMODAL PAGE
  
  // Create a new OpenAI Assistant for multimodal analysis
  apiRouter.post("/assistant/create", async (req, res) => {
    try {
      // Validate the required parameters
      const { apiKey, name, instructions } = req.body;
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          message: "OpenAI API key is required for creating an assistant",
          requiresApiKey: true
        });
      }
      
      // Create an OpenAI client
      const openai = new OpenAI({ apiKey });
      
      try {
        // Create a new assistant
        const assistant = await openai.beta.assistants.create({
          name: name || "Knowledge Graph Assistant",
          instructions: instructions || "You are a knowledgeable assistant that helps users understand and build knowledge graphs.",
          model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
          tools: [{
            type: "function",
            function: {
              name: "extract_knowledge_graph",
              description: "Extract entities and relationships from text to create a knowledge graph",
              parameters: {
                type: "object",
                properties: {
                  nodes: {
                    type: "array",
                    description: "List of entities extracted from the text",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Name of the entity" },
                        type: { type: "string", description: "Type of the entity (person, organization, location, concept, etc.)" },
                        group: { type: "integer", description: "Group number for categorizing the entity (1-5)" }
                      },
                      required: ["name"]
                    }
                  },
                  links: {
                    type: "array",
                    description: "List of relationships between entities",
                    items: {
                      type: "object",
                      properties: {
                        source: { type: "integer", description: "Index of the source entity in the nodes array (0-based)" },
                        target: { type: "integer", description: "Index of the target entity in the nodes array (0-based)" },
                        relationship: { type: "string", description: "Description of the relationship between entities" }
                      },
                      required: ["source", "target"]
                    }
                  }
                },
                required: ["nodes", "links"]
              }
            }
          }]
        });
        
        // Create a new thread for the assistant
        const thread = await openai.beta.threads.create();
        
        return res.status(200).json({
          success: true,
          data: {
            assistantId: assistant.id,
            threadId: thread.id
          }
        });
      } catch (apiError) {
        console.error("OpenAI API Error:", apiError);
        const errorMessage = apiError instanceof Error ? apiError.message : "Unknown OpenAI API error";
        const isApiKeyError = errorMessage.toLowerCase().includes('api key') || 
                            errorMessage.toLowerCase().includes('auth') || 
                            errorMessage.toLowerCase().includes('401');
        
        return res.status(400).json({
          success: false,
          message: errorMessage,
          requiresApiKey: isApiKeyError,
          errorDetails: {
            errorType: isApiKeyError ? "api_key_error" : "ai_processing_error"
          }
        });
      }
    } catch (error) {
      console.error("Error creating assistant:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred while creating assistant"
      });
    }
  });
  
  // Send a message to an assistant and get the response
  apiRouter.post("/assistant/message", async (req, res) => {
    try {
      // Validate the required parameters
      const { apiKey, assistantId, threadId, message, useEnvKey, provider = 'openai' } = req.body;
      
      // Check required message, assistantId, and threadId
      if (!assistantId || !threadId || !message) {
        return res.status(400).json({
          success: false,
          message: "Assistant ID, thread ID, and message are required"
        });
      }
      
      // Determine which API key to use
      let keyToUse = apiKey;
      
      // If useEnvKey is true or no apiKey provided, try to use environment variable
      if (useEnvKey || !keyToUse || keyToUse === "use_env_key") {
        // Choose the appropriate environment variable based on provider
        if (provider === 'mistral') {
          keyToUse = process.env.MISTRAL_API_KEY;
          console.log('Using Mistral API key from environment variable for assistant message');
        } else {
          keyToUse = process.env.OPENAI_API_KEY;
          console.log('Using OpenAI API key from environment variable for assistant message');
        }
      }
      
      // Final check for API key
      if (!keyToUse) {
        return res.status(400).json({
          success: false,
          message: `${provider === 'mistral' ? 'Mistral' : 'OpenAI'} API key is required for the assistant`,
          requiresApiKey: true
        });
      }
      
      // Create an OpenAI client
      const openai = new OpenAI({ apiKey: keyToUse });
      
      try {
        // Add the user message to the thread
        await openai.beta.threads.messages.create(threadId, {
          role: "user",
          content: message
        });
        
        // Run the assistant
        const run = await openai.beta.threads.runs.create(threadId, {
          assistant_id: assistantId
        });
        
        // Poll for completion with a longer timeout for complex analysis
        let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
        
        // Wait for the run to complete with a timeout
        const startTime = Date.now();
        const TIMEOUT_MS = 60000; // 60 second timeout for complex analyses
        
        while (runStatus.status !== "completed" && runStatus.status !== "failed" && 
               runStatus.status !== "cancelled" && runStatus.status !== "expired") {
          // Check for timeout
          if (Date.now() - startTime > TIMEOUT_MS) {
            return res.status(408).json({
              success: false,
              message: "Request timed out waiting for assistant response"
            });
          }
          
          // Wait a bit before checking again
          await new Promise(resolve => setTimeout(resolve, 1000));
          runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
        }
        
        // Check if the run completed successfully
        if (runStatus.status !== "completed") {
          return res.status(500).json({
            success: false,
            message: `Assistant run ${runStatus.status}: ${runStatus.last_error?.message || "Unknown error"}`
          });
        }
        
        // Get the assistant's messages
        const messages = await openai.beta.threads.messages.list(threadId);
        
        // Find the last assistant message
        const assistantMessages = messages.data.filter(msg => msg.role === "assistant");
        if (assistantMessages.length === 0) {
          return res.status(404).json({
            success: false,
            message: "No assistant response found"
          });
        }
        
        const lastMessage = assistantMessages[0];
        let messageContent = '';
        
        // Extract the message content
        if (lastMessage.content && lastMessage.content.length > 0) {
          const contentBlock = lastMessage.content[0];
          if (contentBlock.type === 'text') {
            messageContent = contentBlock.text.value;
          }
        }
        
        return res.status(200).json({
          success: true,
          data: {
            messageId: lastMessage.id,
            content: messageContent
          }
        });
      } catch (apiError) {
        console.error("OpenAI API Error:", apiError);
        const errorMessage = apiError instanceof Error ? apiError.message : "Unknown OpenAI API error";
        const isApiKeyError = errorMessage.toLowerCase().includes('api key') || 
                            errorMessage.toLowerCase().includes('auth') || 
                            errorMessage.toLowerCase().includes('401');
        
        return res.status(400).json({
          success: false,
          message: errorMessage,
          requiresApiKey: isApiKeyError,
          errorDetails: {
            errorType: isApiKeyError ? "api_key_error" : "ai_processing_error"
          }
        });
      }
    } catch (error) {
      console.error("Error sending message to assistant:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred while communicating with assistant"
      });
    }
  });
  // NOTE: The create-assistant endpoint is already implemented at line ~2407
  // with proper authentication and user-specific API key validation
  
  // The assistant-message endpoint is now implemented at line ~2357
  // This duplicate implementation has been removed

  // Extract knowledge graph from web
  apiRouter.post("/extract/web", async (req, res) => {
    try {
      const { url, sourceSystem, apiKey, model } = req.body;
      
      if (!url || !sourceSystem) {
        return res.status(400).json({
          success: false,
          message: "URL and source system are required"
        });
      }
      
      // Get the appropriate API key based on the model
      let selectedApiKey = apiKey;
      if (!selectedApiKey) {
        if (model === 'mistral') {
          // Try to get the Mistral API key from the database
          try {
            const mistralKey = await app.locals.storage.getActiveApiKey('mistral');
            if (mistralKey && mistralKey.key) {
              selectedApiKey = mistralKey.key;
              console.log("Using Mistral API key from database");
            } else {
              selectedApiKey = process.env.MISTRAL_API_KEY;
              console.log("Using Mistral API key from environment");
            }
          } catch (error) {
            console.error("Error getting Mistral API key:", error);
            selectedApiKey = process.env.MISTRAL_API_KEY;
          }
          
          if (!selectedApiKey) {
            return res.status(500).json({
              success: false,
              message: "Failed to extract from web: API key is required for MistralAI"
            });
          }
        } else {
          // Default to OpenAI - try to get from database first
          try {
            const openaiKey = await app.locals.storage.getActiveApiKey('openai');
            if (openaiKey && openaiKey.key) {
              selectedApiKey = openaiKey.key;
              console.log("Using OpenAI API key from database");
            } else {
              selectedApiKey = process.env.OPENAI_API_KEY;
              console.log("Using OpenAI API key from environment");
            }
          } catch (error) {
            console.error("Error getting OpenAI API key:", error);
            selectedApiKey = process.env.OPENAI_API_KEY;
          }
        }
      }
      
      // Create extraction service with storage and API key
      const extractionService = getExtractionService(app.locals.storage, selectedApiKey, model);
      
      // Extract from web
      const result = await extractionService.extractFromWeb(url, sourceSystem, model);
      
      // Update the graph with the user ID from the session if authenticated
      if (req.session && req.session.isAuthenticated && req.session.userId && result.graphId) {
        try {
          // Update the graph to set the user ID
          await app.locals.storage.updateGraphOwner(result.graphId, req.session.userId);
          console.log(`Updated graph ${result.graphId} with user ID ${req.session.userId}`);
        } catch (updateError) {
          console.error(`Failed to update graph owner: ${updateError}`);
        }
      }
      
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error("Error extracting from web:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred during web extraction"
      });
    }
  });

  // Extract knowledge graph from file
  apiRouter.post("/extract/file", fileUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file provided"
        });
      }
      
      let fileType = req.body.fileType;
      const apiKey = req.body.apiKey;
      const model = req.body.model || 'openai';
      
      if (!fileType) {
        // Try to determine file type from MIME type as fallback
        const mimeType = req.file.mimetype;
        if (mimeType.includes('pdf')) {
          fileType = 'pdf';
        } else if (mimeType.includes('image')) {
          fileType = 'image';
        } else if (mimeType.includes('csv') || mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
          fileType = 'csv';
        } else if (mimeType.includes('text')) {
          fileType = 'txt';
        } else {
          return res.status(400).json({
            success: false,
            message: "File type is required and could not be determined automatically"
          });
        }
      }
      
      console.log(`Processing ${fileType} file: ${req.file.originalname} (${Math.round(req.file.size/1024)}KB) with model: ${model}`);
      
      // Create extraction service with storage, API key, and model
      const extractionService = getExtractionService(app.locals.storage, apiKey || process.env.OPENAI_API_KEY, model);
      
      // Extract from file
      const result = await extractionService.extractFromFile(req.file.path, fileType);
      
      // Update the graph with the user ID from the session if authenticated
      if (req.session && req.session.isAuthenticated && req.session.userId && result.graphId) {
        try {
          // Update the graph to set the user ID
          await app.locals.storage.updateGraphOwner(result.graphId, req.session.userId);
          console.log(`Updated graph ${result.graphId} with user ID ${req.session.userId}`);
        } catch (updateError) {
          console.error(`Failed to update graph owner: ${updateError}`);
        }
      }
      
      // Extract the text from the relevant fields for PDF and image files
      let extractedText = "";
      if (fileType === 'pdf' || fileType === 'image') {
        // Get the actual extracted text from the inputText field which now contains
        // the OCR/PDF content instead of just metadata
        extractedText = result.graph.inputText || "";
        
        // Make sure we're returning actual content to the client
        if (!extractedText || extractedText.startsWith('Extracted from file:')) {
          console.log('Warning: inputText contains metadata instead of actual content');
          
          // Last resort fallback if we somehow still have metadata text
          if (fileType === 'pdf') {
            extractedText = "PDF content extracted - please try again";
          } else if (fileType === 'image') {
            extractedText = "Image OCR content extracted - please try again";
          }
        }
        
        console.log(`Including extracted ${fileType} text in response (${extractedText.length} chars): ${extractedText.substring(0, 100)}...`);
      }
      
      // Clean up the uploaded file after processing
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(200).json({
        success: true,
        data: result,
        text: extractedText, // Include the extracted text in the response
        ocrProcessed: result.graph.ocrProcessed || false, // Include OCR status
        documentType: fileType
      });
    } catch (error) {
      console.error("Error extracting from file:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred during file extraction"
      });
    }
  });

  // Mount the API router
  // Extract knowledge graph from URL
  apiRouter.post("/extract/url", async (req, res) => {
    try {
      const { url, sourceSystem, model } = req.body;
      
      if (!url) {
        return res.status(400).json({
          success: false,
          message: "URL is required"
        });
      }
      
      // Validate URL format
      try {
        new URL(url); // This will throw if the URL is invalid
      } catch (urlError) {
        return res.status(400).json({
          success: false,
          message: "Invalid URL format. Please ensure the URL includes the protocol (http:// or https://)"
        });
      }
      
      // Create extraction service with storage, API key from env, and specified model
      const apiKey = req.body.apiKey || process.env.OPENAI_API_KEY;
      const selectedModel = model || 'openai';
      const extractionService = getExtractionService(app.locals.storage, apiKey, selectedModel);
      
      // Extract from web - Make sure sourceSystem is a string to prevent toLowerCase errors
      const system = sourceSystem && typeof sourceSystem === 'string' ? sourceSystem : 'general';
      
      console.log(`Extracting knowledge graph from URL: ${url} using source system: ${system} and model: ${selectedModel}`);
      const result = await extractionService.extractFromWeb(url, system, selectedModel);
      
      // Update the graph with the user ID from the session if authenticated
      if (req.session && req.session.isAuthenticated && req.session.userId && result.graphId) {
        try {
          // Update the graph to set the user ID
          await app.locals.storage.updateGraphOwner(result.graphId, req.session.userId);
          console.log(`Updated graph ${result.graphId} with user ID ${req.session.userId}`);
        } catch (updateError) {
          console.error(`Failed to update graph owner: ${updateError}`);
        }
      }
      
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error("Error in /extract/url endpoint:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred during extraction"
      });
    }
  });

  // Extract knowledge graph from text
  apiRouter.post("/extract/text", async (req, res) => {
    try {
      const { text, title } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({
          success: false,
          message: "Text content is required and must be a string"
        });
      }
      
      // Create AI service with OpenAI
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          message: "OpenAI API key is required for text extraction"
        });
      }
      
      const aiService = createAIService('openai', apiKey);
      
      // Process the text and extract knowledge graph
      const graph = await aiService.processText(text);
      
      // Store the graph in the database
      const graphName = title || `Text Extract (${new Date().toISOString()})`;
      const insertedGraph = await app.locals.storage.createGraph({
        name: graphName,
        inputText: text.substring(0, 500) + (text.length > 500 ? '...' : ''),
        nodes: graph.nodes || [],
        links: graph.links || [],
        entityCount: graph.nodes?.length || 0,
        relationCount: graph.links?.length || 0,
        createdAt: new Date().toISOString(),
        userId: req.session && req.session.isAuthenticated ? req.session.userId : null
      });
      
      // Generate stats for the response
      const stats = {
        entityCount: graph.nodes.length,
        relationCount: graph.links.length,
        sourceType: 'TEXT',
        processingTime: 0, // Not tracked in this implementation
        sourceName: graphName,
        topEntities: [],
        topRelations: []
      };
      
      return res.status(200).json({
        success: true,
        data: {
          graph: {
            ...insertedGraph,
            nodes: graph.nodes,
            links: graph.links
          },
          stats,
          graphId: insertedGraph.id
        }
      });
    } catch (error) {
      console.error("Error in /extract/text endpoint:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred during extraction"
      });
    }
  });

  // ===== Authentication Routes =====
  
  // Get signup enabled status (public API)
  apiRouter.get("/auth/signup-enabled", async (req, res) => {
    try {
      // Get the setting directly instead of using isSignupEnabled()
      const setting = await app.locals.storage.getSetting(SYSTEM_SETTINGS.SIGNUP_ENABLED);
      
      // Default to enabled if no setting exists (consistent with admin API)
      const value = setting ? setting.value : 'true';
      const isEnabled = value === 'true';
      
      console.log('Signup enabled status:', { setting, value, isEnabled });
      
      return res.json({
        success: true,
        data: { enabled: isEnabled }
      });
    } catch (error) {
      console.error('Error checking if signup is enabled:', error);
      return res.status(500).json({
        success: false, 
        message: error instanceof Error ? error.message : 'An error occurred checking signup status'
      });
    }
  });
  
  // User signup - optimized for performance
  apiRouter.post("/auth/signup", async (req, res) => {
    try {
      // Check if signups are enabled
      const isSignupEnabled = await app.locals.storage.isSignupEnabled();
      if (!isSignupEnabled) {
        return res.status(403).json({
          success: false,
          message: "User registration is currently disabled."
        });
      }
      
      // Start session setup in parallel with other operations
      const sessionPromise = new Promise<void>((resolve) => {
        req.session.regenerate((err) => {
          if (err) {
            console.error('Session regeneration error:', err);
          }
          resolve();
        });
      });
      
      // Validate the user data
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists (email or username)
      const [existingUserByEmail, existingUserByUsername] = await Promise.all([
        app.locals.storage.getUserByEmail(userData.email),
        app.locals.storage.getUserByUsername(userData.username)
      ]);
      
      if (existingUserByEmail) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }
      
      if (existingUserByUsername) {
        return res.status(400).json({
          success: false,
          message: 'Username already taken'
        });
      }
      
      // Hash the password asynchronously
      const hashedPassword = await hashPassword(userData.password);
      
      const timestamp = new Date().toISOString();
      
      // Create new user
      const userId = await app.locals.storage.createUser({
        ...userData,
        password: hashedPassword,
        createdAt: timestamp,
        lastLogin: timestamp,
        isAdmin: false // Default to non-admin user
      });
      
      // Wait for session setup to complete
      await sessionPromise;
      
      // Set up user session
      req.session.userId = userId;
      req.session.username = userData.username;
      req.session.isAuthenticated = true;
      req.session.isAdmin = false;
      
      // Save session explicitly to ensure it's stored before response
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error('Session save error:', err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
      
      return res.status(201).json({
        success: true,
        data: {
          userId,
          username: userData.username,
          email: userData.email,
          fullName: userData.fullName,
          isAdmin: false
        }
      });
    } catch (error) {
      console.error('Error in signup:', error);
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: fromZodError(error).message
        });
      }
      
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred during signup'
      });
    }
  });
  
  // User login - optimized for performance
  apiRouter.post("/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username/email and password are required'
        });
      }
      
      // Start session setup in parallel with other operations
      const sessionPromise = new Promise<void>((resolve) => {
        req.session.regenerate((err) => {
          if (err) {
            console.error('Session regeneration error:', err);
          }
          resolve();
        });
      });
      
      // Try to get user by email and username in parallel
      const [userByEmail, userByUsername] = await Promise.all([
        app.locals.storage.getUserByEmail(email),
        app.locals.storage.getUserByUsername(email)
      ]);
      
      // Choose which user result to use
      const user = userByEmail || userByUsername;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid username/email or password'
        });
      }
      
      // Verify password asynchronously
      const passwordValid = await verifyPassword(password, user.password);
      if (!passwordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid username/email or password'
        });
      }
      
      // Update last login time
      const loginUpdatePromise = app.locals.storage.updateUserLastLogin(
        user.id, 
        new Date().toISOString()
      );
      
      // Wait for session promise to complete
      await sessionPromise;
      
      // Set up user session
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.isAuthenticated = true;
      req.session.isAdmin = user.isAdmin || false;
      
      // Ensure session is saved before sending response
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error('Session save error:', err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
      
      // Make sure login time update completes
      await loginUpdatePromise;
      
      return res.json({
        success: true,
        data: {
          userId: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          isAdmin: user.isAdmin || false
        }
      });
    } catch (error) {
      console.error('Error in login:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred during login'
      });
    }
  });
  
  // User logout
  apiRouter.post("/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to logout'
        });
      }
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    });
  });
  
  // Get current user
  apiRouter.get("/auth/user", (req, res) => {
    if (req.session.isAuthenticated) {
      return res.json({
        success: true,
        data: {
          userId: req.session.userId,
          username: req.session.username,
          isAdmin: req.session.isAdmin
        }
      });
    } else {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }
  });
  
  // Contact form endpoint
  apiRouter.post("/contact", async (req, res) => {
    try {
      const { name, email, message, subject } = req.body;
      
      // Validate required fields
      if (!name || !email || !message) {
        return res.status(400).json({
          success: false,
          message: "Name, email, and message are required"
        });
      }
      
      // Basic email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format"
        });
      }
      
      // Send email using our email service
      const emailSent = await emailService.sendContactEmail(name, email, message, subject);
      
      if (emailSent) {
        return res.status(200).json({
          success: true,
          message: "Contact form submitted successfully"
        });
      } else {
        // If email failed to send but the service was initialized
        return res.status(500).json({
          success: false,
          message: "Failed to send email. Please try again later."
        });
      }
    } catch (error) {
      console.error('Error submitting contact form:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred'
      });
    }
  });
  
  // ================ ADMIN ROUTES ================
  
  // Get all users (admin only)
  apiRouter.get("/admin/users", isAdmin, async (req, res) => {
    try {
      const users = await app.locals.storage.getAllUsers();
      
      // Don't send password hashes to the client
      const sanitizedUsers = users.map(user => ({
        ...user,
        password: undefined
      }));
      
      return res.json({
        success: true,
        data: sanitizedUsers
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred fetching users'
      });
    }
  });

  // Update user (admin only)
  apiRouter.patch("/admin/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      if (isNaN(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID'
        });
      }
      
      // Verify the user exists
      const user = await app.locals.storage.getUser(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Update the user
      const success = await app.locals.storage.updateUser(userId, req.body);
      
      if (success) {
        // Retrieve the updated user
        const updatedUser = await app.locals.storage.getUser(userId);
        
        return res.json({
          success: true,
          data: {
            ...updatedUser,
            password: undefined // Don't send the password hash
          }
        });
      } else {
        return res.status(500).json({
          success: false,
          message: 'Failed to update user'
        });
      }
    } catch (error) {
      console.error('Error updating user:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred updating user'
      });
    }
  });

  // Delete user (admin only)
  apiRouter.delete("/admin/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      if (isNaN(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID'
        });
      }
      
      // Don't allow deleting yourself
      if (userId === req.session.userId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete your own account'
        });
      }
      
      // Delete the user
      const success = await app.locals.storage.deleteUser(userId);
      
      if (success) {
        return res.json({
          success: true,
          message: 'User deleted successfully'
        });
      } else {
        return res.status(404).json({
          success: false,
          message: 'User not found or could not be deleted'
        });
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred deleting user'
      });
    }
  });
  
  // Get all graphs with user information (admin only)
  apiRouter.get("/admin/graphs", isAdmin, async (req, res) => {
    try {
      const graphs = await app.locals.storage.getAllGraphs();
      
      // Fetch user details for each graph
      const graphsWithUserInfo = await Promise.all(
        graphs.map(async (graph) => {
          let userData = { username: 'Unknown', email: 'unknown' };
          
          try {
            if (graph.userId) {
              const user = await app.locals.storage.getUser(graph.userId);
              if (user) {
                userData = { 
                  username: user.username,
                  email: user.email
                };
              }
            }
          } catch (userError) {
            console.error(`Error fetching user for graph ${graph.id}:`, userError);
          }
          
          return {
            ...graph,
            user: userData
          };
        })
      );
      
      return res.json({
        success: true,
        data: graphsWithUserInfo
      });
    } catch (error) {
      console.error('Error fetching graphs:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred fetching graphs'
      });
    }
  });

  // Get a specific graph (admin only)
  apiRouter.get("/admin/graphs/:id", isAdmin, async (req, res) => {
    try {
      const graphId = parseInt(req.params.id, 10);
      if (isNaN(graphId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid graph ID'
        });
      }
      
      const graph = await app.locals.storage.getGraph(graphId);
      
      if (!graph) {
        return res.status(404).json({
          success: false,
          message: 'Graph not found'
        });
      }
      
      // Get user information if available
      let userData = { username: 'Unknown', email: 'unknown' };
      try {
        if (graph.userId) {
          const user = await app.locals.storage.getUser(graph.userId);
          if (user) {
            userData = { 
              username: user.username,
              email: user.email
            };
          }
        }
      } catch (userError) {
        console.error(`Error fetching user for graph ${graph.id}:`, userError);
      }
      
      return res.json({
        success: true,
        data: {
          ...graph,
          user: userData
        }
      });
    } catch (error) {
      console.error('Error fetching graph:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred fetching graph'
      });
    }
  });

  // Update a graph (admin only)
  apiRouter.patch("/admin/graphs/:id", isAdmin, async (req, res) => {
    try {
      const graphId = parseInt(req.params.id, 10);
      if (isNaN(graphId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid graph ID'
        });
      }
      
      const graph = await app.locals.storage.getGraph(graphId);
      
      if (!graph) {
        return res.status(404).json({
          success: false,
          message: 'Graph not found'
        });
      }
      
      // Handle different update types
      let updatedGraph;
      
      if (req.body.name !== undefined) {
        // Update name
        updatedGraph = await app.locals.storage.updateGraphName(graphId, req.body.name);
      } else if (req.body.nodes !== undefined && req.body.links !== undefined) {
        // Update content
        updatedGraph = await app.locals.storage.updateGraphContent(graphId, req.body.nodes, req.body.links);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid update parameters'
        });
      }
      
      if (!updatedGraph) {
        return res.status(500).json({
          success: false,
          message: 'Failed to update graph'
        });
      }
      
      return res.json({
        success: true,
        data: updatedGraph
      });
    } catch (error) {
      console.error('Error updating graph:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred updating graph'
      });
    }
  });

  // Delete a graph (admin only)
  apiRouter.delete("/admin/graphs/:id", isAdmin, async (req, res) => {
    try {
      const graphId = parseInt(req.params.id, 10);
      if (isNaN(graphId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid graph ID'
        });
      }
      
      const success = await app.locals.storage.deleteGraph(graphId);
      
      if (success) {
        return res.json({
          success: true,
          message: 'Graph deleted successfully'
        });
      } else {
        return res.status(404).json({
          success: false,
          message: 'Graph not found or could not be deleted'
        });
      }
    } catch (error) {
      console.error('Error deleting graph:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred deleting graph'
      });
    }
  });

  // Delete multiple graphs (admin only)
  apiRouter.post("/admin/graphs/delete-multiple", isAdmin, async (req, res) => {
    try {
      if (!Array.isArray(req.body.ids) || req.body.ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Must provide an array of graph IDs'
        });
      }
      
      // Validate IDs
      const graphIds = req.body.ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      
      if (graphIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid graph IDs provided'
        });
      }
      
      const result = await app.locals.storage.deleteMultipleGraphs(graphIds);
      
      return res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error deleting multiple graphs:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred deleting graphs'
      });
    }
  });
  
  // Get system statistics (admin only)
  apiRouter.get("/admin/stats", isAdmin, async (req, res) => {
    try {
      const users = await app.locals.storage.getAllUsers();
      const graphs = await app.locals.storage.getAllGraphs();
      
      // Calculate aggregate statistics
      const totalUsers = users.length;
      const totalGraphs = graphs.length;
      
      // Count graphs by user
      const graphsByUser = users.map(user => {
        const userGraphs = graphs.filter(graph => graph.userId === user.id);
        return {
          userId: user.id,
          username: user.username,
          email: user.email,
          graphCount: userGraphs.length
        };
      }).sort((a, b) => b.graphCount - a.graphCount); // Sort by graph count
      
      // Count total entities and relations
      const totalEntities = graphs.reduce((sum, graph) => sum + (graph.entityCount || 0), 0);
      const totalRelations = graphs.reduce((sum, graph) => sum + (graph.relationCount || 0), 0);
      
      // Date stats
      const now = new Date();
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(now.getMonth() - 1);
      
      const newUsersLastMonth = users.filter(user => {
        const createdDate = new Date(user.createdAt);
        return createdDate >= oneMonthAgo;
      }).length;
      
      const newGraphsLastMonth = graphs.filter(graph => {
        const createdDate = new Date(graph.createdAt);
        return createdDate >= oneMonthAgo;
      }).length;
      
      return res.json({
        success: true,
        data: {
          totalUsers,
          totalGraphs,
          totalEntities,
          totalRelations,
          newUsersLastMonth,
          newGraphsLastMonth,
          graphsByUser: graphsByUser.slice(0, 10), // Top 10 users by graph count
          storageType: app.locals.storage.constructor.name // PostgresStorage or MemStorage
        }
      });
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred fetching admin statistics'
      });
    }
  });

  // System Settings API Endpoints (Admin Only)
  // Get signup enabled setting
  apiRouter.get("/admin/settings/signup-enabled", isAdmin, async (req, res) => {
    try {
      const setting = await app.locals.storage.getSetting(SYSTEM_SETTINGS.SIGNUP_ENABLED);
      
      // Default to enabled if no setting exists
      const value = setting ? setting.value : 'true';
      
      return res.json({
        success: true,
        data: {
          key: SYSTEM_SETTINGS.SIGNUP_ENABLED,
          value,
          description: 'Controls whether new user registration is enabled',
          updatedAt: setting?.updatedAt,
          updatedBy: setting?.updatedBy
        }
      });
    } catch (error) {
      console.error('Error fetching signup setting:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred fetching setting'
      });
    }
  });
  
  // Update signup enabled setting
  apiRouter.post("/admin/settings/signup-enabled", isAdmin, async (req, res) => {
    try {
      const { value } = req.body;
      
      if (typeof value !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Value must be a string'
        });
      }
      
      // Get the existing setting
      let setting = await app.locals.storage.getSetting(SYSTEM_SETTINGS.SIGNUP_ENABLED);
      
      if (!setting) {
        // Create the setting if it doesn't exist
        setting = await app.locals.storage.createSetting({
          key: SYSTEM_SETTINGS.SIGNUP_ENABLED,
          value,
          description: 'Controls whether new user registration is enabled',
          updatedAt: new Date().toISOString(),
          updatedBy: req.session.userId
        });
      } else {
        // Update the existing setting
        setting = await app.locals.storage.updateSetting(
          SYSTEM_SETTINGS.SIGNUP_ENABLED, 
          value, 
          req.session.userId
        );
      }
      
      if (!setting) {
        return res.status(500).json({
          success: false,
          message: 'Failed to update setting'
        });
      }
      
      return res.json({
        success: true,
        data: setting
      });
    } catch (error) {
      console.error('Error updating signup setting:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred updating setting'
      });
    }
  });

  // Ontology Management APIs
  apiRouter.get('/ontologies', async (req, res) => {
    try {
      // Only return ontologies owned by the current user
      const userId = req.session.userId;
      let ontologies;
      
      if (userId) {
        // Get only ontologies created by this user
        ontologies = await app.locals.storage.getOntologiesByUser(userId);
      } else {
        // If not authenticated, return empty array
        ontologies = [];
      }
      
      return res.json({ success: true, data: ontologies });
    } catch (error) {
      console.error('Error fetching ontologies:', error);
      return res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to fetch ontologies' 
      });
    }
  });

  apiRouter.post('/ontologies', async (req, res) => {
    try {
      const ontologyData = req.body;
      
      if (!ontologyData || !ontologyData.name || !ontologyData.entities || !ontologyData.relations) {
        return res.status(400).json({
          success: false,
          message: 'Invalid ontology data: name, entities, and relations are required'
        });
      }

      // Set user ID if authenticated
      if (req.session.userId) {
        ontologyData.userId = req.session.userId;
      }

      // Set creation timestamp if not provided
      if (!ontologyData.createdAt) {
        ontologyData.createdAt = new Date().toISOString();
      }

      // Set update timestamp
      ontologyData.updatedAt = new Date().toISOString();

      const ontology = await app.locals.storage.createOntology(ontologyData);
      
      return res.json({
        success: true,
        data: ontology
      });
    } catch (error) {
      console.error('Error creating ontology:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create ontology'
      });
    }
  });
  
  // Get ontology by ID
  apiRouter.get('/ontologies/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid ontology ID'
        });
      }
      
      const ontology = await app.locals.storage.getOntologyById(id);
      
      if (!ontology) {
        return res.status(404).json({
          success: false,
          message: 'Ontology not found'
        });
      }
      
      return res.json({
        success: true,
        data: ontology
      });
    } catch (error) {
      console.error('Error fetching ontology:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch ontology'
      });
    }
  });
  
  // Update ontology
  apiRouter.put('/ontologies/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid ontology ID'
        });
      }
      
      const ontologyData = req.body;
      
      if (!ontologyData) {
        return res.status(400).json({
          success: false,
          message: 'No update data provided'
        });
      }
      
      // Set update timestamp
      ontologyData.updatedAt = new Date().toISOString();
      
      const updatedOntology = await app.locals.storage.updateOntology(id, ontologyData);
      
      if (!updatedOntology) {
        return res.status(404).json({
          success: false,
          message: 'Ontology not found or update failed'
        });
      }
      
      return res.json({
        success: true,
        data: updatedOntology
      });
    } catch (error) {
      console.error('Error updating ontology:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update ontology'
      });
    }
  });
  
  // Delete ontology
  apiRouter.delete('/ontologies/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid ontology ID'
        });
      }
      
      const success = await app.locals.storage.deleteOntology(id);
      
      if (!success) {
        return res.status(404).json({
          success: false,
          message: 'Ontology not found or delete failed'
        });
      }
      
      return res.json({
        success: true,
        message: 'Ontology deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting ontology:', error);
      return res.status(500).json({
        success: false,
        message: 'An unexpected error occurred while deleting the ontology'
      });
    }
  });
  
  // Duplicate ontology
  apiRouter.post('/ontologies/:id/duplicate', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid ontology ID'
        });
      }
      
      const ontology = await app.locals.storage.getOntologyById(id);
      
      if (!ontology) {
        return res.status(404).json({
          success: false,
          message: 'Ontology not found'
        });
      }
      
      // Create a new ontology based on the existing one
      const duplicateData = {
        ...ontology,
        id: undefined, // Remove ID so a new one is generated
        name: `${ontology.name} (Copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: req.session.userId || null
      };
      
      const newOntology = await app.locals.storage.createOntology(duplicateData);
      
      return res.json({
        success: true,
        data: newOntology
      });
    } catch (error) {
      console.error('Error duplicating ontology:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to duplicate ontology'
      });
    }
  });

  // Generate ontology from prompt
  apiRouter.post('/ontologies/generate', async (req, res) => {
    try {
      const { prompt, model, apiKey } = req.body;
      
      if (!prompt || !model) {
        return res.status(400).json({
          success: false,
          message: 'Prompt and model are required'
        });
      }

      // Import the ontology service
      const { createOntologyService } = await import('./ontology-service');
      
      // Create the ontology service
      const ontologyService = createOntologyService(app.locals.storage);
      
      // Generate the ontology
      const generatedOntology = await ontologyService.generateOntology({
        prompt,
        model,
        apiKey
      });

      // Set user ID if authenticated
      if (req.session.userId) {
        generatedOntology.userId = req.session.userId;
      }

      // CMF lineage log (fire-and-forget)
      cmfService.logOntology({
        ontologyId:   generatedOntology.id || 0,
        ontologyName: generatedOntology.name || '',
        model:        model,
        provider:     model?.includes('gpt') || model === 'openai' ? 'openai'
                      : model?.includes('mistral') ? 'mistral' : model || 'unknown',
        enrichmentType: 'generate',
        classCount:   generatedOntology.classes?.length,
        propertyCount: generatedOntology.properties?.length,
        userId:       req.session.userId,
      });

      return res.json({
        success: true,
        data: generatedOntology
      });
    } catch (error) {
      console.error('Error generating ontology:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate ontology'
      });
    }
  });

  // Upload ontology file
  apiRouter.post('/ontologies/upload', multer({ storage: multerStorage }).single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      const format = req.body.format || 'jsonld';
      const filePath = req.file.path;
      
      // Read the file content
      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      
      // Import the ontology service
      const { createOntologyService } = await import('./ontology-service');
      
      // Create the ontology service
      const ontologyService = createOntologyService(app.locals.storage);
      
      // Parse the ontology file
      const parsedOntology = await ontologyService.parseOntologyFile(fileContent, format);
      
      // Set user ID if authenticated
      if (req.session.userId) {
        parsedOntology.userId = req.session.userId;
      }

      // Save the parsed ontology to the database
      const savedOntology = await app.locals.storage.createOntology(parsedOntology);

      return res.json({
        success: true,
        data: savedOntology
      });
    } catch (error) {
      console.error('Error parsing ontology file:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to parse ontology file'
      });
    }
  });

  // Parse ontology from text input
  apiRouter.post('/ontologies/parse-text', async (req, res) => {
    try {
      const { text, format } = req.body;
      
      if (!text || !text.trim()) {
        return res.status(400).json({
          success: false,
          message: 'No ontology text provided'
        });
      }

      const ontologyFormat = format || 'json-ld';
      
      // Import the ontology service
      const { createOntologyService } = await import('./ontology-service');
      
      // Create the ontology service
      const ontologyService = createOntologyService(app.locals.storage);
      
      // Parse the ontology text
      const parsedOntology = await ontologyService.parseOntologyFile(text, ontologyFormat);
      
      // Set user ID if authenticated
      if (req.session.userId) {
        parsedOntology.userId = req.session.userId;
      }

      // Save the parsed ontology to the database
      const savedOntology = await app.locals.storage.createOntology(parsedOntology);

      return res.json({
        success: true,
        data: savedOntology
      });
    } catch (error) {
      console.error('Error parsing ontology text:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to parse ontology text'
      });
    }
  });

  // Enrich ontology
  apiRouter.post('/ontologies/enrich', async (req, res) => {
    try {
      const { ontology, model, apiKey, enrichmentType = 'ai' } = req.body;
      
      if (!ontology) {
        return res.status(400).json({
          success: false,
          message: 'Ontology is required'
        });
      }
      
      // Model is required for AI enrichment but not for schema.org enrichment
      if (enrichmentType === 'ai' && !model) {
        return res.status(400).json({
          success: false,
          message: 'Model is required for AI-based enrichment'
        });
      }

      // Import the ontology service
      const { createOntologyService } = await import('./ontology-service');
      
      // Create the ontology service
      const ontologyService = createOntologyService(app.locals.storage);
      
      // Enrich the ontology
      const enrichedOntology = await ontologyService.enrichOntology({
        ontology,
        model,
        apiKey,
        enrichmentType
      });

      return res.json({
        success: true,
        data: enrichedOntology
      });
    } catch (error) {
      console.error('Error enriching ontology:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to enrich ontology'
      });
    }
  });
  
  // Schema.org integration endpoint
  // Route to get Schema.org suggestions without applying them
  apiRouter.post('/ontologies/schema-suggest', async (req, res) => {
    try {
      const { 
        ontologyId, 
        mappingType = 'suggested', 
        integrationType = 'extend',
        classes = [] // Array of class names to include
      } = req.body;
      
      if (!ontologyId) {
        return res.status(400).json({
          success: false,
          message: 'Ontology ID is required'
        });
      }
      
      // Get the ontology
      const ontology = await app.locals.storage.getOntology(ontologyId);
      
      if (!ontology) {
        return res.status(404).json({
          success: false,
          message: 'Ontology not found'
        });
      }
      
      // Import the enrichment service
      const { integrateSchemaOrg } = await import('./enrichment-service');
      
      // Call the Schema.org integration function but don't save the changes
      const enrichedOntology = await integrateSchemaOrg(
        ontology, 
        mappingType as any, 
        integrationType as any,
        classes as string[] // Pass the selected classes
      );
      
      // Calculate added entities, relations, and properties
      const originalEntityCount = Array.isArray(ontology.entities) ? ontology.entities.length : 0;
      const originalRelationCount = Array.isArray(ontology.relations) ? ontology.relations.length : 0;
      
      const newEntities = Array.isArray(enrichedOntology.entities)
        ? enrichedOntology.entities.slice(originalEntityCount)
        : [];
        
      const newRelations = Array.isArray(enrichedOntology.relations)
        ? enrichedOntology.relations.slice(originalRelationCount)
        : [];
        
      // Extract properties added to existing entities
      const newProperties = [];
      if (Array.isArray(enrichedOntology.entities) && Array.isArray(ontology.entities)) {
        // For each original entity, compare properties
        for (let i = 0; i < originalEntityCount; i++) {
          const originalEntity = ontology.entities[i];
          const enrichedEntity = enrichedOntology.entities[i];
          
          if (originalEntity && enrichedEntity && 
              Array.isArray(originalEntity.properties) && 
              Array.isArray(enrichedEntity.properties)) {
            // Find properties that were added
            const originalPropCount = originalEntity.properties.length;
            const addedProps = enrichedEntity.properties.slice(originalPropCount);
            
            // Add them to our list with entity context
            addedProps.forEach(prop => {
              newProperties.push({
                entityName: originalEntity.name,
                property: prop
              });
            });
          }
        }
      }
      
      // Return the suggestions without saving them
      return res.json({
        success: true,
        data: {
          entities: newEntities,
          relations: newRelations,
          properties: newProperties,
          entityCount: newEntities.length,
          relationCount: newRelations.length,
          propertyCount: newProperties.length
        }
      });
      
    } catch (error) {
      console.error('Error getting Schema.org suggestions:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred while getting Schema.org suggestions'
      });
    }
  });

  apiRouter.post('/ontologies/schema-integrate', async (req, res) => {
    try {
      const { 
        ontologyId, 
        mappingType = 'suggested', 
        integrationType = 'extend',
        classes = [] // Array of class names to include
      } = req.body;
      
      if (!ontologyId) {
        return res.status(400).json({
          success: false,
          message: 'Ontology ID is required'
        });
      }
      
      // Get the ontology
      const ontology = await app.locals.storage.getOntology(ontologyId);
      
      if (!ontology) {
        return res.status(404).json({
          success: false,
          message: 'Ontology not found'
        });
      }
      
      // Import the enrichment service
      const { integrateSchemaOrg } = await import('./enrichment-service');
      
      // Call the Schema.org integration function
      const enrichedOntology = await integrateSchemaOrg(
        ontology, 
        mappingType as any, 
        integrationType as any,
        classes as string[] // Pass the selected classes
      );
      
      // Count the new entities and relations
      const originalEntityCount = Array.isArray(ontology.entities) ? ontology.entities.length : 0;
      const originalRelationCount = Array.isArray(ontology.relations) ? ontology.relations.length : 0;
      const newEntityCount = Array.isArray(enrichedOntology.entities) ? enrichedOntology.entities.length - originalEntityCount : 0;
      const newRelationCount = Array.isArray(enrichedOntology.relations) ? enrichedOntology.relations.length - originalRelationCount : 0;
      
      // Ensure all required fields are present in the enriched ontology
      const completeOntology = {
        ...ontology,
        ...enrichedOntology,
        updatedAt: new Date().toISOString(),
        // Ensure these fields exist even if they weren't in the original ontology
        description: enrichedOntology.description || ontology.description || null,
        domain: enrichedOntology.domain || ontology.domain || null
      };
      
      // Save the enriched ontology
      const savedOntology = await app.locals.storage.updateOntology(completeOntology.id, completeOntology);
      
      return res.json({
        success: true,
        data: {
          ontology: savedOntology,
          entityCount: newEntityCount,
          relationCount: newRelationCount
        }
      });
    } catch (error) {
      console.error('Error integrating Schema.org:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to integrate Schema.org'
      });
    }
  });
  
  // Generate enrichment suggestions for ontology
  apiRouter.post('/ontologies/enrich-suggestions', async (req, res) => {
    try {
      const { ontologyId, model, focus = 'all', instructions = '', apiKey } = req.body;
      
      if (!ontologyId) {
        return res.status(400).json({
          success: false,
          message: 'Ontology ID is required'
        });
      }
      
      if (!model) {
        return res.status(400).json({
          success: false,
          message: 'Model is required for AI-based enrichment'
        });
      }
      
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          message: 'API key is required for AI-based enrichment'
        });
      }

      // Get the ontology
      const ontology = await app.locals.storage.getOntology(ontologyId);
      
      if (!ontology) {
        return res.status(404).json({
          success: false,
          message: 'Ontology not found'
        });
      }

      // Import the enrichment service
      const { generateEnrichmentSuggestions } = await import('./enrichment-service');
      
      // Generate enrichment suggestions
      const suggestions = await generateEnrichmentSuggestions(
        ontology,
        model as 'openai' | 'mistral',
        focus as 'all' | 'entities' | 'relations' | 'properties',
        instructions,
        apiKey
      );

      return res.json({
        success: true,
        data: suggestions
      });
    } catch (error) {
      console.error('Error generating enrichment suggestions:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate enrichment suggestions'
      });
    }
  });

  // Export ontology
  // Export ontology by direct JSON object (legacy endpoint)
  apiRouter.post('/ontologies/export', async (req, res) => {
    try {
      const { ontology, format } = req.body;
      
      if (!ontology || !format) {
        return res.status(400).json({
          success: false,
          message: 'Ontology and format are required'
        });
      }

      // Import the ontology service
      const { createOntologyService } = await import('./ontology-service');
      
      // Create the ontology service
      const ontologyService = createOntologyService(app.locals.storage);
      
      // Export the ontology
      const exportedContent = await ontologyService.exportOntology(ontology, format);

      return res.json({
        success: true,
        data: exportedContent
      });
    } catch (error) {
      console.error('Error exporting ontology:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to export ontology'
      });
    }
  });
  
  // Export ontology by ID (standard endpoint)
  apiRouter.post('/ontologies/:id/export', async (req, res) => {
    try {
      const { format } = req.body;
      const ontologyId = parseInt(req.params.id, 10);
      
      if (!format) {
        return res.status(400).json({
          success: false,
          message: 'Export format is required'
        });
      }
      
      if (isNaN(ontologyId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid ontology ID'
        });
      }

      // Get the ontology by ID
      const ontology = await app.locals.storage.getOntologyById(ontologyId);
      if (!ontology) {
        return res.status(404).json({
          success: false,
          message: 'Ontology not found'
        });
      }
      
      // Ensure entities and relations are proper arrays
      const normalizedOntology = {
        ...ontology,
        entities: Array.isArray(ontology.entities) 
          ? ontology.entities 
          : (typeof ontology.entities === 'string' 
              ? JSON.parse(ontology.entities) 
              : []),
        relations: Array.isArray(ontology.relations) 
          ? ontology.relations 
          : (typeof ontology.relations === 'string' 
              ? JSON.parse(ontology.relations) 
              : []),
        versions: Array.isArray(ontology.versions) 
          ? ontology.versions 
          : (typeof ontology.versions === 'string' 
              ? JSON.parse(ontology.versions) 
              : [])
      };
      
      // Import the ontology service
      const { createOntologyService } = await import('./ontology-service');
      
      // Create the ontology service
      const ontologyService = createOntologyService(app.locals.storage);
      
      // Export the ontology
      const exportedContent = await ontologyService.exportOntology(normalizedOntology, format);
      
      // Set appropriate content type based on format
      let contentType = 'application/json';
      if (format === 'rdf') {
        contentType = 'application/rdf+xml';
      } else if (format === 'ttl') {
        contentType = 'text/turtle';
      } else if (format === 'json') {
        contentType = 'application/ld+json';
      }
      
      // Send as downloadable file with proper content type
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="ontology.${format}"`);
      return res.send(exportedContent);
    } catch (error) {
      console.error('Error exporting ontology:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to export ontology'
      });
    }
  });
  
  // Convert graph to ontology
  apiRouter.post('/ontologies/convert-from-graph', async (req, res) => {
    try {
      const { graphId, name, domain } = req.body;
      
      if (!graphId) {
        return res.status(400).json({
          success: false,
          message: 'Graph ID is required'
        });
      }

      // Get the graph from storage
      const graph = await app.locals.storage.getGraph(graphId);
      
      if (!graph) {
        return res.status(404).json({
          success: false,
          message: 'Graph not found'
        });
      }
      
      // Import the ontology service
      const { createOntologyService } = await import('./ontology-service');
      
      // Create the ontology service
      const ontologyService = createOntologyService(app.locals.storage);
      
      // Convert graph to ontology
      const ontology = await ontologyService.convertFromGraph(graph, name || graph.name, domain);
      
      // Set user ID if authenticated
      if (req.session.userId) {
        ontology.userId = req.session.userId;
      }
      
      // Set creation timestamp if not provided
      if (!ontology.createdAt) {
        ontology.createdAt = new Date().toISOString();
      }

      // Set update timestamp
      ontology.updatedAt = new Date().toISOString();
      
      // Auto-save the ontology to the database
      const savedOntology = await app.locals.storage.createOntology(ontology);
      
      // Return the saved ontology with the correct ID assigned by the database
      return res.json({
        success: true,
        data: savedOntology
      });
    } catch (error) {
      console.error('Error converting graph to ontology:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to convert graph to ontology'
      });
    }
  });

  // Google Scholar Author Search API
  apiRouter.post('/scholar/author', async (req, res) => {
    try {
      const { authorId, publicationLimit = 10 } = req.body;
      
      if (!authorId) {
        return res.status(400).json({
          success: false,
          message: 'Author ID is required'
        });
      }

      // Validate publication limit (0 means no limit)
      const limit = publicationLimit === 0 ? 0 : Math.min(Math.max(parseInt(publicationLimit), 1), 100);

      // Make request to Google Scholar API via RapidAPI
      const response = await fetch(`https://google-scholar1.p.rapidapi.com/author_details_by_id?author_id=${encodeURIComponent(authorId)}&sortby=year&publication_limit=${limit}`, {
        method: 'GET',
        headers: {
          'x-rapidapi-host': 'google-scholar1.p.rapidapi.com',
          'x-rapidapi-key': '9728cb9555msh5c99df6841b61bfp14f715jsnfebb1f8f8e63'
        }
      });

      if (!response.ok) {
        throw new Error(`Google Scholar API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return res.json(data);
    } catch (error) {
      console.error('Error fetching Google Scholar data:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch author data'
      });
    }
  });

  // Generate Expertise Knowledge Graph from Scholar Data
  apiRouter.post('/scholar/generate-expertise', async (req, res) => {
    try {
      const { authorData } = req.body;
      const userId = req.session?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!authorData || !authorData.result) {
        return res.status(400).json({
          success: false,
          message: 'Author data is required'
        });
      }

      // Get user's OpenAI API key
      const userApiKey = await app.locals.storage.getActiveApiKey('openai', userId);
      if (!userApiKey) {
        return res.status(400).json({
          success: false,
          message: 'OpenAI API key not found. Please add one in Settings.'
        });
      }

      const openai = new OpenAI({ apiKey: userApiKey.key });

      // Prepare data for analysis
      const interests = authorData.result.interests || [];
      const publications = authorData.result.publications || [];
      const publicationTitles = publications.map((pub: any) => pub.bib.title).slice(0, 20); // Limit to first 20

      // Generate expertise knowledge graph with OpenAI
      const prompt = `
Based on the following academic profile data, generate an expertise knowledge graph and biography:

Author: ${authorData.result.name}
Research Interests: ${interests.join(', ')}
Publication Titles: ${publicationTitles.join('; ')}

Please provide a JSON response with the following structure:
{
  "knowledgeGraph": {
    "nodes": [
      {"id": "unique_id", "name": "Topic Name", "type": "topic", "group": 1, "size": 10},
      {"id": "author_id", "name": "${authorData.result.name}", "type": "person", "group": 0, "size": 15}
    ],
    "links": [
      {"source": "author_id", "target": "topic_id", "relationship": "expertise_in", "label": "expertise in", "value": 5}
    ]
  },
  "biography": "A comprehensive biography based on research interests and publications..."
}

Generate nodes for:
1. The author (type: "person", group: 0)
2. Main research topics/domains (type: "topic", group: 1-5)
3. Specific techniques/methods (type: "method", group: 6)
4. Applications/domains (type: "application", group: 7)

Link the author to their areas of expertise with appropriate relationship types like "expertise_in", "researches", "develops", etc.
For each link, include a descriptive "label" field that describes the relationship (e.g., "expertise in", "researches", "developed", "applies").
Ensure the biography is 2-3 sentences describing their research focus and contributions.
`;

      console.log('GPT-4 Prompt for expertise analysis:', prompt);

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
        temperature: 0.7
      });

      let content = response.choices[0].message.content || '{}';
      
      // Remove markdown formatting if present
      if (content.includes('```json')) {
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      }
      
      const result = JSON.parse(content);

      // Save the expertise graph to database
      const graphData = {
        name: `${authorData.result.name} - Expertise Graph`,
        userId: userId,
        inputText: `Generated from Google Scholar profile: ${authorData.result.name}`,
        nodes: result.knowledgeGraph.nodes,
        links: result.knowledgeGraph.links,
        entityCount: result.knowledgeGraph.nodes.length,
        relationCount: result.knowledgeGraph.links.length
      };

      const savedGraph = await app.locals.storage.createGraph(graphData);

      res.json({
        success: true,
        data: {
          knowledgeGraph: result.knowledgeGraph,
          biography: result.biography,
          graphId: savedGraph.id
        }
      });

    } catch (error: any) {
      console.error('Error generating expertise graph:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate expertise knowledge graph'
      });
    }
  });

  // Save Scholar Profile
  apiRouter.post('/scholar/profiles', async (req, res) => {
    try {
      const { authorId, name, profileData, expertiseGraph, biography, expertiseGraphId } = req.body;
      
      // Convert expertiseGraphId to integer if it exists, handle both string and number inputs
      let parsedExpertiseGraphId = null;
      if (expertiseGraphId !== undefined && expertiseGraphId !== null) {
        if (typeof expertiseGraphId === 'string') {
          parsedExpertiseGraphId = expertiseGraphId === '' ? null : parseInt(expertiseGraphId, 10);
        } else if (typeof expertiseGraphId === 'number') {
          parsedExpertiseGraphId = expertiseGraphId;
        }
      }
      const userId = req.session?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!authorId || !name || !profileData) {
        return res.status(400).json({
          success: false,
          message: 'Author ID, name, and profile data are required'
        });
      }

      const now = new Date().toISOString();
      
      // Check if profile already exists and update it, otherwise create new
      const existingProfile = await app.locals.storage.getScholarProfile(authorId, userId);
      
      let profile;
      if (existingProfile) {
        profile = await app.locals.storage.updateScholarProfile(authorId, userId, {
          name,
          profileData,
          expertiseGraph,
          biography,
          expertiseGraphId: parsedExpertiseGraphId,
          updatedAt: now
        });
      } else {
        profile = await app.locals.storage.createScholarProfile({
          userId,
          authorId,
          name,
          profileData,
          expertiseGraph,
          biography,
          expertiseGraphId: parsedExpertiseGraphId,
          createdAt: now,
          updatedAt: now
        });
      }

      return res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      console.error('Error saving scholar profile:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save scholar profile'
      });
    }
  });

  // Get Scholar Profiles by User
  apiRouter.get('/scholar/profiles', async (req, res) => {
    try {
      const userId = req.session?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const profiles = await app.locals.storage.getScholarProfilesByUser(userId);

      return res.json({
        success: true,
        data: profiles
      });
    } catch (error) {
      console.error('Error fetching scholar profiles:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch scholar profiles'
      });
    }
  });

  // Delete Scholar Profile
  apiRouter.delete('/scholar/profiles/:profileId', async (req, res) => {
    try {
      const { profileId } = req.params;
      const userId = req.session?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // First check if the profile exists and belongs to the user
      const profile = await app.locals.storage.getScholarProfileById(parseInt(profileId));
      if (!profile || profile.userId !== userId) {
        return res.status(404).json({
          success: false,
          message: 'Profile not found or not authorized to delete'
        });
      }

      await app.locals.storage.deleteScholarProfile(parseInt(profileId));

      return res.json({
        success: true,
        message: 'Profile deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting scholar profile:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete scholar profile'
      });
    }
  });

  // Get Specific Scholar Profile
  apiRouter.get('/scholar/profiles/:authorId', async (req, res) => {
    try {
      const { authorId } = req.params;
      const userId = req.session?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const profile = await app.locals.storage.getScholarProfile(authorId, userId);

      if (!profile) {
        return res.status(404).json({
          success: false,
          message: 'Scholar profile not found'
        });
      }

      return res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      console.error('Error fetching scholar profile:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch scholar profile'
      });
    }
  });

  // RFP Analysis - Match researcher expertise against project requirements
  apiRouter.post('/scholar/rfp-analysis', async (req, res) => {
    try {
      const { projectDescription, requiredSkills, projectDomain, authorData } = req.body;
      const userId = req.session?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!projectDescription || !requiredSkills || !projectDomain || !authorData) {
        return res.status(400).json({
          success: false,
          message: 'Project description, required skills, project domain, and author data are required'
        });
      }

      // Get the user's active API key
      let activeApiKey = await app.locals.storage.getActiveApiKey('openai', userId);
      let provider = 'openai';
      
      if (!activeApiKey) {
        // Try Mistral if OpenAI is not available
        activeApiKey = await app.locals.storage.getActiveApiKey('mistral', userId);
        provider = 'mistral';
      }
      
      if (!activeApiKey) {
        return res.status(400).json({
          success: false,
          message: 'No active API key found for OpenAI or Mistral. Please configure your API keys in Settings.'
        });
      }

      // Create AI service based on active provider
      const aiService = createAIService(provider, activeApiKey.key);

      // Prepare researcher data for analysis
      const researcherProfile = {
        name: authorData.result.name,
        affiliation: authorData.result.affiliation,
        interests: authorData.result.interests,
        publications: authorData.result.publications.slice(0, 10), // Recent publications
        citedby: authorData.result.citedby,
        hindex: authorData.result.hindex,
        domain: authorData.result.interests.join(', ')
      };

      // Create analysis prompt
      const analysisPrompt = `
Analyze the match between this researcher and the project requirements:

RESEARCHER PROFILE:
Name: ${researcherProfile.name}
Affiliation: ${researcherProfile.affiliation}
Research Interests: ${researcherProfile.interests.join(', ')}
Citations: ${researcherProfile.citedby}
H-Index: ${researcherProfile.hindex}
Recent Publications: ${researcherProfile.publications.map((pub: any) => pub.bib.title).join('; ')}

PROJECT REQUIREMENTS:
Description: ${projectDescription}
Required Skills: ${requiredSkills}
Domain: ${projectDomain}

Please provide a comprehensive analysis in JSON format with the following structure:
{
  "overallMatch": "percentage (0-100)",
  "matchScore": "Excellent/Good/Fair/Poor",
  "strengths": ["list of researcher strengths relevant to project"],
  "gaps": ["list of skills/experience gaps"],
  "recommendations": ["recommendations for collaboration or hiring"],
  "domainAlignment": "percentage (0-100)",
  "experienceLevel": "Senior/Mid-level/Junior",
  "riskFactors": ["potential risks or concerns"],
  "opportunities": ["opportunities for mutual benefit"]
}`;

      // Perform basic analysis based on researcher profile
      const researchInterests = researcherProfile.interests || [];
      const projectKeywords = projectDomain.toLowerCase().split(/[,\s]+/).filter((word: string) => word.length > 2);
      const skillKeywords = requiredSkills.toLowerCase().split(/[,\s]+/).filter((word: string) => word.length > 2);
      
      // Calculate domain alignment based on keyword overlap
      const interestKeywords = researchInterests.join(' ').toLowerCase().split(/[,\s]+/).filter((word: string) => word.length > 2);
      const domainOverlap = projectKeywords.filter((keyword: string) => 
        interestKeywords.some((interest: string) => interest.includes(keyword) || keyword.includes(interest))
      ).length;
      const domainAlignment = Math.min(95, Math.max(20, (domainOverlap / Math.max(projectKeywords.length, 1)) * 100));
      
      // Calculate overall match based on various factors
      const citationScore = Math.min(30, (researcherProfile.citedby || 0) / 100);
      const hindexScore = Math.min(25, (researcherProfile.hindex || 0) * 2);
      const alignmentScore = domainAlignment * 0.45;
      const overallMatch = Math.round(citationScore + hindexScore + alignmentScore);
      
      // Determine match grade
      let matchScore = "Poor";
      if (overallMatch >= 80) matchScore = "Excellent";
      else if (overallMatch >= 65) matchScore = "Good";
      else if (overallMatch >= 45) matchScore = "Fair";
      
      // Generate analysis based on data
      const parsedAnalysis = {
        overallMatch: overallMatch.toString(),
        matchScore,
        strengths: [
          `${researcherProfile.citedby || 0} total citations indicate research impact`,
          `H-index of ${researcherProfile.hindex || 0} shows sustained research quality`,
          `Research interests align with project domain`,
          `Affiliated with ${researcherProfile.affiliation || 'academic institution'}`
        ].filter(strength => 
          (researcherProfile.citedby && researcherProfile.citedby > 100) ||
          (researcherProfile.hindex && researcherProfile.hindex > 5) ||
          domainAlignment > 30
        ),
        gaps: [
          domainAlignment < 50 ? "Limited direct experience in project domain" : null,
          (researcherProfile.citedby || 0) < 500 ? "Could benefit from more research visibility" : null,
          "Specific project requirements need detailed evaluation"
        ].filter(Boolean),
        recommendations: [
          overallMatch > 70 ? "Strong candidate for collaboration" : "Consider for specific expertise areas",
          "Review recent publications for technical depth",
          "Conduct detailed interview to assess project fit",
          "Evaluate availability and interest level"
        ],
        domainAlignment: Math.round(domainAlignment).toString(),
        experienceLevel: (researcherProfile.hindex || 0) > 15 ? "Senior" : (researcherProfile.hindex || 0) > 5 ? "Mid-level" : "Junior",
        riskFactors: [
          domainAlignment < 40 ? "Domain expertise gap" : null,
          "Academic vs industry project expectations",
          "Timeline and availability constraints"
        ].filter(Boolean),
        opportunities: [
          "Access to academic research network",
          "Potential for publication opportunities",
          "Fresh perspective on project challenges",
          researcherProfile.citedby > 1000 ? "High-impact researcher reputation" : null
        ].filter(Boolean)
      };

      return res.json({
        success: true,
        data: {
          analysis: parsedAnalysis,
          projectInfo: {
            description: projectDescription,
            requiredSkills: requiredSkills,
            domain: projectDomain
          },
          researcherInfo: researcherProfile,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error performing RFP analysis:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to perform RFP analysis'
      });
    }
  });

  // Delete Scholar Profile
  apiRouter.delete('/scholar/profiles/:profileId', async (req, res) => {
    try {
      const { profileId } = req.params;
      const userId = req.session?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const deleted = await app.locals.storage.deleteScholarProfile(parseInt(profileId));

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Scholar profile not found'
        });
      }

      return res.json({
        success: true,
        message: 'Scholar profile deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting scholar profile:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete scholar profile'
      });
    }
  });

  // ─────────────────────────────────────────────────────────
  // CMF Pipeline Lineage Inspection Endpoints
  // ─────────────────────────────────────────────────────────

  // GET /api/cmf/stats — pipeline-wide summary metrics
  apiRouter.get('/cmf/stats', async (_req, res) => {
    try {
      const result = await cmfService.queryStats();
      res.json(result);
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

  // GET /api/cmf/executions?stage=extraction&limit=20
  apiRouter.get('/cmf/executions', async (req, res) => {
    try {
      const stage = req.query.stage as string | undefined;
      const limit = parseInt(req.query.limit as string || '50');
      const result = await cmfService.queryExecutions(stage, limit);
      res.json(result);
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

  // GET /api/cmf/lineage/:graphId — full lineage for one graph
  apiRouter.get('/cmf/lineage/:graphId', async (req, res) => {
    try {
      const graphId = parseInt(req.params.graphId);
      const result = await cmfService.queryLineage(graphId);
      res.json(result);
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

  // GET /api/cmf/export — full JSON dump of all pipeline metadata
  apiRouter.get('/cmf/export', async (_req, res) => {
    try {
      const result = await cmfService.exportJson();
      res.json(result);
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

  app.use("/api", apiRouter);

  const httpServer = createServer(app);
  
  // Initialize Socket.IO with CORS configuration
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  
  // Socket.IO connection handling
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    
    // Handle client disconnection
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
  
  // Make io accessible from route handlers
  app.set('socketio', io);
  
  return httpServer;
}
