import { KnowledgeGraph, Node, Link } from '../../shared/schema';
import OpenAI from 'openai';

/**
 * Helper function to decode HTML entities in text
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;|&#160;/g, ' ')  // Convert non-breaking spaces to regular spaces
    .replace(/&middot;|&#183;|•|&#8226;/g, '-')  // Convert bullets to dashes
    .replace(/&[a-zA-Z]+;|&#\d+;/g, (match) => {
      // Decode common HTML entities
      const entities: {[key: string]: string} = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&apos;': "'",
        '&eacute;': 'é',
        '&egrave;': 'è',
        '&agrave;': 'à',
        '&oacute;': 'ó',
        '&ouml;': 'ö',
        '&auml;': 'ä',
        '&uuml;': 'ü'
      };
      return entities[match] || match;
    });
}

/**
 * Extract knowledge graph from Wikipedia
 * 
 * This specialized extractor for Wikipedia pages handles:
 * 1. Infoboxes - Structured data in the sidebar
 * 2. Section structure - Using headings to organize content
 * 3. Links to other Wikipedia articles - As relationships
 * 4. Categories - For classification
 * 5. Citations and references - For source validation
 */
export async function extractFromWikipedia(url: string, html: string, apiKey: string): Promise<KnowledgeGraph> {
  try {
    console.log(`Extracting Wikipedia page: ${url}`);
    
    // Core graph structure
    const nodes: Node[] = [];
    const links: Link[] = [];
    const timestamp = new Date().toISOString();
    let nextNodeId = 1;
    
    // Helper to add nodes
    const addNode = (name: string, group: number, props: any = {}): number => {
      const id = nextNodeId++;
      nodes.push({
        id,
        name,
        group,
        properties: {
          ...props,
          source: "Wikipedia-extractor",
          timestamp: timestamp
        }
      });
      return id;
    };
    
    // Helper to add links
    const addLink = (source: number, target: number, label: string): void => {
      links.push({
        source,
        target,
        value: 1,
        label,
        dataSource: "Wikipedia-extractor",
        timestamp: timestamp
      });
    };
    
    // Extract page title - this will be our main entity
    const titleMatch = html.match(/<title>([^<]+?) - Wikipedia<\/title>/);
    const title = titleMatch ? titleMatch[1] : url.split('/').pop() || "Wikipedia Article";
    
    // Add the main entity
    const mainEntityId = addNode(title, 1, { url });
    
    // Extract infobox data (typically contains key facts about the subject)
    const infoboxData = extractInfobox(html);
    Object.entries(infoboxData).forEach(([key, value]) => {
      if (value && typeof value === "string") {
        const nodeId = addNode(value, getPropertyGroup(key));
        addLink(mainEntityId, nodeId, key);
      } else if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item && typeof item === "string") {
            const nodeId = addNode(item, getPropertyGroup(key));
            addLink(mainEntityId, nodeId, key);
          }
        });
      }
    });
    
    // Extract section headings to represent the structure
    const sections = extractSections(html);
    sections.forEach(section => {
      if (section.title) {
        const sectionId = addNode(section.title, 3, { level: section.level });
        addLink(mainEntityId, sectionId, "has_section");
        
        // Add key content from each section
        if (section.keyEntities && section.keyEntities.length > 0) {
          section.keyEntities.forEach(entity => {
            const entityId = addNode(entity.name, getEntityGroup(entity.type || "concept"));
            addLink(sectionId, entityId, "contains");
          });
        }
      }
    });
    
    // Extract categories (at the bottom of Wikipedia pages)
    const categories = extractCategories(html);
    categories.forEach(category => {
      const categoryId = addNode(category, 3, { type: "category" });
      addLink(mainEntityId, categoryId, "belongs_to_category");
    });
    
    // Extract links to other Wikipedia articles (powerful for relationship building)
    const relatedArticles = extractWikiLinks(html);
    relatedArticles.forEach(article => {
      if (article.title && article.context) {
        const articleId = addNode(article.title, 1, { link: article.href });
        addLink(mainEntityId, articleId, article.context || "related_to");
      }
    });
    
    // If the graph is too small, enrich it with AI
    if (nodes.length < 15) {
      try {
        const openai = new OpenAI({ apiKey });
        const textContent = extractTextFromHTML(html);
        const limitedText = textContent.substring(0, 15000); // Limit to avoid token overflows
        
        const extractedContent = await extractContentWithAI(limitedText, openai, {
          systemPrompt: `Extract entities and relationships from this Wikipedia article about "${title}".
          Focus on key facts, people, places, events, and concepts mentioned in the article.
          Identify the relationships between these entities.
          Format your response as a JSON knowledge graph.`
        });
        
        // Add AI-extracted nodes and relationships
        extractedContent.nodes.forEach((node) => {
          // Skip if we already have this entity
          if (!nodes.some(existingNode => existingNode.name.toLowerCase() === node.name.toLowerCase())) {
            addNode(node.name, getEntityGroup(node.type), { 
              type: node.type,
              aiGenerated: true
            });
          }
        });
        
        extractedContent.links.forEach(link => {
          const sourceNode = nodes.find(n => n.name.toLowerCase() === 
            extractedContent.nodes[link.source - 1]?.name.toLowerCase());
          const targetNode = nodes.find(n => n.name.toLowerCase() === 
            extractedContent.nodes[link.target - 1]?.name.toLowerCase());
          
          if (sourceNode && targetNode && sourceNode.id !== targetNode.id) {
            addLink(sourceNode.id, targetNode.id, link.relationship);
          }
        });
      } catch (aiError) {
        console.error("Error enriching Wikipedia extraction with AI:", aiError);
        // Continue with what we extracted, AI enrichment is optional
      }
    }
    
    return { nodes, links };
  } catch (error) {
    console.error("Error extracting from Wikipedia:", error);
    
    // Fallback to AI extraction if something goes wrong
    const openai = new OpenAI({ apiKey });
    const extractedContent = await extractContentWithAI(html, openai, {
      systemPrompt: `Extract entities and relationships from this Wikipedia page.
      Focus on the main subject of the article and key facts about it.
      Format your response as a JSON knowledge graph.`
    });
    
    const timestamp = new Date().toISOString();
    
    return {
      nodes: extractedContent.nodes.map((node, index) => ({
        id: index + 1,
        name: node.name,
        group: getEntityGroup(node.type),
        properties: {
          source: "Wikipedia-AI-fallback",
          timestamp: timestamp,
          type: node.type
        }
      })),
      links: extractedContent.links.map(link => ({
        source: link.source,
        target: link.target,
        value: 1,
        label: link.relationship,
        dataSource: "Wikipedia-AI-fallback",
        timestamp: timestamp
      }))
    };
  }
}

