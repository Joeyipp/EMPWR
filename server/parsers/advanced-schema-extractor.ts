import { KnowledgeGraph, Node, Link } from '../../shared/schema';
import OpenAI from 'openai';

/**
 * Extract knowledge graph from Schema.org structured data with enhanced processing
 * This implementation provides advanced Schema.org extraction capabilities:
 * 1. Processes all JSON-LD blocks even if they contain different entity types
 * 2. Establishes relationships between entities based on references
 * 3. Handles entity de-duplication to prevent redundancy
 * 4. Extracts semantic content from the page when structured data is limited
 * 5. Properly attributes all nodes and links with consistent source and timestamp
 */
export async function extractFromSchemaAdvanced(url: string, html: string): Promise<KnowledgeGraph> {
  // Schema.org data can be embedded in multiple formats: JSON-LD, Microdata, and RDFa
  console.log(`Extracting Schema.org data from: ${url}`);
  
  // Store nodes and links arrays
  const nodes: Node[] = [];
  const links: Link[] = [];
  
  // Store entity references to create relationships between entities
  const entityMap = new Map<string, number>(); // Maps entity URI/ID to node ID
  const pendingRelationships: Array<{
    sourceId: string | number, 
    targetId: string | number,
    relationship: string
  }> = [];
  
  // Create a central page node
  const pageTitle = extractPageTitle(html) || url;
  const timestamp = new Date().toISOString();
  
  nodes.push({
    id: 1,
    name: pageTitle,
    group: 3, // Website/page as a concept
    properties: {
      url: url,
      source: "Schema.org-advanced-extractor",
      timestamp: timestamp
    }
  });
  
  // Track node IDs to prevent duplicates and maintain entity references
  let nodeId = 2;
  let entitiesFound = false;
  
  // Set to track processed entity IDs to avoid duplication
  const processedEntityIds = new Set<string>();
  
  // 1. Extract and process all JSON-LD content (primary source)
  const jsonLdData = extractJsonLdData(html);
  
  if (jsonLdData.length > 0) {
    // First pass: Create nodes for all entities and build the entity map
    for (const item of jsonLdData) {
      if (processSchemaEntity(item, 1, true)) {
        entitiesFound = true;
      }
    }
    
    // Second pass: Process relationships between entities
    processPendingRelationships();
  }
  
  // 2. Extract and process Microdata
  // Even if we found JSON-LD, we still extract microdata as they often contain complementary information
  const microdataItems = extractMicrodataItems(html);
  
  if (microdataItems.length > 0) {
    for (const item of microdataItems) {
      if (processSchemaEntity(item, 1, false)) {
        entitiesFound = true;
      }
    }
    
    // Process any new relationships discovered
    processPendingRelationships();
  }
  
  // 3. Extract and process RDFa data
  const rdfaItems = extractRdfaItems(html);
  
  if (rdfaItems.length > 0) {
    for (const item of rdfaItems) {
      if (processSchemaEntity(item, 1, false)) {
        entitiesFound = true;
      }
    }
    
    // Process any new relationships discovered
    processPendingRelationships();
  }
  
  // 4. If no structured data was found, extract basic metadata and semantic information
  if (!entitiesFound) {
    extractBasicMetadata();
    // Try to extract some semantic content from the page
    extractSemanticContent();
  }
  
  return { nodes, links };
  
  // Helper function to extract the page title
  function extractPageTitle(htmlContent: string): string | null {
    // Try to get the title from meta tags first (more reliable for SEO-optimized sites)
    const ogTitleMatch = htmlContent.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/);
    if (ogTitleMatch && ogTitleMatch[1]) {
      return ogTitleMatch[1];
    }
    
    // Fall back to the HTML title tag
    const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/);
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1];
    }
    
    return null;
  }
  
  // Helper function to extract all JSON-LD data from the page
  function extractJsonLdData(htmlContent: string): any[] {
    const jsonLdItems: any[] = [];
    
    // Match all script tags with JSON-LD content - use a more robust pattern
    // This pattern handles both type="application/ld+json" and variations with whitespace/attributes
    const jsonLdRegex = /<script\s+([^>]*type\s*=\s*['"]application\/ld\+json['"][^>]*)>\s*([\s\S]*?)\s*<\/script>/gi;
    
    let match;
    while ((match = jsonLdRegex.exec(htmlContent)) !== null) {
      try {
        // Extract just the content between script tags
        const jsonContent = match[2].trim();
        
        // Remove any HTML comments within the JSON-LD
        const cleanedJson = jsonContent
          .replace(/<!--[\s\S]*?-->/g, '')  // Remove HTML comments
          .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove JS block comments
        
        // Try to parse the JSON content
        try {
          const schemaData = JSON.parse(cleanedJson);
          
          // Handle both single objects and arrays
          const schemaItems = Array.isArray(schemaData) ? schemaData : [schemaData];
          jsonLdItems.push(...schemaItems);
        } catch (jsonError) {
          // Try fixing common JSON issues
          console.warn('Error parsing JSON-LD, attempting to fix:', jsonError);
          
          // Try to fix trailing commas (common error in JSON-LD)
          const fixedJson = cleanedJson
            .replace(/,\s*}/g, '}')        // Fix trailing commas in objects
            .replace(/,\s*\]/g, ']')       // Fix trailing commas in arrays
            .replace(/'/g, '"');           // Replace single quotes with double quotes
          
          try {
            const schemaData = JSON.parse(fixedJson);
            const schemaItems = Array.isArray(schemaData) ? schemaData : [schemaData];
            jsonLdItems.push(...schemaItems);
            console.log('Successfully parsed JSON-LD after fixing');
          } catch (fixError) {
            console.warn('Failed to fix JSON-LD:', fixError);
          }
        }
      } catch (error) {
        console.warn('Error processing JSON-LD script tag:', error);
      }
    }
    
    return jsonLdItems;
  }
  
  // Process a Schema.org entity and its properties
  function processSchemaEntity(entity: any, parentNodeId: number, isJsonLd: boolean): boolean {
    if (!entity || typeof entity !== 'object') return false;
    
    // Extract entity type and ID
    const schemaType = extractSchemaType(entity, isJsonLd);
    if (!schemaType) return false; // Not a valid Schema.org entity
    
    // Try to get a unique identifier for this entity
    const entityId = extractEntityId(entity, schemaType, isJsonLd);
    
    // Skip if we've already processed this exact entity
    if (entityId && processedEntityIds.has(entityId)) {
      // If we have a relationship from parent to this entity, add it
      if (parentNodeId !== 1 || !entityMap.has(entityId)) {
        addRelationship(parentNodeId, entityId, `has${schemaType}`);
      }
      return true;
    }
    
    // Get entity name or create a descriptive one
    let entityName = getEntityName(entity) || `${schemaType} (${nodeId})`;
    
    // Create node for this entity
    const currentNodeId = nodeId++;
    nodes.push({
      id: currentNodeId,
      name: entityName,
      group: getGroupFromSchemaType(schemaType),
      properties: {
        schemaType: schemaType,
        entityId: entityId || undefined,
        source: "Schema.org-advanced-extractor",
        timestamp: timestamp
      }
    });
    
    // Register this entity in our map if it has an ID
    if (entityId) {
      entityMap.set(entityId, currentNodeId);
      processedEntityIds.add(entityId);
    }
    
    // Link from parent entity if this isn't the main entity or we have multiple top-level entities
    if (parentNodeId !== 1 || entitiesFound) {
      links.push({
        source: parentNodeId,
        target: currentNodeId,
        value: 1,
        label: `has${schemaType}`,
        dataSource: "Schema.org-advanced-extractor",
        timestamp: timestamp
      });
    }
    
    // Process properties and their relationships
    processEntityProperties(entity, currentNodeId, isJsonLd);
    
    return true;
  }
  
  // Process all properties of an entity
  function processEntityProperties(entity: any, entityNodeId: number, isJsonLd: boolean): void {
    for (const [key, value] of Object.entries(entity)) {
      // Skip JSON-LD context and already handled type properties
      if (key === '@context' || 
          (isJsonLd && key === '@type') || 
          (!isJsonLd && key === 'type')) {
        continue;
      }
      
      // Handle ID fields depending on the format
      if ((isJsonLd && key === '@id') || key === 'identifier' || key === 'url') {
        // Already processed for entity identification
        continue;
      }
      
      // Process the property based on its type
      if (value === null || value === undefined) {
        continue;
      } else if (Array.isArray(value)) {
        processArrayProperty(key, value, entityNodeId, isJsonLd);
      } else if (typeof value === 'object') {
        processObjectProperty(key, value, entityNodeId, isJsonLd);
      } else {
        // Simple value (string, number, boolean)
        processSimpleProperty(key, value, entityNodeId);
      }
    }
  }
  
  // Process array properties
  function processArrayProperty(propertyName: string, array: any[], entityNodeId: number, isJsonLd: boolean): void {
    for (let i = 0; i < array.length; i++) {
      const item = array[i];
      
      if (item === null || item === undefined) {
        continue;
      } else if (typeof item === 'object') {
        // Check if it's a nested entity or just a value object
        if (extractSchemaType(item, isJsonLd)) {
          // It's a nested entity - process it and link to the parent
          processSchemaEntity(item, entityNodeId, isJsonLd);
        } else {
          // It's a complex property without a schema type
          // Create a property group node with aggregated values
          addPropertyGroupNode(entityNodeId, `${propertyName}[${i}]`, item);
        }
      } else {
        // It's a simple value in an array
        processSimpleProperty(`${propertyName}[${i}]`, item, entityNodeId);
      }
    }
  }
  
  // Process object properties
  function processObjectProperty(propertyName: string, obj: any, entityNodeId: number, isJsonLd: boolean): void {
    // Check if it's a nested entity with a schema type
    if (extractSchemaType(obj, isJsonLd)) {
      // It's a nested entity - process it and link to the parent
      processSchemaEntity(obj, entityNodeId, isJsonLd);
    } else {
      // It's a complex property without a schema type
      // Create a property group node with aggregated values
      addPropertyGroupNode(entityNodeId, propertyName, obj);
    }
  }
  
  // Process simple properties (strings, numbers, booleans)
  function processSimpleProperty(propertyName: string, value: any, entityNodeId: number): void {
    // Skip empty values and very long strings
    if (value === '' || (typeof value === 'string' && value.length > 1000)) {
      return;
    }
    
    const strValue = String(value);
    
    // Check if this is a reference to another entity
    if (propertyName === 'sameAs' || propertyName.endsWith('Url') || propertyName === 'url') {
      // Add it to pending relationships to process later
      pendingRelationships.push({
        sourceId: entityNodeId,
        targetId: strValue,
        relationship: propertyName
      });
      return;
    }
    
    // For regular properties
    const propertyNodeId = nodeId++;
    
    // Get display value (truncate very long strings)
    const displayValue = strValue.length > 100 ? 
      strValue.substring(0, 100) + '...' : 
      strValue;
    
    // Add node for the property
    nodes.push({
      id: propertyNodeId,
      name: displayValue,
      group: getPropertyGroup(propertyName),
      properties: {
        propertyName: propertyName,
        fullValue: strValue, // Store full value in properties
        source: "Schema.org-advanced-extractor",
        timestamp: timestamp
      }
    });
    
    // Link from parent entity
    links.push({
      source: entityNodeId,
      target: propertyNodeId,
      value: 1,
      label: propertyName,
      dataSource: "Schema.org-advanced-extractor",
      timestamp: timestamp
    });
  }
  
  // Add a node representing a group of properties
  function addPropertyGroupNode(entityNodeId: number, groupName: string, properties: any): void {
    // Create a summary of the property values
    const propertyValues = Object.entries(properties)
      .filter(([_, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join('\n')
      .substring(0, 200);
    
    if (!propertyValues.length) return; // Skip if no valid properties
    
    const propertyGroupNodeId = nodeId++;
    
    // Add node for the property group
    nodes.push({
      id: propertyGroupNodeId,
      name: `${groupName} properties`,
      group: getPropertyGroup(groupName),
      properties: {
        groupName: groupName,
        propertyDetails: propertyValues,
        source: "Schema.org-advanced-extractor",
        timestamp: timestamp
      }
    });
    
    // Link from parent entity
    links.push({
      source: entityNodeId,
      target: propertyGroupNodeId,
      value: 1,
      label: groupName,
      dataSource: "Schema.org-advanced-extractor",
      timestamp: timestamp
    });
  }
  
  // Add a relationship between entities (to be processed after all entities are created)
  function addRelationship(sourceId: number | string, targetId: number | string, relationship: string): void {
    pendingRelationships.push({
      sourceId,
      targetId,
      relationship
    });
  }
  
  // Process all pending relationships between entities
  function processPendingRelationships(): void {
    for (const { sourceId, targetId, relationship } of pendingRelationships) {
      let source: number;
      let target: number;
      
      // Resolve source
      if (typeof sourceId === 'number') {
        source = sourceId;
      } else if (entityMap.has(sourceId)) {
        source = entityMap.get(sourceId)!;
      } else {
        continue; // Skip if source cannot be resolved
      }
      
      // Resolve target
      if (typeof targetId === 'number') {
        target = targetId;
      } else if (entityMap.has(targetId)) {
        target = entityMap.get(targetId)!;
      } else if (typeof targetId === 'string' && targetId.startsWith('http')) {
        // If target is a URL that doesn't match our entities,
        // create a new node for the external reference
        try {
          target = nodeId++;
          const hostname = new URL(targetId).hostname;
          nodes.push({
            id: target,
            name: hostname || targetId,
            group: 3, // External reference as concept
            properties: {
              url: targetId,
              externalReference: true,
              source: "Schema.org-advanced-extractor",
              timestamp: timestamp
            }
          });
          entityMap.set(targetId, target);
        } catch (error) {
          // Skip invalid URLs
          continue;
        }
      } else {
        continue; // Skip if target cannot be resolved
      }
      
      // Check if source and target are different (avoid self-loops)
      if (source === target) continue;
      
      // Add the relationship
      links.push({
        source,
        target,
        value: 1,
        label: relationship,
        dataSource: "Schema.org-advanced-extractor",
        timestamp: timestamp
      });
    }
    
    // Clear pending relationships after processing
    pendingRelationships.length = 0;
  }
  
  // Extract a unique identifier for an entity
  function extractEntityId(entity: any, schemaType: string, isJsonLd: boolean): string | null {
    // First priority: @id for JSON-LD
    if (isJsonLd && entity['@id']) {
      return entity['@id'];
    }
    
    // Second priority: url or identifier properties
    if (entity.url && typeof entity.url === 'string') {
      return entity.url;
    }
    
    if (entity.identifier && typeof entity.identifier === 'string') {
      return entity.identifier;
    }
    
    // If it has a name and type, create a composite ID
    const name = getEntityName(entity);
    if (name) {
      return `schema:${schemaType}:${name.replace(/\s+/g, '_').toLowerCase()}`;
    }
    
    return null;
  }
  
  // Extract the Schema.org type from an entity
  function extractSchemaType(entity: any, isJsonLd: boolean): string | null {
    if (!entity || typeof entity !== 'object') return null;
    
    // Handle JSON-LD format
    if (isJsonLd && entity['@type']) {
      if (Array.isArray(entity['@type'])) {
        // Return the first type if it's an array
        return String(entity['@type'][0]).split('/').pop()?.replace('schema:', '') || String(entity['@type'][0]);
      }
      // Return the single type
      return String(entity['@type']).split('/').pop()?.replace('schema:', '') || String(entity['@type']);
    }
    
    // Handle Microdata/RDFa format
    if (!isJsonLd && entity.type) {
      const type = String(entity.type);
      
      // Extract the type name from the Schema.org URL or prefixed format
      if (type.includes('schema.org/')) {
        return type.split('/').pop() || type;
      } else if (type.includes('schema:')) {
        return type.replace('schema:', '');
      }
      
      return type;
    }
    
    return null;
  }
  
  // Get a human-readable name for an entity
  function getEntityName(entity: any): string | null {
    if (!entity || typeof entity !== 'object') return null;
    
    // Try common name properties in order of preference
    const nameProps = [
      'name', 'title', 'headline', 'alternateName', 'caption', 
      'label', 'text', 'description', 'legalName', 'givenName',
      'familyName', 'fullName', 'productName', 'brand', 'author'
    ];
    
    for (const prop of nameProps) {
      if (entity[prop]) {
        if (typeof entity[prop] === 'string') {
          return entity[prop];
        } else if (typeof entity[prop] === 'object' && entity[prop].name) {
          return entity[prop].name;
        }
      }
    }
    
    return null;
  }
  
  // Extract basic metadata when little to no Schema.org data is found
  function extractBasicMetadata(): void {
    // Extract meta tags with key information
    const metaTags = [
      { selector: 'meta[name="description"]', attribute: 'content', property: 'description' },
      { selector: 'meta[name="keywords"]', attribute: 'content', property: 'keywords' },
      { selector: 'meta[name="author"]', attribute: 'content', property: 'author' },
      { selector: 'meta[property="og:title"]', attribute: 'content', property: 'ogTitle' },
      { selector: 'meta[property="og:description"]', attribute: 'content', property: 'ogDescription' },
      { selector: 'meta[property="og:image"]', attribute: 'content', property: 'ogImage' },
      { selector: 'meta[property="og:url"]', attribute: 'content', property: 'ogUrl' },
      { selector: 'meta[property="og:type"]', attribute: 'content', property: 'ogType' },
      { selector: 'meta[name="twitter:title"]', attribute: 'content', property: 'twitterTitle' },
      { selector: 'meta[name="twitter:description"]', attribute: 'content', property: 'twitterDescription' },
      { selector: 'meta[name="twitter:image"]', attribute: 'content', property: 'twitterImage' },
    ];
    
    // Extract each meta tag and create nodes for them
    for (const metaTag of metaTags) {
      const regex = new RegExp(`<${metaTag.selector.replace(/\[/g, '\\s[^>]*')}[^>]*${metaTag.attribute}="([^"]*)"[^>]*>`, 'i');
      const match = html.match(regex);
      
      if (match && match[1] && match[1].trim()) {
        const value = match[1].trim();
        
        // For keywords, split into individual tags
        if (metaTag.property === 'keywords') {
          const keywords = value.split(',').map(k => k.trim()).filter(k => k);
          keywords.forEach((keyword, index) => {
            addPropertyNode(1, `keyword${index + 1}`, keyword);
          });
        } else {
          addPropertyNode(1, metaTag.property, value);
        }
      }
    }
    
    // Try to extract site name
    const siteNameMatch = html.match(/<meta[^>]*property="og:site_name"[^>]*content="([^"]*)"[^>]*>/i);
    if (siteNameMatch && siteNameMatch[1] && siteNameMatch[1].trim()) {
      addPropertyNode(1, 'siteName', siteNameMatch[1].trim());
    }
  }
  
  // Extract semantic content from headings and structured elements
  function extractSemanticContent(): void {
    // Extract main headings (H1)
    const h1Regex = /<h1[^>]*>(.*?)<\/h1>/gi;
    let h1Match;
    let headingCount = 0;
    
    while ((h1Match = h1Regex.exec(html)) !== null && headingCount < 5) {
      const headingText = h1Match[1].replace(/<[^>]*>/g, '').trim(); // Remove inner HTML tags
      if (headingText) {
        addPropertyNode(1, `mainHeading${headingCount > 0 ? headingCount + 1 : ''}`, headingText);
        headingCount++;
      }
    }
    
    // Extract subheadings (H2)
    const h2Regex = /<h2[^>]*>(.*?)<\/h2>/gi;
    let h2Match;
    let subheadingCount = 0;
    
    while ((h2Match = h2Regex.exec(html)) !== null && subheadingCount < 8) {
      const headingText = h2Match[1].replace(/<[^>]*>/g, '').trim();
      if (headingText) {
        addPropertyNode(1, `subheading${subheadingCount + 1}`, headingText);
        subheadingCount++;
      }
    }
    
    // Extract image alt texts (potentially descriptive content)
    const imgRegex = /<img[^>]*alt="([^"]*)"[^>]*>/gi;
    let imgMatch;
    let imageCount = 0;
    
    while ((imgMatch = imgRegex.exec(html)) !== null && imageCount < 10) {
      const altText = imgMatch[1].trim();
      if (altText && altText.length > 5) { // Skip very short alt texts
        addPropertyNode(1, `imageDescription${imageCount + 1}`, altText);
        imageCount++;
      }
    }
  }
  
  // Helper function to add a property node and link it to its parent
  function addPropertyNode(parentId: number, propertyName: string, propertyValue: string): void {
    // Skip very long property values to avoid noise
    if (propertyValue.length > 1000) {
      propertyValue = propertyValue.substring(0, 1000) + '...';
    }
    
    // Create node for the property value
    const propertyNodeId = nodeId++;
    nodes.push({
      id: propertyNodeId,
      name: propertyValue.substring(0, 100) + (propertyValue.length > 100 ? '...' : ''),
      group: getPropertyGroup(propertyName),
      properties: {
        propertyName: propertyName,
        fullValue: propertyValue, // Store full value in properties
        source: "Schema.org-advanced-extractor",
        timestamp: timestamp
      }
    });
    
    // Link from parent
    links.push({
      source: parentId,
      target: propertyNodeId,
      value: 1,
      label: propertyName,
      dataSource: "Schema.org-advanced-extractor",
      timestamp: timestamp
    });
  }
  
  // Extract Microdata items from HTML (simplified implementation)
  function extractMicrodataItems(html: string): any[] {
    // Simple regex-based extraction for itemscope elements
    const items: any[] = [];
    // This is a simplified version - a real implementation would use DOM parsing
    const itemscopeRegex = /itemscope(?:\s+itemtype=['"]([^'"]+)['"])?/g;
    const itempropRegex = /itemprop=['"]([^'"]+)['"](?:\s+content=['"]([^'"]+)['"])?/g;
    
    let match;
    while ((match = itemscopeRegex.exec(html)) !== null) {
      const item: any = {};
      
      if (match[1]) {
        item.type = match[1]; // Store as type for consistent processing
      }
      
      // Extract properties (simplified)
      const itemSegment = html.substring(match.index, match.index + 1000); // Look at next 1000 chars
      let propMatch;
      while ((propMatch = itempropRegex.exec(itemSegment)) !== null) {
        const propName = propMatch[1];
        let propValue = propMatch[2];
        
        if (!propValue) {
          // Try to extract content from element
          const contentMatch = itemSegment.substring(propMatch.index).match(/>([^<]+)</);
          if (contentMatch) {
            propValue = contentMatch[1].trim();
          }
        }
        
        if (propValue) {
          item[propName] = propValue;
        }
      }
      
      items.push(item);
    }
    
    return items;
  }
  
  // Extract RDFa items from HTML (simplified implementation)
  function extractRdfaItems(html: string): any[] {
    // Simple regex-based extraction for RDFa elements
    const items: any[] = [];
    // This is a simplified version - a real implementation would use DOM parsing
    const rdfa1Regex = /typeof=['"]([^'"]+)['"](?:\s+property=['"]([^'"]+)['"])?/g;
    const rdfa2Regex = /property=['"]([^'"]+)['"](?:\s+content=['"]([^'"]+)['"])?/g;
    
    let match;
    while ((match = rdfa1Regex.exec(html)) !== null) {
      const item: any = {
        type: match[1] // Store as type for consistent processing
      };
      
      // Extract properties (simplified)
      const itemSegment = html.substring(match.index, match.index + 1000);
      let propMatch;
      while ((propMatch = rdfa2Regex.exec(itemSegment)) !== null) {
        const propName = propMatch[1];
        let propValue = propMatch[2];
        
        if (!propValue) {
          // Try to extract content from element
          const contentMatch = itemSegment.substring(propMatch.index).match(/>([^<]+)</);
          if (contentMatch) {
            propValue = contentMatch[1].trim();
          }
        }
        
        if (propValue) {
          item[propName.split(':').pop() || propName] = propValue;
        }
      }
      
      items.push(item);
    }
    
    return items;
  }
}

