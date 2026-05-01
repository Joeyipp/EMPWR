import { KnowledgeGraph, Node, Link } from '@shared/schema';
import { translateWikidataPropertyLabels } from '@shared/wikidata-utils';

interface WikidataEntity {
  id: string;
  label: string;
  description?: string;
  aliases?: string[];
  properties?: {
    [key: string]: {
      label: string;
      values: {
        id?: string;
        value: string;
        type: string;
      }[];
    };
  };
}

interface WikidataSearchResult {
  id: string;
  label: string;
  description?: string;
  score: number;
}

// Map Wikidata entity types to our app's entity groups
const mapEntityTypeToGroup = (type: string): number => {
  // Mapping based on common Wikidata entity types
  const typeMapping: Record<string, number> = {
    'human': 1, // Person
    'person': 1,
    'city': 2, // Place
    'country': 2,
    'location': 2,
    'geographical object': 2,
    'concept': 3, // Concept
    'abstract object': 3,
    'organization': 4, // Organization
    'company': 4,
    'date': 5, // Date
    'point in time': 5,
    'time interval': 5
  };

  // Default to Concept (3) if no match
  return typeMapping[type.toLowerCase()] || 3;
};

/**
 * WikidataService provides methods to enrich a knowledge graph with data from Wikidata
 */
// Wikidata properties we actually use — limits response payload dramatically
const INTERESTING_PROPS = [
  'P31', 'P279', 'P361', 'P138', 'P36', 'P27', 'P106',
  'P69', 'P19', 'P570', 'P569', 'P26', 'P40', 'P127', 'P112',
];

const FETCH_TIMEOUT_MS = 10000;
const USER_AGENT = 'EMPWR-KnowledgeGraph/1.0 (https://github.com/Joeyipp/EMPWR)';

function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, {
    signal: controller.signal,
    headers: { 'User-Agent': USER_AGENT },
  }).finally(() => clearTimeout(timer));
}

export class WikidataService {
  private baseUrl = 'https://www.wikidata.org/w/api.php';
  
  /**
   * Searches for entities in Wikidata
   * @param query The search term
   * @param limit Maximum number of results (default: 5)
   * @returns Array of search results
   */
  async searchEntity(query: string, limit: number = 5): Promise<WikidataSearchResult[]> {
    try {
      const params = new URLSearchParams({
        action: 'wbsearchentities',
        search: query,
        language: 'en',
        format: 'json',
        limit: limit.toString(),
      });
      
      const response = await fetchWithTimeout(`${this.baseUrl}?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Wikidata search failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.search) {
        return [];
      }
      
      return data.search.map((item: any) => ({
        id: item.id,
        label: item.label,
        description: item.description,
        score: item.score || 0
      }));
    } catch (error) {
      console.error('Error searching Wikidata:', error);
      return [];
    }
  }
  
  /**
   * Gets detailed information about a Wikidata entity
   * @param entityId The Wikidata entity ID (e.g., "Q42" for Douglas Adams)
   * @returns Detailed entity data or null if not found
   */
  async getEntityDetails(entityId: string): Promise<WikidataEntity | null> {
    try {
      const params = new URLSearchParams({
        action: 'wbgetentities',
        ids: entityId,
        languages: 'en',
        format: 'json',
        props: 'labels|descriptions|aliases|claims',
      });
      
      const response = await fetchWithTimeout(`${this.baseUrl}?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Wikidata entity fetch failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.entities || !data.entities[entityId]) {
        return null;
      }
      
      const entity = data.entities[entityId];
      const properties: WikidataEntity['properties'] = {};
      
      // Process claims — only the subset we actually use to keep payloads small
      if (entity.claims) {
        Object.entries(entity.claims).forEach(([propId, claimsList]: [string, any]) => {
          if (!INTERESTING_PROPS.includes(propId)) return;
          const propLabel = propId;
          
          const values = claimsList.map((claim: any) => {
            const mainSnak = claim.mainsnak;
            if (!mainSnak || !mainSnak.datavalue) return null;
            
            const dv = mainSnak.datavalue;
            
            // Handle different types of values
            if (dv.type === 'wikibase-entityid') {
              return {
                id: dv.value.id,
                value: dv.value.id, // Ideally we would resolve this to a label
                type: 'entity'
              };
            } else if (dv.type === 'string') {
              return {
                value: dv.value,
                type: 'string'
              };
            } else if (dv.type === 'time') {
              return {
                value: dv.value.time,
                type: 'time'
              };
            } else if (dv.type === 'quantity') {
              return {
                value: dv.value.amount,
                type: 'quantity'
              };
            }
            
            return null;
          }).filter(Boolean);
          
          if (values.length > 0) {
            properties[propId] = {
              label: propLabel,
              values
            };
          }
        });
      }
      
      return {
        id: entityId,
        label: entity.labels?.en?.value || entityId,
        description: entity.descriptions?.en?.value,
        aliases: entity.aliases?.en?.map((alias: any) => alias.value) || [],
        properties
      };
    } catch (error) {
      console.error('Error fetching Wikidata entity details:', error);
      return null;
    }
  }
  
