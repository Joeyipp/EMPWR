import { KnowledgeGraph } from '@shared/schema';
import OpenAI from 'openai';
// Import the MistralClient class from the SDK
// We need to write this import as a comment first since the package is not yet installed
// import { MistralClient } from '@mistralai/mistralai';
import { processText as processTextLocal } from './nlp';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Blob } from 'buffer';
import FormData from 'form-data';
import { getPDFService } from './pdf-service';

// Get current directory path (ES modules compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ontology constraints for hybrid mode
export interface OntologyConstraints {
  entities: Array<{ name: string; description?: string }>;
  relations: Array<{ name: string; description?: string; domain?: string; range?: string }>;
  description?: string;
  domain?: string;
  rawContent?: string; // Raw ontology text for LLM to parse directly
}

// Define the base interface for all AI services
export interface AIService {
  processText(text: string, filePath?: string): Promise<KnowledgeGraph>;
  processTextWithOntology?(text: string, ontology: OntologyConstraints): Promise<KnowledgeGraph>;
}

// Local NLP service implementation
export class LocalNLPService implements AIService {
  async processText(text: string, filePath?: string): Promise<KnowledgeGraph> {
    // Get the base graph from the local NLP processor
    const graph = processTextLocal(text);
    
    // Add data provenance information
    const currentTimestamp = new Date().toISOString();
    
    // Add dataSource and timestamp to nodes and links
    const nodes = graph.nodes.map((node: any) => ({
      ...node,
      dataSource: 'compromisejs',
      timestamp: currentTimestamp
    }));
    
    const links = graph.links.map((link: any) => ({
      ...link,
      dataSource: 'compromisejs',
      timestamp: currentTimestamp
    }));
    
    return {
      nodes,
      links
    };
  }
}

