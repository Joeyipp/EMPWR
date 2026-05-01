import { Node, Link, KnowledgeGraph, Graph, InsertGraph, MergeAlgorithmTypeValue } from '@shared/schema';
import { calculateStringSimilarity } from './string-utils';
import { createEntityResolver } from './entity-resolution';

/**
 * Enhanced merge statistics including detailed information about unified entities and new relationships
 */
export interface EnhancedMergeStats {
  originalNodeCount: number;
  mergedNodeCount: number;
  newLinks: number;
  unifiedEntities: Array<{
    originalIds: number[];
    originalNames: string[];
    mergedId: number;
    mergedName: string;
    algorithm: string;
    originalSources?: Array<{
      id: number;
      name: string;
      graphId: number;
      graphName: string;
    }>;
  }>;
  newRelationships: Array<{
    sourceId: number;
    sourceName: string;
    targetId: number;
    targetName: string;
    relationship: string;
  }>;
}

/**
 * Interface for merge review options
 */
export interface MergeReviewOptions {
  approvedEntities?: Array<{
    originalIds: number[];
    originalNames: string[];
    mergedName: string;
    algorithm: string;
    approved: boolean;
  }>;
  approvedRelationships?: Array<{
    sourceId: number;
    sourceName: string;
    targetId: number;
    targetName: string;
    relationship: string;
    approved: boolean;
  }>;
}

/**
 * Merge multiple knowledge graphs with enhanced reporting
 * @param graphs The graphs to merge
 * @param newName Name for the merged graph
 * @param similarityThreshold Threshold for considering entities equivalent
 * @param algorithm The algorithm to use for entity resolution
 * @param apiKey API key for OpenAI (if using OpenAI algorithm)
 * @param reviewOptions Optional review options for approved entities and relationships
 * @returns The merged graph and detailed merge statistics
 */
