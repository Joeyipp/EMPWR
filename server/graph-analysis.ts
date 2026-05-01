import { Graph, KnowledgeGraph, Node, Link } from '@shared/schema';
import OpenAI from 'openai';

interface GraphMetrics {
  entityCount: number;
  relationCount: number;
  mostConnectedEntities: Array<{
    id: number;
    name: string;
    connectionCount: number;
  }>;
  connectedComponentsCount: number;
  averageConnections: number;
  isolatedEntities: Array<{
    id: number;
    name: string;
  }>;
  centrality: Array<{
    id: number;
    name: string;
    score: number;
  }>;
  relationshipTypes: Array<{
    type: string;
    count: number;
  }>;
  entityTypes: Array<{
    type: string;
    count: number;
  }>;
  density: number;
}

/**
 * Analyzes a knowledge graph to extract metrics and insights
 */
export class GraphAnalyzer {
  /**
   * Calculates basic graph metrics for visualization and analysis
   * @param graph The knowledge graph to analyze
   * @returns Object containing various graph metrics
   */
  analyzeGraph(graph: Graph): GraphMetrics {
    // Ensure we have arrays for nodes and links, not undefined or empty objects
    const nodes: Node[] = Array.isArray(graph.nodes) ? graph.nodes : [];
    const links: Link[] = Array.isArray(graph.links) ? graph.links : [];
    
    // Count entities and relations
    const entityCount = nodes.length;
    const relationCount = links.length;
    
    // Calculate connection counts for each node
    const connectionCounts = new Map<number, number>();
    
    // Initialize all nodes with 0 connections
    nodes.forEach((node: Node) => connectionCounts.set(node.id, 0));
    
    // Count connections for each node
    links.forEach((link: Link) => {
      connectionCounts.set(link.source, (connectionCounts.get(link.source) || 0) + 1);
      connectionCounts.set(link.target, (connectionCounts.get(link.target) || 0) + 1);
    });
    
    // Find most connected entities
    const sortedConnections = Array.from(connectionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
      
    const mostConnectedEntities = sortedConnections.map(([id, count]) => {
      const node = nodes.find((n: Node) => n.id === id);
      return {
        id,
        name: node?.name || `Entity ${id}`,
        connectionCount: count
      };
    });
    
    // Find isolated entities (nodes with no connections)
    const isolatedEntitiesArray = Array.from(connectionCounts.entries())
      .filter(([_, count]) => count === 0);
      
    const isolatedEntities = isolatedEntitiesArray.map(([id]) => {
      const node = nodes.find((n: Node) => n.id === id);
      return {
        id,
        name: node?.name || `Entity ${id}`
      };
    });
    
    // Calculate average connections per entity
    const connectionsArray = Array.from(connectionCounts.values());
    const totalConnections = connectionsArray.reduce((sum, count) => sum + count, 0);
    const averageConnections = entityCount > 0 ? totalConnections / entityCount : 0;
    
    // Calculate connected components using BFS
    const visited = new Set<number>();
    let componentCount = 0;
    
    // Build adjacency list for efficient traversal
    const adjacencyList = new Map<number, number[]>();
    
    // Initialize the adjacency list for all nodes
    nodes.forEach((node: Node) => adjacencyList.set(node.id, []));
    
    // Populate the adjacency list with connections
    links.forEach((link: Link) => {
      const sourceAdjList = adjacencyList.get(link.source) || [];
      sourceAdjList.push(link.target);
      adjacencyList.set(link.source, sourceAdjList);
      
      const targetAdjList = adjacencyList.get(link.target) || [];
      targetAdjList.push(link.source);
      adjacencyList.set(link.target, targetAdjList);
    });
    
    // BFS to count connected components
    for (const node of nodes) {
      if (!visited.has(node.id)) {
        componentCount++;
        
        // BFS from this node
        const queue = [node.id];
        visited.add(node.id);
        
        while (queue.length > 0) {
          const currentNodeId = queue.shift()!;
          const neighbors = adjacencyList.get(currentNodeId) || [];
          
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          }
        }
      }
    }
    
    // Calculate approximate centrality (degree centrality)
    const centrality = Array.from(connectionCounts.entries())
      .map(([id, count]) => {
        const node = nodes.find((n: Node) => n.id === id);
        return {
          id,
          name: node?.name || `Entity ${id}`,
          score: count
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    
    // Count relationship types
    const relationshipTypesMap = new Map<string, number>();
    links.forEach(link => {
      const type = link.label || 'unknown';
      relationshipTypesMap.set(type, (relationshipTypesMap.get(type) || 0) + 1);
    });
    
    const relationshipTypes = Array.from(relationshipTypesMap.entries())
      .map(entry => ({ type: entry[0], count: entry[1] }))
      .sort((a, b) => b.count - a.count);
    
    // Helper function to convert entity group number to a descriptive label
    const getEntityTypeLabel = (group: number | undefined): string => {
      switch (group) {
        case 1: return "Person";
        case 2: return "Place";
        case 3: return "Concept";
        case 4: return "Organization";
        case 5: return "Date";
        case 6: return "Other";
        default: return "Unknown";
      }
    };

    // Count entity types (if available)
    const entityTypesMap = new Map<string, number>();
    nodes.forEach(node => {
      const typeLabel = getEntityTypeLabel(node.group);
      entityTypesMap.set(typeLabel, (entityTypesMap.get(typeLabel) || 0) + 1);
    });
    
    const entityTypes = Array.from(entityTypesMap.entries())
      .map(entry => ({ type: entry[0], count: entry[1] }))
      .sort((a, b) => b.count - a.count);
    
    // Calculate graph density (actual edges / possible edges)
    const maxPossibleEdges = entityCount * (entityCount - 1) / 2; // For undirected graph
    const density = maxPossibleEdges > 0 ? relationCount / maxPossibleEdges : 0;
    
    return {
      entityCount,
      relationCount,
      mostConnectedEntities,
      connectedComponentsCount: componentCount,
      averageConnections,
      isolatedEntities,
      centrality,
      relationshipTypes,
      entityTypes,
      density
    };
  }
  
  /**
   * Generates AI insights from the knowledge graph using selected language model
   * @param graph The knowledge graph to analyze
   * @param apiKey API key for the selected model
   * @param model Language model to use (openai or mistral)
   * @returns Structured insights about the knowledge graph
   */
  async generateAIInsights(graph: Graph, apiKey: string, model: string = 'openai'): Promise<{
    summary: string;
    keyInsights: string[];
    potentialRelationships: Array<{
      source: string;
      relationship: string;
      target: string;
      confidence: number;
      explanation: string;
    }>;
    knowledgeGaps: string[];
    narrative: string;
    modelUsed: string;
  }> {
    // Use the appropriate model API
    const modelName = model.toLowerCase();
    
    // Validate model selection
    if (!['openai', 'mistral'].includes(modelName)) {
      throw new Error(`Unsupported model: ${model}. Please use 'openai' or 'mistral'.`);
    }
    
    // Prepare graph data for the AI model
    const nodes: Node[] = Array.isArray(graph.nodes) ? graph.nodes : [];
    const links: Link[] = Array.isArray(graph.links) ? graph.links : [];
    
    // Create a map of entity IDs to labels
    type EntityMapType = Map<number, string>;
    const entityMap: EntityMapType = new Map();
    
    // Populate the entity map
    for (const node of nodes) {
      entityMap.set(node.id, node.name || `Entity ${node.id}`);
    }
    
    // Create triples from the graph for easier AI processing
    type Triple = {
      subject: string;
      predicate: string;
      object: string;
    };
    
    const triples: Triple[] = [];
    for (const link of links) {
      triples.push({
        subject: entityMap.get(link.source) || `Entity ${link.source}`,
        predicate: link.label || 'relates to',
        object: entityMap.get(link.target) || `Entity ${link.target}`
      });
    }
    
    // Structured analytics input
    const metrics = this.analyzeGraph(graph);
    
    // Create a structured prompt for the AI
    const prompt = `
You are a knowledge graph analyst. Analyze the following knowledge graph data and provide insights:

Graph summary:
- Name: ${graph.name}
- Entities: ${metrics.entityCount}
- Relations: ${metrics.relationCount}
- Connected components: ${metrics.connectedComponentsCount}
- Graph density: ${metrics.density.toFixed(4)}
- Most connected entities: ${metrics.mostConnectedEntities.map(e => `${e.name} (${e.connectionCount} connections)`).join(', ')}

Entity-Relationship-Entity triples from the graph:
${triples.map((t: Triple) => `- ${t.subject} ${t.predicate} ${t.object}`).join('\n')}

Please provide:
1. A concise summary of what this knowledge graph represents (2-3 sentences)
2. 3-5 key insights from analyzing the graph structure and content
3. 5 potential relationships that might exist but aren't explicitly represented in the graph (with confidence scores 0-1)
4. 2-3 knowledge gaps or areas that could benefit from additional data
5. A short narrative (2-3 paragraphs) that weaves together the main entities and relationships in this knowledge graph

Format the potential relationships as: "Entity A | relationship | Entity B | confidence score | brief explanation"
`;

    try {
      let content: string = '';
      
      // Use the appropriate API based on the selected model
      if (modelName === 'openai') {
        // Initialize OpenAI client
        const openai = new OpenAI({ apiKey });
        
        const response = await openai.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
          messages: [
            { role: "system", content: "You are a knowledge graph analysis assistant that identifies patterns, insights, and potential relationships." },
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 1500
        });
    
        content = response.choices[0]?.message?.content || '';
      } 
      else if (modelName === 'mistral') {
        // Use Mistral AI API
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "mistral-large-latest",
            messages: [
              { role: "system", content: "You are a knowledge graph analysis assistant that identifies patterns, insights, and potential relationships." },
              { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 1500
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Mistral API error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        content = data.choices?.[0]?.message?.content || '';
      }
      
      // Parse the AI response to extract structured insights
      const sections = content.split(/\d+\.\s+/).filter(Boolean);
      
      const summary = sections[0]?.trim() || 'No summary available.';
      
      // Extract key insights (handle different possible formats)
      const keyInsightsSection = sections[1] || '';
      const keyInsights = keyInsightsSection
        .split(/\n-|\n•/)
        .map(line => line.trim())
        .filter(Boolean);
      
      // Extract potential relationships
      const potentialRelationshipsSection = sections[2] || '';
      const potentialRelationships = potentialRelationshipsSection
        .split('\n')
        .filter(line => line.includes('|'))
        .map(line => {
          const parts = line.split('|').map(part => part.trim());
          return {
            source: parts[0] || '',
            relationship: parts[1] || '',
            target: parts[2] || '',
            confidence: parseFloat(parts[3]) || 0.5,
            explanation: parts[4] || ''
          };
        });
      
      // Extract knowledge gaps
      const knowledgeGapsSection = sections[3] || '';
      const knowledgeGaps = knowledgeGapsSection
        .split(/\n-|\n•/)
        .map(line => line.trim())
        .filter(Boolean);
      
      // Extract narrative
      const narrative = sections[4]?.trim() || 'No narrative available.';
      
      return {
        summary,
        keyInsights,
        potentialRelationships,
        knowledgeGaps,
        narrative,
        modelUsed: modelName
      };
    } catch (error) {
      console.error('Error generating AI insights:', error);
      return {
        summary: 'Failed to generate insights.',
        keyInsights: ['Error processing graph data.'],
        potentialRelationships: [],
        knowledgeGaps: ['Unable to identify knowledge gaps due to processing error.'],
        narrative: 'Could not generate narrative due to an error in AI processing.',
        modelUsed: modelName
      };
    }
  }

  /**
   * Creates an OpenAI assistant for interactive analysis of the knowledge graph
   * @param graph The knowledge graph to analyze
   * @param apiKey OpenAI API key
   * @returns Assistant ID and thread ID for continued conversation
   */
  async createGraphAssistant(graph: Graph, apiKey: string): Promise<{
    assistantId: string;
    threadId: string;
  }> {
    const openai = new OpenAI({ apiKey });
    
    // Prepare graph data for the assistant
    const nodes: Node[] = Array.isArray(graph.nodes) ? graph.nodes : [];
    const links: Link[] = Array.isArray(graph.links) ? graph.links : [];
    
    // Create a map of entity IDs to labels
    type EntityMapType = Map<number, string>;
    const entityMap: EntityMapType = new Map();
    
    // Populate the entity map
    for (const node of nodes) {
      entityMap.set(node.id, node.name || `Entity ${node.id}`);
    }
    
    // Create triples from the graph for easier AI processing
    type Triple = {
      subject: string;
      predicate: string;
      object: string;
    };
    
    const triples: Triple[] = [];
    for (const link of links) {
      triples.push({
        subject: entityMap.get(link.source) || `Entity ${link.source}`,
        predicate: link.label || 'relates to',
        object: entityMap.get(link.target) || `Entity ${link.target}`
      });
    }
    
    // Create or update the assistant
    let assistant;
    try {
      // Create a new assistant
      assistant = await openai.beta.assistants.create({
        name: "Knowledge Graph Analyst",
        description: "This assistant analyzes knowledge graphs and provides insights.",
        model: "gpt-4-turbo-preview",
        instructions: `
You are a specialized Knowledge Graph Analyst assistant. Your purpose is to analyze and provide insights about knowledge graphs.

You have access to a knowledge graph with the following data:
- Name: ${graph.name}
- Entities: ${nodes.length}
- Relations: ${links.length}

The complete list of triples (subject-predicate-object) from this knowledge graph is:
${triples.map((t: Triple) => `- ${t.subject} ${t.predicate} ${t.object}`).join('\n')}

When interacting with users, you can:
1. Answer questions about the structure and content of the knowledge graph
2. Identify patterns and insights from the graph structure
3. Suggest potential relationships that might exist but aren't explicitly represented
4. Identify knowledge gaps or areas that could benefit from additional data
5. Generate narratives or explanations that tie together different entities and relationships
6. Explain concepts related to knowledge graphs and network analysis

Your responses should be helpful, informative, and backed by the actual data in the knowledge graph.
Avoid making claims about relationships that aren't supported by the data unless you clearly state they are potential or predicted relationships.
`,
        tools: []
      });
    } catch (error) {
      console.error('Error creating assistant:', error);
      throw new Error('Failed to create OpenAI assistant');
    }
    
    // Create a thread for the conversation
    let thread;
    try {
      thread = await openai.beta.threads.create();
    } catch (error) {
      console.error('Error creating thread:', error);
      throw new Error('Failed to create conversation thread');
    }
    
    return {
      assistantId: assistant.id,
      threadId: thread.id
    };
  }
  
  /**
   * Sends a message to the OpenAI assistant and returns the response
   * @param message User message to send to the assistant
   * @param assistantId The OpenAI assistant ID
   * @param threadId The conversation thread ID
   * @param apiKey OpenAI API key
   * @returns Assistant's response
   */
  async sendMessageToAssistant(
    message: string,
    assistantId: string,
    threadId: string,
    apiKey: string
  ): Promise<{
    content: string;
    messageId: string;
  }> {
    const openai = new OpenAI({ apiKey });
    
    try {
      // Add the user message to the thread
      await openai.beta.threads.messages.create(threadId, {
        role: "user",
        content: message
      });
      
      // Run the assistant on the thread
      const run = await openai.beta.threads.runs.create(threadId, {
        assistant_id: assistantId
      });
      
      // Poll for the completion of the run
      let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
      
      // Loop until the run is completed
      while (runStatus.status !== 'completed' && runStatus.status !== 'failed' && runStatus.status !== 'expired') {
        // Wait for a short period before polling again
        await new Promise(resolve => setTimeout(resolve, 1000));
        runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
      }
      
      if (runStatus.status !== 'completed') {
        throw new Error(`Assistant run ${runStatus.status}`);
      }
      
      // Retrieve the messages after the run is completed
      const messages = await openai.beta.threads.messages.list(threadId);
      
      // Find the assistant's response (the most recent assistant message)
      const assistantMessages = messages.data.filter(msg => msg.role === 'assistant');
      
      if (assistantMessages.length === 0) {
        throw new Error('No assistant response found');
      }
      
      const latestMessage = assistantMessages[0];
      
      // Extract the content
      const content = latestMessage.content
        .filter(item => item.type === 'text')
        .map(item => (item.type === 'text' ? item.text.value : ''))
        .join('\n');
      
      return {
        content,
        messageId: latestMessage.id
      };
    } catch (error) {
      console.error('Error communicating with assistant:', error);
      throw new Error('Failed to get response from the assistant');
    }
  }
}

export function getGraphAnalyzer(): GraphAnalyzer {
  return new GraphAnalyzer();
}