/**
 * Determine the group (category) for a Schema.org type
 */
function getGroupFromSchemaType(schemaType: string): number {
  // Map Schema.org types to appropriate group numbers
  const typeToGroup: Record<string, number> = {
    'Person': 1,
    'Organization': 4,
    'Corporation': 4,
    'LocalBusiness': 4,
    'Place': 2,
    'Event': 3,
    'Product': 5,
    'Offer': 5,
    'Creative': 6, // Creative works
    'CreativeWork': 6,
    'Article': 6,
    'Book': 6,
    'Movie': 6,
    'Recipe': 6,
    'WebPage': 3,
    'WebSite': 3,
    'Action': 7,
    'Thing': 3,
    'ItemList': 3,
    'Review': 6
  };
  
  // Default groups for specific prefixes
  if (schemaType.includes('Person')) return 1;
  if (schemaType.includes('Place') || schemaType.includes('Location')) return 2;
  if (schemaType.includes('Organization') || schemaType.includes('Business')) return 4;
  if (schemaType.includes('Event')) return 3;
  if (schemaType.includes('Product') || schemaType.includes('Offer')) return 5;
  if (schemaType.includes('Creative') || schemaType.includes('Article') || 
      schemaType.includes('Book') || schemaType.includes('Media')) return 6;
  
  // Look up the type in our mapping, or default to group 3 (concepts)
  return typeToGroup[schemaType] || 3;
}

