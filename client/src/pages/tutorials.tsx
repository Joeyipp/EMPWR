import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, 
  ChevronRight, 
  Edit, 
  Save, 
  Briefcase, 
  FileText, 
  Clock, 
  BarChart,
  Search,
  Filter,
  BookOpenCheck,
  GraduationCap,
  FileBarChart,
  ExternalLink,
  Plus,
  X,
  List,
  LayoutGrid as Grid,
  Eye,
  Calendar,
  Tag,
  User,
  ArrowUpRight
} from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import AnimatedGradientBackground from '@/components/AnimatedGradientBackground';

// Tutorial interface
interface Tutorial {
  id: string;
  title: string;
  description: string;
  content: string;
  externalLink?: string;
  type: 'tutorial' | 'case-study';
}

// Sample tutorials and case studies
const contentData: Tutorial[] = [
  {
    id: 'getting-started',
    title: 'Getting Started with EMPWR',
    description: 'A complete guide to setting up and using EMPWR for the first time.',
    type: 'tutorial',
    content: `
      <h3>Welcome to EMPWR</h3>
      <p>EMPWR is a powerful platform for creating and managing knowledge graphs. This guide will help you get started with the basics.</p>
      
      <h4>Step 1: Create an Account</h4>
      <p>If you haven't already, sign up for an account on the login page. You'll need to provide a username, email, and password.</p>
      
      <h4>Step 2: Configure API Keys</h4>
      <p>For advanced features, you'll need to configure your API keys. Visit the Settings page to add your OpenAI or Mistral API keys.</p>
      
      <h4>Step 3: Generate Your First Knowledge Graph</h4>
      <p>Navigate to the Generate page and enter some text in the input field. Click the Generate button to create your first knowledge graph.</p>
    `
  },
  {
    id: 'generating-graphs',
    title: 'How to Generate Knowledge Graphs',
    description: 'A detailed guide to generating knowledge graphs from various text sources.',
    type: 'tutorial',
    content: `
      <h3>Generating Knowledge Graphs</h3>
      <p>EMPWR makes it easy to generate knowledge graphs from text. Here's how to do it effectively:</p>
      
      <h4>Text Length Considerations</h4>
      <p>For optimal results, use text between 500-3000 words. Shorter texts may produce sparse graphs, while longer texts might be truncated.</p>
      
      <h4>Advanced Options</h4>
      <p>Use the advanced options to customize your graph generation:</p>
      <ul>
        <li><strong>Model Selection:</strong> Choose between different AI models based on your needs</li>
        <li><strong>Entity Types:</strong> Focus on specific entity types like people, organizations, etc.</li>
        <li><strong>Relationship Depth:</strong> Control how deeply the system analyzes relationships</li>
      </ul>
      
      <h4>Saving and Editing</h4>
      <p>After generation, you can save your graph for later use or edit it to add/remove entities and relationships manually.</p>
    `
  },
  {
    id: 'pharma-case-study',
    title: 'Pharmaceutical Domain Knowledge Graph: End-to-End Tutorial',
    description: 'A comprehensive walkthrough of creating and analyzing a pharmaceutical domain knowledge graph.',
    type: 'case-study',
    content: `
      <h2>Pharmaceutical Knowledge Graph: End-to-End Tutorial</h2>
      <p>This tutorial demonstrates how to create a comprehensive knowledge graph for pharmaceutical research using EMPWR. We'll track drug interactions, research findings, and clinical trials for a hypothetical cancer treatment.</p>
      
      <h3>1. Setting Up Your Environment</h3>
      <p>Before starting, ensure you have:</p>
      <ul>
        <li>An active EMPWR account with admin permissions</li>
        <li>API keys configured in the Settings page (OpenAI or Mistral)</li>
        <li>Sample pharmaceutical documents ready for processing</li>
      </ul>
      
      <h3>2. Generating the Initial Knowledge Graph</h3>
      <p>We'll start by generating a knowledge graph from a research abstract about a novel cancer treatment:</p>
      <ol>
        <li>Navigate to the <strong>Generate</strong> section from the sidebar</li>
        <li>Paste the following text in the input field:</li>
      </ol>
      
      <pre class="bg-gray-800 p-4 rounded-md text-sm overflow-auto my-4">
      MolKure-7 is a novel tyrosine kinase inhibitor being investigated for treatment of non-small cell lung cancer (NSCLC). In phase II clinical trials, MolKure-7 demonstrated significant progression-free survival benefit in patients with EGFR mutations. The compound works by selectively inhibiting the EGFR signaling pathway while showing minimal activity against other kinase families, potentially reducing off-target effects observed with first-generation TKIs. Common adverse events included skin rash (22%), diarrhea (15%), and elevated liver enzymes (10%). Preliminary data suggests MolKure-7 retains activity against T790M resistance mutations. The compound's chemical structure features a quinazoline core with a modified aniline substituent that improves binding affinity. Combination therapy with immune checkpoint inhibitors is currently being explored in Phase I trials, with early data suggesting potential synergistic effects with pembrolizumab in PD-L1 positive patients.      
      </pre>
      
      <ol start="3">
        <li>Click <strong>Generate</strong> and wait for the system to process the text</li>
        <li>When complete, you'll see the initial graph visualization with entities like MolKure-7, NSCLC, EGFR, pembrolizumab, etc.</li>
      </ol>
      
      <h3>3. Extracting Additional Information from External Sources</h3>
      <p>Next, we'll enhance our knowledge graph by extracting information from authoritative websites:</p>
      <ol>
        <li>Navigate to the <strong>Extract</strong> section in the sidebar</li>
        <li>In the URL field, enter: <code>https://www.cancer.gov/about-cancer/treatment/drugs/lung</code></li>
        <li>Select <strong>General</strong> as the extraction method</li>
        <li>Click <strong>Extract Data</strong> and wait for processing</li>
        <li>Review the extracted entities and save this as a separate graph</li>
      </ol>
      
      <h3>4. Merging Knowledge Graphs</h3>
      <p>Now we'll combine our generated and extracted graphs:</p>
      <ol>
        <li>Go to the <strong>Merge</strong> section in the sidebar</li>
        <li>Select the two graphs we created (the MolKure-7 research and the extracted cancer.gov information)</li>
        <li>Set the similarity threshold to 0.75 (this provides a good balance between matching entities without excessive false positives)</li>
        <li>Select <strong>String Similarity</strong> as the algorithm</li>
        <li>Click <strong>Prepare Merge</strong> to see a preview of entity matches</li>
        <li>Review the proposed entity matches, making adjustments if needed:</li>
        <ul>
          <li>Accept the match between "cancer" and "lung cancer"</li>
          <li>Reject any incorrect matches</li>
          <li>Manually add any matches the system missed</li>
        </ul>
        <li>Name your merged graph "Pharmaceutical Cancer Treatment KG" and click <strong>Confirm Merge</strong></li>
      </ol>
      
      <h3>5. Visualizing and Exploring the Graph</h3>
      <p>When the merge completes:</p>
      <ol>
        <li>The system will automatically open the visualization of your merged graph</li>
        <li>Experiment with different visualization modes:</li>
        <ul>
          <li>Use the <strong>Force-Directed</strong> view to see overall relationship patterns</li>
          <li>Try the <strong>3D Graph</strong> to explore spatial relationships</li>
          <li>Use the <strong>Hierarchical</strong> view to see parent-child relationships</li>
        </ul>
        <li>Color-code entities by type:</li>
        <ul>
          <li>Drugs and compounds (blue)</li>
          <li>Diseases and conditions (red)</li>
          <li>Biological targets (green)</li>
          <li>Clinical outcomes (purple)</li>
        </ul>
        <li>Use the search and filter functionality to focus on specific aspects, such as "Show all entities related to EGFR"</li>
      </ol>
      
      <h3>6. Generating Insights</h3>
      <p>Now let's analyze the graph to extract meaningful insights:</p>
      <ol>
        <li>Navigate to the <strong>Insights</strong> section</li>
        <li>Select the merged pharmaceutical graph</li>
        <li>Click on <strong>Generate Insights</strong></li>
        <li>The knowledge assistant will analyze the graph and generate observations such as:</li>
        <ul>
          <li>Key drug interaction patterns</li>
          <li>Potential contraindications</li>
          <li>Research gaps and opportunities</li>
          <li>Comparison with existing treatments</li>
        </ul>
        <li>Try asking specific questions in the Insights panel:</li>
        <pre class="bg-gray-800 p-4 rounded-md text-sm overflow-auto my-4">
        What mechanisms of action are shared between MolKure-7 and other EGFR inhibitors?
        What potential drug interactions should be monitored?
        Which patient populations might benefit most from this treatment?
        </pre>
      </ol>
      
      <h3>7. Creating a Focused Subgraph</h3>
      <p>For deeper analysis of specific mechanisms:</p>
      <ol>
        <li>Go to the <strong>Subgraphs</strong> section</li>
        <li>Select your merged pharmaceutical graph</li>
        <li>Use the entity selector to choose "EGFR pathway" as the focal point</li>
        <li>Set the traversal depth to 2 to include directly related entities and their connections</li>
        <li>Click <strong>Create Subgraph</strong></li>
        <li>Save this focused view as "EGFR Mechanism Subgraph"</li>
      </ol>
      
      <h3>8. Enriching with Ontology Integration</h3>
      <p>To standardize terminology and improve interoperability:</p>
      <ol>
        <li>Navigate to <strong>OntoMaker</strong></li>
        <li>Select "Create New Ontology" and name it "Pharmaceutical Research Ontology"</li>
        <li>Choose the "Healthcare" template as a starting point</li>
        <li>Click <strong>Enrich Ontology</strong> and select your pharmaceutical graph as the source</li>
        <li>Review and approve the suggested additions to the ontology</li>
        <li>Link your knowledge graph to this ontology by going back to the graph visualization and selecting "Link to Ontology"</li>
      </ol>
      
      <h3>9. Multimodal Enhancement</h3>
      <p>Finally, let's enhance our graph with information from multiple sources:</p>
      <ol>
        <li>Go to the <strong>Multimodal</strong> section</li>
        <li>Create a new project named "Comprehensive Cancer Treatment Analysis"</li>
        <li>Add your existing pharmaceutical graph as the foundation</li>
        <li>Import additional sources:</li>
        <ul>
          <li>A PDF of clinical trial results</li>
          <li>A CSV file containing patient outcome data</li>
          <li>A molecular structure image of MolKure-7</li>
        </ul>
        <li>Process these sources and review how they augment your knowledge graph</li>
        <li>Use the connection explorer to find relationships across different data types</li>
      </ol>
      
      <h3>10. Exporting and Sharing Results</h3>
      <p>To share your findings with stakeholders:</p>
      <ol>
        <li>From the graph visualization, click <strong>Export</strong></li>
        <li>Choose format options:</li>
        <ul>
          <li>Static image (PNG) for presentations</li>
          <li>Interactive HTML for web embedding</li>
          <li>JSON for data interoperability</li>
          <li>RDF for semantic web applications</li>
        </ul>
        <li>Add annotations and highlights to emphasize key insights</li>
        <li>Generate a shareable link with appropriate permissions for your research team</li>
      </ol>
      
      <h3>Conclusion</h3>
      <p>You've now created a comprehensive pharmaceutical domain knowledge graph that integrates information from multiple sources, applies domain-specific ontology, and generates actionable insights. This graph can serve as a foundation for drug development decision-making, identifying research priorities, and understanding complex biological mechanisms in cancer treatment.</p>
    `
  },
  {
    id: 'merging-graphs',
    title: 'Merging Multiple Knowledge Graphs',
    description: 'Learn how to combine separate knowledge graphs into a comprehensive dataset.',
    type: 'tutorial',
    content: `
      <h3>Merging Knowledge Graphs</h3>
      <p>The merge feature allows you to combine multiple knowledge graphs into a single, unified representation.</p>
      
      <h4>Entity Resolution</h4>
      <p>EMPWR automatically identifies and resolves duplicate entities across graphs using advanced entity resolution algorithms.</p>
      
      <h4>Merge Process</h4>
      <ol>
        <li>Navigate to the Merge page</li>
        <li>Select two or more graphs to merge</li>
        <li>Choose a similarity threshold for entity matching</li>
        <li>Review proposed merges</li>
        <li>Confirm and create the merged graph</li>
      </ol>
      
      <h4>Post-Merge Cleanup</h4>
      <p>After merging, you may need to manually review some entity matches or relationships that couldn't be automatically resolved.</p>
    `
  },
  {
    id: 'extracting-web-data',
    title: 'Extracting Knowledge from Websites',
    description: 'Learn to extract structured data from web pages automatically.',
    type: 'tutorial',
    content: `
      <h3>Web Data Extraction</h3>
      <p>EMPWR can automatically extract structured knowledge from websites without requiring custom scraping rules.</p>
      
      <h4>Extraction Methods</h4>
      <p>Choose from several extraction approaches based on the website type:</p>
      <ul>
        <li><strong>General:</strong> Works on most websites, extracting visible text content</li>
        <li><strong>Wikidata:</strong> Optimized for Wikipedia and related sites</li>
        <li><strong>Schema.org:</strong> For sites using standard schema.org markup</li>
        <li><strong>Custom:</strong> For specialized extraction with defined parameters</li>
      </ul>
      
      <h4>Extraction Process</h4>
      <ol>
        <li>Navigate to the Extract page</li>
        <li>Enter the URL of the website</li>
        <li>Select the appropriate extraction method</li>
        <li>Click Extract and wait for processing to complete</li>
        <li>Review and save the extracted knowledge graph</li>
      </ol>
    `
  },
  {
    id: 'ontomaker-guide',
    title: 'Using OntoMaker for Ontology Management',
    description: 'A comprehensive guide to creating and managing ontologies.',
    type: 'tutorial',
    content: `
      <h3>OntoMaker: Create and Manage Ontologies</h3>
      <p>OntoMaker is EMPWR's tool for creating, managing, and visualizing ontologies to structure your knowledge graphs.</p>
      
      <h4>Creating an Ontology</h4>
      <p>Start by defining your core concepts and their relationships. OntoMaker provides templates for common domains like business, science, and education.</p>
      
      <h4>Enriching with AI</h4>
      <p>Use the AI-assisted enrichment feature to expand your ontology with suggested concepts and relationships based on your domain.</p>
      
      <h4>Visualizing and Editing</h4>
      <p>The visual editor allows you to drag and drop concepts, create relationships, and organize your ontology hierarchically.</p>
    `,
    externalLink: 'https://docs.empwr.ai/ontomaker-guide'
  },
  {
    id: 'multimodal-integration',
    title: 'Working with Multimodal Data Sources',
    description: 'Combine text, images, PDFs, and other sources in your knowledge graphs.',
    type: 'tutorial',
    content: `
      <h3>Multimodal Knowledge Integration</h3>
      <p>EMPWR's multimodal capabilities allow you to build comprehensive knowledge graphs from diverse data sources.</p>
      
      <h4>Supported Data Types</h4>
      <ul>
        <li><strong>Text documents:</strong> TXT, DOC, DOCX, RTF</li>
        <li><strong>Spreadsheets:</strong> CSV, XLS, XLSX</li>
        <li><strong>PDFs:</strong> With automatic OCR for scanned documents</li>
        <li><strong>Images:</strong> JPG, PNG, with automatic visual analysis</li>
        <li><strong>Web content:</strong> URLs, HTML pages</li>
        <li><strong>Structured data:</strong> JSON, XML, RDF</li>
      </ul>
      
      <h4>Integration Process</h4>
      <p>The multimodal processor extracts information from each source type and constructs a unified knowledge representation:</p>
      <ol>
        <li>Create a new multimodal project</li>
        <li>Add your diverse data sources</li>
        <li>Configure processing parameters for each source type</li>
        <li>Process the sources individually or as a batch</li>
        <li>Review and refine the integrated knowledge graph</li>
      </ol>
      
      <h4>Cross-Modal Entity Resolution</h4>
      <p>The system automatically identifies and links the same entities across different modalities, creating a truly unified knowledge representation.</p>
    `
  },
  {
    id: 'api-reference',
    title: 'API Reference Guide',
    description: 'Complete API documentation with examples for integrating EMPWR into your applications.',
    type: 'tutorial',
    content: `
      <h2>EMPWR API Reference</h2>
      <p>This guide provides comprehensive documentation for all EMPWR API endpoints, enabling you to integrate knowledge graph generation and management into your applications.</p>
      
      <h3>Authentication</h3>
      <p>Most API endpoints require authentication. Include your session cookie or authentication token in requests.</p>
      
      <h3>Base URL</h3>
      <pre class="bg-gray-800 p-4 rounded-md text-sm overflow-auto my-4">https://withempwr.com/api</pre>
      
      <h3>Knowledge Graph Generation</h3>
      
      <h4>POST /api/process-text</h4>
      <p>Generate a knowledge graph from text input using various AI models. Optionally provide an ontology schema to guide entity and relationship extraction.</p>
      
      <p><strong>Request Body:</strong></p>
      <pre class="bg-gray-800 p-4 rounded-md text-sm overflow-auto my-4">{
  "text": "Your text content here",
  "model": "openai" | "mistral" | "spacy",
  "apiKey": "your-api-key",
  "ontologyText": "Your ontology schema here (RDF, OWL, TTL, or JSON-LD)"
}</pre>
      
      <p><strong>Parameters:</strong></p>
      <ul>
        <li><code>text</code> <em>(required)</em> - The text content to extract entities and relationships from.</li>
        <li><code>model</code> <em>(optional, default: "local")</em> - AI model to use: <code>"openai"</code>, <code>"mistral"</code>, <code>"spacy"</code>, or <code>"local"</code>.</li>
        <li><code>apiKey</code> <em>(optional)</em> - API key for the selected model. Required for <code>openai</code> and <code>mistral</code>.</li>
        <li><code>ontologyText</code> <em>(optional)</em> - Raw ontology schema text (RDF, OWL, TTL, or JSON-LD format) to guide knowledge graph generation. When provided, the AI will use the ontology to constrain entity types and relationship types to match the schema. Supported by <code>openai</code> and <code>mistral</code> models only.</li>
        <li><code>filePath</code> <em>(optional)</em> - Path to an uploaded document file for processing.</li>
        <li><code>ocrProcessed</code> <em>(optional)</em> - Boolean flag indicating text was already extracted via OCR.</li>
      </ul>
      
      <p><strong>Response:</strong></p>
      <pre class="bg-gray-800 p-4 rounded-md text-sm overflow-auto my-4">{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": 1,
        "name": "Entity Name",
        "group": 1,
        "dataSource": "openai",
        "timestamp": "2025-10-02T12:00:00Z"
      }
    ],
    "links": [
      {
        "source": 1,
        "target": 2,
        "value": 1,
        "label": "relationship type",
        "dataSource": "openai"
      }
    ]
  }
}</pre>
      
      <p><strong>Example (spaCy - No API Key Required):</strong></p>
      <pre class="bg-gray-800 p-4 rounded-md text-sm overflow-auto my-4">curl -X POST https://withempwr.com/api/process-text \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "Albert Einstein was a theoretical physicist who developed the theory of relativity.",
    "model": "spacy"
  }'</pre>
      
      <p><strong>Example (OpenAI GPT-4o):</strong></p>
      <pre class="bg-gray-800 p-4 rounded-md text-sm overflow-auto my-4">curl -X POST https://withempwr.com/api/process-text \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "Steve Jobs founded Apple Inc. in 1976 with Steve Wozniak.",
    "model": "openai",
    "apiKey": "sk-your-openai-api-key-here"
  }'</pre>
      
      <p><strong>Example (Ontology-Guided Generation):</strong></p>
      <p>When you provide an <code>ontologyText</code> parameter, the AI uses your ontology schema to guide extraction. The ontology can be in any standard format (RDF, OWL, TTL, JSON-LD). The LLM interprets the schema directly, so entity types and relationships in the generated graph will conform to your ontology.</p>
      <pre class="bg-gray-800 p-4 rounded-md text-sm overflow-auto my-4">curl -X POST https://withempwr.com/api/process-text \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "Aspirin is a medication used to treat pain and inflammation. It was developed by Bayer in 1899.",
    "model": "openai",
    "apiKey": "sk-your-openai-api-key-here",
    "ontologyText": "@prefix owl: &lt;http://www.w3.org/2002/07/owl#&gt; .\\n@prefix rdfs: &lt;http://www.w3.org/2000/01/rdf-schema#&gt; .\\n:Drug a owl:Class .\\n:Company a owl:Class .\\n:Condition a owl:Class .\\n:treats a owl:ObjectProperty ; rdfs:domain :Drug ; rdfs:range :Condition .\\n:developedBy a owl:ObjectProperty ; rdfs:domain :Drug ; rdfs:range :Company ."
  }'</pre>
      
      <p><strong>Ontology-Guided Response:</strong></p>
      <p>When an ontology is provided, the response nodes and links will align with the entity types and relationship types defined in the ontology schema:</p>
      <pre class="bg-gray-800 p-4 rounded-md text-sm overflow-auto my-4">{
  "success": true,
  "data": {
    "nodes": [
      { "id": 1, "name": "Aspirin", "group": 1 },
      { "id": 2, "name": "Pain", "group": 3 },
      { "id": 3, "name": "Inflammation", "group": 3 },
      { "id": 4, "name": "Bayer", "group": 4 }
    ],
    "links": [
      { "source": 1, "target": 2, "value": 1, "label": "treats" },
      { "source": 1, "target": 3, "value": 1, "label": "treats" },
      { "source": 1, "target": 4, "value": 1, "label": "developedBy" }
    ]
  }
}</pre>
      
      <h3>Data Extraction</h3>
      
      <h4>POST /api/extract/url</h4>
      <p>Extract knowledge graph from a web URL.</p>
      
      <p><strong>Request Body:</strong></p>
      <pre class="bg-gray-800 p-4 rounded-md text-sm overflow-auto my-4">{
  "url": "https://example.com/article",
  "extractionType": "general" | "wikidata"
}</pre>
      
      <p><strong>Example:</strong></p>
      <pre class="bg-gray-800 p-4 rounded-md text-sm overflow-auto my-4">curl -X POST https://withempwr.com/api/extract/url \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://en.wikipedia.org/wiki/Artificial_intelligence",
    "extractionType": "wikidata"
  }'</pre>
      
      <h4>POST /api/extract/file</h4>
      <p>Upload and extract knowledge graph from a file (PDF, TXT, CSV, etc.).</p>
      
      <p><strong>Form Data:</strong></p>
      <ul>
        <li><code>file</code>: The file to upload</li>
        <li><code>fileType</code>: Type of file (pdf, txt, csv, rdf)</li>
      </ul>
      
      <p><strong>Example:</strong></p>
      <pre class="bg-gray-800 p-4 rounded-md text-sm overflow-auto my-4">curl -X POST https://withempwr.com/api/extract/file \\
  -F "file=@document.pdf" \\
  -F "fileType=pdf"</pre>
      
      <h3>Graph Analysis</h3>
      
      <h4>POST /api/graphs/analyze/:id</h4>
      <p>Analyze a graph and return metrics.</p>
      
      <p><strong>Response:</strong></p>
      <pre class="bg-gray-800 p-4 rounded-md text-sm overflow-auto my-4">{
  "success": true,
  "data": {
    "nodeCount": 25,
    "linkCount": 40,
    "density": 0.12,
    "avgDegree": 3.2,
    "clusters": 4
  }
}</pre>
      
      <h4>POST /api/graphs/generate-insights/:id</h4>
      <p>Generate AI-powered insights for a graph.</p>
      
      <h3>Graph Merging</h3>
      
      <h4>POST /api/graphs/merge</h4>
      <p>Merge multiple knowledge graphs into one.</p>
      
      <p><strong>Request Body:</strong></p>
      <pre class="bg-gray-800 p-4 rounded-md text-sm overflow-auto my-4">{
  "graphIds": [1, 2, 3],
  "newName": "Merged Knowledge Graph",
  "similarityThreshold": 0.8,
  "algorithm": "string-similarity" | "wordnet" | "openai" | "mistral"
}</pre>
      
      <h3>Ontology Management</h3>
      
      <h4>POST /api/ontologies/generate</h4>
      <p>Generate an ontology from a text prompt using AI.</p>
      
      <p><strong>Request Body:</strong></p>
      <pre class="bg-gray-800 p-4 rounded-md text-sm overflow-auto my-4">{
  "prompt": "Create an ontology for e-commerce domain",
  "model": "openai" | "mistral",
  "apiKey": "your-api-key"
}</pre>
      
      <h4>GET /api/ontologies</h4>
      <p>List all ontologies for the current user.</p>
      
      <h4>POST /api/ontologies</h4>
      <p>Create or save an ontology.</p>
      
      <h4>PUT /api/ontologies/:id</h4>
      <p>Update an existing ontology.</p>
      
      <h4>DELETE /api/ontologies/:id</h4>
      <p>Delete an ontology.</p>
      
      <h4>POST /api/ontologies/enrich-suggestions</h4>
      <p>Get AI suggestions to enrich an ontology.</p>
      
      <p><strong>Request Body:</strong></p>
      <pre class="bg-gray-800 p-4 rounded-md text-sm overflow-auto my-4">{
  "ontologyId": 123,
  "model": "openai",
  "focus": "all" | "entities" | "relations" | "properties",
  "instructions": "Add more healthcare-related concepts",
  "apiKey": "your-api-key"
}</pre>
      
      <h3>Error Handling</h3>
      <p>All endpoints return errors in a consistent format:</p>
      
      <pre class="bg-gray-800 p-4 rounded-md text-sm overflow-auto my-4">{
  "success": false,
  "error": "Error message describing what went wrong",
  "message": "User-friendly error message"
}</pre>
      
      <h3>Response Codes</h3>
      <ul>
        <li><code>200</code> - Success</li>
        <li><code>400</code> - Bad Request (invalid input)</li>
        <li><code>401</code> - Unauthorized (authentication required)</li>
        <li><code>403</code> - Forbidden (insufficient permissions)</li>
        <li><code>404</code> - Not Found</li>
        <li><code>500</code> - Internal Server Error</li>
      </ul>
      
      <h3>Rate Limiting</h3>
      <p>API endpoints may be rate-limited based on your account tier. Check response headers for rate limit information.</p>
      
      <h3>Best Practices</h3>
      <ul>
        <li>Always validate API keys before making requests</li>
        <li>Use appropriate models based on your use case (spaCy for speed, OpenAI for accuracy)</li>
        <li>Cache frequently accessed graphs to reduce API calls</li>
        <li>Handle errors gracefully and provide user feedback</li>
        <li>Use batch operations when processing multiple items</li>
      </ul>
      
      <h3>Support</h3>
      <p>For additional API support or questions, contact the EMPWR team or check the documentation portal.</p>
    `
  }
];

