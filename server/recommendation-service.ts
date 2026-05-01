import OpenAI from "openai";
import { IStorage } from "./storage";
import { Graph, KnowledgeGraph, Node, Link } from "@shared/schema";

export interface PanelRecommendation {
  id: string;
  sourceId: string | null; // ID of the panel that triggered this recommendation, or null if it's a general recommendation
  type: 'youtube' | 'website' | 'text' | 'image' | 'pdf';
  title: string;
  description: string;
  content: string; // Suggested content for the panel (URL, text, etc.)
  confidence: number; // 0.0 to 1.0 score indicating confidence
  reason: string; // Explanation for why this recommendation was made
}

export interface RecommendationOptions {
  maxRecommendations?: number;
  minConfidence?: number;
  preferredTypes?: Array<'youtube' | 'website' | 'text' | 'image' | 'pdf'>;
}

interface RecommendationAPIResponse {
  recommendations?: PanelRecommendation[];
}

export class RecommendationService {
  private openai: OpenAI;
  private storage: IStorage;
  
  constructor(storage: IStorage, openaiApiKey: string) {
    this.storage = storage;
    this.openai = new OpenAI({ apiKey: openaiApiKey });
  }
  
  /**
   * Generate recommendations for new panels based on existing panels
   * @param panels Array of existing panel data
   * @param options Recommendation options
   * @returns List of panel recommendations
   */
  async getRecommendations(
    panels: Array<{
      id: string;
      type: 'youtube' | 'website' | 'text' | 'image' | 'pdf';
      title: string;
      content: string;
    }>,
    options: RecommendationOptions = {}
  ): Promise<PanelRecommendation[]> {
    if (panels.length === 0) {
      return this.getInitialRecommendations(options);
    }
    
    // Get content-based recommendations using LLM
    const contentBasedRecs = await this.getContentBasedRecommendations(panels, options);
    
    // Get graph-based recommendations using existing knowledge graphs
    const graphBasedRecs = await this.getGraphBasedRecommendations(panels, options);
    
    // Combine and deduplicate recommendations
    const allRecommendations = [...contentBasedRecs, ...graphBasedRecs];
    
    // Sort by confidence score and limit by maxRecommendations
    const filteredRecommendations = allRecommendations
      .filter(rec => rec.confidence >= (options.minConfidence || 0.7))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, options.maxRecommendations || 5);
    