  /**
   * Enriches a knowledge graph with data from Wikidata
   * @param graph The original knowledge graph
   * @param maxEnrichments Maximum number of entities to enrich (default: 10)
   * @returns Object containing both the original and enriched knowledge graphs
   */
  async enrichGraph(graph: KnowledgeGraph, maxEnrichments: number = 10): Promise<{
    originalGraph: KnowledgeGraph,
    enrichedGraph: KnowledgeGraph
  }> {
    if (!graph.nodes.length) {
      return {
        originalGraph: graph,
        enrichedGraph: { ...graph }
      };
    }
    
    // Create a deep copy of the original graph to maintain it
    const originalGraph = {
      nodes: JSON.parse(JSON.stringify(graph.nodes)),
      links: JSON.parse(JSON.stringify(graph.links)),
      schema: graph.schema ? JSON.parse(JSON.stringify(graph.schema)) : []
    };
    
    const enrichedGraph: KnowledgeGraph = {
      nodes: [...graph.nodes],
      links: [...graph.links],
      schema: graph.schema ? [...graph.schema] : []
    };
    
    // Sort nodes by importance (we'll consider nodes with more connections as more important)
    const nodeConnections = new Map<number, number>();
    
    // Count connections for each node
    graph.links.forEach(link => {
      nodeConnections.set(link.source, (nodeConnections.get(link.source) || 0) + 1);
      nodeConnections.set(link.target, (nodeConnections.get(link.target) || 0) + 1);
    });
    
    // Sort nodes by number of connections (descending)
    const sortedNodes = [...graph.nodes].sort((a, b) => {
      const aConn = nodeConnections.get(a.id) || 0;
      const bConn = nodeConnections.get(b.id) || 0;
      return bConn - aConn;
    });
    
    // Take the top N nodes to enrich
    const nodesToEnrich = sortedNodes.slice(0, maxEnrichments);
    
    // Track new entities we've added to avoid duplicates
    const addedEntities = new Map<string, number>();
    
    // Assign new IDs starting from the max ID in the original graph + 1
    const maxId = Math.max(...graph.nodes.map(node => node.id));
    let nextId = maxId + 1;
    
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    // Process each node to enrich
    for (const node of nodesToEnrich) {
      await sleep(150); // throttle to avoid Wikidata rate limits
      // Search for the entity in Wikidata
      const searchResults = await this.searchEntity(node.name, 3);
      
      if (!searchResults.length) {
        continue;
      }
      
      // Take the top result
      const bestMatch = searchResults[0];
      
      // Get details for the entity
      const entityDetails = await this.getEntityDetails(bestMatch.id);
      
      if (!entityDetails) {
        continue;
      }
      
      // Current timestamp for all newly created entities and relations
      const currentTimestamp = new Date().toISOString();
      
      // Add a connection to the Wikidata entity
      enrichedGraph.links.push({
        source: node.id,
        target: nextId,
        value: 1,
        label: 'sameAs',
        enriched: true,
        wikidataId: 'P460', // Same as property in Wikidata
        dataSource: 'wikidata',
        timestamp: currentTimestamp
      });
      
      // Add the Wikidata entity
      enrichedGraph.nodes.push({
        id: nextId,
        name: entityDetails.label,
        group: node.group, // Use the same group as the original entity
        enriched: true,
        description: entityDetails.description,
        wikidataId: entityDetails.id,
        properties: entityDetails.properties,
        dataSource: 'wikidata',
        timestamp: currentTimestamp
      });
      
      // Map this entity ID
      addedEntities.set(bestMatch.id, nextId);
      nextId++;
      
      // Add some properties as nodes and connect them
      if (entityDetails.properties) {
        for (const propId of INTERESTING_PROPS) {
          if (entityDetails.properties[propId]) {
            const prop = entityDetails.properties[propId];
            
            // Take only the first few values to avoid overwhelming the graph
            const valuesToAdd = prop.values.slice(0, 3);
            
            for (const value of valuesToAdd) {
              if (value.type === 'entity' && value.id) {
                // If this entity is already added, link to it
                if (addedEntities.has(value.id)) {
                  enrichedGraph.links.push({
                    source: addedEntities.get(bestMatch.id)!,
                    target: addedEntities.get(value.id)!,
                    value: 1,
                    label: prop.label,
                    enriched: true,
                    wikidataId: propId,
                    dataSource: 'wikidata',
                    timestamp: currentTimestamp
                  });
                } else {
                  // Otherwise fetch and add this entity
                  const relatedEntity = await this.getEntityDetails(value.id);
                  
                  if (relatedEntity) {
                    // Determine the appropriate group for this entity (by type)
                    // Ideally we'd have a more sophisticated approach that examines the entity type
                    const entityGroup = propId === 'P31' ? mapEntityTypeToGroup(relatedEntity.label) : node.group;
                    
                    // Add the entity
                    enrichedGraph.nodes.push({
                      id: nextId,
                      name: relatedEntity.label,
                      group: entityGroup,
                      enriched: true,
                      description: relatedEntity.description,
                      wikidataId: relatedEntity.id,
                      properties: relatedEntity.properties,
                      dataSource: 'wikidata',
                      timestamp: currentTimestamp
                    });
                    
                    // Add the relationship
                    enrichedGraph.links.push({
                      source: addedEntities.get(bestMatch.id)!,
                      target: nextId,
                      value: 1,
                      label: prop.label,
                      enriched: true,
                      wikidataId: propId,
                      dataSource: 'wikidata',
                      timestamp: currentTimestamp
                    });
                    
                    // Map this entity ID
                    addedEntities.set(value.id, nextId);
                    nextId++;
                  }
                }
              } else if (['string', 'time', 'quantity'].includes(value.type)) {
                // Add literal values as nodes
                const valueName = 
                  value.type === 'time' 
                    ? value.value.replace(/T.*Z$/i, '').replace(/^\+/,'') // Clean up time format
                    : String(value.value);
                
                // Determine group based on value type
                const valueGroup = value.type === 'time' ? 5 : 3; // Date or Concept
                
                enrichedGraph.nodes.push({
                  id: nextId,
                  name: valueName,
                  group: valueGroup,
                  enriched: true,
                  dataSource: 'wikidata',
                  timestamp: currentTimestamp
                });
                
                // Add the relationship
                enrichedGraph.links.push({
                  source: addedEntities.get(bestMatch.id)!,
                  target: nextId,
                  value: 1,
                  label: prop.label,
                  enriched: true,
                  wikidataId: propId,
                  dataSource: 'wikidata',
                  timestamp: currentTimestamp
                });
                
                nextId++;
              }
            }
          }
        }
      }
    }
    
    // Translate Wikidata property IDs to human-readable labels before returning
    if (enrichedGraph.links && Array.isArray(enrichedGraph.links)) {
      enrichedGraph.links = translateWikidataPropertyLabels(enrichedGraph.links);
    }

    // Return a structure that includes both the original and enriched graphs
    return {
      originalGraph: originalGraph as KnowledgeGraph,
      enrichedGraph: enrichedGraph as KnowledgeGraph
    };
  }
}

export const wikidataService = new WikidataService();