// Extended Tutorial interface with additional fields for modern design
interface ExtendedTutorial extends Tutorial {
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  duration?: string; // '5 min', '10 min', etc.
  topics?: string[];
  author?: string;
  lastUpdated?: string;
  views?: number;
  status?: 'published' | 'draft' | 'in-progress';
}

// Extend the sample data with additional fields
const extendedContentData: ExtendedTutorial[] = contentData.map(item => {
  if (item.type === 'tutorial') {
    return {
      ...item,
      difficulty: item.id === 'getting-started' ? 'beginner' : 'intermediate',
      duration: item.id === 'getting-started' ? '5 min' : '10 min',
      topics: item.id === 'getting-started' 
        ? ['setup', 'configuration', 'basics'] 
        : ['graph generation', 'customization', 'advanced'],
      author: 'EMPWR Team',
      lastUpdated: '2025-04-15',
      views: Math.floor(Math.random() * 500) + 100,
      status: 'published'
    };
  } else {
    return {
      ...item,
      difficulty: 'advanced',
      duration: '20 min',
      topics: ['case study', 'research', 'application'],
      author: 'Research Team',
      lastUpdated: '2025-04-18',
      views: Math.floor(Math.random() * 300) + 200,
      status: 'published'
    };
  }
});

// Add a few tutorials with in-progress status
const inProgressTutorials: ExtendedTutorial[] = [
  {
    id: 'advanced-visualization',
    title: 'Advanced Visualization Techniques',
    description: 'Master the advanced visualization features to create powerful graph representations.',
    type: 'tutorial',
    content: 'Coming soon',
    difficulty: 'advanced',
    duration: '15 min',
    topics: ['visualization', 'customization', 'advanced'],
    author: 'EMPWR Team',
    lastUpdated: '2025-04-20',
    views: 0,
    status: 'in-progress'
  },
  {
    id: 'export-formats',
    title: 'Knowledge Graph Export Formats',
    description: 'Learn about the various export formats and when to use each one.',
    type: 'tutorial',
    content: 'Coming soon',
    difficulty: 'intermediate',
    duration: '8 min',
    topics: ['export', 'sharing', 'integration'],
    author: 'EMPWR Team',
    lastUpdated: '2025-04-22',
    views: 0,
    status: 'in-progress'
  }
];

