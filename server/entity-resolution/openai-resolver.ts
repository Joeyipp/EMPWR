/**
 * Entity resolution using OpenAI's advanced language models
 * This module provides entity matching using contextual understanding and advanced semantics
 */

import { Node } from '@shared/schema';
import { calculateStringSimilarity } from '../string-utils';
import OpenAI from 'openai';

/**
 * OpenAIResolver provides entity resolution using OpenAI's language models
 */
export class OpenAIResolver {
  private openai: OpenAI;
  
  /**
   * Create a new OpenAI resolver
   * @param apiKey OpenAI API key
   */
  constructor(private apiKey: string) {
    this.openai = new OpenAI({
      apiKey: this.apiKey
    });
  }
  
  /**
   * Determine if two entities are equivalent using OpenAI's language model
   * 
   * @param entity1 First entity name
   * @param entity2 Second entity name
   * @param entityType The group/type of the entity
   * @returns Promise with similarity score between 0 and 1
   */
  async areEntitiesEquivalent(
    entity1: string,
    entity2: string,
    entityType: number
  ): Promise<number> {
    try {
      // Prepare prompt for OpenAI
      const typeDescription = this.getEntityTypeDescription(entityType);
      const prompt = `
I need to determine if the following two entities refer to the same ${typeDescription}:

Entity 1: "${entity1}"
Entity 2: "${entity2}"

Please analyze whether these two entities refer to the same real-world ${typeDescription}.
Consider context, semantics, synonyms, abbreviations, and alternate names.
Don't focus just on string similarity, but on whether they represent the same thing.

On a scale from 0.0 to 1.0, what is the likelihood that these entities are equivalent?
- 0.0: Definitely different entities
- 0.5: Possibly the same, but uncertain
- 1.0: Definitely the same entity

Provide your answer as a number between 0.0 and 1.0, without any explanation.
`;

      // Call OpenAI API
      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are an expert entity resolution assistant. Your task is to determine if two entities refer to the same real-world thing. Provide your assessment as a single number between 0.0 and 1.0." },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 10
      });

      // Extract the score from the response
      const responseText = completion.choices[0]?.message?.content?.trim() || "";
      const scoreMatch = responseText.match(/(\d+\.\d+|\d+)/);
      
      if (scoreMatch) {
        // Convert to number and ensure it's between 0 and 1
        const score = Math.min(Math.max(parseFloat(scoreMatch[0]), 0), 1);
        return score;
      }
      
