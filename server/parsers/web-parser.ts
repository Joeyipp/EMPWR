import { KnowledgeGraph, Node, Link } from '../../shared/schema';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import OpenAI from 'openai';

/**
 * Fetch HTML content from a URL using Node.js native http/https modules
 * @param url The URL to fetch
 * @returns The HTML content as a string
 */
async function fetchWebContent(url: string, maxRedirects = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeGraphBot/1.0)'
        }
      };
      
      const req = protocol.request(options, (res) => {
        // Handle redirects
        if (res.statusCode && (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303) && res.headers.location) {
          if (maxRedirects <= 0) {
            reject(new Error('Too many redirects'));
            return;
          }
          
          // Follow the redirect
          console.log(`Following redirect to: ${res.headers.location}`);
          // Handle relative URLs
          const redirectUrl = new URL(res.headers.location, url).toString();
          fetchWebContent(redirectUrl, maxRedirects - 1)
            .then(resolve)
            .catch(reject);
          return;
        }
        
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to fetch URL: ${res.statusCode}`));
          return;
        }
        
        let data = '';
        res.setEncoding('utf8');
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          resolve(data);
        });
      });
      
      req.on('error', (e) => {
        reject(new Error(`Error fetching URL: ${e.message}`));
      });
      
      req.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Extract a knowledge graph from a web page
 * @param url The URL of the web page
 * @param sourceSystem The source system for extraction (wikidata, dbpedia, schema, general)
 * @param apiKey OpenAI API key for content processing
 * @param model The AI model to use ('openai' or 'mistral')
 * @returns The extracted knowledge graph and metadata
 */
export async function extractFromWeb(url: string, sourceSystem: string, apiKey: string, model: string = 'openai'): Promise<{ graph: KnowledgeGraph, metadata: any }> {
  try {
    console.log(`Web parser: Processing URL '${url}' with source system '${sourceSystem}'`);
    
    // Specific handlers for image and PDF URLs
    if (sourceSystem.toLowerCase() === 'image') {
      // For image URLs, return a simple graph that will be processed by the AI service
      console.log(`Handling image URL extraction for: ${url}`);
      return {
        graph: {
          nodes: [
            { 
              id: 1, 
              name: 'Image Source', 
              group: 1, 
              properties: {
                type: 'image',
                source: url,
                label: 'Image Source'
              }
            }
          ],
          links: []
        },
        metadata: { source: url, type: 'image' }
      };
    }
    
    if (sourceSystem.toLowerCase() === 'pdf') {
      // For PDF URLs, return a simple graph that will be processed by the AI service
      console.log(`Handling PDF URL extraction for: ${url}`);
      return {
        graph: {
          nodes: [
            { 
              id: 1, 
              name: 'PDF Source', 
              group: 1, 
              properties: {
                type: 'pdf',
                source: url,
                label: 'PDF Source'
              }
            }
          ],
          links: []
        },
        metadata: { source: url, type: 'pdf' }
      };
    }
    
    // For regular web pages, fetch the HTML content
    const html = await fetchWebContent(url);
    
    // Extract content from HTML based on source system
    let graph: KnowledgeGraph;
    
    switch (sourceSystem.toLowerCase()) {
      case 'wikidata':
        graph = await extractFromWikidata(url, html, apiKey);
        break;
      case 'dbpedia':
        graph = await extractFromDBpedia(url, html, apiKey);
        break;
      case 'schema':
        graph = await extractFromSchema(url, html);
        break;
      case 'wikipedia':
        graph = await extractFromWikipedia(url, html, apiKey);
        break;
      case 'general':
      default:
        graph = await extractFromGeneral(url, html, apiKey, model);
        break;
    }
    
    return {
      graph,
      metadata: {
        url,
        sourceSystem,
        extractionDate: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error extracting from web:', error);
    throw new Error(`Failed to extract from web: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract knowledge graph from a general website
 * 
 * This implementation provides enhanced extraction capabilities:
 * 1. Extracts metadata (title, description, keywords) from the HTML
 * 2. Analyzes document structure (headings, lists) to provide context
 * 3. Uses specialized AI prompts with context to create a more accurate knowledge graph
 * 4. Connects entities to form a cohesive graph structure with the webpage as central node
 */
async function extractFromGeneral(url: string, html: string, apiKey: string, model: string = 'openai'): Promise<KnowledgeGraph> {
  // Extract the main text content of the page
  const textContent = extractTextFromHTML(html);
  
  // Extract metadata from HTML head
  const metadata = extractMetadata(html);
  
  // Process based on the selected model
  if (model === 'mistral') {
    // Use Mistral AI service
    console.log("Using Mistral AI for web extraction");
    const { createAIService } = await import('../ai-services');
    const aiService = createAIService('mistral', apiKey);
    
    // Process the content with Mistral AI
    const graph = await aiService.processText(textContent);
    
    // Return the processed graph
    return graph;
  } else {
    // Default to OpenAI
    console.log("Using OpenAI for web extraction");
    const openai = new OpenAI({ apiKey });
    
    // Extract structural elements (headings, lists, etc.)
    const structure = extractStructure(html);
    
    // Combine all the information for context
    const contextInfo = {
      url,
      title: metadata.title || '',
      description: metadata.description || '',
      keywords: metadata.keywords || [],
      headings: structure.headings || [],
      lists: structure.lists || []
    };
    
    // Prepare a better prompt for AI with context
    const promptWithContext = `
    Website: ${contextInfo.url}
    Title: ${contextInfo.title}
    Description: ${contextInfo.description}
    
    MAIN CONTENT:
    ${textContent.substring(0, 9000)} // Leave room for the context
    `;
    
    // Use a specialized system prompt to get better entity and relationship extraction
    const systemPrompt = `You are an expert knowledge graph generator. Analyze the website content and extract:
    
    1. Entities: Identify persons, organizations, places, concepts, dates, and other entities.
    2. Relationships: Find meaningful connections between these entities.
    
    For better knowledge graph quality:
    - Focus on the most important entities and relationships
    - Use the website title, description, and headings as guides for key topics
    - Extract specific relationships with descriptive predicates
    - Avoid generic relationships like "is related to" or "is associated with"
    - Ensure entity types are accurate and specific
    
    Format your response as JSON with this structure:
    {
      "entities": [
        {"name": "Entity Name", "type": "person|organization|place|concept|date|other", "importance": 1-5}
      ],
      "relationships": [
        {"source": 0, "target": 1, "type": "specific relationship description"}
      ]
    }
    
    Where:
    - Entities are ordered by importance (most important first)
    - Source and target are indexes of the entities array
    - Importance is 1-5 (5 being most important)
    `;
    
    // Use OpenAI to extract entities and relationships with the enhanced context
    const extractedContent = await extractContentWithAI(promptWithContext, openai, { systemPrompt });
    
    // Build a more comprehensive knowledge graph
    const nodes: Node[] = [];
    const links: Link[] = [];
    
    // Start by adding the webpage as a node
    nodes.push({
      id: 1,
      name: metadata.title || url,
      group: 3, // Concept
      properties: {
        url,
        isMainPage: true,
        source: "General-AI-extractor",
        timestamp: new Date().toISOString()
      }
    });
    
    // Add important metadata nodes that weren't extracted by AI
    if (metadata.description && !extractedContent.nodes.some(n => n.name === metadata.description)) {
      nodes.push({
        id: nodes.length + 1,
        name: metadata.description,
        group: 3, // Concept
        properties: { 
          isMetadata: true,
          source: "General-AI-extractor",
          timestamp: new Date().toISOString(),
          metadataType: "description"
        }
      });
      
      links.push({
        source: 1,
        target: nodes.length,
        value: 1, 
        label: 'hasDescription',
        dataSource: "General-AI-extractor",
        timestamp: new Date().toISOString()
      });
    }
    
    // Add AI-extracted entities and relationships with adjusted IDs
    const entityIdOffset = nodes.length; // Start entities after the metadata nodes
    
    // Add entities from AI extraction
    extractedContent.nodes.forEach((node, index) => {
      nodes.push({
        id: index + 1 + entityIdOffset,
        name: node.name,
        group: getEntityGroup(node.type),
        properties: { 
          type: node.type,
          source: "General-AI-extractor",
          timestamp: new Date().toISOString()
        }
      });
    });
    
    // Add relationships from AI extraction
    extractedContent.links.forEach(link => {
      links.push({
        source: link.source + entityIdOffset,
        target: link.target + entityIdOffset,
        value: 1,
        label: link.relationship,
        dataSource: "General-AI-extractor",
        timestamp: new Date().toISOString()
      });
      
      // Connect important entities to the main webpage
      if (!links.some(l => l.source === 1 && l.target === link.source + entityIdOffset)) {
        links.push({
          source: 1,
          target: link.source + entityIdOffset,
          value: 1,
          label: 'mentions',
          dataSource: "General-AI-extractor",
          timestamp: new Date().toISOString()
        });
      }
      
      if (!links.some(l => l.source === 1 && l.target === link.target + entityIdOffset)) {
        links.push({
          source: 1,
          target: link.target + entityIdOffset,
          value: 1,
          label: 'mentions',
          dataSource: "General-AI-extractor",
          timestamp: new Date().toISOString()
        });
      }
    });
    
    return { nodes, links };
  }
}

/**
 * Extract knowledge graph from Wikidata
 */
async function extractFromWikidata(url: string, html: string, apiKey: string): Promise<KnowledgeGraph> {
  console.log("Extracting from Wikidata:", url);
  // Create a simple placeholder implementation
  const nodes: Node[] = [
    {
      id: 1,
      name: "Wikidata Entity",
      group: 3,
      properties: {
        source: "Wikidata",
        timestamp: new Date().toISOString()
      }
    }
  ];
  
  return {
    nodes,
    links: []
  };
}

/**
 * Extract knowledge graph from DBpedia
 */
async function extractFromDBpedia(url: string, html: string, apiKey: string): Promise<KnowledgeGraph> {
  console.log("Extracting from DBpedia:", url);
  // Create a simple placeholder implementation
  const nodes: Node[] = [
    {
      id: 1,
      name: "DBpedia Entity",
      group: 3,
      properties: {
        source: "DBpedia",
        timestamp: new Date().toISOString()
      }
    }
  ];
  
  return {
    nodes,
    links: []
  };
}

/**
 * Extract knowledge graph from Wikipedia
 */
async function extractFromWikipedia(url: string, html: string, apiKey: string): Promise<KnowledgeGraph> {
  console.log("Extracting from Wikipedia:", url);
  // Create a simple placeholder implementation
  const nodes: Node[] = [
    {
      id: 1,
      name: "Wikipedia Article",
      group: 3,
      properties: {
        source: "Wikipedia",
        timestamp: new Date().toISOString()
      }
    }
  ];
  
  return {
    nodes,
    links: []
  };
}

/**
 * Extract knowledge graph from Schema.org structured data
 */
async function extractFromSchema(url: string, html: string): Promise<KnowledgeGraph> {
  console.log("Extracting from Schema.org:", url);
  // Create a simple placeholder implementation
  const nodes: Node[] = [
    {
      id: 1,
      name: "Schema.org Data",
      group: 3,
      properties: {
        source: "Schema.org",
        timestamp: new Date().toISOString()
      }
    }
  ];
  
  return {
    nodes,
    links: []
  };
}

/**
 * Extract metadata from HTML
 */
function extractMetadata(htmlContent: string): { 
  title?: string; description?: string; keywords?: string[] 
} {
  const result: { title?: string; description?: string; keywords?: string[] } = {};
  
  // Extract title
  const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    result.title = titleMatch[1].trim();
  }
  
  // Extract description
  const descriptionMatch = htmlContent.match(/<meta\s+name=['"]description['"]\s+content=['"]([^'"]*)['"]/i);
  if (descriptionMatch && descriptionMatch[1]) {
    result.description = descriptionMatch[1].trim();
  }
  
  // Extract keywords
  const keywordsMatch = htmlContent.match(/<meta\s+name=['"]keywords['"]\s+content=['"]([^'"]*)['"]/i);
  if (keywordsMatch && keywordsMatch[1]) {
    result.keywords = keywordsMatch[1].split(',').map(k => k.trim());
  }
  
  return result;
}

/**
 * Extract structural elements from HTML
 */
function extractStructure(htmlContent: string): {
  headings: string[]; lists: string[][]
} {
  const result: { headings: string[]; lists: string[][] } = {
    headings: [],
    lists: []
  };
  
  // Extract headings
  const headingRegex = /<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi;
  let headingMatch;
  while ((headingMatch = headingRegex.exec(htmlContent)) !== null) {
    if (headingMatch[1]) {
      const cleanHeading = headingMatch[1].replace(/<[^>]*>/g, '').trim();
      if (cleanHeading) {
        result.headings.push(cleanHeading);
      }
    }
  }
  
  // Extract lists
  const listRegex = /<ul[^>]*>([\s\S]*?)<\/ul>/gi;
  let listMatch;
  while ((listMatch = listRegex.exec(htmlContent)) !== null) {
    if (listMatch[1]) {
      const listItems: string[] = [];
      const itemRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let itemMatch;
      while ((itemMatch = itemRegex.exec(listMatch[1])) !== null) {
        if (itemMatch[1]) {
          const cleanItem = itemMatch[1].replace(/<[^>]*>/g, '').trim();
          if (cleanItem) {
            listItems.push(cleanItem);
          }
        }
      }
      if (listItems.length > 0) {
        result.lists.push(listItems);
      }
    }
  }
  
  return result;
}

/**
 * Extract readable text from HTML
 */
function extractTextFromHTML(html: string): string {
  // Simple HTML to text conversion
  let text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  
  // Decode HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  
  return text;
}

/**
 * Map an entity type string to a numeric group
 */
function getEntityGroup(type: string): number {
  // Map common entity types to group numbers
  // 1: Person, 2: Place, 3: Concept, 4: Organization, 5: Date, 6: Other
  const typeMap: Record<string, number> = {
    'person': 1,
    'people': 1,
    'individual': 1,
    'human': 1,
    
    'place': 2,
    'location': 2,
    'city': 2,
    'country': 2,
    'address': 2,
    'region': 2,
    'geographic': 2,
    
    'concept': 3,
    'idea': 3,
    'topic': 3,
    'subject': 3,
    'theory': 3,
    'philosophy': 3,
    'abstract': 3,
    
    'organization': 4,
    'company': 4,
    'business': 4,
    'corporation': 4,
    'institution': 4,
    'agency': 4,
    
    'date': 5,
    'time': 5,
    'event': 5,
    'period': 5,
    'year': 5,
    'month': 5,
    'day': 5
  };
  
  if (!type) return 6; // Default to "Other"
  
  const normalizedType = type.toLowerCase().trim();
  
  // Check for direct match
  if (normalizedType in typeMap) {
    return typeMap[normalizedType];
  }
  
  // Check for partial match
  for (const key in typeMap) {
    if (normalizedType.includes(key)) {
      return typeMap[key];
    }
  }
  
  return 6; // Default to "Other" if no match found
}

/**
 * Map a property name to a group number
 */
function getPropertyGroup(property: string): number {
  // Map property types to group numbers (similar to entity groups)
  // 1: Person, 2: Place, 3: Concept, 4: Organization, 5: Date, 6: Other
  const propertyMap: Record<string, number> = {
    // Person attributes
    'name': 1,
    'age': 1,
    'gender': 1,
    'profession': 1,
    'occupation': 1,
    'nationality': 1,
    
    // Place attributes
    'location': 2,
    'address': 2,
    'city': 2,
    'country': 2,
    'region': 2,
    'coordinates': 2,
    
    // Concept attributes
    'definition': 3,
    'meaning': 3,
    'category': 3,
    'description': 3,
    'explanation': 3,
    'topic': 3,
    
    // Organization attributes
    'company': 4,
    'organization': 4,
    'institution': 4,
    'founded': 4,
    'headquarters': 4,
    'industry': 4,
    
    // Date/time attributes
    'date': 5,
    'time': 5,
    'year': 5,
    'month': 5,
    'day': 5,
    'period': 5
  };
  
  if (!property) return 6; // Default to "Other"
  
  const normalizedProperty = property.toLowerCase().trim();
  
  // Check for direct match
  if (normalizedProperty in propertyMap) {
    return propertyMap[normalizedProperty];
  }
  
  // Check for partial match
  for (const key in propertyMap) {
    if (normalizedProperty.includes(key)) {
      return propertyMap[key];
    }
  }
  
  return 6; // Default to "Other" if no match found
}

/**
 * Use OpenAI to extract entities and relationships from text
 * @param text The text to analyze
 * @param openai The OpenAI instance
 * @param options Optional configuration like custom system prompt
 * @returns An object containing nodes (entities) and links (relationships)
 */
async function extractContentWithAI(
  text: string, 
  openai: OpenAI, 
  options?: { systemPrompt?: string }
): Promise<{ 
  nodes: Array<{ name: string, type: string }>,
  links: Array<{ source: number, target: number, relationship: string }>
}> {
  try {
    // Limit text to a reasonable size for OpenAI
    const limitedText = text.substring(0, 10000);
    
    // Use custom system prompt if provided, otherwise use default
    const systemPrompt = options?.systemPrompt || `Extract entities and relationships from the following text. Identify people, organizations, places, concepts, and other important entities. Then identify relationships between these entities.
          
    Format your response as JSON with this structure:
    {
      "entities": [
        {"name": "Entity Name", "type": "person|organization|place|concept|other"}
      ],
      "relationships": [
        {"source": 0, "target": 1, "type": "relationship description"}
      ]
    }
    
    Where source and target are indexes of the entities array.`;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: systemPrompt + "\n\nIMPORTANT: Return your response in valid JSON format."
        },
        {
          role: "user",
          content: limitedText
        }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });
    
    const content = response.choices[0]?.message.content;
    
    if (!content) {
      throw new Error("No content in OpenAI response");
    }
    
    try {
      const parsedData = JSON.parse(content);
      
      // Transform to the format we need
      const nodes = (parsedData.entities || []).map((entity: any) => ({
        name: entity.name,
        type: entity.type
      }));
      
      const links = (parsedData.relationships || []).map((rel: any) => ({
        source: rel.source + 1, // Add 1 to make 1-indexed
        target: rel.target + 1, // Add 1 to make 1-indexed
        relationship: rel.type
      }));
      
      return { nodes, links };
    } catch (parseError) {
      console.error("Error parsing OpenAI response:", parseError);
      throw new Error("Failed to parse AI response");
    }
  } catch (error) {
    console.error("Error extracting content with AI:", error);
    // Return empty set if OpenAI fails
    return { nodes: [], links: [] };
  }
}