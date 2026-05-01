import { 
  users, type User, type InsertUser, 
  graphs, type Graph, type InsertGraph,
  apiKeys, type ApiKey, type InsertApiKey,
  ontologies, type Ontology, type InsertOntology,
  systemSettings, type SystemSetting, type InsertSystemSetting,
  scholarProfiles, type ScholarProfile, type InsertScholarProfile,
  type KnowledgeGraph, type Node, type Link,
  type MergeAlgorithmTypeValue, type SystemSettingKey, SYSTEM_SETTINGS
} from "@shared/schema";
import pg from 'pg';
const { Pool } = pg;
import * as fs from 'fs';
import * as path from 'path';
import { calculateStringSimilarity } from './string-utils';
import { createEntityResolver } from './entity-resolution';

// Storage interface with CRUD methods
export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>; // Get all users (for admin dashboard)
  createUser(user: InsertUser): Promise<number>; // Returns user ID
  updateUser(id: number, userData: Partial<User>): Promise<boolean>; // Update user details
  updateUserLastLogin(id: number, lastLogin: string): Promise<boolean>;
  deleteUser(id: number): Promise<boolean>; // Delete a user
  
  // Knowledge Graph methods
  createGraph(graph: InsertGraph): Promise<Graph>;
  getGraph(id: number): Promise<Graph | undefined>;
  getGraphsByUser(userId: number): Promise<Graph[]>;
  getAllGraphs(): Promise<Graph[]>;
  getRecentGraphs(limit: number): Promise<Graph[]>; // Get most recently created graphs
  getGraphsByTopics(topics: string[], limit: number): Promise<Graph[]>; // Get graphs related to topics
  updateGraphName(id: number, name: string): Promise<Graph | undefined>;
  updateGraphContent(id: number, nodes: Node[], links: Link[]): Promise<Graph | undefined>;
  updateGraphOwner(id: number, userId: number): Promise<boolean>; // Update the owner/user ID of a graph
  updateNode(graphId: number, nodeId: number, updatedNode: Node): Promise<Graph | undefined>;
  updateLink(graphId: number, source: number, target: number, updatedLink: Link): Promise<Graph | undefined>;
  deleteNode(graphId: number, nodeId: number): Promise<Graph | undefined>;
  deleteLink(graphId: number, source: number, target: number): Promise<Graph | undefined>;
  addNode(graphId: number, newNode: Node): Promise<Graph | undefined>;
  addLink(graphId: number, newLink: Link): Promise<Graph | undefined>;
  deleteGraph(id: number): Promise<boolean>;
  deleteMultipleGraphs(ids: number[]): Promise<{ success: number[]; failed: number[] }>;
  
  // API Keys methods
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  getApiKeysByProvider(provider: string): Promise<ApiKey[]>;
  getApiKeysByProviderAndUser(provider: string, userId: number): Promise<ApiKey[]>; // Get API keys for a specific provider and user
  getApiKey(id: number): Promise<ApiKey | undefined>;
  getApiKeyById(id: number): Promise<ApiKey | undefined>;  // Alias for getApiKey for readability
  updateApiKeyLastUsed(id: number, lastUsed: string): Promise<boolean>;
  deleteApiKey(id: number): Promise<boolean>;
  getActiveApiKey(provider: string, userId?: number): Promise<ApiKey | undefined>; // Get the most recently created/used API key for a provider (optionally filtered by user)
  
  // Merge multiple graphs into a new graph
  mergeGraphs(
    graphIds: number[], 
    newName: string, 
    similarityThreshold?: number,
    algorithm?: MergeAlgorithmTypeValue,
    apiKey?: string
  ): Promise<{ 
    graph: Graph; 
    mergeStats: { 
      originalNodeCount: number;
      mergedNodeCount: number;
      newLinks: number;
      unifiedEntities: Array<{
        originalIds: number[];
        originalNames: string[];
        mergedId: number;
        mergedName: string;
        algorithm: string;
      }>;
      newRelationships: Array<{
        sourceId: number;
        sourceName: string;
        targetId: number;
        targetName: string;
        relationship: string;
      }>;
    }
  }>;
  
  // Ontology methods
  createOntology(ontology: InsertOntology): Promise<Ontology>;
  getOntology(id: number): Promise<Ontology | undefined>;
  getOntologyById(id: number): Promise<Ontology | undefined>; // Alias for getOntology
  getOntologiesByUser(userId: number): Promise<Ontology[]>;
  getAllOntologies(): Promise<Ontology[]>;
  updateOntology(id: number, ontology: Partial<Ontology>): Promise<Ontology | undefined>;
  deleteOntology(id: number): Promise<boolean>;
  
  // System Settings methods
  getSetting(key: SystemSettingKey): Promise<SystemSetting | undefined>;
  getAllSettings(): Promise<SystemSetting[]>;
  createSetting(setting: InsertSystemSetting): Promise<SystemSetting>;
  updateSetting(key: SystemSettingKey, value: string, userId: number): Promise<SystemSetting | undefined>;
  
  // Scholar Profile methods
  createScholarProfile(profile: InsertScholarProfile): Promise<ScholarProfile>;
  getScholarProfile(authorId: string, userId: number): Promise<ScholarProfile | undefined>;
  getScholarProfileById(id: number): Promise<ScholarProfile | undefined>;
  getScholarProfilesByUser(userId: number): Promise<ScholarProfile[]>;
  updateScholarProfile(authorId: string, userId: number, updates: Partial<InsertScholarProfile>): Promise<ScholarProfile | undefined>;
  deleteScholarProfile(id: number): Promise<boolean>;
  deleteSetting(key: SystemSettingKey): Promise<boolean>;
  isSignupEnabled(): Promise<boolean>; // Convenience method for signup status
}