/**
 * Extract information from Wikipedia infobox
 * Infoboxes contain structured data in the sidebar of Wikipedia articles
 */
function extractInfobox(html: string): Record<string, string | string[]> {
  const infobox: Record<string, string | string[]> = {};
  
  // Regular expression to find infobox table
  const infoboxMatch = html.match(/<table class="infobox[^>]*>([\s\S]*?)<\/table>/i);
  
  if (infoboxMatch) {
    const infoboxHtml = infoboxMatch[0];
    
    // Extract rows from the infobox
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    
    while ((rowMatch = rowRegex.exec(infoboxHtml)) !== null) {
      const row = rowMatch[1];
      
      // Extract label (field name) from th element
      const thMatch = row.match(/<th[^>]*>([\s\S]*?)<\/th>/i);
      
      if (thMatch) {
        let label = thMatch[1]
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/\s+/g, ' ')     // Normalize whitespace
          .trim();
        
        // Extract value from td element
        const tdMatch = row.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
        
        if (tdMatch && label) {
          let value = tdMatch[1];
          
          // Check for lists
          if (value.includes('<li>')) {
            const listItems: string[] = [];
            const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
            let liMatch;
            
            while ((liMatch = liRegex.exec(value)) !== null) {
              let listItem = liMatch[1]
                .replace(/<[^>]*>/g, '')  // Remove HTML tags
                .replace(/\s+/g, ' ')      // Normalize whitespace
                .trim();
                
              // Decode HTML entities
              listItem = decodeHtmlEntities(listItem);
              
              if (listItem) {
                listItems.push(listItem);
              }
            }
            
            if (listItems.length > 0) {
              infobox[label] = listItems;
              continue;
            }
          }
          
          // Process as plain text and decode HTML entities
          value = value
            .replace(/<[^>]*>/g, '')  // Remove HTML tags
            .replace(/\s+/g, ' ')      // Normalize whitespace
            .trim();
          
          // Decode HTML entities
          value = decodeHtmlEntities(value);
          
          if (value) {
            infobox[label] = value;
          }
        }
      }
    }
  }
  
  return infobox;
}

/**
 * Extract section structure from Wikipedia article
 */
