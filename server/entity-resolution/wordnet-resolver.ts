/**
 * Entity resolution using WordNet-based semantic similarity
 * This module provides more advanced entity matching using synonyms and semantic relations
 */

import { Node } from '@shared/schema';
import { calculateStringSimilarity } from '../string-utils';

/**
 * WordNetResolver provides entity resolution using WordNet synsets and synonyms
 * This is a simulated implementation as actual WordNet would require additional packages
 */
export class WordNetResolver {
  /**
   * Calculate semantic similarity between two strings using simulated WordNet synsets
   * In a real implementation, this would use a WordNet database to find synonyms and semantic relations
   * 
   * @param str1 First string to compare
   * @param str2 Second string to compare
   * @returns A similarity score between 0 (not similar) and 1 (identical)
   */
  calculateSemanticSimilarity(str1: string, str2: string): number {
    // Basic string similarity as a baseline
    const stringSimilarity = calculateStringSimilarity(str1, str2);
    
    // If strings are already very similar, return the high similarity
    if (stringSimilarity > 0.9) {
      return stringSimilarity;
    }
    
    // Enhance similarity with simulated semantic matching
    const semanticBoost = this.simulateSemanticMatching(str1.toLowerCase(), str2.toLowerCase());
    
    // Calculate boosted similarity but cap at 1.0
    return Math.min(stringSimilarity + semanticBoost, 1.0);
  }
  
  /**
   * Simulate semantic matching with common patterns
   * In a real implementation, this would use actual WordNet data
   */
  private simulateSemanticMatching(s1: string, s2: string): number {
    let semanticScore = 0;
    
    // Check for known synonyms
    const synonymPairs = [
      ['company', 'corporation', 'enterprise', 'firm', 'business'],
      ['person', 'individual', 'human'],
      ['location', 'place', 'area', 'region', 'spot'],
      ['time', 'date', 'period', 'duration'],
      ['book', 'publication', 'volume', 'text'],
      ['product', 'item', 'good', 'merchandise'],
      ['event', 'occurrence', 'incident', 'occasion'],
      ['technology', 'tech', 'technical'],
      ['software', 'application', 'program', 'app'],
      ['service', 'utility', 'assistance'],
      ['employee', 'worker', 'staff', 'personnel'],
      ['customer', 'client', 'consumer', 'user'],
      ['student', 'pupil', 'learner'],
      ['teacher', 'instructor', 'educator', 'professor'],
      ['researcher', 'scientist', 'investigator']
    ];
    
    // Check if both strings belong to the same synonym group
    for (const group of synonymPairs) {
      const s1Matches = group.some(term => s1.includes(term));
      const s2Matches = group.some(term => s2.includes(term));
      
      if (s1Matches && s2Matches) {
        semanticScore += 0.3; // Significant boost for recognized synonyms
        break;
      }
    }
    
    // Check for compound words (e.g., "data science" and "science of data")
    const s1Words = s1.split(/\s+/);
    const s2Words = s2.split(/\s+/);
    
    // Count shared words between the two strings
    const sharedWords = s1Words.filter(word => s2Words.includes(word));
    if (sharedWords.length > 0) {
      const coverage = sharedWords.length / Math.max(s1Words.length, s2Words.length);
      semanticScore += coverage * 0.2;
    }
    
    // Check for possessive forms (e.g., "John's" vs "John")
    if (s1.endsWith("'s") && s2 === s1.substring(0, s1.length - 2)) {
      semanticScore += 0.2;
    }
    if (s2.endsWith("'s") && s1 === s2.substring(0, s2.length - 2)) {
      semanticScore += 0.2;
    }
    
    // Check for common abbreviations (simplified example)
    const abbrevPairs = [
      ['united states', 'us', 'usa'],
      ['united kingdom', 'uk'],
      ['artificial intelligence', 'ai'],
      ['machine learning', 'ml'],
      ['natural language processing', 'nlp'],
      ['information technology', 'it']
    ];
    
    for (const group of abbrevPairs) {
      const s1Matches = group.some(term => s1 === term);
      const s2Matches = group.some(term => s2 === term);
      
      if (s1Matches && s2Matches) {
        semanticScore += 0.4; // Higher boost for abbreviation matches
        break;
      }
    }
    
    // Calculate edit distance for very short strings (< 5 chars)
    if (s1.length < 5 && s2.length < 5) {
      const normalizedEditDistance = this.calculateNormalizedEditDistance(s1, s2);
      if (normalizedEditDistance < 0.3) { // Small edit distance
        semanticScore += 0.2;
      }
    }
    
    return semanticScore;
  }
  
  /**
   * Calculate normalized edit distance between two strings
   */
  private calculateNormalizedEditDistance(s1: string, s2: string): number {
    // Simple Levenshtein distance implementation
    const m = s1.length;
    const n = s2.length;
    
    // Handle edge cases
    if (m === 0) return n;
    if (n === 0) return m;
    
    // Create distance matrix
    const d: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    // Initialize first row and column
    for (let i = 0; i <= m; i++) d[i][0] = i;
    for (let j = 0; j <= n; j++) d[0][j] = j;
    
    // Fill distance matrix
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        d[i][j] = Math.min(
          d[i - 1][j] + 1,      // deletion
          d[i][j - 1] + 1,      // insertion
          d[i - 1][j - 1] + cost // substitution
        );
      }
    }
    
    // Return normalized distance between 0 and 1
    return d[m][n] / Math.max(m, n);
  }
  
  /**
   * Resolve entities based on semantic similarity
   * This merges similar nodes based on their semantic meaning rather than string similarity
   * 
   * @param nodes Array of nodes to resolve
   * @param threshold Minimum similarity threshold to consider two entities equivalent
   * @returns A map of original node IDs to new node IDs
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
        
        // Skip if not the same entity type
        if (node.group !== existingNode.group) {
          continue;
        }
        
        // Compare node names using semantic similarity
        const similarity = this.calculateSemanticSimilarity(node.name, existingNode.name);
        
        // If similarity is above threshold and they're the same entity type, merge them
        if (similarity >= similarityThreshold) {
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
          dataSource: `wordnet-resolved${node.dataSource ? ` (from ${node.dataSource})` : ''}`,
          // Mark with the current timestamp
          timestamp: new Date().toISOString()
        };
        idMappings[originalId] = nextNodeId;
        mergedNodes.push(newNode);
        nextNodeId++;
      }
    }
    
    return Promise.resolve({ idMappings, mergedNodes });
  }
}