      // Fallback to string similarity if we couldn't get a valid score
      console.warn('Could not parse a valid similarity score from OpenAI response:', responseText);
      return this.fallbackSimilarityCheck(entity1, entity2);
      
    } catch (error) {
      console.error('Error calling OpenAI for entity resolution:', error);
      // Fallback to string similarity in case of API failure
      return this.fallbackSimilarityCheck(entity1, entity2);
    }
  }
  
  /**
   * Convert entity group number to a descriptive string
   */
  private getEntityTypeDescription(group: number): string {
    switch (group) {
      case 1: return "person";
      case 2: return "place or location";
      case 3: return "concept or abstract entity";
      case 4: return "organization";
      case 5: return "date or time period";
      default: return "entity";
    }
  }
  
  /**
   * Fallback similarity method when API calls fail
   */
  private fallbackSimilarityCheck(str1: string, str2: string): number {
    return calculateStringSimilarity(str1, str2);
  }
  
  /**
   * Process a batch of entity pairs to compare them efficiently
   * This optimizes API usage by batching comparisons
   * 
   * @param pairs Array of entity pairs to compare
   * @returns Promise with array of similarity scores
   */
  async batchProcessEntityPairs(
    pairs: Array<{entity1: Node, entity2: Node}>
  ): Promise<number[]> {
    // For small batches, do sequential processing to avoid rate limits
    if (pairs.length <= 5) {
      const results: number[] = [];
      for (const pair of pairs) {
        const score = await this.areEntitiesEquivalent(
          pair.entity1.name,
          pair.entity2.name,
          pair.entity1.group
        );
        results.push(score);
      }
      return results;
    }
    
    // For larger batches, try to optimize with a single batch API call
    try {
      // Prepare prompt for OpenAI
      const prompt = `
I need to determine if the following pairs of entities refer to the same real-world entity.
For each pair, provide a similarity score from 0.0 to 1.0 where:
- 0.0: Definitely different entities
- 0.5: Possibly the same, but uncertain
- 1.0: Definitely the same entity

${pairs.map((pair, index) => {
  const typeDesc = this.getEntityTypeDescription(pair.entity1.group);
  return `Pair ${index + 1} (${typeDesc}):
- Entity A: "${pair.entity1.name}"
- Entity B: "${pair.entity2.name}"`;
}).join('\n\n')}

For each pair, respond with ONLY a number between 0.0 and 1.0 in this exact format:
Pair 1: [SCORE]
Pair 2: [SCORE]
...and so on.
Do not include any explanations, just the pair number and score.
`;

      // Call OpenAI API
      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo-16k",
        messages: [
          { role: "system", content: "You are an expert entity resolution assistant. Your task is to determine if pairs of entities refer to the same real-world thing. Respond with only numbers between 0.0 and 1.0 for each pair." },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 500
      });

      const responseText = completion.choices[0]?.message?.content?.trim() || "";
      
      // Parse the response to extract scores
      const scores: number[] = [];
      const lines = responseText.split('\n');
      
      for (let i = 0; i < pairs.length; i++) {
        const pattern = new RegExp(`Pair ${i + 1}:\\s*(\\d+\\.\\d+|\\d+)`, 'i');
        
        // Find the matching line in the response
        const matchingLine = lines.find(line => pattern.test(line));
        if (matchingLine) {
          const match = matchingLine.match(pattern);
          if (match && match[1]) {
            const score = Math.min(Math.max(parseFloat(match[1]), 0), 1);
            scores.push(score);
          } else {
            scores.push(this.fallbackSimilarityCheck(pairs[i].entity1.name, pairs[i].entity2.name));
          }
        } else {
          scores.push(this.fallbackSimilarityCheck(pairs[i].entity1.name, pairs[i].entity2.name));
        }
      }
      
      return scores;
      
    } catch (error) {
      console.error('Error in batch entity resolution:', error);
      
      // Fallback to basic string similarity
      return pairs.map(pair => this.fallbackSimilarityCheck(pair.entity1.name, pair.entity2.name));
    }
  }
  
  /**
   * Resolve entities using OpenAI's understanding of semantics and context
   * 
   * @param nodes Array of nodes to resolve
   * @param similarityThreshold Minimum similarity threshold to consider two entities equivalent
   * @returns Promise with a map of original node IDs to new node IDs and the merged nodes
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
      
      // For small node sets, use a simple N^2 comparison
      if (groupNodes.length <= 50) {
        for (const node of groupNodes) {
          const originalId = node.id;
          
          // Check if we have a similar node already in mergedNodes
          let foundMatch = false;
          
          // Filter potential matches to only compare with nodes of the same group
          const potentialMatches: Array<{ node: Node; index: number }> = [];
          
          for (let i = 0; i < mergedNodes.length; i++) {
            const existingNode = mergedNodes[i];
            if (existingNode.group === node.group) {
              potentialMatches.push({ node: existingNode, index: i });
            }
          }
          
          // Batch process similarity checks if possible
          if (potentialMatches.length > 0) {
            const pairs = potentialMatches.map(match => ({
              entity1: node,
              entity2: match.node
            }));
            
            // Get similarity scores for all pairs
            const similarities = await this.batchProcessEntityPairs(pairs);
            
            // Find the best match that exceeds the threshold
            let bestMatchIndex = -1;
            let bestSimilarity = similarityThreshold;
            
            for (let i = 0; i < similarities.length; i++) {
              if (similarities[i] >= bestSimilarity) {
                bestSimilarity = similarities[i];
                bestMatchIndex = i;
              }
            }
            
            // If we found a good match, use it
            if (bestMatchIndex >= 0) {
              idMappings[originalId] = potentialMatches[bestMatchIndex].node.id;
              foundMatch = true;
            }
          }
          
          // If no match was found, add this as a new node
          if (!foundMatch) {
            const newNode: Node = {
              ...node,
              id: nextNodeId,
              // Mark the node with the algorithm used
              dataSource: `openai-resolved${node.dataSource ? ` (from ${node.dataSource})` : ''}`,
              // Mark with the current timestamp
              timestamp: new Date().toISOString()
            };
            idMappings[originalId] = nextNodeId;
            mergedNodes.push(newNode);
            nextNodeId++;
          }
        }
      } 
      // For larger sets, use a more efficient approach with clustering or pre-filtering
      else {
        console.log(`Using optimized approach for large group (size ${groupNodes.length})`);
        
        // First add the first node from this group to the merged set
        const firstNode = groupNodes[0];
        const firstNewNode: Node = {
          ...firstNode,
          id: nextNodeId,
          dataSource: `openai-resolved${firstNode.dataSource ? ` (from ${firstNode.dataSource})` : ''}`,
          timestamp: new Date().toISOString()
        };
        idMappings[firstNode.id] = nextNodeId;
        mergedNodes.push(firstNewNode);
        nextNodeId++;
        
        // For remaining nodes, first do string similarity as a filter
        for (let i = 1; i < groupNodes.length; i++) {
          const node = groupNodes[i];
          const originalId = node.id;
          
          // Use string similarity to create a shortlist of candidates
          const candidates: { 
            node: Node;
            similarity: number;
            index: number;
          }[] = [];
          
          for (let j = 0; j < mergedNodes.length; j++) {
            const existingNode = mergedNodes[j];
            if (existingNode.group === node.group) {
              const similarity = this.fallbackSimilarityCheck(node.name, existingNode.name);
              if (similarity >= similarityThreshold * 0.7) { // Lower threshold for pre-filtering
                candidates.push({ node: existingNode, similarity, index: j });
              }
            }
          }
          
          // If we have a few good candidates, check them with OpenAI
          if (candidates.length > 0 && candidates.length <= 5) {
            const pairs = candidates.map(c => ({
              entity1: node,
              entity2: c.node
            }));
            
            const similarities = await this.batchProcessEntityPairs(pairs);
            
            // Find the best match
            let bestMatchIndex = -1;
            let bestSimilarity = similarityThreshold;
            
            for (let j = 0; j < similarities.length; j++) {
              if (similarities[j] >= bestSimilarity) {
                bestSimilarity = similarities[j];
                bestMatchIndex = j;
              }
            }
            
            // Use the best match if found
            if (bestMatchIndex >= 0) {
              idMappings[originalId] = candidates[bestMatchIndex].node.id;
              continue;
            }
          }
          
          // If we have too many candidates or none, go with string similarity
          else if (candidates.length > 5) {
            // Find the best string similarity match
            let bestMatch = candidates[0];
            for (let j = 1; j < candidates.length; j++) {
              if (candidates[j].similarity > bestMatch.similarity) {
                bestMatch = candidates[j];
              }
            }
            
            // Use the best match if it's good enough
            if (bestMatch.similarity >= similarityThreshold) {
              idMappings[originalId] = bestMatch.node.id;
              continue;
            }
          }
          
          // No good match found, add as new node
          const newNode: Node = {
            ...node,
            id: nextNodeId,
            dataSource: `openai-resolved${node.dataSource ? ` (from ${node.dataSource})` : ''}`,
            timestamp: new Date().toISOString()
          };
          idMappings[originalId] = nextNodeId;
          mergedNodes.push(newNode);
          nextNodeId++;
        }
      }
    }
    
    return { idMappings, mergedNodes };
  }
}