function extractSections(html: string): Array<{
  title: string;
  level: number;
  content?: string;
  keyEntities?: Array<{name: string; type?: string}>;
}> {
  const sections: Array<{
    title: string;
    level: number;
    content?: string;
    keyEntities?: Array<{name: string; type?: string}>;
  }> = [];
  
  // Find all headings in the article
  const headingRegex = /<h([2-6])[^>]*><span[^>]*>([^<]+)<\/span>.*?<\/h\1>/g;
  let match;
  
  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1]);
    let title = match[2].trim();
    
    // Remove edit links and other artifacts
    title = title.replace(/\[\s*edit\s*\]/gi, '').trim();
    
    // Decode HTML entities
    title = decodeHtmlEntities(title);
    
    if (title) {
      // Get content up to the next heading
      const startPos = match.index + match[0].length;
      const nextHeadingMatch = html.slice(startPos).match(/<h[2-6][^>]*>/);
      
      let content = '';
      if (nextHeadingMatch && nextHeadingMatch.index !== undefined) {
        content = html.slice(startPos, startPos + nextHeadingMatch.index);
      } else {
        content = html.slice(startPos);
      }
      
      // Extract key entities from the section content
      // Look for links as they often represent important entities
      const keyEntities: Array<{name: string; type?: string}> = [];
      const linkRegex = /<a[^>]*href="\/wiki\/([^"]+)"[^>]*>([^<]+)<\/a>/g;
      let linkMatch;
      
      while ((linkMatch = linkRegex.exec(content)) !== null) {
        // Decode HTML entities in link text
        let name = linkMatch[2].trim();
        name = decodeHtmlEntities(name);
        
        // Skip citations and other non-entity links
        if (!name.match(/^\[\d+\]$/) && name.length > 1) {
          keyEntities.push({
            name: name,
            type: determineEntityType(name, content)
          });
        }
      }
      
      sections.push({
        title,
        level,
        keyEntities: keyEntities.slice(0, 5) // Limit to most important entities
      });
    }
  }
  
  return sections;
}

/**
 * Extract categories from Wikipedia article
 */
function extractCategories(html: string): string[] {
  const categories: string[] = [];
  
  // Find the categories section
  const categoryMatch = html.match(/<div id="mw-normal-catlinks[^>]*>([\s\S]*?)<\/div>/);
  
  if (categoryMatch) {
    const categoryHtml = categoryMatch[1];
    const linkRegex = /<a[^>]*href="\/wiki\/Category:([^"]+)"[^>]*>([^<]+)<\/a>/g;
    let match;
    
    while ((match = linkRegex.exec(categoryHtml)) !== null) {
      let category = match[2].trim();
      
      // Decode HTML entities in category name
      category = decodeHtmlEntities(category);
      
      if (category) {
        categories.push(category);
      }
    }
  }
  
  return categories;
}

/**
 * Extract links to other Wikipedia articles with context
 */
function extractWikiLinks(html: string): Array<{title: string; href: string; context?: string}> {
  const links: Array<{title: string; href: string; context?: string}> = [];
  const processedLinks = new Set<string>(); // To avoid duplicates
  
  // Get the main content area
  const contentMatch = html.match(/<div id="mw-content-text[^>]*>([\s\S]*?)<div id="catlinks"/);
  
  if (contentMatch) {
    const content = contentMatch[1];
    
    // Find paragraphs with links
    const paragraphs = content.split(/<p[^>]*>/);
    
    for (const paragraph of paragraphs) {
      // Extract context from paragraph (first sentence or truncated content)
      let context = paragraph
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Truncate context to first sentence or 50 chars
      context = context.split(/\.\s/)[0] || context.substring(0, 50);
      
      // Find links in this paragraph
      const linkRegex = /<a[^>]*href="\/wiki\/([^":#]+)(?:[^"]*)"[^>]*>([^<]+)<\/a>/g;
      let linkMatch;
      
      while ((linkMatch = linkRegex.exec(paragraph)) !== null) {
        const href = decodeURIComponent(linkMatch[1]);
        let title = linkMatch[2].trim();
        
        // Decode HTML entities in link title
        title = decodeHtmlEntities(title);
        
        // Skip disambiguation, category, file links and non-content namespaces
        if (!href.match(/^(File:|Category:|Help:|Template:|Wikipedia:|Talk:)/) && 
            !href.includes('disambiguation') && 
            title && 
            !processedLinks.has(title)) {
          
          links.push({
            title,
            href: `/wiki/${href}`,
            context: context ? inferRelationship(title, context) : 'related_to'
          });
          
          processedLinks.add(title); // Mark as processed to avoid duplicates
        }
      }
    }
  }
  
  // Limit to 30 most relevant links
  return links.slice(0, 30);
}

/**
 * Determine entity type based on context
 */
function determineEntityType(name: string, context: string): string {
  // Use simple heuristics to guess entity type
  const lowerName = name.toLowerCase();
  const lowerContext = context.toLowerCase();
  
  // Check for likely person
  if (name.split(' ').length >= 2 && 
      (lowerContext.includes(' born ') || 
       lowerContext.includes(' died ') || 
       lowerContext.includes('birth') || 
       lowerContext.includes('death'))) {
    return 'person';
  }
  
  // Check for likely location
  if (lowerContext.includes('located in') || 
      lowerContext.includes('city of') || 
      lowerContext.includes('town in') || 
      lowerContext.includes('country') || 
      lowerContext.includes('province') || 
      lowerContext.includes('region')) {
    return 'place';
  }
  
  // Check for likely organization
  if (lowerName.includes('company') || 
      lowerName.includes('corporation') || 
      lowerName.includes('inc.') || 
      lowerName.includes('ltd') || 
      lowerName.includes('university') || 
      lowerContext.includes('founded') || 
      lowerContext.includes('established') || 
      lowerContext.includes('organization')) {
    return 'organization';
  }
  
  // Check for dates and times
  if (lowerName.match(/^\d{4}$/) || // Year
      lowerName.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/) || // Date format
      lowerContext.includes('century') || 
      lowerContext.includes('decade')) {
    return 'date';
  }
  
  // Default is concept
  return 'concept';
}