// In-memory storage as a fallback
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private graphs: Map<number, Graph>;
  private apiKeys: Map<number, ApiKey>;
  private ontologies: Map<number, Ontology>;
  private settings: Map<string, SystemSetting>;
  private scholarProfiles: Map<number, ScholarProfile>;
  private userCurrentId: number;
  private graphCurrentId: number;
  private apiKeyCurrentId: number;
  private ontologyCurrentId: number;
  private settingCurrentId: number;
  private scholarProfileCurrentId: number;

  constructor() {
    this.users = new Map();
    this.graphs = new Map();
    this.apiKeys = new Map();
    this.ontologies = new Map();
    this.settings = new Map();
    this.scholarProfiles = new Map();
    this.userCurrentId = 1;
    this.graphCurrentId = 1;
    this.apiKeyCurrentId = 1;
    this.ontologyCurrentId = 1;
    this.settingCurrentId = 1;
    this.scholarProfileCurrentId = 1;

    // Try to load previously saved data from a file
    this.loadFromDisk();
  }

  // Save state to disk for persistence between server restarts
  private saveToDisk() {
    try {
      const dataDir = path.join(process.cwd(), 'data');
      
      // Create data directory if it doesn't exist
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const graphsData = Array.from(this.graphs.values());
      const usersData = Array.from(this.users.values());
      const apiKeysData = Array.from(this.apiKeys.values());
      const ontologiesData = Array.from(this.ontologies.values());
      const data = { 
        graphs: graphsData, 
        users: usersData,
        apiKeys: apiKeysData,
        ontologies: ontologiesData
      };
      
      fs.writeFileSync(
        path.join(dataDir, 'storage.json'),
        JSON.stringify(data, null, 2)
      );
    } catch (error) {
      console.error('Error saving data to disk:', error);
    }
  }

  // Load state from disk
  private loadFromDisk() {
    try {
      const filePath = path.join(process.cwd(), 'data', 'storage.json');
      
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        if (data.graphs && Array.isArray(data.graphs)) {
          for (const graph of data.graphs) {
            this.graphs.set(graph.id, graph);
            this.graphCurrentId = Math.max(this.graphCurrentId, graph.id + 1);
          }
        }
        
        if (data.users && Array.isArray(data.users)) {
          for (const user of data.users) {
            this.users.set(user.id, user);
            this.userCurrentId = Math.max(this.userCurrentId, user.id + 1);
          }
        }
        
        if (data.apiKeys && Array.isArray(data.apiKeys)) {
          for (const apiKey of data.apiKeys) {
            this.apiKeys.set(apiKey.id, apiKey);
            this.apiKeyCurrentId = Math.max(this.apiKeyCurrentId, apiKey.id + 1);
          }
        }
        
        if (data.ontologies && Array.isArray(data.ontologies)) {
          for (const ontology of data.ontologies) {
            this.ontologies.set(ontology.id, ontology);
            this.ontologyCurrentId = Math.max(this.ontologyCurrentId, ontology.id + 1);
          }
        }

        console.log(`Loaded ${this.graphs.size} graphs, ${this.users.size} users, ${this.apiKeys.size} API keys, and ${this.ontologies.size} ontologies from disk.`);
      }
    } catch (error) {
      console.error('Error loading data from disk:', error);
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }
  
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createUser(insertUser: InsertUser): Promise<number> {
    const id = this.userCurrentId++;
    const timestamp = new Date().toISOString();
    
    // Create a complete user object with all required fields
    const user: User = {
      id,
      username: insertUser.username,
      email: insertUser.email,
      password: insertUser.password,
      fullName: insertUser.fullName || null,
      avatarUrl: null,
      createdAt: timestamp,
      lastLogin: timestamp,
      isAdmin: insertUser.isAdmin || false
    };
    
    this.users.set(id, user);
    
    // Save to disk for persistence
    this.saveToDisk();
    
    return id;
  }
  
  async updateUserLastLogin(id: number, lastLogin: string): Promise<boolean> {
    const user = this.users.get(id);
    
    if (!user) {
      return false;
    }
    
    // Update the last login timestamp
    user.lastLogin = lastLogin;
    this.users.set(id, user);
    
    // Save to disk for persistence
    this.saveToDisk();
    
    return true;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<boolean> {
    const user = this.users.get(id);
    
    if (!user) {
      return false;
    }
    
    // Update user fields, but don't allow changing the id
    const updatedUser: User = {
      ...user,
      ...userData,
      id: user.id // Ensure id remains unchanged
    };
    
    this.users.set(id, updatedUser);
    
    // Save to disk for persistence
    this.saveToDisk();
    
    return true;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    if (!this.users.has(id)) {
      return false;
    }
    
    // Delete the user
    this.users.delete(id);
    
    // Save to disk for persistence
    this.saveToDisk();
    
    return true;
  }

  async createGraph(insertGraph: InsertGraph): Promise<Graph> {
    const id = this.graphCurrentId++;
    const graph: Graph = { 
      id,
      userId: insertGraph.userId || null,
      name: insertGraph.name || null,
      inputText: insertGraph.inputText,
      nodes: insertGraph.nodes,
      links: insertGraph.links,
      entityCount: insertGraph.entityCount,
      relationCount: insertGraph.relationCount,
      createdAt: insertGraph.createdAt
    };
    this.graphs.set(id, graph);
    
    // Save to disk for persistence
    this.saveToDisk();
    
    return graph;
  }

  async getGraph(id: number): Promise<Graph | undefined> {
    return this.graphs.get(id);
  }

  async getGraphsByUser(userId: number): Promise<Graph[]> {
    return Array.from(this.graphs.values()).filter(
      (graph) => graph.userId === userId
    );
  }

  async getAllGraphs(): Promise<Graph[]> {
    return Array.from(this.graphs.values());
  }
  
  async getRecentGraphs(limit: number): Promise<Graph[]> {
    return Array.from(this.graphs.values())
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA; // Sort in descending order (newest first)
      })
      .slice(0, limit);
  }
  
  async getGraphsByTopics(topics: string[], limit: number): Promise<Graph[]> {
    if (!topics.length) return [];
    
    // Create a scoring system for each graph based on how many topics it contains
    const graphScores: Map<number, number> = new Map();
    
    // Get all graphs
    const allGraphs = Array.from(this.graphs.values());
    
    // Score each graph based on topic matches in node names and input text
    for (const graph of allGraphs) {
      let score = 0;
      
      // Check input text for topics
      if (graph.inputText) {
        const lowerInputText = graph.inputText.toLowerCase();
        topics.forEach(topic => {
          if (lowerInputText.includes(topic.toLowerCase())) {
            score += 1;
          }
        });
      }
      
      // Check node names for topics
      if (graph.nodes && Array.isArray(graph.nodes)) {
        graph.nodes.forEach(node => {
          if (node.name) {
            const lowerNodeName = node.name.toLowerCase();
            topics.forEach(topic => {
              if (lowerNodeName.includes(topic.toLowerCase())) {
                score += 2; // Node names are more important than text
              }
            });
          }
        });
      }
      
      if (score > 0) {
        graphScores.set(graph.id, score);
      }
    }
    
    // Sort graphs by score and return the top results
    return allGraphs
      .filter(graph => graphScores.has(graph.id))
      .sort((a, b) => (graphScores.get(b.id) || 0) - (graphScores.get(a.id) || 0))
      .slice(0, limit);
  }

  async updateGraphName(id: number, name: string): Promise<Graph | undefined> {
    const graph = this.graphs.get(id);
    
    if (!graph) {
      return undefined;
    }
    
    // Update the graph name
    const updatedGraph: Graph = {
      ...graph,
      name: name
    };
    
    this.graphs.set(id, updatedGraph);
    
    // Save to disk for persistence
    this.saveToDisk();
    
    return updatedGraph;
  }

  async updateGraphContent(id: number, nodes: Node[], links: Link[]): Promise<Graph | undefined> {
    const graph = this.graphs.get(id);
    
    if (!graph) {
      return undefined;
    }
    
    // Update the graph with new nodes and links
    const updatedGraph: Graph = {
      ...graph,
      nodes: nodes,
      links: links,
      entityCount: nodes.length,
      relationCount: links.length
    };
    
    this.graphs.set(id, updatedGraph);
    
    // Save to disk for persistence
    this.saveToDisk();
    
    return updatedGraph;
  }

  async updateGraphOwner(id: number, userId: number): Promise<boolean> {
    const graph = this.graphs.get(id);
    
    if (!graph) {
      return false;
    }
    
    // Update the graph with the new owner
    const updatedGraph: Graph = {
      ...graph,
      userId: userId
    };
    
    this.graphs.set(id, updatedGraph);
    
    // Save to disk for persistence
    this.saveToDisk();
    
    return true;
  }

  async updateNode(graphId: number, nodeId: number, updatedNode: Node): Promise<Graph | undefined> {
    const graph = this.graphs.get(graphId);
    
    if (!graph) {
      return undefined;
    }
    
    // Find the node index
    const nodeIndex = (graph.nodes as Node[]).findIndex((node: Node) => node.id === nodeId);
    
    if (nodeIndex === -1) {
      return undefined;
    }
    
    // Create a new array with the updated node
    const updatedNodes = [...(graph.nodes as Node[])];
    updatedNodes[nodeIndex] = updatedNode;
    
    // Update the graph with the modified nodes
    const updatedGraph: Graph = {
      ...graph,
      nodes: updatedNodes
    };
    
    this.graphs.set(graphId, updatedGraph);
    
    // Save to disk for persistence
    this.saveToDisk();
    
    return updatedGraph;
  }

  async updateLink(graphId: number, source: number, target: number, updatedLink: Link): Promise<Graph | undefined> {
    const graph = this.graphs.get(graphId);
    
    if (!graph) {
      return undefined;
    }
    
    // Find the link index matching source and target
    const linkIndex = (graph.links as Link[]).findIndex((link: Link) => 
      link.source === source && link.target === target
    );
    
    if (linkIndex === -1) {
      return undefined;
    }
    
    // Create a new array with the updated link
    const updatedLinks = [...(graph.links as Link[])];
    updatedLinks[linkIndex] = updatedLink;
    
    // Update the graph with the modified links
    const updatedGraph: Graph = {
      ...graph,
      links: updatedLinks
    };
    
    this.graphs.set(graphId, updatedGraph);
    
    // Save to disk for persistence
    this.saveToDisk();
    
    return updatedGraph;
  }

  async deleteNode(graphId: number, nodeId: number): Promise<Graph | undefined> {
    const graph = this.graphs.get(graphId);
    
    if (!graph) {
      return undefined;
    }
    
    // Filter out the node to be deleted
    const updatedNodes = (graph.nodes as Node[]).filter((node: Node) => node.id !== nodeId);
    
    // Also filter out any links connected to the deleted node
    const updatedLinks = (graph.links as Link[]).filter((link: Link) => 
      link.source !== nodeId && link.target !== nodeId
    );
    
    // Update the graph with the modified nodes and links
    const updatedGraph: Graph = {
      ...graph,
      nodes: updatedNodes,
      links: updatedLinks,
      entityCount: updatedNodes.length,
      relationCount: updatedLinks.length
    };
    
    this.graphs.set(graphId, updatedGraph);
    
    // Save to disk for persistence
    this.saveToDisk();
    
    return updatedGraph;
  }

  async deleteLink(graphId: number, source: number, target: number): Promise<Graph | undefined> {
    const graph = this.graphs.get(graphId);
    
    if (!graph) {
      return undefined;
    }
    
    // Filter out the link to be deleted
    const updatedLinks = (graph.links as Link[]).filter((link: Link) => 
      !(link.source === source && link.target === target)
    );
    
    // Update the graph with the modified links
    const updatedGraph: Graph = {
      ...graph,
      links: updatedLinks,
      relationCount: updatedLinks.length
    };
    
    this.graphs.set(graphId, updatedGraph);
    
    // Save to disk for persistence
    this.saveToDisk();
    
    return updatedGraph;
  }

  async addNode(graphId: number, newNode: Node): Promise<Graph | undefined> {
    const graph = this.graphs.get(graphId);
    
    if (!graph) {
      return undefined;
    }
    
    // Ensure the node has a unique ID
    const existingIds = new Set((graph.nodes as Node[]).map((node: Node) => node.id));
    if (existingIds.has(newNode.id)) {
      // If ID already exists, assign a new one
      newNode.id = Math.max(...Array.from(existingIds)) + 1;
    }
    
    // Add the new node
    const updatedNodes = [...(graph.nodes as Node[]), newNode];
    
    // Update the graph with the modified nodes
    const updatedGraph: Graph = {
      ...graph,
      nodes: updatedNodes,
      entityCount: updatedNodes.length
    };
    
    this.graphs.set(graphId, updatedGraph);
    
    // Save to disk for persistence
    this.saveToDisk();
    
    return updatedGraph;
  }

  async addLink(graphId: number, newLink: Link): Promise<Graph | undefined> {
    const graph = this.graphs.get(graphId);
    
    if (!graph) {
      return undefined;
    }
    
    // Verify that source and target nodes exist
    const sourceExists = (graph.nodes as Node[]).some((node: Node) => node.id === newLink.source);
    const targetExists = (graph.nodes as Node[]).some((node: Node) => node.id === newLink.target);
    
    if (!sourceExists || !targetExists) {
      throw new Error('Source or target node does not exist');
    }
    
    // Add the new link
    const updatedLinks = [...(graph.links as Link[]), newLink];
    
    // Update the graph with the modified links
    const updatedGraph: Graph = {
      ...graph,
      links: updatedLinks,
      relationCount: updatedLinks.length
    };
    
    this.graphs.set(graphId, updatedGraph);
    
    // Save to disk for persistence
    this.saveToDisk();
    
    return updatedGraph;
  }

  async deleteGraph(id: number): Promise<boolean> {
    const deleted = this.graphs.delete(id);
    
    // Save the updated state to disk
    if (deleted) {
      this.saveToDisk();
    }
    
    return deleted;
  }
  
  async deleteMultipleGraphs(ids: number[]): Promise<{ success: number[]; failed: number[] }> {
    const results = { success: [] as number[], failed: [] as number[] };
    
    for (const id of ids) {
      const deleted = await this.deleteGraph(id);
      if (deleted) {
        results.success.push(id);
      } else {
        results.failed.push(id);
      }
    }
    
    return results;
  }
  
  // API Key methods
  async createApiKey(insertApiKey: InsertApiKey): Promise<ApiKey> {
    const id = this.apiKeyCurrentId++;
    
    // Ensure proper API key structure with non-nullable fields
    const apiKey: ApiKey = { 
      id,
      provider: insertApiKey.provider,
      key: insertApiKey.key,
      userId: insertApiKey.userId ?? null,
      label: insertApiKey.label ?? null,
      createdAt: insertApiKey.createdAt,
      lastUsed: insertApiKey.lastUsed ?? null
    };
    
    this.apiKeys.set(id, apiKey);
    
    // Save to disk for persistence
    this.saveToDisk();
    
    return apiKey;
  }
  
  async getApiKeysByProvider(provider: string): Promise<ApiKey[]> {
    return Array.from(this.apiKeys.values()).filter(
      (apiKey) => apiKey.provider === provider
    );
  }
  
  async getApiKeysByProviderAndUser(provider: string, userId: number): Promise<ApiKey[]> {
    return Array.from(this.apiKeys.values()).filter(
      (apiKey) => apiKey.provider === provider && apiKey.userId === userId
    );
  }
  
  async getActiveApiKey(provider: string, userId?: number): Promise<ApiKey | undefined> {
    // Get API keys for the provider, filtered by user if userId is provided
    const keys = userId 
      ? await this.getApiKeysByProviderAndUser(provider, userId)
      : await this.getApiKeysByProvider(provider);
    
    if (keys.length === 0) {
      return undefined;
    }
    
    // Return the most recently created key
    return keys.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA; // Descending order - most recent first
    })[0];
  }
  
  async getApiKey(id: number): Promise<ApiKey | undefined> {
    return this.apiKeys.get(id);
  }
  
  async getApiKeyById(id: number): Promise<ApiKey | undefined> {
    return this.getApiKey(id); // Alias for getApiKey
  }
  
  async updateApiKeyLastUsed(id: number, lastUsed: string): Promise<boolean> {
    const apiKey = this.apiKeys.get(id);
    
    if (!apiKey) {
      return false;
    }
    
    // Update the lastUsed timestamp
    const updatedApiKey: ApiKey = {
      ...apiKey,
      lastUsed: lastUsed
    };
    
    this.apiKeys.set(id, updatedApiKey);
    
    // Save to disk for persistence
    this.saveToDisk();
    
    return true;
  }
  
  async deleteApiKey(id: number): Promise<boolean> {
    const deleted = this.apiKeys.delete(id);
    
    // Save the updated state to disk
    if (deleted) {
      this.saveToDisk();
    }
    
    return deleted;
  }
  
  // Ontology methods
  async createOntology(insertOntology: InsertOntology): Promise<Ontology> {
    const id = this.ontologyCurrentId++;
    const timestamp = new Date().toISOString();
    
    // Create the ontology with all required fields
    const ontology: Ontology = {
      id,
      userId: insertOntology.userId || null,
      name: insertOntology.name,
      description: insertOntology.description || null,
      domain: insertOntology.domain || null,
      entities: insertOntology.entities,
      relations: insertOntology.relations,
      versions: insertOntology.versions,
      createdAt: insertOntology.createdAt || timestamp,
      updatedAt: insertOntology.updatedAt || timestamp
    };
    
    this.ontologies.set(id, ontology);
    
    // Save to disk for persistence
    this.saveToDisk();
    
    return ontology;
  }
  
  async getOntology(id: number): Promise<Ontology | undefined> {
    return this.ontologies.get(id);
  }
  
  async getOntologyById(id: number): Promise<Ontology | undefined> {
    // Alias for getOntology
    return this.getOntology(id);
  }
  
  async getOntologiesByUser(userId: number): Promise<Ontology[]> {
    return Array.from(this.ontologies.values()).filter(
      (ontology) => ontology.userId === userId
    );
  }
  
  async getAllOntologies(): Promise<Ontology[]> {
    return Array.from(this.ontologies.values());
  }
  
  async updateOntology(id: number, ontologyData: Partial<Ontology>): Promise<Ontology | undefined> {
    const ontology = this.ontologies.get(id);
    
    if (!ontology) {
      return undefined;
    }
    
    // Update the ontology with new data, but don't change the id
    const updatedOntology: Ontology = {
      ...ontology,
      ...ontologyData,
      id: ontology.id, // Ensure id remains unchanged
      updatedAt: new Date().toISOString() // Update the timestamp
    };
    
    this.ontologies.set(id, updatedOntology);
    
    // Save to disk for persistence
    this.saveToDisk();
    
    return updatedOntology;
  }
  
  async deleteOntology(id: number): Promise<boolean> {
    const deleted = this.ontologies.delete(id);
    
    // Save the updated state to disk
    if (deleted) {
      this.saveToDisk();
    }
    
    return deleted;
  }
  
  // Use the enhanced string similarity algorithm from string-utils
  private calculateStringSimilarity(str1: string, str2: string): number {
    // Delegate to the imported function that has more advanced comparison features
    return calculateStringSimilarity(str1, str2);
  }
  
  // Merge multiple knowledge graphs into a new one
  async mergeGraphs(
    graphIds: number[], 
    newName: string, 
    similarityThreshold: number = 0.8,
    algorithm: MergeAlgorithmTypeValue = "string-similarity",
    apiKey?: string
  ): Promise<{ 
    graph: Graph; 
    mergeStats: { 
      originalNodeCount: number;
      mergedNodeCount: number;
      newLinks: number;
      unifiedEntities: Array<{
        originalIds: number[];
        originalNames: string[];
        mergedId: number;
        mergedName: string;
        algorithm: string;
      }>;
      newRelationships: Array<{
        sourceId: number;
        sourceName: string;
        targetId: number;
        targetName: string;
        relationship: string;
      }>;
    }
  }> {
    // Validate that we have at least 2 graphs
    if (graphIds.length < 2) {
      throw new Error('At least 2 graphs are required for merging');
    }
    
    // Load all the graphs
    const graphs: Graph[] = [];
    for (const id of graphIds) {
      const graph = await this.getGraph(id);
      if (!graph) {
        throw new Error(`Graph with ID ${id} not found`);
      }
      graphs.push(graph);
    }
    
    // Use the enhanced merge functionality
    const { mergedGraph, mergeStats } = await import('./enhanced-merge')
      .then(module => module.enhancedMergeGraphs(
        graphs, 
        newName, 
        similarityThreshold, 
        algorithm, 
        apiKey
      ));
    
    // Save the merged graph
    const newGraph = await this.createGraph(mergedGraph);
    
    return {
      graph: newGraph,
      mergeStats
    };
  }
  
  // System Settings methods
  async getSetting(key: SystemSettingKey): Promise<SystemSetting | undefined> {
    return this.settings.get(key);
  }
  
  async getAllSettings(): Promise<SystemSetting[]> {
    return Array.from(this.settings.values());
  }
  
  async createSetting(setting: InsertSystemSetting): Promise<SystemSetting> {
    const id = this.settingCurrentId++;
    
    const newSetting: SystemSetting = {
      id,
      key: setting.key,
      value: setting.value,
      description: setting.description === undefined ? null : setting.description,
      updatedAt: setting.updatedAt,
      updatedBy: setting.updatedBy || null
    };
    
    this.settings.set(setting.key, newSetting);
    
    // Save the updated state to disk
    this.saveToDisk();
    
    return newSetting;
  }
  
  async updateSetting(key: SystemSettingKey, value: string, userId: number): Promise<SystemSetting | undefined> {
    const setting = this.settings.get(key);
    
    if (!setting) {
      return undefined;
    }
    
    const updatedSetting: SystemSetting = {
      ...setting,
      value,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    };
    
    this.settings.set(key, updatedSetting);
    
    // Save the updated state to disk
    this.saveToDisk();
    
    return updatedSetting;
  }
  
  async deleteSetting(key: SystemSettingKey): Promise<boolean> {
    const deleted = this.settings.delete(key);
    
    // Save the updated state to disk
    if (deleted) {
      this.saveToDisk();
    }
    
    return deleted;
  }
  
  async isSignupEnabled(): Promise<boolean> {
    const setting = await this.getSetting(SYSTEM_SETTINGS.SIGNUP_ENABLED);
    if (!setting) {
      // Default to enabled if setting doesn't exist
      return true;
    }
    return setting.value === 'true';
  }

  // Scholar Profile methods
  async createScholarProfile(profile: InsertScholarProfile): Promise<ScholarProfile> {
    const id = this.scholarProfileCurrentId++;
    const now = new Date().toISOString();
    
    const newProfile: ScholarProfile = {
      id,
      userId: profile.userId,
      authorId: profile.authorId,
      name: profile.name,
      profileData: profile.profileData,
      expertiseGraph: profile.expertiseGraph,
      biography: profile.biography,
      expertiseGraphId: profile.expertiseGraphId,
      createdAt: profile.createdAt || now,
      updatedAt: profile.updatedAt || now,
    };

    this.scholarProfiles.set(id, newProfile);
    this.saveToDisk();
    return newProfile;
  }

  async getScholarProfile(authorId: string, userId: number): Promise<ScholarProfile | undefined> {
    for (const profile of this.scholarProfiles.values()) {
      if (profile.authorId === authorId && profile.userId === userId) {
        return profile;
      }
    }
    return undefined;
  }

  async getScholarProfileById(id: number): Promise<ScholarProfile | undefined> {
    return this.scholarProfiles.get(id);
  }

  async getScholarProfilesByUser(userId: number): Promise<ScholarProfile[]> {
    return Array.from(this.scholarProfiles.values())
      .filter(profile => profile.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async updateScholarProfile(authorId: string, userId: number, updates: Partial<InsertScholarProfile>): Promise<ScholarProfile | undefined> {
    const existing = await this.getScholarProfile(authorId, userId);
    if (!existing) {
      return undefined;
    }

    const updated: ScholarProfile = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.scholarProfiles.set(existing.id, updated);
    this.saveToDisk();
    return updated;
  }

  async deleteScholarProfile(id: number): Promise<boolean> {
    const deleted = this.scholarProfiles.delete(id);
    if (deleted) {
      this.saveToDisk();
    }
    return deleted;
  }
}

// PostgreSQL storage implementation
export class PostgresStorage implements IStorage {
  private pool: any; // Using any type to avoid TS issues with Pool

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    
    // Initialize the database schema
    this.initializeDatabase().catch(err => {
      console.error('Error initializing database:', err);
    });
  }

  private async initializeDatabase() {
    const client = await this.pool.connect();
    
    try {
      // Create users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(100) NOT NULL UNIQUE,
          email VARCHAR(255) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          full_name VARCHAR(255),
          avatar_url TEXT,
          created_at TEXT NOT NULL,
          last_login TEXT,
          is_admin BOOLEAN DEFAULT FALSE
        )
      `);

      // Create graphs table
      await client.query(`
        CREATE TABLE IF NOT EXISTS graphs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          name VARCHAR(255),
          input_text TEXT NOT NULL,
          nodes JSONB NOT NULL,
          links JSONB NOT NULL,
          entity_count INTEGER NOT NULL,
          relation_count INTEGER NOT NULL,
          created_at TEXT NOT NULL
        )
      `);
      
      // Create API keys table
      await client.query(`
        CREATE TABLE IF NOT EXISTS api_keys (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          provider VARCHAR(50) NOT NULL,
          key TEXT NOT NULL,
          label VARCHAR(100),
          created_at TEXT NOT NULL,
          last_used TEXT
        )
      `);
      
      // Create ontologies table
      await client.query(`
        CREATE TABLE IF NOT EXISTS ontologies (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          domain VARCHAR(255),
          entities JSONB NOT NULL,
          relations JSONB NOT NULL,
          versions JSONB NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      console.log('Database schema initialized successfully');
    } catch (error) {
      console.error('Error setting up database schema:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  async getUser(id: number): Promise<User | undefined> {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return undefined;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      email: row.email || '',
      password: row.password,
      fullName: row.full_name || null,
      avatarUrl: row.avatar_url || null,
      createdAt: row.created_at || new Date().toISOString(),
      lastLogin: row.last_login || null,
      isAdmin: row.is_admin || false
    };
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      return undefined;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      password: row.password,
      fullName: row.full_name,
      avatarUrl: row.avatar_url,
      createdAt: row.created_at,
      lastLogin: row.last_login,
      isAdmin: row.is_admin,
    };
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return undefined;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      password: row.password,
      fullName: row.full_name,
      avatarUrl: row.avatar_url,
      createdAt: row.created_at,
      lastLogin: row.last_login,
      isAdmin: row.is_admin,
    };
  }
  
  async getAllUsers(): Promise<User[]> {
    const result = await this.pool.query('SELECT * FROM users ORDER BY id');
    
    return result.rows.map((row: any) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      password: row.password,
      fullName: row.full_name,
      avatarUrl: row.avatar_url,
      createdAt: row.created_at,
      lastLogin: row.last_login,
      isAdmin: row.is_admin,
    }));
  }

  async createUser(user: InsertUser): Promise<number> {
    const timestamp = new Date().toISOString();
    const result = await this.pool.query(
      `INSERT INTO users (username, email, password, full_name, created_at, last_login, is_admin)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        user.username,
        user.email,
        user.password,
        user.fullName || null,
        timestamp,
        timestamp, // last_login set to current time for new users
        user.isAdmin || false
      ]
    );
    
    return result.rows[0].id;
  }
  
  async updateUserLastLogin(id: number, lastLogin: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `UPDATE users 
         SET last_login = $1
         WHERE id = $2`,
        [lastLogin, id]
      );
      
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error updating user last login:', error);
      return false;
    }
  }

  async updateUser(id: number, userData: Partial<User>): Promise<boolean> {
    try {
      // Build dynamic update SQL
      const updates: string[] = [];
      const values: any[] = [];
      let paramCounter = 1;
      
      if (userData.username !== undefined) {
        updates.push(`username = $${paramCounter}`);
        values.push(userData.username);
        paramCounter++;
      }
      
      if (userData.email !== undefined) {
        updates.push(`email = $${paramCounter}`);
        values.push(userData.email);
        paramCounter++;
      }
      
      if (userData.password !== undefined) {
        updates.push(`password = $${paramCounter}`);
        values.push(userData.password);
        paramCounter++;
      }
      
      if (userData.fullName !== undefined) {
        updates.push(`full_name = $${paramCounter}`);
        values.push(userData.fullName);
        paramCounter++;
      }
      
      if (userData.avatarUrl !== undefined) {
        updates.push(`avatar_url = $${paramCounter}`);
        values.push(userData.avatarUrl);
        paramCounter++;
      }
      
      if (userData.isAdmin !== undefined) {
        updates.push(`is_admin = $${paramCounter}`);
        values.push(userData.isAdmin);
        paramCounter++;
      }
      
      // If there are no updates, return early
      if (updates.length === 0) {
        return true; // Nothing to update is considered success
      }
      
      // Add ID to values list
      values.push(id);
      
      const result = await this.pool.query(
        `UPDATE users 
         SET ${updates.join(', ')}
         WHERE id = $${paramCounter}`,
        values
      );
      
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error updating user:', error);
      return false;
    }
  }
  
  async deleteUser(id: number): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      // Begin transaction
      await client.query('BEGIN');
      
      // Delete associated API keys
      await client.query(
        'DELETE FROM api_keys WHERE user_id = $1',
        [id]
      );
      
      // Delete or reassign associated graphs
      await client.query(
        'UPDATE graphs SET user_id = NULL WHERE user_id = $1',
        [id]
      );
      
      // Delete the user
      const result = await client.query(
        'DELETE FROM users WHERE id = $1',
        [id]
      );
      
      // Commit transaction
      await client.query('COMMIT');
      
      return result.rowCount > 0;
    } catch (error) {
      // Rollback in case of error
      await client.query('ROLLBACK');
      console.error('Error deleting user:', error);
      return false;
    } finally {
      client.release();
    }
  }

  async createGraph(graph: InsertGraph): Promise<Graph> {
    const result = await this.pool.query(
      `INSERT INTO graphs (user_id, name, input_text, nodes, links, entity_count, relation_count, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id`,
      [
        graph.userId || null,
        graph.name || null,
        graph.inputText,
        JSON.stringify(graph.nodes),
        JSON.stringify(graph.links),
        graph.entityCount,
        graph.relationCount,
      ]
    );
    
    const id = result.rows[0].id;
    return { 
      id,
      userId: graph.userId || null,
      name: graph.name || null,
      inputText: graph.inputText,
      nodes: graph.nodes,
      links: graph.links,
      entityCount: graph.entityCount,
      relationCount: graph.relationCount,
      createdAt: graph.createdAt
    };
  }

  async getGraph(id: number): Promise<Graph | undefined> {
    const result = await this.pool.query(
      'SELECT * FROM graphs WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return undefined;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id || null,
      name: row.name || null,
      inputText: row.input_text,
      nodes: row.nodes as Node[],
      links: row.links as Link[],
      entityCount: row.entity_count,
      relationCount: row.relation_count,
      createdAt: row.created_at,
    };
  }

  async getGraphsByUser(userId: number): Promise<Graph[]> {
    const result = await this.pool.query(
      'SELECT * FROM graphs WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id || null,
      name: row.name || null,
      inputText: row.input_text,
      nodes: row.nodes as Node[],
      links: row.links as Link[],
      entityCount: row.entity_count,
      relationCount: row.relation_count,
      createdAt: row.created_at,
    }));
  }

  async getAllGraphs(): Promise<Graph[]> {
    const result = await this.pool.query(
      'SELECT * FROM graphs ORDER BY created_at DESC'
    );
    
    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id || null,
      name: row.name || null,
      inputText: row.input_text,
      nodes: row.nodes as Node[],
      links: row.links as Link[],
      entityCount: row.entity_count,
      relationCount: row.relation_count,
      createdAt: row.created_at,
    }));
  }
  
  async getRecentGraphs(limit: number): Promise<Graph[]> {
    const result = await this.pool.query(
      'SELECT * FROM graphs ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    
    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id || null,
      name: row.name || null,
      inputText: row.input_text,
      nodes: row.nodes as Node[],
      links: row.links as Link[],
      entityCount: row.entity_count,
      relationCount: row.relation_count,
      createdAt: row.created_at,
    }));
  }
  
  async getGraphsByTopics(topics: string[], limit: number): Promise<Graph[]> {
    if (!topics.length) return [];
    
    // Prepare query with full-text search using the topics
    const topicsParam = topics.map(topic => `%${topic.toLowerCase()}%`);
    
    // Build a query that scores graphs based on topic matches in input_text and node names
    const result = await this.pool.query(
      `WITH scored_graphs AS (
        SELECT 
          g.*,
          (
            -- Score based on input text matches (weight: 1)
            (
              ${topics.map((_, idx) => 
                `CASE WHEN LOWER(input_text) LIKE $${idx + 1} THEN 1 ELSE 0 END`
              ).join(' + ')}
            ) + 
            -- Score based on node name matches (weight: 2)
            (
              SELECT 2 * COUNT(*) FROM jsonb_array_elements(nodes) AS n
              WHERE ${topics.map((_, idx) => 
                `LOWER(n->>'name') LIKE $${idx + 1}`
              ).join(' OR ')}
            )
          ) AS match_score
        FROM graphs g
      )
      SELECT * FROM scored_graphs
      WHERE match_score > 0
      ORDER BY match_score DESC
      LIMIT $${topics.length + 1}`,
      [...topicsParam, limit]
    );
    
    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id || null,
      name: row.name || null,
      inputText: row.input_text,
      nodes: row.nodes as Node[],
      links: row.links as Link[],
      entityCount: row.entity_count,
      relationCount: row.relation_count,
      createdAt: row.created_at,
    }));
  }

  async updateGraphName(id: number, name: string): Promise<Graph | undefined> {
    const result = await this.pool.query(
      'UPDATE graphs SET name = $1 WHERE id = $2 RETURNING *',
      [name, id]
    );
    
    if (result.rows.length === 0) {
      return undefined;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id || null,
      name: row.name || null,
      inputText: row.input_text,
      nodes: row.nodes as Node[],
      links: row.links as Link[],
      entityCount: row.entity_count,
      relationCount: row.relation_count,
      createdAt: row.created_at,
    };
  }

  async updateGraphContent(id: number, nodes: Node[], links: Link[]): Promise<Graph | undefined> {
    const result = await this.pool.query(
      'UPDATE graphs SET nodes = $1, links = $2, entity_count = $3, relation_count = $4 WHERE id = $5 RETURNING *',
      [JSON.stringify(nodes), JSON.stringify(links), nodes.length, links.length, id]
    );
    
    if (result.rows.length === 0) {
      return undefined;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id || null,
      name: row.name || null,
      inputText: row.input_text,
      nodes: row.nodes as Node[],
      links: row.links as Link[],
      entityCount: row.entity_count,
      relationCount: row.relation_count,
      createdAt: row.created_at,
    };
  }
  
  async updateGraphOwner(id: number, userId: number): Promise<boolean> {
    const result = await this.pool.query(
      'UPDATE graphs SET user_id = $1 WHERE id = $2 RETURNING id',
      [userId, id]
    );
    
    // Return true if at least one row was updated
    return result.rows.length > 0;
  }

  async updateNode(graphId: number, nodeId: number, updatedNode: Node): Promise<Graph | undefined> {
    // First get the current graph
    const graph = await this.getGraph(graphId);
    
    if (!graph) {
      return undefined;
    }
    
    // Find the node index
    const nodeIndex = (graph.nodes as Node[]).findIndex((node: Node) => node.id === nodeId);
    
    if (nodeIndex === -1) {
      return undefined;
    }
    
    // Create a new array with the updated node
    const updatedNodes = [...(graph.nodes as Node[])];
    updatedNodes[nodeIndex] = updatedNode;
    
    // Update the database with the modified nodes array
    return this.updateGraphContent(graphId, updatedNodes, graph.links as Link[]);
  }

  async updateLink(graphId: number, source: number, target: number, updatedLink: Link): Promise<Graph | undefined> {
    // First get the current graph
    const graph = await this.getGraph(graphId);
    
    if (!graph) {
      return undefined;
    }
    
    // Find the link index matching source and target
    const linkIndex = (graph.links as Link[]).findIndex((link: Link) => 
      link.source === source && link.target === target
    );
    
    if (linkIndex === -1) {
      return undefined;
    }
    
    // Create a new array with the updated link
    const updatedLinks = [...(graph.links as Link[])];
    updatedLinks[linkIndex] = updatedLink;
    
    // Update the database with the modified links array
    return this.updateGraphContent(graphId, graph.nodes as Node[], updatedLinks);
  }

  async deleteNode(graphId: number, nodeId: number): Promise<Graph | undefined> {
    // First get the current graph
    const graph = await this.getGraph(graphId);
    
    if (!graph) {
      return undefined;
    }
    
    // Filter out the node to be deleted
    const updatedNodes = (graph.nodes as Node[]).filter((node: Node) => node.id !== nodeId);
    
    // Also filter out any links connected to the deleted node
    const updatedLinks = (graph.links as Link[]).filter((link: Link) => 
      link.source !== nodeId && link.target !== nodeId
    );
    
    // Update the database with the modified nodes and links
    return this.updateGraphContent(graphId, updatedNodes, updatedLinks);
  }

  async deleteLink(graphId: number, source: number, target: number): Promise<Graph | undefined> {
    // First get the current graph
    const graph = await this.getGraph(graphId);
    
    if (!graph) {
      return undefined;
    }
    
    // Filter out the link to be deleted
    const updatedLinks = (graph.links as Link[]).filter((link: Link) => 
      !(link.source === source && link.target === target)
    );
    
    // Update the database with the modified links
    return this.updateGraphContent(graphId, graph.nodes as Node[], updatedLinks);
  }

  async addNode(graphId: number, newNode: Node): Promise<Graph | undefined> {
    // First get the current graph
    const graph = await this.getGraph(graphId);
    
    if (!graph) {
      return undefined;
    }
    
    // Ensure the node has a unique ID
    const existingIds = new Set((graph.nodes as Node[]).map((node: Node) => node.id));
    if (existingIds.has(newNode.id)) {
      // If ID already exists, assign a new one
      newNode.id = Math.max(...Array.from(existingIds)) + 1;
    }
    
    // Add the new node
    const updatedNodes = [...(graph.nodes as Node[]), newNode];
    
    // Update the database with the modified nodes
    return this.updateGraphContent(graphId, updatedNodes, graph.links as Link[]);
  }

  async addLink(graphId: number, newLink: Link): Promise<Graph | undefined> {
    // First get the current graph
    const graph = await this.getGraph(graphId);
    
    if (!graph) {
      return undefined;
    }
    
    // Verify that source and target nodes exist
    const sourceExists = (graph.nodes as Node[]).some((node: Node) => node.id === newLink.source);
    const targetExists = (graph.nodes as Node[]).some((node: Node) => node.id === newLink.target);
    
    if (!sourceExists || !targetExists) {
      throw new Error('Source or target node does not exist');
    }
    
    // Add the new link
    const updatedLinks = [...(graph.links as Link[]), newLink];
    
    // Update the database with the modified links
    return this.updateGraphContent(graphId, graph.nodes as Node[], updatedLinks);
  }

  async deleteGraph(id: number): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM graphs WHERE id = $1',
      [id]
    );
    
    return result.rowCount > 0;
  }

  async deleteMultipleGraphs(ids: number[]): Promise<{ success: number[]; failed: number[] }> {
    const results = { success: [] as number[], failed: [] as number[] };
    
    for (const id of ids) {
      const success = await this.deleteGraph(id);
      if (success) {
        results.success.push(id);
      } else {
        results.failed.push(id);
      }
    }
    
    return results;
  }
  
  // API Key methods
  async createApiKey(apiKey: InsertApiKey): Promise<ApiKey> {
    const result = await this.pool.query(
      `INSERT INTO api_keys (provider, key, user_id, label, created_at, last_used)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        apiKey.provider,
        apiKey.key,
        apiKey.userId || null,
        apiKey.label || null,
        apiKey.createdAt,
        apiKey.lastUsed || null
      ]
    );
    
    const id = result.rows[0].id;
    return {
      id,
      provider: apiKey.provider,
      key: apiKey.key,
      userId: apiKey.userId || null,
      label: apiKey.label || null,
      createdAt: apiKey.createdAt,
      lastUsed: apiKey.lastUsed || null
    };
  }
  
  async getApiKeysByProvider(provider: string): Promise<ApiKey[]> {
    const result = await this.pool.query(
      'SELECT * FROM api_keys WHERE provider = $1',
      [provider]
    );
    
    return result.rows.map((row: any) => ({
      id: row.id,
      provider: row.provider,
      key: row.key,
      userId: row.user_id || null,
      label: row.label || null,
      createdAt: row.created_at,
      lastUsed: row.last_used || null,
    }));
  }
  
  async getApiKeysByProviderAndUser(provider: string, userId: number): Promise<ApiKey[]> {
    const result = await this.pool.query(
      'SELECT * FROM api_keys WHERE provider = $1 AND user_id = $2',
      [provider, userId.toString()]
    );
    
    return result.rows.map((row: any) => ({
      id: row.id,
      provider: row.provider,
      key: row.key,
      userId: row.user_id || null,
      label: row.label || null,
      createdAt: row.created_at,
      lastUsed: row.last_used || null,
    }));
  }
  
  async getActiveApiKey(provider: string, userId?: number): Promise<ApiKey | undefined> {
    // Build the query based on whether userId is provided
    let query = 'SELECT * FROM api_keys WHERE provider = $1';
    let params = [provider];
    
    if (userId) {
      query += ' AND user_id = $2';
      params.push(userId.toString());
    }
    
    query += ' ORDER BY created_at DESC LIMIT 1';
    
    const result = await this.pool.query(query, params);
    
    if (result.rows.length === 0) {
      return undefined;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      provider: row.provider,
      key: row.key,
      userId: row.user_id || null,
      label: row.label || null,
      createdAt: row.created_at,
      lastUsed: row.last_used || null,
    };
  }
  
  async getApiKey(id: number): Promise<ApiKey | undefined> {
    const result = await this.pool.query(
      'SELECT * FROM api_keys WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return undefined;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      provider: row.provider,
      key: row.key,
      userId: row.user_id || null,
      label: row.label || null,
      createdAt: row.created_at,
      lastUsed: row.last_used || null,
    };
  }
  
  async getApiKeyById(id: number): Promise<ApiKey | undefined> {
    return this.getApiKey(id); // Alias for getApiKey
  }
  
  async updateApiKeyLastUsed(id: number, lastUsed: string): Promise<boolean> {
    const result = await this.pool.query(
      'UPDATE api_keys SET last_used = $1 WHERE id = $2',
      [lastUsed, id]
    );
    
    return result.rowCount > 0;
  }
  
  async deleteApiKey(id: number): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM api_keys WHERE id = $1',
      [id]
    );
    
    return result.rowCount > 0;
  }

  // Ontology methods
  async createOntology(ontology: InsertOntology): Promise<Ontology> {
    const result = await this.pool.query(
      `INSERT INTO ontologies (user_id, name, description, domain, entities, relations, versions, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        ontology.userId || null,
        ontology.name,
        ontology.description || null,
        ontology.domain || null,
        JSON.stringify(ontology.entities),
        JSON.stringify(ontology.relations),
        JSON.stringify(ontology.versions),
        ontology.createdAt,
        ontology.updatedAt,
      ]
    );
    
    const id = result.rows[0].id;
    return {
      id,
      userId: ontology.userId || null,
      name: ontology.name,
      description: ontology.description || null,
      domain: ontology.domain || null,
      entities: ontology.entities,
      relations: ontology.relations,
      versions: ontology.versions,
      createdAt: ontology.createdAt,
      updatedAt: ontology.updatedAt,
    };
  }
  
  async getOntology(id: number): Promise<Ontology | undefined> {
    const result = await this.pool.query(
      'SELECT * FROM ontologies WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return undefined;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id || null,
      name: row.name,
      description: row.description || null,
      domain: row.domain || null,
      entities: row.entities,
      relations: row.relations,
      versions: row.versions,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
  
  async getOntologyById(id: number): Promise<Ontology | undefined> {
    // Alias for getOntology
    return this.getOntology(id);
  }
  
  async getOntologiesByUser(userId: number): Promise<Ontology[]> {
    const result = await this.pool.query(
      'SELECT * FROM ontologies WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id || null,
      name: row.name,
      description: row.description || null,
      domain: row.domain || null,
      entities: row.entities,
      relations: row.relations,
      versions: row.versions,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }
  
  async getAllOntologies(): Promise<Ontology[]> {
    const result = await this.pool.query(
      'SELECT * FROM ontologies ORDER BY created_at DESC'
    );
    
    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id || null,
      name: row.name,
      description: row.description || null,
      domain: row.domain || null,
      entities: row.entities,
      relations: row.relations,
      versions: row.versions,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }
  
  async updateOntology(id: number, ontologyData: Partial<Ontology>): Promise<Ontology | undefined> {
    try {
      // Get the existing ontology first to ensure we have data to work with
      const existingOntology = await this.getOntology(id);
      if (!existingOntology) {
        console.error(`Ontology with ID ${id} not found for update`);
        return undefined;
      }
      
      // Build dynamic update SQL
      const updates: string[] = [];
      const values: any[] = [];
      let paramCounter = 1;
      
      // Use existing ontology data as a fallback for required fields
      const safeOntologyData = {
        ...existingOntology,
        ...ontologyData
      };
      
      // Now safely update the fields using the combined data
      updates.push(`name = $${paramCounter}`);
      values.push(safeOntologyData.name);
      paramCounter++;
      
      updates.push(`description = $${paramCounter}`);
      values.push(safeOntologyData.description);
      paramCounter++;
      
      updates.push(`domain = $${paramCounter}`);
      values.push(safeOntologyData.domain);
      paramCounter++;
      
      // Always use the safe ontology data for these fields
      updates.push(`entities = $${paramCounter}`);
      values.push(JSON.stringify(safeOntologyData.entities || []));
      paramCounter++;
      
      updates.push(`relations = $${paramCounter}`);
      values.push(JSON.stringify(safeOntologyData.relations || []));
      paramCounter++;
      
      updates.push(`versions = $${paramCounter}`);
      values.push(JSON.stringify(safeOntologyData.versions || []));
      paramCounter++;
      
      // Always update the updated_at timestamp
      updates.push(`updated_at = $${paramCounter}`);
      values.push(new Date().toISOString());
      paramCounter++;
      
      // If there are no updates, return early
      if (updates.length === 0) {
        return this.getOntology(id); // Return current state
      }
      
      // Add ID to values list
      values.push(id);
      
      const result = await this.pool.query(
        `UPDATE ontologies 
         SET ${updates.join(', ')}
         WHERE id = $${paramCounter}
         RETURNING *`,
        values
      );
      
      if (result.rows.length === 0) {
        return undefined;
      }
      
      const row = result.rows[0];
      return {
        id: row.id,
        userId: row.user_id || null,
        name: row.name,
        description: row.description || null,
        domain: row.domain || null,
        entities: row.entities,
        relations: row.relations,
        versions: row.versions,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      console.error('Error updating ontology:', error);
      return undefined;
    }
  }
  
  async deleteOntology(id: number): Promise<boolean> {
    try {
      const result = await this.pool.query(
        'DELETE FROM ontologies WHERE id = $1',
        [id]
      );
      
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting ontology:', error);
      return false;
    }
  }
  
  // System Settings methods
  async getSetting(key: SystemSettingKey): Promise<SystemSetting | undefined> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM system_settings WHERE key = $1',
        [key]
      );
      
      if (result.rows.length === 0) {
        return undefined;
      }
      
      const row = result.rows[0];
      return {
        id: row.id,
        key: row.key,
        value: row.value,
        description: row.description,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by
      };
    } catch (error) {
      console.error('Error getting setting:', error);
      return undefined;
    }
  }
  
  async getAllSettings(): Promise<SystemSetting[]> {
    try {
      const result = await this.pool.query('SELECT * FROM system_settings');
      
      return result.rows.map((row: any) => ({
        id: row.id,
        key: row.key,
        value: row.value,
        description: row.description,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by
      }));
    } catch (error) {
      console.error('Error getting all settings:', error);
      return [];
    }
  }
  
  async createSetting(setting: InsertSystemSetting): Promise<SystemSetting> {
    try {
      const result = await this.pool.query(
        `INSERT INTO system_settings (key, value, description, updated_at, updated_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          setting.key,
          setting.value,
          setting.description,
          setting.updatedAt,
          setting.updatedBy
        ]
      );
      
      const row = result.rows[0];
      return {
        id: row.id,
        key: row.key,
        value: row.value,
        description: row.description,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by
      };
    } catch (error) {
      console.error('Error creating setting:', error);
      throw error;
    }
  }
  
  async updateSetting(key: SystemSettingKey, value: string, userId: number): Promise<SystemSetting | undefined> {
    try {
      const result = await this.pool.query(
        `UPDATE system_settings 
         SET value = $1, updated_at = $2, updated_by = $3
         WHERE key = $4
         RETURNING *`,
        [value, new Date().toISOString(), userId, key]
      );
      
      if (result.rows.length === 0) {
        return undefined;
      }
      
      const row = result.rows[0];
      return {
        id: row.id,
        key: row.key,
        value: row.value,
        description: row.description,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by
      };
    } catch (error) {
      console.error('Error updating setting:', error);
      return undefined;
    }
  }
  
  async deleteSetting(key: SystemSettingKey): Promise<boolean> {
    try {
      const result = await this.pool.query(
        'DELETE FROM system_settings WHERE key = $1',
        [key]
      );
      
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting setting:', error);
      return false;
    }
  }
  
  async isSignupEnabled(): Promise<boolean> {
    try {
      const setting = await this.getSetting(SYSTEM_SETTINGS.SIGNUP_ENABLED);
      if (!setting) {
        // Default to enabled if setting doesn't exist
        return true;
      }
      return setting.value === 'true';
    } catch (error) {
      console.error('Error checking if signup is enabled:', error);
      // Default to enabled if there's an error
      return true;
    }
  }

  async mergeGraphs(
    graphIds: number[], 
    newName: string, 
    similarityThreshold: number = 0.8,
    algorithm: MergeAlgorithmTypeValue = "string-similarity",
    apiKey?: string
  ): Promise<{ 
    graph: Graph; 
    mergeStats: { 
      originalNodeCount: number;
      mergedNodeCount: number;
      newLinks: number;
      unifiedEntities: Array<{
        originalIds: number[];
        originalNames: string[];
        mergedId: number;
        mergedName: string;
        algorithm: string;
      }>;
      newRelationships: Array<{
        sourceId: number;
        sourceName: string;
        targetId: number;
        targetName: string;
        relationship: string;
      }>;
    }
  }> {
    // Validate that we have at least 2 graphs
    if (graphIds.length < 2) {
      throw new Error('At least 2 graphs are required for merging');
    }
    
    // Load all the graphs
    const graphs: Graph[] = [];
    for (const id of graphIds) {
      const graph = await this.getGraph(id);
      if (!graph) {
        throw new Error(`Graph with ID ${id} not found`);
      }
      graphs.push(graph);
    }
    
    // Use the enhanced merge functionality
    const { mergedGraph, mergeStats } = await import('./enhanced-merge')
      .then(module => module.enhancedMergeGraphs(
        graphs, 
        newName, 
        similarityThreshold, 
        algorithm, 
        apiKey
      ));
    
    // Save the merged graph
    const newGraph = await this.createGraph(mergedGraph);
    
    return {
      graph: newGraph,
      mergeStats
    };
  }

  // Scholar Profile methods
  async createScholarProfile(profile: InsertScholarProfile): Promise<ScholarProfile> {
    const result = await this.pool.query(
      `INSERT INTO scholar_profiles (user_id, author_id, name, profile_data, expertise_graph, biography, expertise_graph_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        profile.userId,
        profile.authorId,
        profile.name,
        JSON.stringify(profile.profileData),
        profile.expertiseGraph ? JSON.stringify(profile.expertiseGraph) : null,
        profile.biography,
        profile.expertiseGraphId,
        profile.createdAt,
        profile.updatedAt
      ]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      authorId: row.author_id,
      name: row.name,
      profileData: row.profile_data,
      expertiseGraph: row.expertise_graph,
      biography: row.biography,
      expertiseGraphId: row.expertise_graph_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getScholarProfile(authorId: string, userId: number): Promise<ScholarProfile | undefined> {
    const result = await this.pool.query(
      'SELECT * FROM scholar_profiles WHERE author_id = $1 AND user_id = $2',
      [authorId, userId]
    );

    if (result.rows.length === 0) {
      return undefined;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      authorId: row.author_id,
      name: row.name,
      profileData: row.profile_data,
      expertiseGraph: row.expertise_graph,
      biography: row.biography,
      expertiseGraphId: row.expertise_graph_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getScholarProfilesByUser(userId: number): Promise<ScholarProfile[]> {
    const result = await this.pool.query(
      'SELECT * FROM scholar_profiles WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      authorId: row.author_id,
      name: row.name,
      profileData: row.profile_data,
      expertiseGraph: row.expertise_graph,
      biography: row.biography,
      expertiseGraphId: row.expertise_graph_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async updateScholarProfile(authorId: string, userId: number, updates: Partial<InsertScholarProfile>): Promise<ScholarProfile | undefined> {
    const updateFields = [];
    const values = [];
    let paramCounter = 1;

    if (updates.name !== undefined) {
      updateFields.push(`name = $${paramCounter}`);
      values.push(updates.name);
      paramCounter++;
    }

    if (updates.profileData !== undefined) {
      updateFields.push(`profile_data = $${paramCounter}`);
      values.push(JSON.stringify(updates.profileData));
      paramCounter++;
    }

    if (updates.expertiseGraph !== undefined) {
      updateFields.push(`expertise_graph = $${paramCounter}`);
      values.push(updates.expertiseGraph ? JSON.stringify(updates.expertiseGraph) : null);
      paramCounter++;
    }

    if (updates.biography !== undefined) {
      updateFields.push(`biography = $${paramCounter}`);
      values.push(updates.biography);
      paramCounter++;
    }

    if (updates.expertiseGraphId !== undefined) {
      updateFields.push(`expertise_graph_id = $${paramCounter}::integer`);
      values.push(updates.expertiseGraphId);
      paramCounter++;
    }

    updateFields.push(`updated_at = NOW()`);

    const authorIdParam = paramCounter;
    const userIdParam = paramCounter + 1;
    values.push(authorId);
    values.push(userId);

    const result = await this.pool.query(
      `UPDATE scholar_profiles 
       SET ${updateFields.join(', ')}
       WHERE author_id = $${authorIdParam} AND user_id = $${userIdParam}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return undefined;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      authorId: row.author_id,
      name: row.name,
      profileData: row.profile_data,
      expertiseGraph: row.expertise_graph,
      biography: row.biography,
      expertiseGraphId: row.expertise_graph_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getScholarProfileById(id: number): Promise<ScholarProfile | undefined> {
    const result = await this.pool.query(
      'SELECT * FROM scholar_profiles WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return undefined;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      authorId: row.author_id,
      name: row.name,
      profileData: row.profile_data,
      expertiseGraph: row.expertise_graph,
      biography: row.biography,
      expertiseGraphId: row.expertise_graph_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async deleteScholarProfile(id: number): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM scholar_profiles WHERE id = $1',
      [id]
    );
    return result.rowCount > 0;
  }
}

// Export a function to create the correct storage based on environment
export async function createStorage(): Promise<IStorage> {
  // Check if we have a database connection string
  if (process.env.DATABASE_URL) {
    try {
      console.log('Testing PostgreSQL connection...');
      
      // Test database connection before creating PostgresStorage
      const testPool = new Pool({
        connectionString: process.env.DATABASE_URL,
      });
      
      const client = await testPool.connect();
      await client.query('SELECT 1'); // Simple test query
      client.release();
      await testPool.end();
      
      console.log('PostgreSQL connection successful, using PostgreSQL storage');
      return new PostgresStorage();
    } catch (error) {
      console.error('PostgreSQL connection failed, falling back to in-memory storage:', error);
      console.log('Using in-memory storage (fallback due to database error)');
      return new MemStorage();
    }
  } else {
    console.log('Using in-memory storage (no DATABASE_URL)');
    return new MemStorage();
  }
}