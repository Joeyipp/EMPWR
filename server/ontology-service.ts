import OpenAI from "openai";
import { IStorage } from './storage';
import { OntologyEntity, OntologyRelation, OntologyVersion, Ontology, GenerateOntologyInput, EnrichOntologyInput } from '../shared/schema';
import fetch from 'node-fetch';

export class OntologyService {
  private storage: IStorage;
  private openai?: OpenAI;
  
  constructor(storage: IStorage) {
    this.storage = storage;
  }
  
  /**
   * Set the OpenAI API key for using OpenAI services
   */
  setOpenAIKey(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }
  
  /**
   * Convert a knowledge graph to an ontology
   * @param graph The knowledge graph to convert
   * @param name Name for the new ontology
   * @param domain Domain for the new ontology
   * @returns The created ontology
   */
  async convertFromGraph(graph: any, name: string, domain: string): Promise<Ontology> {
    try {
      // Create a base ontology structure
      const timestamp = new Date().toISOString();
      
      // Track entities by ID to avoid duplicates
      const entityMap = new Map<number, OntologyEntity>();
      // Track relations to avoid duplicates
      const relationMap = new Map<string, OntologyRelation>();
      
      // Track entity types to create schema entries instead of instances
      const entityTypeMap = new Map<string, boolean>();
      
      // First pass: collect all entity types from the graph
      for (const node of graph.nodes) {
        if (!node.name) continue;
        
        // Determine entity type based on node properties
        let entityType = 'Other'; // Default to 'Other' instead of 'Class'
        
        // First check if node has explicit type property
        if (node.type) {
          entityType = node.type;
        } else if (node.entityType) {
          // Use entityType if available
          entityType = node.entityType;
        } else if (node.group) {
          // Map group numbers to common entity types if type is not specified
          switch (node.group) {
            case 1: entityType = 'Person'; break;
            case 2: entityType = 'Place'; break;
            case 3: entityType = 'Concept'; break;
            case 4: entityType = 'Organization'; break;
            case 5: entityType = 'Date'; break;
            default: entityType = 'Other';
          }
        }
        
        // Add this entity type to our map
        entityTypeMap.set(entityType, true);
      }
      
      // Second pass: Create schema entities from the entity types
      let entityId = 1;
      // Convert to array to avoid TypeScript iteration issues
      const entityTypes = Array.from(entityTypeMap.keys());
      for (const entityType of entityTypes) {
        // Create an entity with basic properties representing the schema
        const entity: OntologyEntity = {
          id: entityId,
          name: entityType,
          description: `Schema entity class for ${entityType}`,
          type: 'Class', // Set type to Class to indicate this is a schema entity
          properties: []
        };
        
        // Add to entity map
        entityMap.set(entityId, entity);
        entityId++;
      }
      
      // Collect unique relation types rather than specific relations
      const relationTypeMap = new Map<string, boolean>();
      
      // First, identify all unique types of relationships in the graph
      for (const link of graph.links) {
        // Skip links without valid source or target
        if (typeof link.source !== 'number' && typeof link.source !== 'object') continue;
        if (typeof link.target !== 'number' && typeof link.target !== 'object') continue;
        
        // Use link label as relation name, or default to 'relatedTo'
        const relationName = link.label || 'relatedTo';
        
        // Add this relation type to our map
        relationTypeMap.set(relationName, true);
      }
      
      // Now create schema-level relations between entity types
      let relationId = 1;
      // Convert to array to avoid TypeScript iteration issues
      const relationTypes = Array.from(relationTypeMap.keys());
      for (const relationName of relationTypes) {
        // For each relation type, create schema-level relation definitions
        // between appropriate entity types
        
        // Get entity types from our map
        const entityTypes = Array.from(entityTypeMap.keys());
        
        // For common relations, connect appropriate entity types
        if (relationName === 'hasA' || relationName === 'contains' || relationName === 'includes') {
          // These are general ownership or containment relations
          // Connect them between the main entity types
          for (let i = 0; i < entityTypes.length; i++) {
            for (let j = 0; j < entityTypes.length; j++) {
              if (i !== j) { // Don't create self-relations
                const source = entityTypes[i];
                const target = entityTypes[j];
                
                // Create a unique key for this relation
                const relationKey = `${source}-${relationName}-${target}`;
                
                // Skip if this relation already exists
                if (relationMap.has(relationKey)) continue;
                
                // Create the schema-level relation
                const relation: OntologyRelation = {
                  id: relationId++,
                  name: relationName,
                  source: source,
                  target: target,
                  description: `Schema relation defining that ${source} can ${relationName} ${target}`
                };
                
                // Add to relation map
                relationMap.set(relationKey, relation);
              }
            }
          }
        } else {
          // For other relations, create a representative schema relation 
          // between the first two entity types if we have at least 2
          if (entityTypes.length >= 2) {
            const source = entityTypes[0];
            const target = entityTypes[1];
            
            // Create a unique key for this relation
            const relationKey = `${source}-${relationName}-${target}`;
            
            // Skip if this relation already exists
            if (relationMap.has(relationKey)) continue;
            
            // Create the schema-level relation
            const relation: OntologyRelation = {
              id: relationId++,
              name: relationName,
              source: source,
              target: target,
              description: `Schema relation defining the '${relationName}' relationship`
            };
            
            // Add to relation map
            relationMap.set(relationKey, relation);
          }
        }
      }
      
      // Create a default version
      const version: OntologyVersion = {
        id: 1,
        version: "1.0.0",
        timestamp,
        description: "Initial version converted from knowledge graph",
        changes: []
      };
      
      // Create the ontology
      const ontology: Ontology = {
        id: 0, // Will be set by the database when saved
        userId: null, // Will be set when saved
        name: name || "Converted Graph",
        description: `Ontology converted from knowledge graph with ${entityMap.size} entities and ${relationMap.size} relations`,
        domain: domain || "",
        entities: Array.from(entityMap.values()),
        relations: Array.from(relationMap.values()),
        versions: [version],
        createdAt: timestamp,
        updatedAt: timestamp
      };
      
      return ontology;
    } catch (error: unknown) {
      console.error('Error converting graph to ontology:', error);
      throw new Error(`Failed to convert graph to ontology: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Generate an ontology from a text prompt using an AI model
   * @param input Generation input with prompt and model information
   * @returns The generated ontology
   */
  async generateOntology(input: GenerateOntologyInput): Promise<Ontology> {
    const { prompt, model, apiKey } = input;
    
    // Initialize the appropriate AI client if an API key is provided
    if (apiKey) {
      if (model === 'openai') {
        this.setOpenAIKey(apiKey);
      }
      // For Mistral, we use direct API calls
    }
    
    if (model === 'openai' && !this.openai) {
      throw new Error('OpenAI API key is required but not provided');
    }
    
    // Create system prompt for generating the ontology
    const systemPrompt = `You are an expert ontology designer. Create a comprehensive ontology for the domain described by the user.
    
The ontology should include:
1. Entities/Classes: The main concepts in the domain
2. Properties for each entity
3. Relations between entities

Format your output as a JSON object with the following structure:
{
  "name": "Domain Ontology Name",
  "description": "Brief description of the ontology",
  "domain": "Domain name or category",
  "entities": [
    {
      "id": 1,
      "name": "EntityName",
      "description": "Entity description",
      "type": "Other",  // Can be: Other, Person, Place, Organization, Concept, Date, Class, Property, DataType, ObjectProperty, AnnotationProperty
      "properties": [
        {
          "name": "propertyName",
          "type": "string",  // Can be: string, number, boolean, date, object
          "description": "Property description"
        }
      ]
    }
  ],
  "relations": [
    {
      "id": 1,
      "name": "relationName",
      "source": "SourceEntityName",
      "target": "TargetEntityName",
      "description": "Relation description"
    }
  ]
}

Make sure entity and relation IDs are unique, and that relation sources and targets refer to existing entity names.`;

    try {
      if (model === 'openai' && this.openai) {
        // Use OpenAI to generate the ontology
        const response = await this.openai.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
        });
        
        // Parse the response and construct the ontology
        const content = response.choices[0].message.content || '{}';
        const generatedContent = JSON.parse(content);
        
        // Add default versions array if not present
        if (!generatedContent.versions) {
          generatedContent.versions = [{
            id: 1,
            version: "1.0.0",
            timestamp: new Date().toISOString(),
            description: "Initial version created from prompt",
            changes: []
          }];
        }
        
        const timestamp = new Date().toISOString();
        
        // Create the full ontology object
        const ontology: Ontology = {
          id: 0, // This will be set by the database when saved
          userId: null, // Will be set when saved
          name: generatedContent.name || "Untitled Ontology",
          description: generatedContent.description || "",
          domain: generatedContent.domain || "",
          entities: generatedContent.entities || [],
          relations: generatedContent.relations || [],
          versions: generatedContent.versions,
          createdAt: timestamp,
          updatedAt: timestamp
        };
        
        return ontology;
      } else if (model === 'mistral') {
        // Use Mistral API to generate the ontology
        const mistralApiUrl = 'https://api.mistral.ai/v1/chat/completions';
        const response = await fetch(mistralApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'mistral-large-latest',
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Mistral API error: ${JSON.stringify(errorData)}`);
        }
        
        const responseData = await response.json();
        
        // Parse the response and construct the ontology
        const content = responseData.choices[0].message.content || '{}';
        const generatedContent = JSON.parse(content);
        
        // Add default versions array if not present
        if (!generatedContent.versions) {
          generatedContent.versions = [{
            id: 1,
            version: "1.0.0",
            timestamp: new Date().toISOString(),
            description: "Initial version created from prompt with Mistral AI",
            changes: []
          }];
        }
        
        const timestamp = new Date().toISOString();
        
        // Create the full ontology object
        const ontology: Ontology = {
          id: 0, // This will be set by the database when saved
          userId: null, // Will be set when saved
          name: generatedContent.name || "Untitled Ontology",
          description: generatedContent.description || "",
          domain: generatedContent.domain || "",
          entities: generatedContent.entities || [],
          relations: generatedContent.relations || [],
          versions: generatedContent.versions,
          createdAt: timestamp,
          updatedAt: timestamp
        };
        
        return ontology;
      } else {
        throw new Error(`Model ${model} is not supported or API key is missing`);
      }
    } catch (error) {
      console.error('Error generating ontology:', error);
      throw new Error(`Failed to generate ontology: ${error.message}`);
    }
  }
  
  /**
   * Enrich an existing ontology with additional entities and relations
   * @param input Enrichment input with ontology and model information
   * @returns The enriched ontology
   */
  async enrichOntology(input: EnrichOntologyInput): Promise<Ontology> {
    const { ontology, model, apiKey, enrichmentType } = input;
    
    // Check if we're using schema.org enrichment
    if (enrichmentType === 'schema') {
      // Implement schema.org enrichment
      return this.enrichWithSchemaOrg(ontology);
    }
    
    // Otherwise proceed with AI-based enrichment
    // Initialize the appropriate AI client if an API key is provided
    if (apiKey) {
      if (model === 'openai') {
        this.setOpenAIKey(apiKey);
      }
      // For Mistral, we use direct API calls
    }
    
    if (model === 'openai' && !this.openai) {
      throw new Error('OpenAI API key is required but not provided');
    }
    
    // Create system prompt for enriching the ontology
    const systemPrompt = `You are an expert ontology designer. Analyze the provided ontology and suggest improvements by adding missing entities, properties, and relations based on domain knowledge.

The current ontology is provided in JSON format. Enhance it by:
1. Adding missing entities and their properties
2. Adding important relationships between entities
3. Improving entity and property descriptions

Return the improved ontology as a complete JSON object with the same structure as the input.
Do not remove any existing entities or relationships, only add new ones or enhance existing ones.

For entity types, use one of the following: "Other", "Person", "Place", "Organization", "Concept", "Date", "Class", "Property", "DataType", "ObjectProperty", "AnnotationProperty".
Default to "Other" if the entity doesn't clearly fit into any specific category.

Format must match:
{
  "name": "Ontology Name",
  "description": "Ontology description",
  "domain": "Domain name",
  "entities": [...], // entities with id, name, description, type, and properties
  "relations": [...], // relations with id, name, source, target, and description
  "versions": [...] // keep versions from input and add a new one for this enrichment
}`;

    try {
      if (model === 'openai' && this.openai) {
        // Create a new version for this enrichment
        const newVersionId = Math.max(0, ...ontology.versions.map(v => v.id)) + 1;
        const newVersion: OntologyVersion = {
          id: newVersionId,
          version: `1.${newVersionId}.0`,
          timestamp: new Date().toISOString(),
          description: "AI-assisted enrichment",
          changes: []
        };
        
        // Use OpenAI to enrich the ontology
        const response = await this.openai.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: JSON.stringify(ontology) }
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
        });
        
        // Parse the response and update the ontology
        const content = response.choices[0].message.content || '{}';
        const enrichedContent = JSON.parse(content);
        
        // Track changes for the version history
        const changes: {
          type: 'add' | 'update' | 'delete';
          element: 'entity' | 'relation';
          name: string;
          description: string;
        }[] = [];
        
        // Check for new entities
        const existingEntityNames = new Set(ontology.entities.map(e => e.name));
        for (const entity of enrichedContent.entities) {
          if (!existingEntityNames.has(entity.name)) {
            changes.push({
              type: 'add',
              element: 'entity',
              name: entity.name,
              description: entity.description || ""
            });
          }
        }
        
        // Check for new relations
        const existingRelations = new Set(
          ontology.relations.map(r => `${r.source}-${r.name}-${r.target}`)
        );
        for (const relation of enrichedContent.relations) {
          const relationKey = `${relation.source}-${relation.name}-${relation.target}`;
          if (!existingRelations.has(relationKey)) {
            changes.push({
              type: 'add',
              element: 'relation',
              name: `${relation.source} ${relation.name} ${relation.target}`,
              description: relation.description || ""
            });
          }
        }
        
        // Update the version with the changes
        newVersion.changes = changes;
        
        // Create a copy of the versions array with the new version
        const updatedVersions = [...enrichedContent.versions || ontology.versions, newVersion];
        
        // Return the enriched ontology
        const enrichedOntology: Ontology = {
          id: ontology.id,
          userId: ontology.userId,
          name: enrichedContent.name || ontology.name,
          description: enrichedContent.description || ontology.description || null,
          domain: enrichedContent.domain || ontology.domain || null,
          entities: enrichedContent.entities || [],
          relations: enrichedContent.relations || [],
          versions: updatedVersions,
          createdAt: ontology.createdAt,
          updatedAt: new Date().toISOString()
        };
        
        return enrichedOntology;
      } else if (model === 'mistral') {
        // Create a new version for this enrichment
        const newVersionId = Math.max(0, ...ontology.versions.map(v => v.id)) + 1;
        const newVersion: OntologyVersion = {
          id: newVersionId,
          version: `1.${newVersionId}.0`,
          timestamp: new Date().toISOString(),
          description: "AI-assisted enrichment with Mistral",
          changes: []
        };
        
        // Use Mistral API to enrich the ontology
        const mistralApiUrl = 'https://api.mistral.ai/v1/chat/completions';
        const response = await fetch(mistralApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'mistral-large-latest',
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: JSON.stringify(ontology) }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Mistral API error: ${JSON.stringify(errorData)}`);
        }
        
        const responseData = await response.json();
        
        // Parse the response and update the ontology
        const content = responseData.choices[0].message.content || '{}';
        const enrichedContent = JSON.parse(content);
        
        // Track changes for the version history
        const changes: {
          type: 'add' | 'update' | 'delete';
          element: 'entity' | 'relation';
          name: string;
          description: string;
        }[] = [];
        
        // Check for new entities
        const existingEntityNames = new Set(ontology.entities.map(e => e.name));
        for (const entity of enrichedContent.entities) {
          if (!existingEntityNames.has(entity.name)) {
            changes.push({
              type: 'add',
              element: 'entity',
              name: entity.name,
              description: entity.description || ""
            });
          }
        }
        
        // Check for new relations
        const existingRelations = new Set(
          ontology.relations.map(r => `${r.source}-${r.name}-${r.target}`)
        );
        for (const relation of enrichedContent.relations) {
          const relationKey = `${relation.source}-${relation.name}-${relation.target}`;
          if (!existingRelations.has(relationKey)) {
            changes.push({
              type: 'add',
              element: 'relation',
              name: `${relation.source} ${relation.name} ${relation.target}`,
              description: relation.description || ""
            });
          }
        }
        
        // Update the version with the changes
        newVersion.changes = changes;
        
        // Create a copy of the versions array with the new version
        const updatedVersions = [...enrichedContent.versions || ontology.versions, newVersion];
        
        // Return the enriched ontology
        const enrichedOntology: Ontology = {
          id: ontology.id,
          userId: ontology.userId,
          name: enrichedContent.name || ontology.name,
          description: enrichedContent.description || ontology.description || null,
          domain: enrichedContent.domain || ontology.domain || null,
          entities: enrichedContent.entities || [],
          relations: enrichedContent.relations || [],
          versions: updatedVersions,
          createdAt: ontology.createdAt,
          updatedAt: new Date().toISOString()
        };
        
        return enrichedOntology;
      } else {
        throw new Error(`Model ${model} is not supported or API key is missing`);
      }
    } catch (error) {
      console.error('Error enriching ontology:', error);
      throw new Error(`Failed to enrich ontology: ${error.message}`);
    }
  }
  
  /**
   * Convert an uploaded file to an ontology
   * This would parse formats like RDF, TTL, JSON-LD in a real implementation
   * @param file The file content
   * @param format The file format (rdf, ttl, jsonld)
   * @returns The ontology object
   */
  async parseOntologyFile(fileContent: string, format: string): Promise<Ontology> {
    try {
      const timestamp = new Date().toISOString();
      let entities: OntologyEntity[] = [];
      let relations: OntologyRelation[] = [];
      let ontologyName = "Imported Ontology";
      let ontologyDescription = "Imported from file";
      let domain = "";
      
      const normalizedFormat = format.toLowerCase();
      
      if (normalizedFormat === 'jsonld' || normalizedFormat === 'json') {
        // Parse JSON-LD format
        const parsedContent = JSON.parse(fileContent);
        entities = parsedContent.entities || [];
        relations = parsedContent.relations || [];
        ontologyName = parsedContent.name || ontologyName;
        ontologyDescription = parsedContent.description || ontologyDescription;
        domain = parsedContent.domain || domain;
      } else if (normalizedFormat === 'rdf' || normalizedFormat === 'owl' || normalizedFormat === 'rdfs') {
        // Parse RDF/XML, OWL, or RDFS formats
        const parseResult = this.parseRdfXml(fileContent);
        entities = parseResult.entities;
        relations = parseResult.relations;
        ontologyName = parseResult.name || ontologyName;
        ontologyDescription = parseResult.description || ontologyDescription;
        domain = parseResult.domain || domain;
      } else if (normalizedFormat === 'ttl' || normalizedFormat === 'turtle' || normalizedFormat === 'n3') {
        // Parse Turtle/N3 format
        const parseResult = this.parseTurtle(fileContent);
        entities = parseResult.entities;
        relations = parseResult.relations;
        ontologyName = parseResult.name || ontologyName;
        ontologyDescription = parseResult.description || ontologyDescription;
        domain = parseResult.domain || domain;
      } else {
        throw new Error(`Unsupported format: ${format}. Supported formats are: RDF, OWL, RDFS, TTL, N3, JSON-LD`);
      }
      
      // Create a default version
      const versions: OntologyVersion[] = [{
        id: 1,
        version: "1.0.0",
        timestamp,
        description: "Initial version from file import",
        changes: []
      }];
      
      // Create the ontology
      const ontology: Ontology = {
        id: 0, // Will be set by the database when saved
        userId: null, // Will be set when saved
        name: ontologyName,
        description: ontologyDescription,
        domain,
        entities,
        relations,
        versions,
        createdAt: timestamp,
        updatedAt: timestamp,
        rawContent: fileContent // Store raw content for LLM processing
      };
      
      return ontology;
    } catch (error) {
      console.error('Error parsing ontology file:', error);
      throw new Error(`Failed to parse ontology file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse RDF/XML, OWL, or RDFS content
   */
  private parseRdfXml(content: string): { entities: OntologyEntity[], relations: OntologyRelation[], name?: string, description?: string, domain?: string } {
    const entities: OntologyEntity[] = [];
    const relations: OntologyRelation[] = [];
    let ontologyName: string | undefined;
    let ontologyDescription: string | undefined;
    let domain: string | undefined;
    
    try {
      // Extract ontology metadata
      const ontologyMatch = content.match(/<(?:rdf:RDF|owl:Ontology)[^>]*>/i);
      if (ontologyMatch) {
        const aboutMatch = content.match(/rdf:about="([^"]+)"/i);
        if (aboutMatch) {
          domain = aboutMatch[1];
        }
      }
      
      // Extract ontology title/label
      const titleMatch = content.match(/<(?:rdfs:label|dc:title|dcterms:title)[^>]*>([^<]+)</i);
      if (titleMatch) {
        ontologyName = titleMatch[1].trim();
      }
      
      // Extract ontology description
      const descMatch = content.match(/<(?:rdfs:comment|dc:description|dcterms:description)[^>]*>([^<]+)</i);
      if (descMatch) {
        ontologyDescription = descMatch[1].trim();
      }
      
      // Extract classes (entities)
      const classRegex = /<(?:owl:Class|rdfs:Class)[^>]*(?:rdf:about|rdf:ID)="([^"]+)"[^>]*>/gi;
      let classMatch;
      const classMap = new Map<string, OntologyEntity>();
      
      while ((classMatch = classRegex.exec(content)) !== null) {
        const classUri = classMatch[1];
        const className = this.extractLocalName(classUri);
        
        if (!classMap.has(classUri)) {
          // Extract class label
          const classPattern = new RegExp(`<(?:owl:Class|rdfs:Class)[^>]*(?:rdf:about|rdf:ID)="${this.escapeRegex(classUri)}"[^>]*>([\\s\\S]*?)</(?:owl:Class|rdfs:Class)>`, 'i');
          const classContentMatch = content.match(classPattern);
          
          let label = className;
          let description = '';
          let properties: Array<{ name: string; type: string; description: string }> = [];
          
          if (classContentMatch) {
            const classContent = classContentMatch[1];
            
            // Extract label
            const labelMatch = classContent.match(/<rdfs:label[^>]*>([^<]+)</i);
            if (labelMatch) {
              label = labelMatch[1].trim();
            }
            
            // Extract comment/description
            const commentMatch = classContent.match(/<rdfs:comment[^>]*>([^<]+)</i);
            if (commentMatch) {
              description = commentMatch[1].trim();
            }
          }
          
          // Extract properties for this class
          const propertyRegex = new RegExp(`<(?:owl:DatatypeProperty|owl:ObjectProperty|rdf:Property)[^>]*>([\\s\\S]*?)<rdfs:domain[^>]*rdf:resource="[^"]*${this.escapeRegex(classUri)}"[^>]*/>([\\s\\S]*?)</(?:owl:DatatypeProperty|owl:ObjectProperty|rdf:Property)>`, 'gi');
          let propMatch;
          
          while ((propMatch = propertyRegex.exec(content)) !== null) {
            const propContent = propMatch[0];
            const propUriMatch = propContent.match(/(?:rdf:about|rdf:ID)="([^"]+)"/);
            if (propUriMatch) {
              const propUri = propUriMatch[1];
              const propName = this.extractLocalName(propUri);
              
              const propLabelMatch = propContent.match(/<rdfs:label[^>]*>([^<]+)</i);
              const propLabel = propLabelMatch ? propLabelMatch[1].trim() : propName;
              
              const propCommentMatch = propContent.match(/<rdfs:comment[^>]*>([^<]+)</i);
              const propComment = propCommentMatch ? propCommentMatch[1].trim() : '';
              
              // Determine property type
              let propType = 'string';
              if (propContent.includes('owl:DatatypeProperty')) {
                const rangeMatch = propContent.match(/<rdfs:range[^>]*rdf:resource="([^"]+)"/);
                if (rangeMatch) {
                  const rangeUri = rangeMatch[1];
                  if (rangeUri.includes('int') || rangeUri.includes('Integer')) propType = 'integer';
                  else if (rangeUri.includes('float') || rangeUri.includes('double') || rangeUri.includes('decimal')) propType = 'number';
                  else if (rangeUri.includes('boolean')) propType = 'boolean';
                  else if (rangeUri.includes('date')) propType = 'date';
                }
              } else if (propContent.includes('owl:ObjectProperty')) {
                propType = 'reference';
              }
              
              properties.push({
                name: propLabel,
                type: propType,
                description: propComment
              });
            }
          }
          
          const entity: OntologyEntity = {
            id: entities.length + 1,
            name: label,
            type: 'Class',
            description,
            properties,
            namespace: this.extractNamespace(classUri)
          };
          
          entities.push(entity);
          classMap.set(classUri, entity);
        }
      }
      
      // Extract object properties (relations)
      const objectPropRegex = /<owl:ObjectProperty[^>]*(?:rdf:about|rdf:ID)="([^"]+)"[^>]*>([\s\S]*?)<\/owl:ObjectProperty>/gi;
      let objPropMatch;
      
      while ((objPropMatch = objectPropRegex.exec(content)) !== null) {
        const propUri = objPropMatch[1];
        const propContent = objPropMatch[2];
        const propName = this.extractLocalName(propUri);
        
        // Extract label
        const labelMatch = propContent.match(/<rdfs:label[^>]*>([^<]+)</i);
        const label = labelMatch ? labelMatch[1].trim() : propName;
        
        // Extract comment
        const commentMatch = propContent.match(/<rdfs:comment[^>]*>([^<]+)</i);
        const description = commentMatch ? commentMatch[1].trim() : '';
        
        // Extract domain and range
        const domainMatch = propContent.match(/<rdfs:domain[^>]*rdf:resource="([^"]+)"/);
        const rangeMatch = propContent.match(/<rdfs:range[^>]*rdf:resource="([^"]+)"/);
        
        if (domainMatch && rangeMatch) {
          const domainUri = domainMatch[1];
          const rangeUri = rangeMatch[1];
          const domainEntity = classMap.get(domainUri);
          const rangeEntity = classMap.get(rangeUri);
          
          if (domainEntity && rangeEntity) {
            const relation: OntologyRelation = {
              id: relations.length + 1,
              name: label,
              sourceEntityId: domainEntity.id,
              targetEntityId: rangeEntity.id,
              type: 'objectProperty',
              description,
              namespace: this.extractNamespace(propUri)
            };
            
            relations.push(relation);
          }
        }
      }
      
    } catch (error) {
      console.error('Error parsing RDF/XML content:', error);
      throw new Error('Failed to parse RDF/XML content');
    }
    
    return { entities, relations, name: ontologyName, description: ontologyDescription, domain };
  }

  /**
   * Parse Turtle/N3 content
   */
  private parseTurtle(content: string): { entities: OntologyEntity[], relations: OntologyRelation[], name?: string, description?: string, domain?: string } {
    const entities: OntologyEntity[] = [];
    const relations: OntologyRelation[] = [];
    let ontologyName: string | undefined;
    let ontologyDescription: string | undefined;
    let domain: string | undefined;
    
    try {
      // Split content into triples
      const lines = content.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
      const prefixes = new Map<string, string>();
      const classMap = new Map<string, OntologyEntity>();
      const statements: Array<{ subject: string; predicate: string; object: string }> = [];
      
      // Extract prefixes
      for (const line of lines) {
        const prefixMatch = line.match(/@prefix\s+(\w+):\s*<([^>]+)>\s*\./);
        if (prefixMatch) {
          prefixes.set(prefixMatch[1], prefixMatch[2]);
        }
      }
      
      // Parse statements
      let currentSubject = '';
      for (const line of lines) {
        if (line.startsWith('@')) continue; // Skip directives
        
        // Handle multi-line statements
        if (line.includes(' a ') || line.includes(' rdf:type ')) {
          const parts = line.split(/\s+/);
          if (parts.length >= 3) {
            currentSubject = parts[0];
            const predicate = parts[1];
            const object = parts.slice(2).join(' ').replace(/[;.]$/, '');
            statements.push({ subject: currentSubject, predicate, object });
          }
        } else if (currentSubject && (line.includes(' rdfs:label ') || line.includes(' rdfs:comment ') || line.includes(' rdfs:domain ') || line.includes(' rdfs:range '))) {
          const parts = line.split(/\s+/);
          if (parts.length >= 2) {
            const predicate = parts[0];
            const object = parts.slice(1).join(' ').replace(/[;.]$/, '');
            statements.push({ subject: currentSubject, predicate, object });
          }
        }
      }
      
      // Process class definitions
      for (const stmt of statements) {
        if (stmt.predicate === 'a' || stmt.predicate === 'rdf:type') {
          if (stmt.object === 'owl:Class' || stmt.object === 'rdfs:Class') {
            const classUri = this.expandUri(stmt.subject, prefixes);
            const className = this.extractLocalName(classUri);
            
            if (!classMap.has(classUri)) {
              const entity: OntologyEntity = {
                id: entities.length + 1,
                name: className,
                type: 'Class',
                description: '',
                properties: [],
                namespace: this.extractNamespace(classUri)
              };
              
              entities.push(entity);
              classMap.set(classUri, entity);
            }
          }
        }
      }
      
      // Process labels and comments
      for (const stmt of statements) {
        if (stmt.predicate === 'rdfs:label') {
          const classUri = this.expandUri(stmt.subject, prefixes);
          const entity = classMap.get(classUri);
          if (entity) {
            entity.name = stmt.object.replace(/^"(.+)".*$/, '$1');
          }
        } else if (stmt.predicate === 'rdfs:comment') {
          const classUri = this.expandUri(stmt.subject, prefixes);
          const entity = classMap.get(classUri);
          if (entity) {
            entity.description = stmt.object.replace(/^"(.+)".*$/, '$1');
          }
        }
      }
      
      // Process object properties for relations
      for (const stmt of statements) {
        if (stmt.predicate === 'a' || stmt.predicate === 'rdf:type') {
          if (stmt.object === 'owl:ObjectProperty') {
            const propUri = this.expandUri(stmt.subject, prefixes);
            const propName = this.extractLocalName(propUri);
            
            // Find domain and range for this property
            let domainUri = '';
            let rangeUri = '';
            
            for (const domainStmt of statements) {
              if (domainStmt.subject === stmt.subject && domainStmt.predicate === 'rdfs:domain') {
                domainUri = this.expandUri(domainStmt.object, prefixes);
              }
              if (domainStmt.subject === stmt.subject && domainStmt.predicate === 'rdfs:range') {
                rangeUri = this.expandUri(domainStmt.object, prefixes);
              }
            }
            
            if (domainUri && rangeUri) {
              const domainEntity = classMap.get(domainUri);
              const rangeEntity = classMap.get(rangeUri);
              
              if (domainEntity && rangeEntity) {
                // Get label for the property
                let propLabel = propName;
                for (const labelStmt of statements) {
                  if (labelStmt.subject === stmt.subject && labelStmt.predicate === 'rdfs:label') {
                    propLabel = labelStmt.object.replace(/^"(.+)".*$/, '$1');
                    break;
                  }
                }
                
                // Get description for the property
                let propDescription = '';
                for (const commentStmt of statements) {
                  if (commentStmt.subject === stmt.subject && commentStmt.predicate === 'rdfs:comment') {
                    propDescription = commentStmt.object.replace(/^"(.+)".*$/, '$1');
                    break;
                  }
                }
                
                const relation: OntologyRelation = {
                  id: relations.length + 1,
                  name: propLabel,
                  sourceEntityId: domainEntity.id,
                  targetEntityId: rangeEntity.id,
                  type: 'objectProperty',
                  description: propDescription,
                  namespace: this.extractNamespace(propUri)
                };
                
                relations.push(relation);
              }
            }
          }
        }
      }
      
    } catch (error) {
      console.error('Error parsing Turtle content:', error);
      throw new Error('Failed to parse Turtle content');
    }
    
    return { entities, relations, name: ontologyName, description: ontologyDescription, domain };
  }

  /**
   * Helper method to extract local name from URI
   */
  private extractLocalName(uri: string): string {
    const lastSlash = uri.lastIndexOf('/');
    const lastHash = uri.lastIndexOf('#');
    const separator = Math.max(lastSlash, lastHash);
    return separator >= 0 ? uri.substring(separator + 1) : uri;
  }

  /**
   * Helper method to extract namespace from URI
   */
  private extractNamespace(uri: string): string {
    const lastSlash = uri.lastIndexOf('/');
    const lastHash = uri.lastIndexOf('#');
    const separator = Math.max(lastSlash, lastHash);
    return separator >= 0 ? uri.substring(0, separator + 1) : '';
  }

  /**
   * Helper method to escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Helper method to expand prefixed URIs in Turtle
   */
  private expandUri(uri: string, prefixes: Map<string, string>): string {
    if (uri.startsWith('<') && uri.endsWith('>')) {
      return uri.slice(1, -1);
    }
    
    const colonIndex = uri.indexOf(':');
    if (colonIndex > 0) {
      const prefix = uri.substring(0, colonIndex);
      const localName = uri.substring(colonIndex + 1);
      const namespace = prefixes.get(prefix);
      if (namespace) {
        return namespace + localName;
      }
    }
    
    return uri;
  }
  
  /**
   * Export an ontology to a specific format
   * @param ontology The ontology to export
   * @param format The target format (rdf, ttl, jsonld)
   * @returns The formatted ontology as a string
   */
  async exportOntology(ontology: Ontology, format: string): Promise<string> {
    try {
      // Handle different format aliases
      const normalizedFormat = format.toLowerCase();
      
      if (normalizedFormat === 'jsonld' || normalizedFormat === 'json') {
        // Convert to JSON-LD format
        return this.convertToJsonLD(ontology);
      } else if (normalizedFormat === 'ttl' || normalizedFormat === 'turtle') {
        // Convert to Turtle format
        return this.convertToTurtle(ontology);
      } else if (normalizedFormat === 'rdf' || normalizedFormat === 'rdfxml') {
        // Convert to RDF/XML format
        return this.convertToRDF(ontology);
      } else {
        throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error: any) {
      console.error('Error exporting ontology:', error);
      throw new Error(`Failed to export ontology: ${error?.message || 'Unknown error'}`);
    }
  }
  
  /**
   * Convert ontology to JSON-LD format
   * @param ontology The ontology to convert
   * @returns A JSON-LD representation of the ontology
   */
  private convertToJsonLD(ontology: Ontology): string {
    // Ensure arrays are properly handled
    const entities = Array.isArray(ontology.entities) ? ontology.entities : [];
    const relations = Array.isArray(ontology.relations) ? ontology.relations : [];
    const safeName = (ontology.name || 'Ontology').replace(/\s+/g, '_');
    
    // Create a proper JSON-LD structure
    const jsonLD = {
      "@context": {
        "owl": "http://www.w3.org/2002/07/owl#",
        "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
        "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
        "xsd": "http://www.w3.org/2001/XMLSchema#",
        "schema": "http://schema.org/",
        "onto": `http://example.org/ontology/${safeName}#`
      },
      "@id": `http://example.org/ontology/${safeName}`,
      "@type": "owl:Ontology",
      "rdfs:label": ontology.name || 'Ontology',
      "rdfs:comment": ontology.description || '',
      "entities": entities.map(entity => ({
        "@id": `onto:${(entity.name || 'Entity').replace(/\s+/g, '_')}`,
        "@type": "owl:Class",
        "rdfs:label": entity.name || '',
        "rdfs:comment": entity.description || '',
        "properties": (entity.properties || []).map(prop => ({
          "@id": `onto:${(prop.name || 'property').replace(/\s+/g, '_')}`,
          "@type": "owl:DatatypeProperty",
          "rdfs:domain": { "@id": `onto:${(entity.name || 'Entity').replace(/\s+/g, '_')}` },
          "rdfs:range": { "@id": `xsd:${prop.type || 'string'}` },
          "rdfs:label": prop.name || '',
          "rdfs:comment": prop.description || ''
        }))
      })),
      "relations": relations.map(relation => ({
        "@id": `onto:${(relation.name || 'relation').replace(/\s+/g, '_')}`,
        "@type": "owl:ObjectProperty",
        "rdfs:domain": { "@id": `onto:${(relation.source || 'Source').replace(/\s+/g, '_')}` },
        "rdfs:range": { "@id": `onto:${(relation.target || 'Target').replace(/\s+/g, '_')}` },
        "rdfs:label": relation.name || '',
        "rdfs:comment": relation.description || ''
      }))
    };
    
    return JSON.stringify(jsonLD, null, 2);
  }
  
  /**
   * Enrich an ontology with schema.org definitions
   * @param ontology The ontology to enrich
   * @returns The enriched ontology
   */
  private async enrichWithSchemaOrg(ontology: Ontology): Promise<Ontology> {
    try {
      // Create a new version for this enrichment
      const newVersionId = Math.max(0, ...ontology.versions.map(v => v.id)) + 1;
      const newVersion: OntologyVersion = {
        id: newVersionId,
        version: `1.${newVersionId}.0`,
        timestamp: new Date().toISOString(),
        description: "Schema.org enrichment",
        changes: []
      };
      
      // Track changes
      const changes: {
        type: 'add' | 'update' | 'delete';
        element: 'entity' | 'relation';
        name: string;
        description: string;
      }[] = [];
      
      // Create sets for existing entities and relations
      const existingEntityNames = new Set(ontology.entities.map(e => e.name.toLowerCase()));
      const existingRelations = new Set(
        ontology.relations.map(r => `${r.source.toLowerCase()}-${r.name.toLowerCase()}-${r.target.toLowerCase()}`)
      );
      
      // Map for schema.org types to standard types
      const schemaTypeMap: Record<string, string> = {
        'Person': 'Person',
        'Organization': 'Organization',
        'Place': 'Place',
        'Event': 'Other',
        'Product': 'Other',
        'CreativeWork': 'Other',
        'Thing': 'Other'
      };
      
      // Map for schema.org properties to standard property types
      const schemaPropertyTypeMap: Record<string, string> = {
        'text': 'string',
        'URL': 'string',
        'DateTime': 'date',
        'Number': 'number',
        'Integer': 'number',
        'Boolean': 'boolean'
      };
      
      // Get a list of common schema.org types and properties relevant to the domain
      const relevantSchemaTypes = this.getRelevantSchemaTypes(ontology.domain);
      
      // Add schema.org entities
      let nextEntityId = Math.max(0, ...ontology.entities.map(e => e.id)) + 1;
      const newEntities: OntologyEntity[] = [];
      
      for (const schemaType of relevantSchemaTypes) {
        const typeName = schemaType.name;
        const typeNameLower = typeName.toLowerCase();
        
        // Skip if this entity already exists
        if (existingEntityNames.has(typeNameLower)) continue;
        
        // Create a new entity
        const newEntity: OntologyEntity = {
          id: nextEntityId++,
          name: typeName,
          description: schemaType.description || `Schema.org ${typeName} type`,
          type: schemaTypeMap[typeName] || 'Class',
          properties: schemaType.properties.map(prop => ({
            name: prop.name,
            type: schemaPropertyTypeMap[prop.type] || 'string',
            description: prop.description || ''
          }))
        };
        
        newEntities.push(newEntity);
        
        // Add to changes
        changes.push({
          type: 'add',
          element: 'entity',
          name: typeName,
          description: `Added from Schema.org: ${typeName}`
        });
      }
      
      // Add schema.org relations
      let nextRelationId = Math.max(0, ...ontology.relations.map(r => r.id)) + 1;
      const newRelations: OntologyRelation[] = [];
      
      // Add common relations between schema.org types
      for (const relation of this.getCommonSchemaRelations()) {
        const relationKey = `${relation.source.toLowerCase()}-${relation.name.toLowerCase()}-${relation.target.toLowerCase()}`;
        
        // Skip if this relation already exists
        if (existingRelations.has(relationKey)) continue;
        
        // Skip if source or target doesn't exist in our combined entity list
        const sourceExists = existingEntityNames.has(relation.source.toLowerCase()) || 
          newEntities.some(e => e.name.toLowerCase() === relation.source.toLowerCase());
        const targetExists = existingEntityNames.has(relation.target.toLowerCase()) || 
          newEntities.some(e => e.name.toLowerCase() === relation.target.toLowerCase());
        
        if (!sourceExists || !targetExists) continue;
        
        // Create a new relation
        const newRelation: OntologyRelation = {
          id: nextRelationId++,
          name: relation.name,
          source: relation.source,
          target: relation.target,
          description: relation.description || `Schema.org relation between ${relation.source} and ${relation.target}`
        };
        
        newRelations.push(newRelation);
        
        // Add to changes
        changes.push({
          type: 'add',
          element: 'relation',
          name: `${relation.source} ${relation.name} ${relation.target}`,
          description: `Added from Schema.org`
        });
      }
      
      // Update the version with the changes
      newVersion.changes = changes;
      
      // Return the enriched ontology
      const enrichedOntology: Ontology = {
        ...ontology,
        entities: [...ontology.entities, ...newEntities],
        relations: [...ontology.relations, ...newRelations],
        versions: [...ontology.versions, newVersion],
        updatedAt: new Date().toISOString()
      };
      
      return enrichedOntology;
    } catch (error) {
      console.error('Error enriching with Schema.org:', error);
      throw new Error(`Failed to enrich with Schema.org: ${error.message}`);
    }
  }
  
  /**
   * Get schema.org types relevant to the specified domain
   * @param domain The domain to find relevant schema.org types for
   * @returns List of relevant schema.org types
   */
  private getRelevantSchemaTypes(domain: string): Array<{
    name: string;
    description: string;
    properties: Array<{
      name: string;
      type: string;
      description: string;
    }>;
  }> {
    // This is a simplified implementation
    // In a real implementation, this would fetch from schema.org or a local cache
    
    // Default schema.org types that are commonly used
    const commonTypes = [
      {
        name: 'Person',
        description: 'A person (alive, dead, undead, or fictional).',
        properties: [
          { name: 'givenName', type: 'text', description: 'Given name. In the U.S., the first name of a Person.' },
          { name: 'familyName', type: 'text', description: 'Family name. In the U.S., the last name of a Person.' },
          { name: 'birthDate', type: 'Date', description: 'Date of birth.' },
          { name: 'email', type: 'text', description: 'Email address.' },
          { name: 'telephone', type: 'text', description: 'Telephone number.' }
        ]
      },
      {
        name: 'Organization',
        description: 'An organization such as a school, NGO, corporation, club, etc.',
        properties: [
          { name: 'name', type: 'text', description: 'The name of the organization.' },
          { name: 'legalName', type: 'text', description: 'The official name of the organization, e.g. the registered company name.' },
          { name: 'foundingDate', type: 'Date', description: 'The date that this organization was founded.' },
          { name: 'email', type: 'text', description: 'Email address.' },
          { name: 'telephone', type: 'text', description: 'Telephone number.' }
        ]
      },
      {
        name: 'Place',
        description: 'Entities that have a somewhat fixed, physical extension.',
        properties: [
          { name: 'name', type: 'text', description: 'The name of the place.' },
          { name: 'address', type: 'text', description: 'Physical address of the item.' },
          { name: 'latitude', type: 'Number', description: 'The latitude of a location.' },
          { name: 'longitude', type: 'Number', description: 'The longitude of a location.' }
        ]
      }
    ];
    
    // Domain-specific schema.org types
    // In a real implementation, this would be a more comprehensive mapping
    const domainMap: Record<string, Array<{
      name: string;
      description: string;
      properties: Array<{
        name: string;
        type: string;
        description: string;
      }>;
    }>> = {
      'education': [
        {
          name: 'EducationalOrganization',
          description: 'An educational organization.',
          properties: [
            { name: 'name', type: 'text', description: 'The name of the organization.' },
            { name: 'alumni', type: 'Person', description: 'Alumni of an organization.' }
          ]
        },
        {
          name: 'Course',
          description: 'A description of an educational course.',
          properties: [
            { name: 'name', type: 'text', description: 'The name of the course.' },
            { name: 'description', type: 'text', description: 'A description of the course.' },
            { name: 'courseCode', type: 'text', description: 'The identifier for the Course used by the course provider.' }
          ]
        }
      ],
      'business': [
        {
          name: 'Product',
          description: 'Any offered product or service.',
          properties: [
            { name: 'name', type: 'text', description: 'The name of the product.' },
            { name: 'description', type: 'text', description: 'A description of the product.' },
            { name: 'price', type: 'Number', description: 'The price of the product.' },
            { name: 'brand', type: 'text', description: 'The brand of the product.' }
          ]
        },
        {
          name: 'Offer',
          description: 'An offer to transfer some rights to an item or to provide a service.',
          properties: [
            { name: 'price', type: 'Number', description: 'The offer price of a product.' },
            { name: 'priceCurrency', type: 'text', description: 'The currency of the price.' },
            { name: 'availability', type: 'text', description: 'The availability of this item.' }
          ]
        }
      ],
      'health': [
        {
          name: 'MedicalCondition',
          description: 'Any condition of the human body that affects the normal functioning of a person.',
          properties: [
            { name: 'name', type: 'text', description: 'The name of the condition.' },
            { name: 'associatedAnatomy', type: 'text', description: 'The anatomy that is affected by the condition.' },
            { name: 'possibleTreatment', type: 'text', description: 'A possible treatment for the condition.' }
          ]
        },
        {
          name: 'MedicalTherapy',
          description: 'A medical therapy is a treatment of a patient aimed at preventing or curing a disease.',
          properties: [
            { name: 'name', type: 'text', description: 'The name of the therapy.' },
            { name: 'indication', type: 'text', description: 'A factor that indicates use of this therapy.' },
            { name: 'contraindication', type: 'text', description: 'A contraindication for this therapy.' }
          ]
        }
      ]
    };
    
    // Convert domain to lowercase and remove spaces
    const normalizedDomain = domain.toLowerCase().replace(/\s+/g, '');
    
    // Get domain-specific types
    let relevantTypes = [...commonTypes];
    
    // Check if we have specific types for this domain
    for (const [key, types] of Object.entries(domainMap)) {
      if (normalizedDomain.includes(key)) {
        relevantTypes = [...relevantTypes, ...types];
      }
    }
    
    return relevantTypes;
  }
  
  /**
   * Get common relations between schema.org types
   * @returns List of common schema.org relations
   */
  private getCommonSchemaRelations(): Array<{
    source: string;
    target: string;
    name: string;
    description: string;
  }> {
    // This is a simplified implementation
    // In a real implementation, this would be more comprehensive
    return [
      {
        source: 'Person',
        target: 'Organization',
        name: 'memberOf',
        description: 'An Organization to which this Person belongs.'
      },
      {
        source: 'Organization',
        target: 'Person',
        name: 'employee',
        description: 'Someone working for this organization.'
      },
      {
        source: 'Person',
        target: 'Place',
        name: 'birthPlace',
        description: 'The place where the person was born.'
      },
      {
        source: 'Organization',
        target: 'Place',
        name: 'location',
        description: 'The location of the organization.'
      },
      {
        source: 'Organization',
        target: 'Organization',
        name: 'parentOrganization',
        description: 'The larger organization that this organization is a part of.'
      }
    ];
  }
  
  /**
   * Convert ontology to Turtle format (simplified)
   * @param ontology The ontology to convert
   * @returns A Turtle representation of the ontology
   */
  private convertToTurtle(ontology: Ontology): string {
    // Ensure arrays are properly handled
    const entities = Array.isArray(ontology.entities) ? ontology.entities : [];
    const relations = Array.isArray(ontology.relations) ? ontology.relations : [];
    const safeName = (ontology.name || 'Ontology').replace(/\s+/g, '_');
    
    let ttl = `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n`;
    ttl += `@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n`;
    ttl += `@prefix owl: <http://www.w3.org/2002/07/owl#> .\n`;
    ttl += `@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n`;
    ttl += `@prefix : <http://example.org/ontology#> .\n\n`;
    
    ttl += `:${safeName} rdf:type owl:Ontology ;\n`;
    ttl += `  rdfs:label "${ontology.name || 'Ontology'}" ;\n`;
    ttl += `  rdfs:comment "${ontology.description || ''}" .\n\n`;
    
    // Add entities
    for (const entity of entities) {
      const entityName = (entity.name || 'Entity').replace(/\s+/g, '_');
      ttl += `:${entityName} rdf:type owl:Class ;\n`;
      ttl += `  rdfs:label "${entity.name || ''}" ;\n`;
      ttl += `  rdfs:comment "${entity.description || ''}" .\n\n`;
      
      // Add properties
      for (const prop of (entity.properties || [])) {
        const propName = (prop.name || 'property').replace(/\s+/g, '_');
        ttl += `:${propName} rdf:type owl:DatatypeProperty ;\n`;
        ttl += `  rdfs:domain :${entityName} ;\n`;
        ttl += `  rdfs:range xsd:${prop.type || 'string'} ;\n`;
        ttl += `  rdfs:label "${prop.name || ''}" ;\n`;
        ttl += `  rdfs:comment "${prop.description || ''}" .\n\n`;
      }
    }
    
    // Add relations
    for (const relation of relations) {
      const relationName = (relation.name || 'relation').replace(/\s+/g, '_');
      const sourceName = (relation.source || 'Source').replace(/\s+/g, '_');
      const targetName = (relation.target || 'Target').replace(/\s+/g, '_');
      ttl += `:${relationName} rdf:type owl:ObjectProperty ;\n`;
      ttl += `  rdfs:domain :${sourceName} ;\n`;
      ttl += `  rdfs:range :${targetName} ;\n`;
      ttl += `  rdfs:label "${relation.name || ''}" ;\n`;
      ttl += `  rdfs:comment "${relation.description || ''}" .\n\n`;
    }
    
    return ttl;
  }
  
  /**
   * Convert ontology to RDF/XML format (simplified)
   * @param ontology The ontology to convert
   * @returns An RDF/XML representation of the ontology
   */
  private convertToRDF(ontology: Ontology): string {
    // Ensure arrays are properly handled
    const entities = Array.isArray(ontology.entities) ? ontology.entities : [];
    const relations = Array.isArray(ontology.relations) ? ontology.relations : [];
    const safeName = (ontology.name || 'Ontology').replace(/\s+/g, '_');
    
    let rdf = '<?xml version="1.0"?>\n';
    rdf += '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"\n';
    rdf += '         xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"\n';
    rdf += '         xmlns:owl="http://www.w3.org/2002/07/owl#"\n';
    rdf += '         xmlns:xsd="http://www.w3.org/2001/XMLSchema#"\n';
    rdf += '         xmlns="http://example.org/ontology#">\n\n';
    
    // Add ontology declaration
    rdf += `  <owl:Ontology rdf:about="http://example.org/ontology#${safeName}">\n`;
    rdf += `    <rdfs:label>${ontology.name || 'Ontology'}</rdfs:label>\n`;
    rdf += `    <rdfs:comment>${ontology.description || ''}</rdfs:comment>\n`;
    rdf += '  </owl:Ontology>\n\n';
    
    // Add entities
    for (const entity of entities) {
      const entityName = (entity.name || 'Entity').replace(/\s+/g, '_');
      rdf += `  <owl:Class rdf:about="http://example.org/ontology#${entityName}">\n`;
      rdf += `    <rdfs:label>${entity.name || ''}</rdfs:label>\n`;
      rdf += `    <rdfs:comment>${entity.description || ''}</rdfs:comment>\n`;
      rdf += '  </owl:Class>\n\n';
      
      // Add properties
      for (const prop of (entity.properties || [])) {
        const propName = (prop.name || 'property').replace(/\s+/g, '_');
        rdf += `  <owl:DatatypeProperty rdf:about="http://example.org/ontology#${propName}">\n`;
        rdf += `    <rdfs:domain rdf:resource="http://example.org/ontology#${entityName}"/>\n`;
        rdf += `    <rdfs:range rdf:resource="http://www.w3.org/2001/XMLSchema#${prop.type || 'string'}"/>\n`;
        rdf += `    <rdfs:label>${prop.name || ''}</rdfs:label>\n`;
        rdf += `    <rdfs:comment>${prop.description || ''}</rdfs:comment>\n`;
        rdf += '  </owl:DatatypeProperty>\n\n';
      }
    }
    
    // Add relations
    for (const relation of relations) {
      const relationName = (relation.name || 'relation').replace(/\s+/g, '_');
      const sourceName = (relation.source || 'Source').replace(/\s+/g, '_');
      const targetName = (relation.target || 'Target').replace(/\s+/g, '_');
      rdf += `  <owl:ObjectProperty rdf:about="http://example.org/ontology#${relationName}">\n`;
      rdf += `    <rdfs:domain rdf:resource="http://example.org/ontology#${sourceName}"/>\n`;
      rdf += `    <rdfs:range rdf:resource="http://example.org/ontology#${targetName}"/>\n`;
      rdf += `    <rdfs:label>${relation.name || ''}</rdfs:label>\n`;
      rdf += `    <rdfs:comment>${relation.description || ''}</rdfs:comment>\n`;
      rdf += '  </owl:ObjectProperty>\n\n';
    }
    
    rdf += '</rdf:RDF>';
    return rdf;
  }
  
  /**
   * Convert a knowledge graph to an ontology
   * @param graph The knowledge graph to convert
   * @param name Name for the new ontology
   * @param domain Domain for the new ontology
   * @returns The created ontology
   */
// Using the implementation at line 28 to avoid duplication
async convertFromGraphDeprecated(graph: any, name: string, domain: string): Promise<Ontology> {
  return this.convertFromGraph(graph, name, domain);
}
}

export const createOntologyService = (storage: IStorage): OntologyService => {
  return new OntologyService(storage);
};