/**
 * Determine the group (category) for a property
 */
function getPropertyGroup(propertyName: string): number {
  // Map property names to appropriate group numbers
  const propertyToGroup: Record<string, number> = {
    'name': 8,
    'title': 8,
    'headline': 8,
    'description': 8,
    'text': 8,
    'content': 8,
    'author': 1,
    'creator': 1,
    'founder': 1,
    'location': 2,
    'address': 2,
    'geo': 2,
    'date': 9,
    'datePublished': 9,
    'dateCreated': 9,
    'dateModified': 9,
    'price': 10,
    'offers': 10,
    'category': 11,
    'type': 11,
    'genre': 11,
    'keywords': 11,
    'image': 12,
    'photo': 12,
    'thumbnail': 12,
    'url': 13,
    'link': 13,
    'sameAs': 13,
    'identifier': 13
  };
  
  // Check for patterns in property names
  if (propertyName.includes('name') || propertyName.includes('title') || 
      propertyName.includes('label') || propertyName.includes('heading')) return 8;
  if (propertyName.includes('date') || propertyName.includes('time')) return 9;
  if (propertyName.includes('price') || propertyName.includes('cost') || 
      propertyName.includes('salary') || propertyName.includes('offer')) return 10;
  if (propertyName.includes('image') || propertyName.includes('photo') || 
      propertyName.includes('picture') || propertyName.includes('thumbnail')) return 12;
  if (propertyName.includes('url') || propertyName.includes('link') || 
      propertyName.includes('href') || propertyName.includes('id')) return 13;
  
  // Look up the property in our mapping, or default to group 14 (other properties)
  return propertyToGroup[propertyName] || 14;
}