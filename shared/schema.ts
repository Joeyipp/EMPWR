import { pgTable, text, serial, integer, boolean, jsonb, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  createdAt: text("created_at").notNull(),
  lastLogin: text("last_login"),
  isAdmin: boolean("is_admin").default(false),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
  fullName: true,
  isAdmin: true,
}).extend({
  confirmPassword: z.string()
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// API Keys Schema
export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  provider: text("provider").notNull(), // e.g., 'openai', 'anthropic', etc.
  key: text("key").notNull(),
  label: text("label"), // Optional friendly name
  createdAt: text("created_at").notNull(),
  lastUsed: text("last_used"), // Optional timestamp of last usage
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
});

export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;

// Knowledge Graph Schema
export const graphs = pgTable("graphs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name"),  // Graph name for saved graphs
  inputText: text("input_text").notNull(),
  nodes: jsonb("nodes").notNull(),
  links: jsonb("links").notNull(),
  entityCount: integer("entity_count").notNull(),
  relationCount: integer("relation_count").notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertGraphSchema = createInsertSchema(graphs).omit({
  id: true,
});

export type InsertGraph = z.infer<typeof insertGraphSchema>;
export type Graph = typeof graphs.$inferSelect;

// Entity and Relation Types
export interface Node {
  id: number;
  name: string;
  group: number;
  enriched?: boolean;        // Whether this node was added from Wikidata enrichment
  description?: string;      // Optional description from Wikidata
  wikidataId?: string;       // Optional Wikidata entity ID (e.g., Q42)
  properties?: Record<string, any>; // Additional properties from Wikidata
  dataSource?: string;       // Source of the data (e.g., 'spacy', 'wikidata', etc.)
  timestamp?: string;        // Timestamp when the entity was created
}

export interface Link {
  source: number;
  target: number;
  value: number;
  label: string;
  enriched?: boolean;        // Whether this link was added from Wikidata enrichment
  wikidataId?: string;       // Optional Wikidata property ID (e.g., P31)
  dataSource?: string;       // Source of the data (e.g., 'spacy', 'wikidata', etc.)
  timestamp?: string;        // Timestamp when the relation was created
}

export interface EntitySchema {
  className: string;
  properties: {
    [key: string]: {
      type: string;
      count: number;
    };
  };
  instances: number;
}

export interface KnowledgeGraph {
  nodes: Node[];
  links: Link[];
  schema?: EntitySchema[];
  id?: number; // Optional ID for CRUD operations
  inputText?: string; // Optional original text input that was processed to create this graph
  ocrProcessed?: boolean; // Flag to indicate if OCR was used to extract text
}

export const ModelType = z.enum(['local', 'openai', 'spacy', 'mistral']);
export type ModelTypeValue = z.infer<typeof ModelType>;

export const processTextSchema = z.object({
  text: z.string(),  // Text content to process
  model: ModelType.optional().default('local'),
  apiKey: z.string().optional(),
  filePath: z.string().nullable().optional(), // Path to PDF file for direct processing
  ocrProcessed: z.boolean().optional(), // Flag to indicate if text was already extracted using OCR
  ontologyText: z.string().optional(), // Optional ontology schema (RDF, OWL, TTL, JSON-LD) to guide KG generation
})
.refine(
  (data) => {
    // If ocrProcessed is true, we must have non-empty text
    if (data.ocrProcessed === true) {
      return data.text.trim().length > 0;
    }
    // Otherwise require either non-empty text or filePath
    return data.text.trim().length > 0 || (data.filePath && data.filePath.length > 0);
  },
  {
    message: "Please provide either text content or a document to process",
    path: ["text"]
  }
);

export type ProcessTextInput = z.infer<typeof processTextSchema>;

// Schemas for the enrichment feature
const nodeSchema = z.object({
  id: z.number(),
  name: z.string(),
  group: z.number(),
  enriched: z.boolean().optional(),
  description: z.string().optional(),
  wikidataId: z.string().optional(),
  properties: z.record(z.any()).optional(),
  dataSource: z.string().optional(),
  timestamp: z.string().optional()
});

const linkSchema = z.object({
  source: z.number(),
  target: z.number(),
  value: z.number(),
  label: z.string(),
  enriched: z.boolean().optional(),
  wikidataId: z.string().optional(),
  dataSource: z.string().optional(),
  timestamp: z.string().optional()
});

const entitySchemaSchema = z.object({
  className: z.string(),
  properties: z.record(
    z.object({
      type: z.string(),
      count: z.number()
    })
  ),
  instances: z.number()
});