/**
 * Infer relationship between entities based on context
 */
function inferRelationship(linkedEntity: string, context: string): string {
  const lc = context.toLowerCase();
  const le = linkedEntity.toLowerCase();
  
  // Check for common relationship patterns
  if (lc.includes(`founded by ${le}`)) return 'founded_by';
  if (lc.includes(`created by ${le}`)) return 'created_by';
  if (lc.includes(`written by ${le}`)) return 'written_by';
  if (lc.includes(`directed by ${le}`)) return 'directed_by';
  if (lc.includes(`discovered by ${le}`)) return 'discovered_by';
  if (lc.includes(`located in ${le}`)) return 'located_in';
  if (lc.includes(`part of ${le}`)) return 'part_of';
  if (lc.includes(`member of ${le}`)) return 'member_of';
  if (lc.includes(`born in ${le}`)) return 'born_in';
  if (lc.includes(`died in ${le}`)) return 'died_in';
  if (lc.includes(`married to ${le}`)) return 'married_to';
  if (lc.includes(`works for ${le}`)) return 'works_for';
  if (lc.includes(`studied at ${le}`)) return 'studied_at';
  if (lc.includes(`published in ${le}`)) return 'published_in';
  if (lc.includes(`developed by ${le}`)) return 'developed_by';
  
  // Invert direction if possible
  if (lc.includes(`${le} founded`)) return 'founded';
  if (lc.includes(`${le} created`)) return 'created';
  if (lc.includes(`${le} wrote`)) return 'wrote';
  if (lc.includes(`${le} directed`)) return 'directed';
  if (lc.includes(`${le} discovered`)) return 'discovered';
  if (lc.includes(`${le} contains`)) return 'contains';
  if (lc.includes(`${le} includes`)) return 'includes';
  if (lc.includes(`${le} has`)) return 'has';
  if (lc.includes(`${le} developed`)) return 'developed';
  
  // Default generic relationships based on entity pairs
  return 'related_to';
}

/**
 * Extract readable text from HTML
 */
function extractTextFromHTML(html: string): string {
  // Simple HTML to text conversion - remove tags and excess whitespace
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract entities and relationships using AI
 */
async function extractContentWithAI(
  text: string,
  openai: OpenAI,
  options: { systemPrompt?: string } = {}
): Promise<{ nodes: Array<{ name: string; type: string }>; links: Array<{ source: number; target: number; relationship: string }> }> {
  try {
    const systemPrompt = options.systemPrompt || `
    Extract named entities and their relationships from the provided text.
    Return your response as a JSON object with the following structure:
    
    {
      "entities": [
        {"name": "Entity Name", "type": "Entity Type"},
        ...
      ],
      "relationships": [
        {"source": 0, "target": 1, "type": "Relationship Type"},
        ...
      ]
    }
    
    Where source and target are indexes of the entities array.`;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: systemPrompt + "\n\nIMPORTANT: Return your response in valid JSON format."
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.2
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

/**
 * Map an entity type string to a numeric group
 */
function getEntityGroup(type: string): number {
  switch (type.toLowerCase()) {
    case 'person':
      return 1;
    case 'place':
    case 'location':
      return 2;
    case 'concept':
    case 'idea':
      return 3;
    case 'organization':
    case 'company':
      return 4;
    case 'date':
    case 'time':
      return 5;
    default:
      return 6; // Other
  }
}

/**
 * Map a property name to a group number
 */
function getPropertyGroup(property: string): number {
  switch (property.toLowerCase()) {
    case 'name':
    case 'alternatename':
    case 'title':
    case 'headline':
      return 3; // Concept
    case 'datepublished':
    case 'datecreated':
    case 'datemodified':
    case 'born':
    case 'died':
    case 'date':
    case 'year':
      return 5; // Date
    case 'author':
    case 'creator':
    case 'founder':
    case 'spouse':
      return 1; // Person
    case 'location':
    case 'address':
    case 'geo':
    case 'country':
    case 'city':
      return 2; // Place
    default:
      return 6; // Other
  }
}