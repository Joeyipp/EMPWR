/**
 * Entity resolution module for the knowledge graph
 * This provides different algorithms for detecting and merging similar entities
 */

import { Node, Link, MergeAlgorithmTypeValue } from '@shared/schema';
import { calculateStringSimilarity } from '../string-utils';
import { WordNetResolver } from './wordnet-resolver';
import { OpenAIResolver } from './openai-resolver';
import { MistralResolver } from './mistral-resolver';

/**
 * Interface for entity resolution algorithms
 */
export interface EntityResolver {
  /**
   * Resolve entities in a list of nodes
   * @param nodes The nodes to resolve
   * @param similarityThreshold The threshold for considering two entities as equivalent
   * @returns A promise with the mapping from original node IDs to new node IDs and the merged nodes
   */
  resolveEntities(nodes: Node[], similarityThreshold: number): Promise<{
    idMappings: Record<number, number>;
    mergedNodes: Node[];
  }>;
}

/**
 * String similarity-based entity resolver
 * This uses the existing string similarity algorithm
 */
export class StringSimilarityResolver implements EntityResolver {
  /**
   * Resolve entities using string similarity
   * @param nodes The nodes to resolve
   * @param similarityThreshold The threshold for considering two entities as equivalent
   * @returns A promise with the mapping and merged nodes
   */
  async resolveEntities(nodes: Node[], similarityThreshold: number = 0.8): Promise<{
    idMappings: Record<number, number>;
    mergedNodes: Node[];
  }> {
    // Track the mapping from original ID to new ID
    const idMappings: Record<number, number> = {};
    
    // Track the merged nodes
    const mergedNodes: Node[] = [];
    
    // Assign new IDs starting from 1
    let nextNodeId = 1;
    
    // Process each node
    for (const node of nodes) {
      // Track this node's ID mapping
      const originalId = node.id;
      
      // Check if we have a similar node already
      let foundMatch = false;
      for (let i = 0; i < mergedNodes.length; i++) {
        const existingNode = mergedNodes[i];
        
        // Compare node names for similarity
        const similarity = calculateStringSimilarity(node.name, existingNode.name);
        
        // If similarity is above threshold and they're the same entity type, merge them
        if (similarity >= similarityThreshold && node.group === existingNode.group) {
          // Found a match, use the existing node ID
          idMappings[originalId] = existingNode.id;
          foundMatch = true;
          break;
        }
      }
      
      // If no match was found, add this as a new node
      if (!foundMatch) {
        const newNode: Node = {
          ...node,
          id: nextNodeId,
          // Mark the node with the algorithm used
          dataSource: `string-resolved${node.dataSource ? ` (from ${node.dataSource})` : ''}`,
          // Mark with the current timestamp
          timestamp: new Date().toISOString()
        };
        idMappings[originalId] = nextNodeId;
        mergedNodes.push(newNode);
        nextNodeId++;
      }
    }
    
    return { idMappings, mergedNodes };
  }
}

/**
 * Factory function to create the appropriate entity resolver
 * @param algorithm The algorithm type to use
 * @param apiKey The OpenAI API key if needed
 * @returns An entity resolver
 */
export function createEntityResolver(
  algorithm: MergeAlgorithmTypeValue, 
  apiKey?: string
): EntityResolver {
  switch (algorithm) {
    case 'wordnet':
      return new WordNetResolver();
    case 'openai':
      if (!apiKey) {
        throw new Error('OpenAI API key is required for OpenAI entity resolution');
      }
      return new OpenAIResolver(apiKey);
    case 'mistral':
      if (!apiKey) {
        throw new Error('Mistral API key is required for Mistral entity resolution');
      }
      return new MistralResolver(apiKey);
    case 'string-similarity':
    default:
      return new StringSimilarityResolver();
  }
}