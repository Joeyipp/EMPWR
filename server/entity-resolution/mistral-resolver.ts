/**
 * Mistral AI Entity Resolution Implementation
 * 
 * This module provides entity resolution using Mistral AI, allowing for
 * more sophisticated alignment of entities across knowledge graphs using
 * Mistral's advanced language models.
 */

import { getApiKeyForAlgorithm } from '../helper/algorithm-key-check';
import { Node, Link, KnowledgeGraph } from '../../shared/schema';
import { EntityResolver } from './index';

// Constants
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODEL = 'mistral-large-latest'; // Using the latest model for best performance

/**
 * Interface for entity resolution matches
 */
interface EntityMatch {
  sourceId: number;
  targetId: number;
  confidence: number;
  reason: string;
}

/**
 * Mistral AI-based entity resolver
 * Uses Mistral's language model capabilities for more sophisticated entity matching
 */
export class MistralResolver implements EntityResolver {
  private apiKey: string;
  
  /**
   * Create a new MistralResolver
   * @param apiKey The Mistral API key to use
   */
  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('API key is required for Mistral entity resolution');
    }
    this.apiKey = apiKey;
  }
  
  /**
   * Resolve entities using Mistral AI
   * @param nodes The nodes to resolve
   * @param similarityThreshold The threshold for considering two entities as equivalent
   * @returns A promise with the mapping and merged nodes
   */
  async resolveEntities(nodes: Node[], similarityThreshold: number = 0.75): Promise<{
    idMappings: Record<number, number>;
    mergedNodes: Node[];
  }> {
    // Track the mapping from original ID to new ID
    const idMappings: Record<number, number> = {};
    
    // Track the merged nodes
    const mergedNodes: Node[] = [];
    
    // Assign new IDs starting from 1
    let nextNodeId = 1;
    
    // Group nodes by entity type for more efficient processing
    const nodesByGroup: Record<number, Node[]> = {};
    
    for (const node of nodes) {
      if (!nodesByGroup[node.group]) {
        nodesByGroup[node.group] = [];
      }
      nodesByGroup[node.group].push(node);
    }
    
    // Process each group separately
    for (const group of Object.keys(nodesByGroup).map(Number)) {
      const groupNodes = nodesByGroup[group];
      
      // For small node sets, use a simple approach
      if (groupNodes.length <= 30) {
        for (const node of groupNodes) {
          const originalId = node.id;
          
          // Check if we have a similar node already in mergedNodes
          let foundMatch = false;
          
          // Filter potential matches to only compare with nodes of the same group
          const potentialMatches = mergedNodes.filter(existingNode => 
            existingNode.group === node.group
          );
          
          if (potentialMatches.length > 0) {
            // Use string similarity as a quick filter first
            const preFiltered = potentialMatches.filter(existingNode => 
              getNameSimilarity(node.name, existingNode.name) >= similarityThreshold * 0.7
            );
            
            // If we have potential matches after pre-filtering, use Mistral
            if (preFiltered.length > 0) {
              // Set up an array of source->target pairs
              const sourcePairs: Node[] = Array(preFiltered.length).fill(node);
              
              // Check each pair with Mistral AI
              const matches = await batchProcessEntityMatches(
                sourcePairs,
                preFiltered,
                similarityThreshold
              );
              
              // Use the first good match if any
              if (matches.length > 0) {
                const bestMatch = matches.reduce((prev, current) => 
                  (current.confidence > prev.confidence) ? current : prev
                );
                
                idMappings[originalId] = bestMatch.targetId;
                foundMatch = true;
              }
            }
          }
          
          // If no match was found, add this as a new node
          if (!foundMatch) {
            const newNode: Node = {
              ...node,
              id: nextNodeId,
              // Mark the node with the algorithm used
              dataSource: `mistral-resolved${node.dataSource ? ` (from ${node.dataSource})` : ''}`,
              // Mark with the current timestamp
              timestamp: new Date().toISOString()
            };
            idMappings[originalId] = nextNodeId;
            mergedNodes.push(newNode);
            nextNodeId++;
          }
        }
      } 
      // For larger sets, use a more efficient approach with batches
      else {
        console.log(`Using optimized approach for large group (size ${groupNodes.length})`);
        
        // First add the first node from this group
        const firstNode = groupNodes[0];
        const firstNewNode: Node = {
          ...firstNode,
          id: nextNodeId,
          dataSource: `mistral-resolved${firstNode.dataSource ? ` (from ${firstNode.dataSource})` : ''}`,
          timestamp: new Date().toISOString()
        };
        idMappings[firstNode.id] = nextNodeId;
        mergedNodes.push(firstNewNode);
        nextNodeId++;
        
        // Process other nodes in batches
        for (let i = 1; i < groupNodes.length; i += 10) {
          const batch = groupNodes.slice(i, i + 10);
          
          for (const node of batch) {
            const originalId = node.id;
            
            // Use string similarity to create a shortlist
            const candidates = mergedNodes
              .filter(existingNode => existingNode.group === node.group)
              .filter(existingNode => 
                getNameSimilarity(node.name, existingNode.name) >= similarityThreshold * 0.7
              );
            
            // If we have candidates, use Mistral to check
            if (candidates.length > 0) {
              const result = await areEntitiesEquivalent(
                node,
                candidates[0],  // Just check the first candidate for efficiency
                similarityThreshold
              );
              
              if (result.isEquivalent) {
                idMappings[originalId] = candidates[0].id;
                continue;
              }
            }
            
            // No good match found, add as new node
            const newNode: Node = {
              ...node,
              id: nextNodeId,
              dataSource: `mistral-resolved${node.dataSource ? ` (from ${node.dataSource})` : ''}`,
              timestamp: new Date().toISOString()
            };
            idMappings[originalId] = nextNodeId;
            mergedNodes.push(newNode);
            nextNodeId++;
          }
        }
      }
    }
    
    return { idMappings, mergedNodes };
  }
}