// Add the in-progress tutorials to the extended content data
const allContentData = [...extendedContentData, ...inProgressTutorials];

// Main Tutorials component
export default function Tutorials() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.isAdmin;
  
  // State management
  const [selectedContent, setSelectedContent] = useState<ExtendedTutorial | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [activeTab, setActiveTab] = useState<string>('tutorials'); // Default to tutorials tab
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    difficulty: [] as string[],
    topics: [] as string[],
    status: [] as string[]
  });
  
  // Toggle help modal
  const toggleHelpModal = () => {
    setIsHelpModalOpen(!isHelpModalOpen);
  };
  
  // Filter tutorials and case studies with search term and filters
  const filteredContent = allContentData
    .filter(item => 
      searchTerm === '' || 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.topics && item.topics.some(topic => topic.toLowerCase().includes(searchTerm.toLowerCase())))
    )
    .filter(item => 
      filters.difficulty.length === 0 || 
      (item.difficulty && filters.difficulty.includes(item.difficulty))
    )
    .filter(item =>
      filters.topics.length === 0 ||
      (item.topics && item.topics.some(topic => filters.topics.includes(topic)))
    )
    .filter(item =>
      filters.status.length === 0 ||
      (item.status && filters.status.includes(item.status))
    );
    
  const filteredTutorials = filteredContent.filter(item => item.type === 'tutorial');
  const filteredCaseStudies = filteredContent.filter(item => item.type === 'case-study');
  
  // Handle edit button click
  const handleEdit = () => {
    if (selectedContent) {
      setEditContent(selectedContent.content);
      setEditMode(true);
    }
  };
  
  // Handle save button click
  const handleSave = () => {
    if (selectedContent && editContent) {
      // In a real application, you would send this to an API
      // For now, we'll just update the local state
      const updatedContent = { ...selectedContent, content: editContent };
      setSelectedContent(updatedContent);
      setEditMode(false);
      
      toast({
        title: "Tutorial updated successfully",
        description: "Your changes have been saved.",
        variant: "default",
      });
    }
  };
  
  // Toggle a filter value
  const toggleFilter = (category: 'difficulty' | 'topics' | 'status', value: string) => {
    setFilters(prevFilters => {
      const currentValues = [...prevFilters[category]];
      const index = currentValues.indexOf(value);
      
      if (index === -1) {
        return { ...prevFilters, [category]: [...currentValues, value] };
      } else {
        currentValues.splice(index, 1);
        return { ...prevFilters, [category]: currentValues };
      }
    });
  };
  
  // Clear all filters
  const clearFilters = () => {
    setFilters({
      difficulty: [],
      topics: [],
      status: []
    });
    setSearchTerm('');
  };

  // Check if a filter is active
  const isFilterActive = (category: 'difficulty' | 'topics' | 'status', value: string) => {
    return filters[category].includes(value);
  };

  return (
    <PageLayout>
      <AnimatedGradientBackground intensity={0.15}>
        <div className="container mx-auto px-4 py-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between pb-2 border-b border-gray-800/30">
              <div>
                <h1 className="text-xl font-medium text-white flex items-center">
                  <BookOpen className="mr-2 h-5 w-5 text-blue-500" />
                  Documentation
                </h1>
                <p className="text-gray-400 text-sm mt-1">
                  Tutorials and case studies to help you get the most out of the platform
                </p>
              </div>
            </div>
          </div>

          {/* Tabs for tutorials and case studies */}
          <Tabs defaultValue="tutorials" className="mb-8" onValueChange={(value) => setActiveTab(value as 'tutorials' | 'case-studies')}>
            <TabsList className="bg-transparent border-b border-gray-800 p-0">
              <TabsTrigger 
                value="tutorials" 
                className="rounded-none border-b-2 border-transparent px-6 py-2.5 data-[state=active]:border-blue-500 data-[state=active]:bg-transparent"
              >
                <FileText className="mr-2 h-4 w-4 text-blue-500" /> 
                <span className="font-medium">Tutorials</span>
              </TabsTrigger>
              <TabsTrigger 
                value="case-studies" 
                className="rounded-none border-b-2 border-transparent px-6 py-2.5 data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent"
              >
                <Briefcase className="mr-2 h-4 w-4 text-indigo-500" /> 
                <span className="font-medium">Case Studies</span>
              </TabsTrigger>
            </TabsList>

            {/* Tutorials Content */}
            <TabsContent value="tutorials" className="mt-6">
              {selectedContent && selectedContent.type === 'tutorial' ? (
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 to-blue-800/10 rounded-xl pointer-events-none z-0"></div>
                  <div className="absolute inset-0 bg-[url('/backgrounds/grid-pattern.svg')] opacity-10 rounded-xl pointer-events-none z-0"></div>
                  
                  <Card className="bg-gradient-to-b from-gray-900 to-gray-900/95 border border-gray-800 shadow-xl relative z-10">
                    <CardHeader className="pb-2 md:pb-4">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-blue-900/30">
                            <FileText className="h-6 w-6 text-blue-400" />
                          </div>
                          <div>
                            <CardTitle className="text-2xl text-blue-100">{selectedContent.title}</CardTitle>
                            <CardDescription className="mt-1 text-blue-300/70">{selectedContent.description}</CardDescription>
                          </div>
                        </div>
                        <div className="flex space-x-2 ml-11 md:ml-0">
                          {isAdmin && !editMode && (
                            <Button variant="outline" size="sm" className="border-blue-800/50 bg-blue-900/20 hover:bg-blue-800/30" onClick={handleEdit}>
                              <Edit className="h-4 w-4 mr-2" /> Edit
                            </Button>
                          )}
                          {isAdmin && editMode && (
                            <Button variant="outline" size="sm" className="border-blue-800/50 bg-blue-900/20 hover:bg-blue-800/30" onClick={handleSave}>
                              <Save className="h-4 w-4 mr-2" /> Save
                            </Button>
                          )}
                          <Button variant="ghost" className="hover:bg-blue-900/20" onClick={() => {
                            setSelectedContent(null);
                            setEditMode(false);
                          }}>
                            Back to List
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      {editMode ? (
                        <Textarea 
                          className="min-h-[400px] bg-gray-800 text-white font-mono border-blue-900/30" 
                          value={editContent} 
                          onChange={(e) => setEditContent(e.target.value)}
                        />
                      ) : (
                        <div className="prose prose-invert prose-headings:text-blue-200 prose-a:text-blue-400 prose-code:text-blue-300 prose-strong:text-blue-300 max-w-none" dangerouslySetInnerHTML={{ __html: selectedContent.content }} />
                      )}
                      {selectedContent.externalLink && !editMode && (
                        <Button className="mt-8 bg-blue-600 hover:bg-blue-700 text-white" asChild>
                          <a href={selectedContent.externalLink} target="_blank" rel="noopener noreferrer">
                            View Full Documentation <ExternalLink className="ml-2 h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-medium text-gray-200">All Tutorials</h2>
                  </div>
                  
                  {filteredTutorials.length === 0 ? (
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-900/10 to-blue-800/5 rounded-xl pointer-events-none z-0"></div>
                      <div className="absolute inset-0 bg-[url('/backgrounds/grid-pattern.svg')] opacity-5 rounded-xl pointer-events-none z-0"></div>
                      <Card className="bg-gradient-to-b from-gray-900 to-gray-900/95 border border-gray-800 shadow-md p-8 relative z-10">
                        <div className="flex flex-col items-center justify-center text-center py-6">
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-900/30 border border-blue-700/20 mb-6">
                            <BookOpen className="h-8 w-8 text-blue-400" />
                          </div>
                          <h3 className="text-xl font-medium text-blue-100 mb-2">No Tutorials Yet</h3>
                          <p className="text-blue-400/70 max-w-md mb-6">
                            We're currently working on creating comprehensive tutorials to help you get the most out of our knowledge graph platform.
                          </p>
                          <div className="w-full max-w-xs h-1.5 bg-gray-800 rounded-full overflow-hidden mb-6">
                            <div className="h-full w-3/5 bg-gradient-to-r from-blue-600 to-blue-400 rounded-full"></div>
                          </div>
                          <p className="text-sm text-blue-500/60">60% Complete - Check back soon</p>
                        </div>
                      </Card>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 auto-rows-auto overflow-visible">
                      {filteredTutorials.map(tutorial => (
                        <div 
                          key={tutorial.id}
                          className="group cursor-pointer h-auto" 
                          onClick={() => setSelectedContent(tutorial)}
                        >
                          {/* Card with fixed height to prevent scrollbars */}
                          <Card className="bg-gray-900 border border-gray-800 hover:border-blue-600/30 shadow-md hover:shadow-blue-900/10 transition-all duration-300 h-full flex flex-col">
                            {/* Accent line on top */}
                            <div className="h-1 w-full bg-gradient-to-r from-blue-600 to-indigo-600 opacity-50 group-hover:opacity-100 transition-all"></div>
                            
                            <div className="p-5 flex-grow">
                              <div className="flex items-start justify-between">
                                <div className="space-y-2 flex-grow pr-3">
                                  <h3 className="text-lg font-medium text-blue-100 leading-tight">{tutorial.title}</h3>
                                  <p className="text-sm text-blue-300/80 line-clamp-2">{tutorial.description}</p>
                                </div>
                                
                                <div className="flex-shrink-0 bg-blue-900/20 p-2 rounded-lg">
                                  <FileText className="h-5 w-5 text-blue-400" />
                                </div>
                              </div>
                              
                              <div className="mt-4 flex items-center text-xs text-blue-500/70 border-t border-gray-800/50 pt-3">
                                <div className="flex items-center">
                                  <Clock className="mr-1 h-3 w-3" />
                                  <span>5 min read</span>
                                </div>
                                <span className="mx-2">•</span>
                                <div className="flex items-center">
                                  <BarChart className="mr-1 h-3 w-3" />
                                  <span>Beginner</span>
                                </div>
                              </div>
                            </div>
                          </Card>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* Case Studies Content */}
            <TabsContent value="case-studies" className="mt-6">
              {selectedContent && selectedContent.type === 'case-study' ? (
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/20 to-indigo-800/10 rounded-xl pointer-events-none z-0"></div>
                  <div className="absolute inset-0 bg-[url('/backgrounds/grid-pattern.svg')] opacity-10 rounded-xl pointer-events-none z-0"></div>
                  
                  <Card className="bg-gradient-to-b from-gray-900 to-gray-900/95 border border-gray-800 shadow-xl relative z-10">
                    <CardHeader className="pb-2 md:pb-4">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-indigo-900/30">
                            <Briefcase className="h-6 w-6 text-indigo-400" />
                          </div>
                          <div>
                            <CardTitle className="text-2xl text-indigo-100">{selectedContent.title}</CardTitle>
                            <CardDescription className="mt-1 text-indigo-300/70">{selectedContent.description}</CardDescription>
                          </div>
                        </div>
                        <div className="flex space-x-2 ml-11 md:ml-0">
                          {isAdmin && !editMode && (
                            <Button variant="outline" size="sm" className="border-indigo-800/50 bg-indigo-900/20 hover:bg-indigo-800/30" onClick={handleEdit}>
                              <Edit className="h-4 w-4 mr-2" /> Edit
                            </Button>
                          )}
                          {isAdmin && editMode && (
                            <Button variant="outline" size="sm" className="border-indigo-800/50 bg-indigo-900/20 hover:bg-indigo-800/30" onClick={handleSave}>
                              <Save className="h-4 w-4 mr-2" /> Save
                            </Button>
                          )}
                          <Button variant="ghost" className="hover:bg-indigo-900/20" onClick={() => {
                            setSelectedContent(null);
                            setEditMode(false);
                          }}>
                            Back to List
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      {editMode ? (
                        <Textarea 
                          className="min-h-[400px] bg-gray-800 text-white font-mono border-indigo-900/30" 
                          value={editContent} 
                          onChange={(e) => setEditContent(e.target.value)}
                        />
                      ) : (
                        <div className="prose prose-invert prose-headings:text-indigo-200 prose-a:text-indigo-400 prose-code:text-indigo-300 prose-strong:text-indigo-300 max-w-none" dangerouslySetInnerHTML={{ __html: selectedContent.content }} />
                      )}
                      {selectedContent.externalLink && !editMode && (
                        <Button className="mt-8 bg-indigo-600 hover:bg-indigo-700 text-white" asChild>
                          <a href={selectedContent.externalLink} target="_blank" rel="noopener noreferrer">
                            View Full Documentation <ExternalLink className="ml-2 h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-medium text-gray-200">All Case Studies</h2>
                  </div>
                  
                  {filteredCaseStudies.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 auto-rows-auto overflow-visible">
                      {filteredCaseStudies.map(caseStudy => (
                        <div 
                          key={caseStudy.id}
                          className="group cursor-pointer h-auto" 
                          onClick={() => setSelectedContent(caseStudy)}
                        >
                          {/* Card with fixed height to prevent scrollbars */}
                          <Card className="bg-gray-900 border border-gray-800 hover:border-indigo-600/30 shadow-md hover:shadow-indigo-900/10 transition-all duration-300 h-full flex flex-col">
                            {/* Accent line on top */}
                            <div className="h-1 w-full bg-gradient-to-r from-indigo-600 to-purple-600 opacity-50 group-hover:opacity-100 transition-all"></div>
                            
                            <div className="p-5 flex-grow">
                              <div className="flex items-start justify-between">
                                <div className="space-y-2 flex-grow pr-3">
                                  <h3 className="text-lg font-medium text-indigo-100 leading-tight">{caseStudy.title}</h3>
                                  <p className="text-sm text-indigo-300/80 line-clamp-2">{caseStudy.description}</p>
                                </div>
                                
                                <div className="flex-shrink-0 bg-indigo-900/20 p-2 rounded-lg">
                                  <Briefcase className="h-5 w-5 text-indigo-400" />
                                </div>
                              </div>
                              
                              <div className="mt-4 flex items-center text-xs text-indigo-500/70 border-t border-gray-800/50 pt-3">
                                <div className="flex items-center">
                                  <Briefcase className="mr-1 h-3 w-3" />
                                  <span>Industry</span>
                                </div>
                                <span className="mx-2">•</span>
                                <div className="flex items-center">
                                  <GraduationCap className="mr-1 h-3 w-3" />
                                  <span>Advanced</span>
                                </div>
                              </div>
                            </div>
                          </Card>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 px-6 border border-gray-800/50 rounded-lg bg-gradient-to-b from-gray-900/50 to-gray-900/30">
                      <div className="mx-auto w-14 h-14 rounded-full bg-indigo-900/10 border border-indigo-700/10 flex items-center justify-center mb-4">
                        <Briefcase className="h-7 w-7 text-indigo-500/60" />
                      </div>
                      <h3 className="text-xl font-medium text-gray-300 mb-3">No Case Studies Available</h3>
                      <p className="text-gray-500 max-w-md mx-auto leading-relaxed">
                        We'll be adding detailed industry-specific case studies soon. Check back later for real-world examples of EMPWR in action.
                      </p>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </AnimatedGradientBackground>
    </PageLayout>
  );
}