    return filteredRecommendations;
  }
  
  /**
   * Generate initial recommendations when no panels exist yet
   * @param options Recommendation options
   * @returns List of panel recommendations
   */
  private async getInitialRecommendations(
    options: RecommendationOptions = {}
  ): Promise<PanelRecommendation[]> {
    // Get popular topics from recent graphs
    const recentGraphs = await this.storage.getRecentGraphs(5);
    const topics = this.extractTopicsFromGraphs(recentGraphs);
    
    // Use OpenAI to generate recommendations based on popular topics
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are a knowledge graph recommendation system. Generate initial content recommendations for a user starting to build a knowledge graph. Provide diverse but related starting points that would create an interesting knowledge graph."
          },
          {
            role: "user",
            content: `Generate 5 panel recommendations for a new knowledge graph. Popular topics in our system include: ${topics.join(", ")}. 
            Each recommendation should include a type (youtube, website, text, image, or pdf), title, description, content (URL or text), and confidence score (0.0-1.0).
            Respond with JSON in this format: 
            {
              "recommendations": [
                {
                  "id": "rec-unique-id", 
                  "sourceId": null,
                  "type": "panel-type",
                  "title": "Panel title",
                  "description": "Brief description",
                  "content": "URL or text content",
                  "confidence": 0.9,
                  "reason": "Why this recommendation is valuable"
                }
              ]
            }`
          }
        ],
        response_format: { type: "json_object" }
      });
      
      const content = response.choices[0].message.content || "{}";
      const result = JSON.parse(content) as RecommendationAPIResponse;
      return result.recommendations || [];
      
    } catch (error) {
      console.error("Error generating initial recommendations:", error);
      return [];
    }
  }
  
  /**
   * Generate content-based recommendations using OpenAI
   * @param panels Array of existing panel data
   * @param options Recommendation options
   * @returns List of panel recommendations
   */
  private async getContentBasedRecommendations(
    panels: Array<{
      id: string;
      type: 'youtube' | 'website' | 'text' | 'image' | 'pdf';
      title: string;
      content: string;
    }>,
    options: RecommendationOptions = {}
  ): Promise<PanelRecommendation[]> {
    try {
      // Prepare panel data for analysis
      const panelData = panels.map(panel => ({
        id: panel.id,
        type: panel.type,
        title: panel.title,
        content: panel.content.substring(0, 1000) // Limit content size
      }));
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `You are a knowledge graph recommendation system. Analyze the provided panels and suggest additional panels that would enhance the knowledge graph. Focus on filling gaps and making connections between existing information.
            
            Your recommendations should be directly relevant to the existing content, with clear explanations of why they're valuable. If you recommend external content like websites or YouTube videos, provide specific URLs when possible.`
          },
          {
            role: "user",
            content: `Analyze these panels and recommend additional panels that would enhance the knowledge graph:
            ${JSON.stringify(panelData, null, 2)}
            
            Generate up to ${options.maxRecommendations || 5} recommendations. Each recommendation should include:
            - A unique ID (format: rec-[timestamp])
            - Source panel ID that triggered this recommendation (or null if it's a general recommendation)
            - Panel type (youtube, website, text, image, or pdf)
            - Title for the panel
            - Short description
            - Content (URL or text)
            - Confidence score (0.0-1.0)
            - Reason explaining why this recommendation enhances the knowledge graph
            
            Preferred panel types: ${options.preferredTypes ? options.preferredTypes.join(", ") : "any"}
            Minimum confidence: ${options.minConfidence || 0.7}
            
            Respond with JSON in this format:
            {"recommendations": [
              {
                "id": "rec-unique-id", 
                "sourceId": "panel-id-or-null",
                "type": "panel-type",
                "title": "Panel title",
                "description": "Brief description",
                "content": "URL or text content",
                "confidence": 0.9,
                "reason": "Why this recommendation is valuable"
              }
            ]}`
          }
        ],
        response_format: { type: "json_object" }
      });
      
      const content = response.choices[0].message.content || "{}";
      const result = JSON.parse(content) as RecommendationAPIResponse;
      return result.recommendations || [];
      
    } catch (error) {
      console.error("Error generating content-based recommendations:", error);
      return [];
    }
  }
  
  /**
   * Generate graph-based recommendations by analyzing existing knowledge graphs
   * @param panels Array of existing panel data
   * @param options Recommendation options
   * @returns List of panel recommendations
   */
  private async getGraphBasedRecommendations(
    panels: Array<{
      id: string;
      type: 'youtube' | 'website' | 'text' | 'image' | 'pdf';
      title: string;
      content: string;
    }>,
    options: RecommendationOptions = {}
  ): Promise<PanelRecommendation[]> {
    try {
      // Extract entities and topics from panel content
      const panelTopics = this.extractTopicsFromPanels(panels);
      
      // Get related graphs from storage
      const relatedGraphs = await this.storage.getGraphsByTopics(panelTopics, 3);
      
      if (relatedGraphs.length === 0) {
        return [];
      }
      
      // Extract common entities and relationships from related graphs
      const commonEntities = this.extractCommonEntities(relatedGraphs);
      
      // Use OpenAI to generate recommendations based on graph analysis
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are a knowledge graph recommendation system. Generate recommendations based on existing knowledge graph patterns and entities."
          },
          {
            role: "user",
            content: `Based on analysis of similar knowledge graphs, we've identified these common entities and relationships:
            ${JSON.stringify(commonEntities, null, 2)}
            
            Current panels:
            ${JSON.stringify(panels.map(p => ({ id: p.id, type: p.type, title: p.title })), null, 2)}
            
            Generate up to ${options.maxRecommendations || 3} recommendations for additional panels that would enhance the knowledge graph based on patterns from similar graphs.
            
            Each recommendation should include:
            - A unique ID (format: rec-[timestamp])
            - Source panel ID that triggered this recommendation (or null if it's a general recommendation)
            - Panel type (youtube, website, text, image, or pdf)
            - Title for the panel
            - Short description
            - Content (URL or text)
            - Confidence score (0.0-1.0)
            - Reason explaining why this recommendation enhances the knowledge graph
            
            Respond with JSON in this format:
            {"recommendations": [
              {
                "id": "rec-unique-id", 
                "sourceId": "panel-id-or-null",
                "type": "panel-type",
                "title": "Panel title",
                "description": "Brief description",
                "content": "URL or text content",
                "confidence": 0.9,
                "reason": "Why this recommendation is valuable"
              }
            ]}`
          }
        ],
        response_format: { type: "json_object" }
      });
      
      const content = response.choices[0].message.content || "{}";
      const result = JSON.parse(content) as RecommendationAPIResponse;
      return result.recommendations || [];
      
    } catch (error) {
      console.error("Error generating graph-based recommendations:", error);
      return [];
    }
  }
  
  /**
   * Extract topics from a list of panels
   * @param panels Array of panel data
   * @returns Array of extracted topics
   */
  private extractTopicsFromPanels(panels: Array<{
    id: string;
    type: 'youtube' | 'website' | 'text' | 'image' | 'pdf';
    title: string;
    content: string;
  }>): string[] {
    // Simple implementation: extract keywords from titles and content
    const allText = panels.map(p => `${p.title} ${p.content}`).join(" ");
    
    // Extract keywords (simplified version)
    const words = allText.toLowerCase().split(/\W+/);
    const wordCounts: Record<string, number> = {};
    
    const stopWords = new Set([
      "a", "an", "the", "and", "or", "but", "is", "are", "was", "were", 
      "in", "on", "at", "to", "for", "with", "by", "about", "of"
    ]);
    
    words.forEach(word => {
      if (word.length > 3 && !stopWords.has(word)) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      }
    });
    
    // Get top 10 keywords
    return Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }
  
  /**
   * Extract topics from a list of knowledge graphs
   * @param graphs Array of knowledge graphs
   * @returns Array of extracted topics
   */
  private extractTopicsFromGraphs(graphs: Graph[]): string[] {
    if (graphs.length === 0) {
      return ["artificial intelligence", "data science", "machine learning", "knowledge graphs", "semantic web"];
    }
    
    // Extract entity names from graph nodes
    const allEntityNames: string[] = [];
    
    graphs.forEach(graph => {
      if (graph.nodes && Array.isArray(graph.nodes)) {
        const entityNodes = graph.nodes.filter(node => node.group === 1);
        entityNodes.forEach(node => {
          if (node.name) allEntityNames.push(node.name);
        });
      }
    });
    
    // Count occurrences
    const entityCounts: Record<string, number> = {};
    allEntityNames.forEach(name => {
      entityCounts[name] = (entityCounts[name] || 0) + 1;
    });
    
    // Get top 10 entities
    return Object.entries(entityCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name]) => name);
  }
  
  /**
   * Extract common entities and relationships from a list of knowledge graphs
   * @param graphs Array of knowledge graphs
   * @returns Object containing common entities and relationships
   */
  private extractCommonEntities(graphs: Graph[]): {
    entities: Array<{name: string; type: string; frequency: number}>;
    relationships: Array<{source: string; target: string; type: string; frequency: number}>;
  } {
    const entityCounts: Record<string, {count: number; type: string}> = {};
    const relationCounts: Record<string, {count: number; source: string; target: string; type: string}> = {};
    
    graphs.forEach(graph => {
      // Process nodes
      if (graph.nodes && Array.isArray(graph.nodes)) {
        graph.nodes.forEach(node => {
          if (node.name) {
            const key = node.name.toLowerCase();
            if (!entityCounts[key]) {
              entityCounts[key] = { count: 0, type: node.group.toString() };
            }
            entityCounts[key].count++;
          }
        });
      }
      
      // Process links
      if (graph.links && Array.isArray(graph.links)) {
        graph.links.forEach(link => {
          if (graph.nodes && Array.isArray(graph.nodes)) {
            const sourceNode = graph.nodes.find(n => n.id === link.source);
            const targetNode = graph.nodes.find(n => n.id === link.target);
            
            if (sourceNode?.name && targetNode?.name) {
              const key = `${sourceNode.name.toLowerCase()}-${link.label || 'related'}-${targetNode.name.toLowerCase()}`;
              
              if (!relationCounts[key]) {
                relationCounts[key] = { 
                  count: 0, 
                  source: sourceNode.name,
                  target: targetNode.name,
                  type: link.label || 'related'
                };
              }
              relationCounts[key].count++;
            }
          }
        });
      }
    });
    
    // Convert to arrays and sort by frequency
    const entities = Object.entries(entityCounts)
      .map(([name, data]) => ({
        name,
        type: data.type,
        frequency: data.count
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 15);
    
    const relationships = Object.values(relationCounts)
      .map(data => ({
        source: data.source,
        target: data.target,
        type: data.type,
        frequency: data.count
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 15);
    
    return { entities, relationships };
  }
}

// Factory function to create the recommendation service
export const createRecommendationService = (
  storage: IStorage, 
  openaiApiKey: string
): RecommendationService => {
  return new RecommendationService(storage, openaiApiKey);
};