const knowledgeGraphSchema = z.object({
  nodes: z.array(nodeSchema),
  links: z.array(linkSchema),
  schema: z.array(entitySchemaSchema).optional(),
  id: z.number().optional(), // Optional ID for CRUD operations
  inputText: z.string().optional(), // Optional original text input that was processed
  ocrProcessed: z.boolean().optional() // Flag to indicate if OCR was used to extract text
});

export const enrichGraphSchema = z.object({
  graph: knowledgeGraphSchema,
  maxEnrichments: z.number().min(1).max(50).optional().default(10)
});

export type EnrichGraphInput = z.infer<typeof enrichGraphSchema>;

// Define merge algorithm types
export const MergeAlgorithmType = z.enum([
  'string-similarity', // Current string similarity-based algorithm
  'wordnet',           // Semantic similarity using WordNet synsets
  'openai',            // Advanced entity resolution using OpenAI API
  'mistral'            // Advanced entity resolution using Mistral AI
]);

export type MergeAlgorithmTypeValue = z.infer<typeof MergeAlgorithmType>;

// Schema for merging multiple knowledge graphs
export const mergeGraphsSchema = z.object({
  graphIds: z.array(z.number()).min(2).max(10),
  newName: z.string().min(1).max(100),
  similarityThreshold: z.number().min(0.5).max(1.0).optional().default(0.8),
  algorithm: MergeAlgorithmType.optional().default('string-similarity'),
});

export type MergeGraphsInput = z.infer<typeof mergeGraphsSchema>;

// Ontology Schema - for OntoMaker
export const ontologies = pgTable("ontologies", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  domain: text("domain"),
  entities: jsonb("entities").notNull(),
  relations: jsonb("relations").notNull(),
  versions: jsonb("versions").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const insertOntologySchema = createInsertSchema(ontologies).omit({
  id: true,
});

export type InsertOntology = z.infer<typeof insertOntologySchema>;
export type Ontology = typeof ontologies.$inferSelect;

// Ontology Entity and Relation Types
export interface OntologyEntity {
  id: number;
  name: string;
  description: string;
  type: string;
  properties: {
    name: string;
    type: string;
    description: string;
  }[];
}

export interface OntologyRelation {
  id: number;
  name: string;
  source: string;
  target: string;
  description: string;
}

export interface OntologyVersion {
  id: number;
  version: string;
  timestamp: string;
  description: string;
  changes: {
    type: 'add' | 'update' | 'delete';
    element: 'entity' | 'relation';
    name: string;
    description: string;
  }[];
}

// Schema for generating an ontology from a prompt
export const generateOntologySchema = z.object({
  prompt: z.string().min(10),
  model: z.enum(['openai', 'mistral']).default('openai'),
  apiKey: z.string().optional(),
});

export type GenerateOntologyInput = z.infer<typeof generateOntologySchema>;

// Schema for enriching an ontology
export const enrichOntologySchema = z.object({
  ontology: z.object({
    id: z.number(),
    name: z.string(),
    description: z.string().optional(),
    domain: z.string().optional(),
    entities: z.array(z.any()),  // Using any to simplify
    relations: z.array(z.any()), // Using any to simplify
    versions: z.array(z.any()),  // Using any to simplify
  }),
  model: z.enum(['openai', 'mistral']).default('openai'),
  apiKey: z.string().optional(),
  enrichmentType: z.enum(['ai', 'schema']).default('ai')
});

export type EnrichOntologyInput = z.infer<typeof enrichOntologySchema>;

// System Settings Schema
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: text("updated_at").notNull(),
  updatedBy: integer("updated_by").references(() => users.id),
});

// Google Scholar Profiles Schema
export const scholarProfiles = pgTable("scholar_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  authorId: text("author_id").notNull(),
  name: text("name").notNull(),
  profileData: jsonb("profile_data").notNull(), // Complete author data from API
  expertiseGraph: jsonb("expertise_graph"), // Generated expertise knowledge graph
  biography: text("biography"), // AI-generated biography
  expertiseGraphId: integer("expertise_graph_id").references(() => graphs.id), // Reference to saved graph
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({
  id: true,
});

export const insertScholarProfileSchema = createInsertSchema(scholarProfiles).omit({
  id: true,
});

export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertScholarProfile = z.infer<typeof insertScholarProfileSchema>;
export type ScholarProfile = typeof scholarProfiles.$inferSelect;

// System Settings Types
export const SYSTEM_SETTINGS = {
  SIGNUP_ENABLED: 'signup_enabled',
} as const;

export type SystemSettingKey = typeof SYSTEM_SETTINGS[keyof typeof SYSTEM_SETTINGS];