// OpenAI service implementation
export class OpenAIService implements AIService {
  private openai: OpenAI;
  
  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }
  
  async processText(text: string, filePath?: string): Promise<KnowledgeGraph> {
    try {
      // Prepare the system prompt
      const systemPrompt = `
        Analyze the provided content and extract entities and relationships to create a knowledge graph.
        
        Instructions:
        1. Identify key entities (people, places, organizations, concepts, dates, etc.)
        2. Determine relationships between these entities
        3. Return the result as a JSON object with the following structure:
        
        {
          "nodes": [
            { "id": number, "name": string, "group": number }
          ],
          "links": [
            { "source": number, "target": number, "value": number, "label": string }
          ]
        }
        
        Entity group numbers should follow this convention:
        - 1: Person
        - 2: Place
        - 3: Concept
        - 4: Organization
        - 5: Date
        - 6: Other
        
        Make sure entity IDs start at 1 and are sequential.
      `;
      
      let response: any;
      
      // If filePath is provided, it's a PDF document to analyze directly
      if (filePath && fs.existsSync(filePath)) {
        console.log(`Processing PDF file: ${filePath} directly with OpenAI`);
        
        try {
          // Read the first few pages of PDF text using a better approach
          // Since OpenAI doesn't support direct PDF uploads, we'll extract the text content
          // and send it along with context about the document
          
          // Read the PDF file to get information about it
          const fileStats = fs.statSync(filePath);
          const fileSizeKB = Math.round(fileStats.size / 1024);
          const fileName = path.basename(filePath);
          
          // Create a message that includes metadata about the PDF
          const pdfDescription = `The following text was extracted from the PDF document "${fileName}" (${fileSizeKB}KB).`;
          
          // Process the text content directly
          response = await this.openai.chat.completions.create({
            model: "gpt-4o", // Using GPT-4o for best text analysis capabilities
            messages: [
              { role: "system", content: systemPrompt },
              { 
                role: "user", 
                content: `${pdfDescription}\n\nExtract entities and relationships from this document to create a structured knowledge graph following the instructions carefully.\n\n${text || "[PDF document content]"}`
              }
            ],
            response_format: { type: "json_object" }
          });
          
          console.log("Successfully processed PDF content with OpenAI");
        } catch (error) {
          console.error("Error processing PDF file with OpenAI:", error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          throw new Error(`Error processing PDF: ${errorMessage}`);
        } finally {
          // Clean up the temp file after processing
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          } catch (cleanupError) {
            console.error("Error cleaning up file:", cleanupError);
          }
        }
      } else {
        // Process text content directly
        response = await this.openai.chat.completions.create({
          model: "gpt-4o", // The newest OpenAI model is "gpt-4o" which was released May 13, 2024
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Extract entities and relationships from the following text:\n\n${text}` }
          ],
          response_format: { type: "json_object" }
        });
      }
      
      // Parse the response
      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }
      
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(content);
      } catch (err) {
        const error = err as Error;
        console.error('Failed to parse OpenAI response:', content);
        throw new Error(`Invalid JSON response from OpenAI: ${error.message || 'Unknown error'}`);
      }
      
      // Validate and format the response
      if (!parsedResponse.nodes || !parsedResponse.links || 
          !Array.isArray(parsedResponse.nodes) || !Array.isArray(parsedResponse.links)) {
        throw new Error('Invalid response format from OpenAI: missing nodes or links arrays');
      }
      
      // Add data provenance information
      const currentTimestamp = new Date().toISOString();
      
      // Add dataSource and timestamp to nodes and links
      const nodes = parsedResponse.nodes.map((node: any) => ({
        ...node,
        dataSource: 'openai',
        timestamp: currentTimestamp
      }));
      
      const links = parsedResponse.links.map((link: any) => ({
        ...link,
        dataSource: 'openai',
        timestamp: currentTimestamp
      }));
      
      return {
        nodes,
        links
      };
    } catch (err) {
      const error = err as Error;
      console.error('Error processing content with OpenAI:', error);
      
      // Provide detailed error message instead of silent fallback
      let errorMessage = 'Unknown error occurred with OpenAI API';
      
      if (error instanceof Error) {
        if (error.message.includes('401')) {
          errorMessage = 'Invalid or expired OpenAI API key. Please check your API key and try again.';
        } else if (error.message.includes('429')) {
          errorMessage = 'OpenAI API rate limit exceeded. Please try again later.';
        } else if (error.message.includes('500')) {
          errorMessage = 'OpenAI API server error. Please try again later.';
        } else {
          errorMessage = `OpenAI API error: ${error.message}`;
        }
      }
      
      throw new Error(errorMessage);
    }
  }

  async processTextWithOntology(text: string, ontology: OntologyConstraints): Promise<KnowledgeGraph> {
    try {
      // Check if we have parsed entities/relations or need to use raw content
      const hasEntities = ontology.entities && ontology.entities.length > 0;
      const hasRelations = ontology.relations && ontology.relations.length > 0;
      const hasRawContent = ontology.rawContent && ontology.rawContent.trim().length > 0;

      let systemPrompt: string;
      let useRawOntology = false;
      
      if (hasEntities || hasRelations) {
        // Use parsed entities/relations
        const entityTypesList = hasEntities 
          ? ontology.entities.map((e, i) => 
              `- "${e.name}" (group: ${i + 1})${e.description ? `: ${e.description}` : ''}`
            ).join('\n')
          : 'No specific entity types defined';
        
        const relationTypesList = hasRelations
          ? ontology.relations.map((r) => 
              `- "${r.name}"${r.description ? `: ${r.description}` : ''}${r.domain && r.range ? ` (connects ${r.domain} to ${r.range})` : ''}`
            ).join('\n')
          : 'No specific relationship types defined';

        systemPrompt = `You are a knowledge graph extraction expert. You MUST extract a knowledge graph that STRICTLY CONFORMS to the provided ontology schema. DO NOT use any entity types or relationship types that are not explicitly listed in the ontology.

=== ONTOLOGY SCHEMA ===
${ontology.description ? `Domain: ${ontology.description}` : 'General domain'}
${ontology.domain ? `Scope: ${ontology.domain}` : ''}

ALLOWED ENTITY TYPES (you MUST ONLY use these - assign the group number shown):
${entityTypesList}

ALLOWED RELATIONSHIP TYPES (you MUST ONLY use these exact names as the "relationship" field):
${relationTypesList}

=== STRICT RULES ===
1. ONLY extract entities that match one of the allowed entity types above
2. ONLY use relationship names from the allowed list - DO NOT use "related_to", "associated_with", or any other generic relationships
3. If an entity or relationship doesn't match the ontology, SKIP IT entirely
4. Use the exact relationship names as specified (case-sensitive)
5. The "relationship" field in links must be one of the allowed relationship type names exactly

=== OUTPUT FORMAT ===
Return a JSON object with this exact structure:
{
  "nodes": [
    { "id": number, "name": "entity name", "group": number (from entity type) }
  ],
  "links": [
    { "source": number, "target": number, "relationship": "exact relationship name from allowed list" }
  ]
}

Entity IDs must start at 0 and be sequential. The "relationship" field MUST be one of the allowed relationship type names exactly as listed.`;
      } else if (hasRawContent) {
        // Use raw ontology content - let the LLM parse it
        useRawOntology = true;
        systemPrompt = `You are a knowledge graph extraction expert. You MUST extract a knowledge graph that STRICTLY CONFORMS to the provided ontology schema.

=== RAW ONTOLOGY SCHEMA ===
The following is the raw ontology definition. Parse it to understand the allowed entity types (classes) and relationship types (properties/predicates):

${ontology.rawContent}

=== STRICT RULES ===
1. First, identify all entity types (classes) defined in the ontology above
2. Identify all relationship types (properties/predicates) defined in the ontology above
3. ONLY extract entities that match the entity types from the ontology
4. ONLY use relationship names that match the properties/predicates from the ontology
5. DO NOT use generic relationships like "related_to", "associated_with", "has", etc. unless they are explicitly defined in the ontology
6. If an entity or relationship doesn't match the ontology, SKIP IT entirely

=== OUTPUT FORMAT ===
Return a JSON object with this exact structure:
{
  "nodes": [
    { "id": number, "name": "entity name", "group": number, "type": "entity type from ontology" }
  ],
  "links": [
    { "source": number, "target": number, "relationship": "exact relationship name from ontology" }
  ]
}

Entity IDs must start at 0 and be sequential. Use group numbers 1-6 for different entity types.`;
      } else {
        throw new Error('No ontology constraints provided - please provide either entity/relation definitions or raw ontology content');
      }

      const userMessage = `Extract entities and relationships from this text, using ONLY the entity types and relationship types from the ontology schema. Skip any entities or relationships that don't fit the schema.

TEXT:
${text}`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(content);
      } catch (err) {
        console.error('Failed to parse OpenAI ontology response:', content);
        throw new Error('Invalid JSON response from OpenAI');
      }

      if (!parsedResponse.nodes || !parsedResponse.links || 
          !Array.isArray(parsedResponse.nodes) || !Array.isArray(parsedResponse.links)) {
        throw new Error('Invalid response format from OpenAI: missing nodes or links arrays');
      }

      const currentTimestamp = new Date().toISOString();

      const nodes = parsedResponse.nodes.map((node: any) => ({
        ...node,
        dataSource: 'openai-hybrid',
        timestamp: currentTimestamp
      }));

      // Only filter relationships if we have parsed relations (not raw ontology mode)
      let links;
      if (!useRawOntology && ontology.relations && ontology.relations.length > 0) {
        const allowedRelations = new Set(ontology.relations.map(r => r.name.toLowerCase()));
        links = parsedResponse.links
          .filter((link: any) => {
            const rel = (link.relationship || '').toLowerCase();
            return allowedRelations.has(rel);
          })
          .map((link: any) => ({
            ...link,
            dataSource: 'openai-hybrid',
            timestamp: currentTimestamp
          }));
      } else {
        // For raw ontology mode, trust the LLM's output
        links = parsedResponse.links.map((link: any) => ({
          ...link,
          dataSource: 'openai-hybrid',
          timestamp: currentTimestamp
        }));
      }

      return { nodes, links };
    } catch (err) {
      const error = err as Error;
      console.error('Error processing content with OpenAI (ontology mode):', error);
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }
}

// Note: We've removed Anthropic and Cohere service implementations

// spaCy service implementation
export class SpacyNLPService implements AIService {
  async processText(text: string, filePath?: string): Promise<KnowledgeGraph> {
    console.log(`SpacyNLPService processing: text length=${text?.length || 0}, filePath=${filePath || 'none'}`);
    
    // Ensure we have some text to process
    if (!text || text.trim() === '' || text === '[Document content for processing]') {
      if (filePath && fs.existsSync(filePath)) {
        console.log('No or placeholder text provided but file exists, attempting to extract text from file...');
        const fileExt = path.extname(filePath).toLowerCase();
        
        if (fileExt === '.txt') {
          try {
            text = fs.readFileSync(filePath, 'utf8');
            console.log(`Read ${text.length} characters from text file`);
          } catch (readError) {
            console.error('Error reading text file:', readError);
            text = 'Error reading text file';
          }
        } else if (fileExt === '.pdf') {
          // Try to use the PDF extraction service first
          try {
            console.log('Using PDFService to extract text from PDF file for spaCy processing');
            const pdfService = getPDFService();
            const pdfResult = await pdfService.extractTextFromPDF(filePath);
            
            if (pdfResult.success && pdfResult.text.length > 0) {
              text = pdfResult.text;
              console.log(`Successfully extracted ${text.length} characters from PDF for spaCy`);
            } else {
              // If standard extraction fails, we could check if OpenAI API key is available
              // and try OCR as a fallback
              console.warn('PDF extraction failed for spaCy, using placeholder text');
              text = `[PDF document: ${path.basename(filePath)}] - Unable to extract text`;
            }
          } catch (pdfError: any) {
            console.error('Error extracting text from PDF for spaCy:', pdfError);
            text = `[PDF document: ${path.basename(filePath)}] - Extraction error: ${pdfError?.message || 'Unknown error'}`;
          }
        } else {
          text = `[Document: ${path.basename(filePath)}]`;
          console.log('Using generic document placeholder');
        }
      } else {
        // If no text and no file, throw a validation error
        throw new Error('Please enter some text to process at "text"');
      }
    }
    
    // If we still don't have usable text content
    if (!text || text.trim() === '' || 
        text.includes('Unable to extract text') || 
        text.includes('Extraction error')) {
      throw new Error('Failed to extract usable text from the document. Please try a different document.');
    }
    
    // Log the first 100 characters of the text to confirm we have content
    console.log(`Processing with spaCy model: Text starts with "${text.substring(0, 100).replace(/\n/g, ' ')}..."`);
    
        
    // Create temporary file paths
    const inputFilePath = path.join(__dirname, 'temp_input.txt');
    const outputFilePath = path.join(__dirname, 'temp_output.json');
    const scriptPath = path.join(__dirname, 'spacy_processor.py');
    
    try {
      console.log('Processing text with spaCy NLP model...');
      
      // If this is a document file processing, log that information
      if (filePath && fs.existsSync(filePath)) {
        const fileName = path.basename(filePath);
        const fileStats = fs.statSync(filePath);
        const fileSizeKB = Math.round(fileStats.size / 1024);
        console.log(`Processing document file with spaCy: ${fileName} (${fileSizeKB}KB)`);
        
        // The text parameter already contains the extracted content from the document
        // Make sure it's not empty or just a placeholder
        if (!text || text.trim() === '' || 
            text.startsWith('[PDF Document:') || 
            text.startsWith('[Document:') || 
            text.startsWith('[PDF document:')) {
          console.warn('Warning: Document content appears to be empty or placeholder text');
        } else {
          console.log(`Document content available: ${text.length} characters`);
        }
      }
      
      // Write the text to a temporary file
      fs.writeFileSync(inputFilePath, text);
      
      // Create a Python script to process the text with spaCy
      const pythonScript = `
import spacy
import json
import sys
import os
from pathlib import Path

def process_text(text):
    # Check if the text is too large and truncate if necessary
    max_text_length = 100000  # spaCy works best with smaller chunks
    if len(text) > max_text_length:
        print(f"Warning: Text is very large ({len(text)} chars). Truncating to {max_text_length} chars for processing.")
        text = text[:max_text_length]
    
    # Load spaCy model
    print("Loading spaCy model...")
    nlp = spacy.load('en_core_web_sm')
    
    print(f"Processing text of length {len(text)} characters...")
    # For very large documents, processing in batches can help
    doc = nlp(text)
    
    # Extract entities
    print("Extracting entities...")
    entities = []
    entity_map = {}  # Map entity text to ID
    entity_counter = 1
    
    for ent in doc.ents:
        # Map entity types to group numbers
        group = 6  # Default: Other
        if ent.label_ in ['PERSON', 'PER']:
            group = 1  # Person
        elif ent.label_ in ['GPE', 'LOC']:
            group = 2  # Place
        elif ent.label_ in ['ORG']:
            group = 4  # Organization
        elif ent.label_ in ['DATE', 'TIME']:
            group = 5  # Date
        elif ent.label_ in ['NORP', 'WORK_OF_ART', 'LAW', 'LANGUAGE']:
            group = 3  # Concept
            
        # Add entity if not already added
        if ent.text not in entity_map:
            entity_map[ent.text] = entity_counter
            entities.append({
                "id": entity_counter,
                "name": ent.text,
                "group": group
            })
            entity_counter += 1
    
    print(f"Found {len(entities)} entities")
    
    # Extract relationships using dependency parsing
    print("Extracting relationships...")
    relationships = []
    
    # Process sentences to find relationships
    for sent in doc.sents:
        # Get the root verb of the sentence
        root = sent.root
        
        # Find subject and object connected to the root verb
        subject = None
        obj = None
        
        for token in sent:
            # Find the subject
            if token.dep_ in ["nsubj", "nsubjpass"] and token.head == root:
                subject = token
                
            # Find the object
            if token.dep_ in ["dobj", "pobj"] and token.head == root:
                obj = token
                
        # If we have both subject and object, create a relationship
        if subject and obj:
            # Check if both subject and object are entities or parts of entities
            subj_entity = None
            obj_entity = None
            
            for ent in doc.ents:
                try:
                    if subject.idx >= ent.start_char and subject.idx + len(subject.text) <= ent.end_char:
                        subj_entity = ent.text
                    if obj.idx >= ent.start_char and obj.idx + len(obj.text) <= ent.end_char:
                        obj_entity = ent.text
                except Exception as e:
                    # Skip this entity if there's an index error
                    print(f"Warning: Error processing entity indexes: {e}")
                    continue
            
            if subj_entity and obj_entity and subj_entity in entity_map and obj_entity in entity_map:
                relationships.append({
                    "source": entity_map[subj_entity],
                    "target": entity_map[obj_entity],
                    "value": 1,
                    "label": root.text
                })
    
    # Add some additional relationships based on noun chunk proximity if we don't have many
    try:
        if len(relationships) < len(entities) / 2:
            print("Generating additional relationships based on proximity...")
            noun_chunks = list(doc.noun_chunks)
            for i in range(len(noun_chunks)-1):
                chunk1 = noun_chunks[i]
                chunk2 = noun_chunks[i+1]
                
                # Find entities containing these chunks
                entity1 = None
                entity2 = None
                
                for ent in doc.ents:
                    try:
                        if chunk1.start >= ent.start and chunk1.end <= ent.end:
                            entity1 = ent.text
                        if chunk2.start >= ent.start and chunk2.end <= ent.end:
                            entity2 = ent.text
                    except Exception as e:
                        # Skip this entity if there's an index error
                        continue
                
                if entity1 and entity2 and entity1 in entity_map and entity2 in entity_map:
                    # Determine the verb or preposition connecting them
                    connecting_words = []
                    for token in doc[chunk1.end:chunk2.start]:
                        if token.pos_ in ["VERB", "ADP"]:
                            connecting_words.append(token.text)
                    
                    label = "connected to"
                    if connecting_words:
                        label = " ".join(connecting_words)
                    
                    # Check if relationship already exists
                    relationship_exists = False
                    for rel in relationships:
                        if (rel["source"] == entity_map[entity1] and rel["target"] == entity_map[entity2]):
                            relationship_exists = True
                            break
                    
                    if not relationship_exists:
                        relationships.append({
                            "source": entity_map[entity1],
                            "target": entity_map[entity2],
                            "value": 1,
                            "label": label
                        })
    except Exception as e:
        print(f"Warning: Error generating proximity relationships: {e}")
    
    print(f"Found {len(relationships)} relationships")
    
    # Ensure there's at least some content in the graph
    if len(entities) == 0:
        # Create a default entity if none were found
        entities.append({
            "id": 1,
            "name": "Document",
            "group": 3  # Concept
        })
    
    return {
        "nodes": entities,
        "links": relationships
    }

try:
    # Read input text from file
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    print(f"Reading input from {input_path}")
    try:
        with open(input_path, 'r', encoding='utf-8') as f:
            text = f.read()
    except UnicodeDecodeError:
        # Try again with latin-1 encoding if utf-8 fails
        with open(input_path, 'r', encoding='latin-1') as f:
            text = f.read()
    
    # Process the text
    result = process_text(text)
    
    # Write results to output file
    print(f"Writing results to {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f)
    
    print(f"Processing complete. Extracted {len(result['nodes'])} entities and {len(result['links'])} relationships.")
except Exception as e:
    print(f"Error in Python script: {str(e)}")
    # Create a minimal valid output to avoid crashing the Node.js process
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump({"nodes": [{"id": 1, "name": "Error processing document", "group": 3}], "links": []}, f)
    exit(1)
`;
      
      fs.writeFileSync(scriptPath, pythonScript);
      
      // Execute the Python script
      try {
        const output = execSync(`python3 ${scriptPath} ${inputFilePath} ${outputFilePath}`, { encoding: 'utf-8', timeout: 120000 });
        console.log(output);
        
        // Read the results from the output file
        if (fs.existsSync(outputFilePath)) {
          const jsonResult = fs.readFileSync(outputFilePath, 'utf-8');
          const parsedResult = JSON.parse(jsonResult);
          
          // Add data provenance information
          const currentTimestamp = new Date().toISOString();
          
          // Add dataSource and timestamp to nodes and links
          const nodes = parsedResult.nodes.map((node: any) => ({
            ...node,
            dataSource: 'spacy',
            timestamp: currentTimestamp
          }));
          
          const links = parsedResult.links.map((link: any) => ({
            ...link,
            dataSource: 'spacy',
            timestamp: currentTimestamp
          }));
          
          return {
            nodes,
            links
          };
        } else {
          throw new Error('SpaCy processing did not generate output file');
        }
      } catch (execError) {
        console.error('Error executing SpaCy script:', execError);
        const errorMessage = execError instanceof Error 
          ? execError.message 
          : 'Unknown execution error';
        throw new Error(`SpaCy processing error: ${errorMessage}`);
      }
    } catch (err) {
      const error = err as Error;
      console.error('Error processing text with SpaCy:', error);
      
      // Provide detailed error message
      let errorMessage = 'Unknown error occurred with SpaCy processing';
      
      if (error instanceof Error) {
        errorMessage = `SpaCy processing error: ${error.message}`;
      }
      
      throw new Error(errorMessage);
    } finally {
      // Clean up any remaining temporary files
      try {
        if (fs.existsSync(inputFilePath)) fs.unlinkSync(inputFilePath);
        if (fs.existsSync(outputFilePath)) fs.unlinkSync(outputFilePath);
        if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
        
        // Also clean up the original document file if it was a temporary upload
        if (filePath && fs.existsSync(filePath) && filePath.includes('temp-uploads')) {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up temporary document file: ${filePath}`);
        }
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }
    }
  }
}