export async function enhancedMergeGraphs(
  graphs: Graph[],
  newName: string,
  similarityThreshold: number = 0.8,
  algorithm: MergeAlgorithmTypeValue = 'string-similarity',
  apiKey?: string,
  reviewOptions?: MergeReviewOptions
): Promise<{
  mergedGraph: InsertGraph;
  mergeStats: EnhancedMergeStats;
}> {
  // Initialize tracking for statistics and detailed reporting
  const mergeStats: EnhancedMergeStats = {
    originalNodeCount: 0,
    mergedNodeCount: 0,
    newLinks: 0,
    unifiedEntities: [],
    newRelationships: []
  };
  
  // Gather all nodes and links from all graphs
  let allNodes: Node[] = [];
  let allLinks: Link[] = [];
  
  // Create the appropriate entity resolver based on algorithm
  const entityResolver = createEntityResolver(algorithm, apiKey);
  
  // Collect all nodes from all graphs
  const nodes: Node[] = [];
  const originalNodeMap: Record<number, Node> = {};
  
  for (const graph of graphs) {
    if (graph.nodes && Array.isArray(graph.nodes)) {
      mergeStats.originalNodeCount += graph.nodes.length;
      
      for (const node of graph.nodes) {
        nodes.push(node);
        originalNodeMap[node.id] = node;
      }
    }
  }
  
  // Check if we're using approved entities from the review
  let idMappings: Record<number, number>;
  let mergedNodes: Node[];
  
  if (reviewOptions?.approvedEntities && reviewOptions.approvedEntities.length > 0) {
    // We'll use the approved entities to manually create mappings
    console.log('Using approved entities from review');
    
    // Create a new ID mapping based on approved entities
    idMappings = {};
    
    // Start with all nodes having their own ID (1:1 mapping)
    // This ensures that by default, no entities are merged unless explicitly approved
    nodes.forEach(node => {
      idMappings[node.id] = node.id;
    });
    
    // Assign new IDs to nodes that need to be merged
    let nextNodeId = Math.max(...nodes.map(n => n.id)) + 1;
    
    // Create a map to track which nodes should be merged together and their target name
    const nodesToMerge: Record<string, { originalIds: number[], mergedName: string }> = {};
    
    // Process each approved entity unification
    // Only include entities where approved = true AND they have more than one original entity
    // (single-entity groups don't need merging)
    const approvedUnifications = reviewOptions.approvedEntities.filter(entity => 
      entity.approved && entity.originalIds.length > 1
    );
    
    for (const entity of approvedUnifications) {
      // Create a key for this entity group
      const key = entity.originalIds.sort().join('-');
      // Store both the original IDs and the approved merged name
      nodesToMerge[key] = {
        originalIds: entity.originalIds,
        mergedName: entity.mergedName
      };
    }
    
    // Process each node group to merge
    for (const [key, nodeGroup] of Object.entries(nodesToMerge)) {
      if (nodeGroup.originalIds.length <= 1) continue;
      
      // Create a new ID for this group
      const newId = nextNodeId++;
      
      // Update the ID mappings for all nodes in this group
      for (const origId of nodeGroup.originalIds) {
        idMappings[origId] = newId;
      }
    }
    
    // Now create the merged nodes
    const nodeMap: Record<number, Node> = {};
    // Map to store the approved merged names for each new ID
    const approvedNames: Record<number, string> = {};
    
    // First, collect the approved names for each merged node group
    for (const [key, nodeGroup] of Object.entries(nodesToMerge)) {
      // Find the newId this group maps to
      if (nodeGroup.originalIds.length <= 1) continue;
      const firstOrigId = nodeGroup.originalIds[0];
      const newId = idMappings[firstOrigId];
      if (newId) {
        // Store the approved name for this merged node
        approvedNames[newId] = nodeGroup.mergedName;
      }
    }
    
    // Process each node with its new ID
    for (const node of nodes) {
      const newId = idMappings[node.id];
      
      // If this node is mapped to a different ID, we need to merge it
      if (newId !== node.id || !nodeMap[newId]) {
        if (!nodeMap[newId]) {
          // Use this node as the base for the merged node
          nodeMap[newId] = {
            ...node,
            id: newId,
            // If we have an approved name for this merged node, use it
            ...(approvedNames[newId] && { name: approvedNames[newId] })
          };
          
          // Store the approved name in a console log for debugging
          if (approvedNames[newId]) {
            console.log(`Using approved name "${approvedNames[newId]}" for merged node ID ${newId}`);
          }
        } else {
          // Merge properties of this node into the existing merged node
          // We could do more sophisticated property merging here if needed
          const existingNode = nodeMap[newId];
          
          // Don't override the name if we already have an approved name
          if (approvedNames[newId] && existingNode.name !== approvedNames[newId]) {
            existingNode.name = approvedNames[newId];
            console.log(`Updated node ${newId} name to approved name "${approvedNames[newId]}"`);
          }
          
          if (node.description && !existingNode.description) {
            existingNode.description = node.description;
          }
          // Copy any additional properties if needed
          Object.keys(node).forEach(key => {
            if (key !== 'id' && key !== 'name' && key !== 'group' && key !== 'description' &&
                !(key in existingNode)) {
              (existingNode as any)[key] = (node as any)[key];
            }
          });
        }
      }
    }
    
    // Convert the map to an array
    mergedNodes = Object.values(nodeMap);
  } else {
    // Standard entity resolution using the algorithm
    console.log(`Using ${algorithm} algorithm for entity resolution`);
    const result = await entityResolver.resolveEntities(nodes, similarityThreshold);
    idMappings = result.idMappings;
    mergedNodes = result.mergedNodes;
  }
  
  // Store resolved nodes
  allNodes = mergedNodes;
  
  // Store the total number of nodes after merging
  mergeStats.mergedNodeCount = allNodes.length;
  
  // Track which original entities were merged into which new entities
  const mergedNodeMap: Record<number, Set<number>> = {};
  
  // Build a map of merged node IDs to the original node IDs that were merged into them
  for (const [originalId, mergedId] of Object.entries(idMappings)) {
    const origId = parseInt(originalId);
    if (!mergedNodeMap[mergedId]) {
      mergedNodeMap[mergedId] = new Set<number>();
    }
    mergedNodeMap[mergedId].add(origId);
  }
  
  // Create unified entities report
  for (const [mergedId, originalIds] of Object.entries(mergedNodeMap)) {
    // Include all entities in the report, even those that weren't merged
    // This allows the frontend to calculate accurate counts and show full details
    
    // Find the merged node
    const mergedNode = allNodes.find(n => n.id === parseInt(mergedId));
    if (!mergedNode) continue;
    
    // Collect original node names and source information
    const originalNames: string[] = [];
    const origIdArray = Array.from(originalIds);
    const originalSources: Array<{
      id: number;
      name: string;
      graphId: number;
      graphName: string;
    }> = [];
    
    for (const origId of origIdArray) {
      const origNode = originalNodeMap[origId];
      if (origNode) {
        originalNames.push(origNode.name || "Unnamed Entity");
        
        // Find which graph this node came from
        let sourceGraphId = 0;
        let sourceGraphName = "Unknown source";
        
        for (let i = 0; i < graphs.length; i++) {
          const graph = graphs[i];
          if (graph && graph.nodes && Array.isArray(graph.nodes)) {
            const hasNode = graph.nodes.some(node => node.id === origId);
            if (hasNode) {
              sourceGraphId = graph.id;
              sourceGraphName = graph.name || "Unnamed Graph";
              break;
            }
          }
        }
        
        // Add source information
        originalSources.push({
          id: origId,
          name: origNode.name || "Unnamed Entity",
          graphId: sourceGraphId,
          graphName: sourceGraphName
        });
      }
    }
    
    // Add to unified entities report
    // Note: We include all entities in the report including single-entity items
    // This allows the frontend to accurately show what happened during the merge
    mergeStats.unifiedEntities.push({
      originalIds: Array.from(originalIds),
      originalNames,
      mergedId: parseInt(mergedId),
      mergedName: mergedNode.name || "Merged Entity",
      algorithm,
      originalSources // Include source information
    });
  }
  
  // Next, process all links, updating source and target to use the new node IDs
  const processedLinkKeys = new Set<string>();
  const existingRelationships = new Set<string>();
  
  // First pass: collect existing relationships to identify new ones later
  for (const graph of graphs) {
    if (graph.links && Array.isArray(graph.links)) {
      for (const link of graph.links) {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        
        const newSource = idMappings[sourceId];
        const newTarget = idMappings[targetId];
        
        if (!newSource || !newTarget) continue;
        
        // Create a unique key for this relationship
        const relationshipKey = `${sourceId}-${link.label}-${targetId}`;
        existingRelationships.add(relationshipKey);
      }
    }
  }
  
  // Check if we have an approved relationships list from review
  // If so, we'll use it to determine which new relationships to include
  const approvedRelationshipsMap: Record<string, boolean> = {};
  
  if (reviewOptions?.approvedRelationships && reviewOptions.approvedRelationships.length > 0) {
    console.log('Using approved relationships from review');
    
    // Build a map for quick lookup of approved relationships
    for (const rel of reviewOptions.approvedRelationships) {
      const key = `${rel.sourceId}-${rel.relationship}-${rel.targetId}`;
      approvedRelationshipsMap[key] = rel.approved;
    }
  }
  
  // Second pass: add links and track new relationships
  for (const graph of graphs) {
    if (graph.links && Array.isArray(graph.links)) {
      for (const link of graph.links) {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        
        const newSource = idMappings[sourceId];
        const newTarget = idMappings[targetId];
        
        // Skip if we couldn't map either source or target
        if (!newSource || !newTarget) continue;
        
        // Create a unique key for this link to detect duplicates
        const linkKey = `${newSource}-${link.label}-${newTarget}`;
        
        // Check if this relationship is new (connecting entities that weren't connected before)
        // This can happen when entities from different graphs get merged
        const isNewRelationship = !existingRelationships.has(`${sourceId}-${link.label}-${targetId}`);
        
        // Skip new relationships that were rejected in the review
        if (isNewRelationship && 
            Object.keys(approvedRelationshipsMap).length > 0 &&
            approvedRelationshipsMap[`${newSource}-${link.label}-${newTarget}`] === false) {
          console.log(`Skipping rejected relationship: ${newSource}-${link.label}-${newTarget}`);
          continue;
        }
        
        // If this link hasn't been processed yet, add it
        if (!processedLinkKeys.has(linkKey)) {
          const newLink: Link = {
            ...link,
            source: newSource,
            target: newTarget,
            // Mark the algorithm used
            dataSource: `${algorithm}${link.dataSource ? ` (from ${link.dataSource})` : ''}`,
            // Mark with the current timestamp
            timestamp: new Date().toISOString()
          };
          allLinks.push(newLink);
          processedLinkKeys.add(linkKey);
          
          // If this is a new relationship created during the merge, add it to the report
          if (isNewRelationship) {
            const sourceNode = allNodes.find(n => n.id === newSource);
            const targetNode = allNodes.find(n => n.id === newTarget);
            
            if (sourceNode && targetNode) {
              // Only add to the report if it's approved (or no review options provided)
              const relationshipKey = `${newSource}-${link.label}-${newTarget}`;
              if (Object.keys(approvedRelationshipsMap).length === 0 || 
                  approvedRelationshipsMap[relationshipKey] !== false) {
                mergeStats.newRelationships.push({
                  sourceId: newSource,
                  sourceName: sourceNode.name || "Unknown Source",
                  targetId: newTarget,
                  targetName: targetNode.name || "Unknown Target",
                  relationship: link.label || "related to"
                });
              }
            }
          }
        }
      }
    }
  }
  
  // Calculate how many new links were created
  mergeStats.newLinks = mergeStats.newRelationships.length;
  
  // Create a combined input text from all graphs
  const combinedInputText = graphs.map(g => g.inputText).join('\n\n');
  
  // Get user ID from one of the source graphs (prefer the first one with a userId)
  let userId = null;
  for (const graph of graphs) {
    if (graph.userId) {
      userId = graph.userId;
      break;
    }
  }
  
  // Create the new merged graph
  const mergedGraph: InsertGraph = {
    userId: userId, // Use the first available userId from source graphs
    name: newName,
    inputText: `[Merged graph from ${graphs.length} sources] ${combinedInputText.substring(0, 200)}...`,
    nodes: allNodes,
    links: allLinks,
    entityCount: allNodes.length,
    relationCount: allLinks.length,
    createdAt: new Date().toISOString()
  };
  
  return {
    mergedGraph,
    mergeStats
  };
}