/**
 * Determines if two entities are equivalent based on their properties
 * @param sourceNode Source entity node
 * @param targetNode Target entity node
 * @param similarityThreshold Threshold for considering entities equivalent (0.0-1.0)
 * @returns Promise resolving to true if entities are equivalent, false otherwise
 */
export async function areEntitiesEquivalent(
  sourceNode: Node,
  targetNode: Node,
  similarityThreshold: number = 0.75
): Promise<{ isEquivalent: boolean; confidence: number; reason: string }> {
  try {
    // Simple case: exact match
    if (sourceNode.name.toLowerCase() === targetNode.name.toLowerCase()) {
      return {
        isEquivalent: true,
        confidence: 1.0,
        reason: 'Exact name match'
      };
    }
    
    // Get API key
    const apiKey = await getApiKeyForAlgorithm('mistral');
    
    if (!apiKey) {
      throw new Error('Mistral API key is required for Mistral entity resolution');
    }
    
    // Create context for the AI model
    const systemPrompt = `
      You are an entity resolution expert. Your task is to determine if two entities refer to the same real-world entity.
      Analyze the properties of both entities and provide a confidence score between 0.0 and 1.0.
      A score of 1.0 means certain match, 0.0 means certain non-match.
      
      Consider the following:
      - Name similarity (accounting for aliases, abbreviations, and different naming formats)
      - Type/category consistency
      - Compatible attributes (if available)
      - Contextual meaning

      Respond with a JSON object in this exact format:
      { 
        "isEquivalent": boolean,
        "confidence": number,
        "reason": "brief explanation"
      }
    `;
    
    // Format entity details
    const sourceNodeText = JSON.stringify({
      id: sourceNode.id,
      name: sourceNode.name,
      group: sourceNode.group,
      properties: sourceNode.properties || {},
      description: sourceNode.description || '',
      enriched: sourceNode.enriched || false
    }, null, 2);
    
    const targetNodeText = JSON.stringify({
      id: targetNode.id,
      name: targetNode.name,
      group: targetNode.group,
      properties: targetNode.properties || {},
      description: targetNode.description || '',
      enriched: targetNode.enriched || false
    }, null, 2);
    
    const userPrompt = `
      I need to determine if these two entities refer to the same real-world entity.
      
      Entity 1:
      ${sourceNodeText}
      
      Entity 2:
      ${targetNodeText}
      
      Please determine if these entities are equivalent with a confidence score (0.0-1.0).
      Entity pairs with confidence above ${similarityThreshold} should be considered matches.
      Provide your analysis as JSON.
    `;
    
    // Make the API request using fetch
    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.0, // Low temperature for more deterministic results
        response_format: { type: 'json_object' }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mistral API error (${response.status}): ${errorText}`);
    }
    
    // Parse the result
    const responseData = await response.json();
    const content = responseData.choices[0].message.content;
    let result;
    
    try {
      result = JSON.parse(content);
    } catch (err) {
      const error = err as Error;
      console.error('Failed to parse Mistral API response:', content);
      throw new Error(`Invalid response format from Mistral API: ${error.message || 'Unknown error'}`);
    }
    
    // Apply threshold 
    result.isEquivalent = result.confidence >= similarityThreshold;
    
    return {
      isEquivalent: result.isEquivalent,
      confidence: result.confidence,
      reason: result.reason
    };
    
  } catch (err) {
    const error = err as Error;
    console.error('Mistral entity resolution error:', error);
    // Fallback to name similarity
    const similarity = getNameSimilarity(sourceNode.name, targetNode.name);
    const isEquivalent = similarity >= similarityThreshold;
    
    return {
      isEquivalent,
      confidence: similarity,
      reason: `Fallback to string similarity due to API error: ${error.message || 'Unknown error'}`
    };
  }
}

/**
 * Batch process multiple entity matches using Mistral AI
 * @param sourceNodes Array of source nodes
 * @param targetNodes Array of target nodes
 * @param similarityThreshold Threshold for considering entities equivalent
 * @returns Promise resolving to array of entity matches
 */
export async function batchProcessEntityMatches(
  sourceNodes: Node[],
  targetNodes: Node[],
  similarityThreshold: number = 0.75
): Promise<EntityMatch[]> {
  try {
    // Get API key
    const apiKey = await getApiKeyForAlgorithm('mistral');
    
    if (!apiKey) {
      throw new Error('Mistral API key is required for batch entity resolution');
    }
    
    // Limit batch size to avoid token limits
    const maxBatchSize = 15; 
    const potentialMatches: { source: Node; target: Node }[] = [];
    
    // Create potential matches based on name similarity to reduce API calls
    for (const sourceNode of sourceNodes) {
      for (const targetNode of targetNodes) {
        // Quick pre-filtering to reduce API calls
        const quickSimilarity = getNameSimilarity(sourceNode.name, targetNode.name);
        if (quickSimilarity >= (similarityThreshold * 0.7)) { // Lower threshold for pre-filtering
          potentialMatches.push({ source: sourceNode, target: targetNode });
        }
        
        // Limit batch size
        if (potentialMatches.length >= maxBatchSize) {
          break;
        }
      }
      
      // Limit batch size
      if (potentialMatches.length >= maxBatchSize) {
        break;
      }
    }
    
    // If no potential matches after pre-filtering, return empty array
    if (potentialMatches.length === 0) {
      return [];
    }
    
    // Create system prompt for batch processing
    const systemPrompt = `
      You are an entity resolution expert. Your task is to determine if pairs of entities refer to the same real-world entities.
      For each pair, analyze the properties and provide a confidence score between 0.0 and 1.0.
      A score of 1.0 means certain match, 0.0 means certain non-match.
      
      Consider the following:
      - Name similarity (accounting for aliases, abbreviations, and different naming formats)
      - Type/category consistency
      - Compatible attributes (if available)
      - Contextual meaning

      Respond with a JSON array of match results, each with this format:
      { 
        "sourceId": number,
        "targetId": number,
        "isEquivalent": boolean,
        "confidence": number,
        "reason": "brief explanation"
      }
    `;
    
    // Format entity pairs for the prompt
    const pairsText = potentialMatches.map((pair, index) => {
      return `
        Pair ${index + 1}:
        Source Entity (ID: ${pair.source.id}):
        ${JSON.stringify({
          id: pair.source.id,
          name: pair.source.name,
          group: pair.source.group,
          properties: pair.source.properties || {},
          description: pair.source.description || '',
          enriched: pair.source.enriched || false
        }, null, 2)}
        
        Target Entity (ID: ${pair.target.id}):
        ${JSON.stringify({
          id: pair.target.id,
          name: pair.target.name,
          group: pair.target.group,
          properties: pair.target.properties || {},
          description: pair.target.description || '',
          enriched: pair.target.enriched || false
        }, null, 2)}
      `;
    }).join('\n\n');
    
    const userPrompt = `
      I need to determine if these pairs of entities refer to the same real-world entities.
      
      ${pairsText}
      
      Please determine for each pair if the entities are equivalent with a confidence score (0.0-1.0).
      Entity pairs with confidence above ${similarityThreshold} should be considered matches.
      Provide your analysis as a JSON array of results, one for each pair.
    `;
    
    // Make the API request using fetch
    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.0,
        response_format: { type: 'json_object' }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mistral API batch error (${response.status}): ${errorText}`);
    }
    
    // Parse the result
    const responseData = await response.json();
    const content = responseData.choices[0].message.content;
    let results;
    
    try {
      results = JSON.parse(content);
      
      // Ensure it's an array
      if (!Array.isArray(results)) {
        if (results.matches && Array.isArray(results.matches)) {
          results = results.matches;
        } else {
          throw new Error('Response is not an array');
        }
      }
    } catch (err) {
      const error = err as Error;
      console.error('Failed to parse Mistral API batch response:', content);
      throw new Error(`Invalid response format from Mistral API: ${error.message || 'Unknown error'}`);
    }
    
    // Process and filter results
    const matches: EntityMatch[] = [];
    
    for (const result of results) {
      if (result.confidence >= similarityThreshold) {
        matches.push({
          sourceId: result.sourceId,
          targetId: result.targetId,
          confidence: result.confidence,
          reason: result.reason
        });
      }
    }
    
    return matches;
    
  } catch (err) {
    const error = err as Error;
    console.error('Mistral batch entity resolution error:', error);
    
    // Fallback to individual processing
    const matches: EntityMatch[] = [];
    
    for (const sourceNode of sourceNodes) {
      for (const targetNode of targetNodes) {
        const result = await areEntitiesEquivalent(sourceNode, targetNode, similarityThreshold);
        
        if (result.isEquivalent) {
          matches.push({
            sourceId: sourceNode.id,
            targetId: targetNode.id,
            confidence: result.confidence,
            reason: result.reason
          });
        }
      }
    }
    
    return matches;
  }
}

/**
 * Helper function to get string similarity between entity names
 * @param str1 First string
 * @param str2 Second string
 * @returns Similarity score from 0.0 to 1.0
 */
function getNameSimilarity(str1: string, str2: string): number {
  // Normalize strings
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  // Quick check for exact match
  if (s1 === s2) return 1.0;
  
  // Levenshtein distance implementation
  const m = s1.length;
  const n = s2.length;
  
  // If either string is empty, distance is the length of the other
  if (m === 0) return 0;
  if (n === 0) return 0;
  
  // Initialize distance matrix
  const d: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  // First column is distance from empty string by inserting characters
  for (let i = 0; i <= m; i++) {
    d[i][0] = i;
  }
  
  // First row is distance from empty string by deleting characters
  for (let j = 0; j <= n; j++) {
    d[0][j] = j;
  }
  
  // Compute Levenshtein distance
  for (let j = 1; j <= n; j++) {
    for (let i = 1; i <= m; i++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,      // deletion
        d[i][j - 1] + 1,      // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  // Convert distance to similarity score (0.0 to 1.0)
  const maxLength = Math.max(m, n);
  const distance = d[m][n];
  const similarity = 1 - (distance / maxLength);
  
  return similarity;
}