// Mistral AI service implementation
export class MistralAIService implements AIService {
  private apiKey: string;
  
  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('API key is required for MistralAI');
    }
    this.apiKey = apiKey;
    console.log('MistralAI service initialized');
  }
  
  async processText(text: string, filePath?: string): Promise<KnowledgeGraph> {
    try {
      // Prepare the system prompt, similar to OpenAI implementation but tailored for Mistral
      const systemPrompt = `
        Analyze the provided content and extract entities and relationships to create a knowledge graph.
        
        Instructions:
        1. Identify key entities (people, places, organizations, concepts, dates, etc.)
        2. Determine relationships between these entities
        3. Return the result as a JSON object with the following structure:
        
        {
          "nodes": [
            { "id": number, "name": string, "group": number }
          ],
          "links": [
            { "source": number, "target": number, "value": number, "label": string }
          ]
        }
        
        Entity group numbers should follow this convention:
        - 1: Person
        - 2: Place
        - 3: Concept
        - 4: Organization
        - 5: Date
        - 6: Other
        
        Make sure entity IDs start at 1 and are sequential.
      `;
      
      let messageContent: string;
      
      // If filePath is provided, it's a document to analyze
      if (filePath && fs.existsSync(filePath)) {
        console.log(`Processing file: ${filePath} with MistralAI`);
        
        try {
          // For PDF files, we need to handle them differently
          if (path.extname(filePath).toLowerCase() === '.pdf') {
            // Create a message that includes metadata about the PDF
            const fileStats = fs.statSync(filePath);
            const fileSizeKB = Math.round(fileStats.size / 1024);
            const fileName = path.basename(filePath);
            const pdfDescription = `The following text was extracted from the PDF document "${fileName}" (${fileSizeKB}KB).`;
            
            messageContent = `${pdfDescription}\n\nExtract entities and relationships from this document to create a structured knowledge graph following the instructions carefully.\n\n${text || "[PDF document content]"}`;
          } else {
            // For other files, use the text parameter which should contain the file contents
            messageContent = `Extract entities and relationships from the document to create a knowledge graph.\n\n${text}`;
          }
          
          console.log("Preparing to process document content with MistralAI");
        } catch (err) {
          const error = err as Error;
          console.error("Error preparing file for MistralAI:", error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          throw new Error(`Error processing file: ${errorMessage}`);
        } finally {
          // Clean up the temp file after processing if needed
          try {
            if (fs.existsSync(filePath) && filePath.includes('temp-')) {
              fs.unlinkSync(filePath);
              console.log(`Cleaned up temporary file: ${filePath}`);
            }
          } catch (cleanupError) {
            console.error("Error cleaning up file:", cleanupError);
          }
        }
      } else {
        // Process text content directly
        messageContent = `Extract entities and relationships from the following text:\n\n${text}`;
      }
      
      // Create the messages array for the Mistral API
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: messageContent }
      ];
      
      // Make the API call to Mistral AI directly using fetch API
      console.log('Sending request to MistralAI API...');
      
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: "mistral-large-latest",
          messages: messages,
          response_format: { type: "json_object" }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const statusMessage = response.statusText || 'Unknown error';
        const errorMessage = errorData.error?.message || 
                            errorData.message || 
                            `API error (${response.status}): ${statusMessage}`;
        
        console.error(`Mistral API error:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        
        throw new Error(`Mistral API error: ${errorMessage}`);
      }
      
      // Parse the response from Mistral AI API
      const responseData = await response.json();
      console.log('Received response from MistralAI API');
      
      // Extract the content from the response
      const content = responseData.choices[0].message.content;
      
      if (!content) {
        throw new Error('Empty response from MistralAI');
      }
      
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(content);
      } catch (err) {
        const error = err as Error;
        console.error('Failed to parse MistralAI response:', content);
        throw new Error(`Invalid JSON response from MistralAI: ${error.message || 'Unknown error'}`);
      }
      
      // Validate and format the response
      if (!parsedResponse.nodes || !parsedResponse.links || 
          !Array.isArray(parsedResponse.nodes) || !Array.isArray(parsedResponse.links)) {
        throw new Error('Invalid response format from MistralAI: missing nodes or links arrays');
      }
      
      // Add data provenance information
      const currentTimestamp = new Date().toISOString();
      
      // Add dataSource and timestamp to nodes and links
      const nodes = parsedResponse.nodes.map((node: any) => ({
        ...node,
        dataSource: 'mistral',
        timestamp: currentTimestamp
      }));
      
      const links = parsedResponse.links.map((link: any) => ({
        ...link,
        dataSource: 'mistral',
        timestamp: currentTimestamp
      }));
      
      return {
        nodes,
        links
      };
    } catch (err) {
      const error = err as Error;
      console.error('Error processing content with MistralAI:', error);
      
      // Provide detailed error message
      let errorMessage = 'Unknown error occurred with MistralAI API';
      
      if (error instanceof Error) {
        if (error.message.includes('401')) {
          errorMessage = 'Invalid or expired MistralAI API key. Please check your API key and try again.';
        } else if (error.message.includes('429')) {
          errorMessage = 'MistralAI API rate limit exceeded. Please try again later.';
        } else if (error.message.includes('500')) {
          errorMessage = 'MistralAI API server error. Please try again later.';
        } else {
          errorMessage = `MistralAI API error: ${error.message}`;
        }
      }
      
      throw new Error(errorMessage);
    }
  }

  async processTextWithOntology(text: string, ontology: OntologyConstraints): Promise<KnowledgeGraph> {
    try {
      // Check if we have parsed entities/relations or need to use raw content
      const hasEntities = ontology.entities && ontology.entities.length > 0;
      const hasRelations = ontology.relations && ontology.relations.length > 0;
      const hasRawContent = ontology.rawContent && ontology.rawContent.trim().length > 0;

      let systemPrompt: string;
      let useRawOntology = false;
      
      if (hasEntities || hasRelations) {
        // Use parsed entities/relations
        const entityTypesList = hasEntities 
          ? ontology.entities.map((e, i) => 
              `- "${e.name}" (group: ${i + 1})${e.description ? `: ${e.description}` : ''}`
            ).join('\n')
          : 'No specific entity types defined';
        
        const relationTypesList = hasRelations
          ? ontology.relations.map((r) => 
              `- "${r.name}"${r.description ? `: ${r.description}` : ''}${r.domain && r.range ? ` (connects ${r.domain} to ${r.range})` : ''}`
            ).join('\n')
          : 'No specific relationship types defined';

        systemPrompt = `You are a knowledge graph extraction expert. You MUST extract a knowledge graph that STRICTLY CONFORMS to the provided ontology schema. DO NOT use any entity types or relationship types that are not explicitly listed in the ontology.

=== ONTOLOGY SCHEMA ===
${ontology.description ? `Domain: ${ontology.description}` : 'General domain'}
${ontology.domain ? `Scope: ${ontology.domain}` : ''}

ALLOWED ENTITY TYPES (you MUST ONLY use these - assign the group number shown):
${entityTypesList}

ALLOWED RELATIONSHIP TYPES (you MUST ONLY use these exact names as the "relationship" field):
${relationTypesList}

=== STRICT RULES ===
1. ONLY extract entities that match one of the allowed entity types above
2. ONLY use relationship names from the allowed list - DO NOT use "related_to", "associated_with", or any other generic relationships
3. If an entity or relationship doesn't match the ontology, SKIP IT entirely
4. Use the exact relationship names as specified (case-sensitive)
5. The "relationship" field in links must be one of the allowed relationship type names exactly

=== OUTPUT FORMAT ===
Return a JSON object with this exact structure:
{
  "nodes": [
    { "id": number, "name": "entity name", "group": number (from entity type) }
  ],
  "links": [
    { "source": number, "target": number, "relationship": "exact relationship name from allowed list" }
  ]
}

Entity IDs must start at 0 and be sequential. The "relationship" field MUST be one of the allowed relationship type names exactly as listed.`;
      } else if (hasRawContent) {
        // Use raw ontology content - let the LLM parse it
        useRawOntology = true;
        systemPrompt = `You are a knowledge graph extraction expert. You MUST extract a knowledge graph that STRICTLY CONFORMS to the provided ontology schema.

=== RAW ONTOLOGY SCHEMA ===
The following is the raw ontology definition. Parse it to understand the allowed entity types (classes) and relationship types (properties/predicates):

${ontology.rawContent}

=== STRICT RULES ===
1. First, identify all entity types (classes) defined in the ontology above
2. Identify all relationship types (properties/predicates) defined in the ontology above
3. ONLY extract entities that match the entity types from the ontology
4. ONLY use relationship names that match the properties/predicates from the ontology
5. DO NOT use generic relationships like "related_to", "associated_with", "has", etc. unless they are explicitly defined in the ontology
6. If an entity or relationship doesn't match the ontology, SKIP IT entirely

=== OUTPUT FORMAT ===
Return a JSON object with this exact structure:
{
  "nodes": [
    { "id": number, "name": "entity name", "group": number, "type": "entity type from ontology" }
  ],
  "links": [
    { "source": number, "target": number, "relationship": "exact relationship name from ontology" }
  ]
}

Entity IDs must start at 0 and be sequential. Use group numbers 1-6 for different entity types.`;
      } else {
        throw new Error('No ontology constraints provided - please provide either entity/relation definitions or raw ontology content');
      }

      const userMessage = `Extract entities and relationships from this text, using ONLY the entity types and relationship types from the ontology schema. Skip any entities or relationships that don't fit the schema.

TEXT:
${text}`;

      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: "mistral-large-latest",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Mistral API error: ${errorData.error?.message || response.statusText}`);
      }

      const responseData = await response.json();
      const content = responseData.choices[0].message.content;

      if (!content) {
        throw new Error('Empty response from MistralAI');
      }

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(content);
      } catch (err) {
        console.error('Failed to parse MistralAI ontology response:', content);
        throw new Error('Invalid JSON response from MistralAI');
      }

      if (!parsedResponse.nodes || !parsedResponse.links || 
          !Array.isArray(parsedResponse.nodes) || !Array.isArray(parsedResponse.links)) {
        throw new Error('Invalid response format from MistralAI: missing nodes or links arrays');
      }

      const currentTimestamp = new Date().toISOString();

      const nodes = parsedResponse.nodes.map((node: any) => ({
        ...node,
        dataSource: 'mistral-hybrid',
        timestamp: currentTimestamp
      }));

      // Only filter relationships if we have parsed relations (not raw ontology mode)
      let links;
      if (!useRawOntology && ontology.relations && ontology.relations.length > 0) {
        const allowedRelations = new Set(ontology.relations.map(r => r.name.toLowerCase()));
        links = parsedResponse.links
          .filter((link: any) => {
            const rel = (link.relationship || '').toLowerCase();
            return allowedRelations.has(rel);
          })
          .map((link: any) => ({
            ...link,
            dataSource: 'mistral-hybrid',
            timestamp: currentTimestamp
          }));
      } else {
        // For raw ontology mode, trust the LLM's output
        links = parsedResponse.links.map((link: any) => ({
          ...link,
          dataSource: 'mistral-hybrid',
          timestamp: currentTimestamp
        }));
      }

      return { nodes, links };
    } catch (err) {
      const error = err as Error;
      console.error('Error processing content with MistralAI (ontology mode):', error);
      throw new Error(`MistralAI API error: ${error.message}`);
    }
  }
}

// Factory to create the appropriate service based on the model type
export function createAIService(model: string, apiKey?: string): AIService {
  // Normalize model name to handle various formats like 'gpt-4o', 'openai', 'mistral-large', etc.
  const normalizedModel = model.toLowerCase();
  
  if (normalizedModel.includes('gpt') || normalizedModel === 'openai' || normalizedModel.includes('openai')) {
    if (!apiKey) {
      throw new Error('API key is required for OpenAI');
    }
    return new OpenAIService(apiKey);
  }
  
  if (normalizedModel.includes('mistral')) {
    if (!apiKey) {
      throw new Error('API key is required for MistralAI');
    }
    return new MistralAIService(apiKey);
  }
  
  if (normalizedModel === 'spacy') {
    return new SpacyNLPService();
  }
  
  // Default to local NLP
  return new LocalNLPService();
}