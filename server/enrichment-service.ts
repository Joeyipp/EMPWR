import OpenAI from 'openai';
import { Ontology, OntologyEntity, OntologyRelation } from '../shared/schema';

// The newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const OPENAI_MODEL = 'gpt-4o';

/**
 * Generate enrichment suggestions for an ontology using AI
 */
export async function generateEnrichmentSuggestions(
  ontology: Ontology,
  model: 'openai' | 'mistral',
  focus: 'all' | 'entities' | 'relations' | 'properties',
  instructions: string,
  apiKey: string
): Promise<{
  entities: OntologyEntity[];
  relations: OntologyRelation[];
  properties: { entityName: string; property: { name: string; type: string; description: string } }[];
}> {
  if (model === 'openai') {
    return generateOpenAISuggestions(ontology, focus, instructions, apiKey);
  } else {
    // Use Mistral implementation when mistral is selected
    return generateMistralSuggestions(ontology, focus, instructions, apiKey);
  }
}

/**
 * Generate enrichment suggestions using OpenAI
 */
async function generateOpenAISuggestions(
  ontology: Ontology,
  focus: 'all' | 'entities' | 'relations' | 'properties',
  instructions: string,
  apiKey: string
): Promise<{
  entities: OntologyEntity[];
  relations: OntologyRelation[];
  properties: { entityName: string; property: { name: string; type: string; description: string } }[];
}> {
  try {
    const openai = new OpenAI({ apiKey });

    // Prepare the current ontology information
    const entityNames = ontology.entities.map(e => e.name);
    const entityTypes = ontology.entities.map(e => e.type);
    const relationNames = ontology.relations.map(r => r.name);
    const relationPairs = ontology.relations.map(r => `${r.source} -> ${r.name} -> ${r.target}`);
    
    // Create a prompt based on the focus
    let systemPrompt = `You are an ontology enrichment expert. Analyze the provided ontology and suggest additional elements to enhance it.
Domain: ${ontology.domain || 'Not specified'}
Description: ${ontology.description || 'Not specified'}

Current ontology structure:
- Entities (${ontology.entities.length}): ${entityNames.join(', ')}
- Entity Types: ${Array.from(new Set(entityTypes)).join(', ')}
- Relations (${ontology.relations.length}): ${relationNames.join(', ')}
- Relation Examples: ${relationPairs.slice(0, 5).join('; ')}

${instructions ? 'Additional instructions: ' + instructions : ''}

`;

    if (focus === 'all' || focus === 'entities') {
      systemPrompt += `
Suggest new entities that would complement this ontology. For each entity, provide:
- A meaningful name
- A type (one of: ${Array.from(new Set(entityTypes)).join(', ') || 'Class, Property, DataType, ObjectProperty, AnnotationProperty'})
- A clear description
`;
    }

    if (focus === 'all' || focus === 'relations') {
      systemPrompt += `
Suggest new relations between entities. Only suggest relations between existing entities or entities you're suggesting. For each relation:
- A meaningful relation name
- Source entity name (must exist in the ontology or be one you're suggesting)
- Target entity name (must exist in the ontology or be one you're suggesting)
- A clear description of the relationship
`;
    }

    if (focus === 'all' || focus === 'properties') {
      systemPrompt += `
Suggest new properties for existing entities. For each property:
- The entity name it belongs to (must exist in the ontology)
- Property name
- Property type (string, number, boolean, date, etc.)
- A clear description
`;
    }

    systemPrompt += `
Return your suggestions as a JSON object with the following structure:
{
  "entities": [
    {
      "id": 0,
      "name": "string",
      "type": "string",
      "description": "string",
      "properties": []
    }
  ],
  "relations": [
    {
      "id": 0,
      "name": "string",
      "source": "string",
      "target": "string",
      "description": "string"
    }
  ],
  "properties": [
    {
      "entityName": "string",
      "property": {
        "name": "string",
        "type": "string",
        "description": "string"
      }
    }
  ]
}

Your suggestions should be thoughtful and aligned with the ontology's domain and existing structure.
`;

    // Make the API call
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate enrichment suggestions for this ontology.' }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2000
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    try {
      const suggestions = JSON.parse(content);
      
      // Validate and sanitize the suggestions
      const sanitizedSuggestions = {
        entities: Array.isArray(suggestions.entities) 
          ? suggestions.entities.map((entity: any, index: number) => ({
              id: index + 1000, // temporary ID that won't conflict with existing ones
              name: entity.name || `Entity${index + 1}`,
              type: entity.type || 'Class',
              description: entity.description || '',
              properties: Array.isArray(entity.properties) ? entity.properties : []
            }))
          : [],
        relations: Array.isArray(suggestions.relations)
          ? suggestions.relations.map((relation: any, index: number) => ({
              id: index + 2000, // temporary ID that won't conflict with existing ones
              name: relation.name || `Relation${index + 1}`,
              source: relation.source || '',
              target: relation.target || '',
              description: relation.description || ''
            }))
          : [],
        properties: Array.isArray(suggestions.properties)
          ? suggestions.properties.map((prop: any) => ({
              entityName: prop.entityName || '',
              property: {
                name: prop.property?.name || '',
                type: prop.property?.type || 'string',
                description: prop.property?.description || ''
              }
            }))
          : []
      };

      return sanitizedSuggestions;
    } catch (error) {
      console.error('Failed to parse OpenAI response:', error);
      throw new Error('Failed to parse enrichment suggestions');
    }
  } catch (error) {
    console.error('Error generating OpenAI suggestions:', error);
    throw new Error('Failed to generate enrichment suggestions with OpenAI');
  }
}

/**
 * Generate enrichment suggestions using Mistral AI
 */
async function generateMistralSuggestions(
  ontology: Ontology,
  focus: 'all' | 'entities' | 'relations' | 'properties',
  instructions: string,
  apiKey: string
): Promise<{
  entities: OntologyEntity[];
  relations: OntologyRelation[];
  properties: { entityName: string; property: { name: string; type: string; description: string } }[];
}> {
  try {
    // Since we don't have a direct Mistral API client in the dependencies,
    // we'll use a fetch-based approach to call the Mistral API

    // Prepare the current ontology information
    const entityNames = ontology.entities.map(e => e.name);
    const entityTypes = ontology.entities.map(e => e.type);
    const relationNames = ontology.relations.map(r => r.name);
    const relationPairs = ontology.relations.map(r => `${r.source} -> ${r.name} -> ${r.target}`);
    
    // Create a prompt based on the focus
    let systemPrompt = `You are an ontology enrichment expert. Analyze the provided ontology and suggest additional elements to enhance it.
Domain: ${ontology.domain || 'Not specified'}
Description: ${ontology.description || 'Not specified'}

Current ontology structure:
- Entities (${ontology.entities.length}): ${entityNames.join(', ')}
- Entity Types: ${Array.from(new Set(entityTypes)).join(', ')}
- Relations (${ontology.relations.length}): ${relationNames.join(', ')}
- Relation Examples: ${relationPairs.slice(0, 5).join('; ')}

${instructions ? 'Additional instructions: ' + instructions : ''}

`;

    if (focus === 'all' || focus === 'entities') {
      systemPrompt += `
Suggest new entities that would complement this ontology. For each entity, provide:
- A meaningful name
- A type (one of: ${Array.from(new Set(entityTypes)).join(', ') || 'Class, Property, DataType, ObjectProperty, AnnotationProperty'})
- A clear description
`;
    }

    if (focus === 'all' || focus === 'relations') {
      systemPrompt += `
Suggest new relations between entities. Only suggest relations between existing entities or entities you're suggesting. For each relation:
- A meaningful relation name
- Source entity name (must exist in the ontology or be one you're suggesting)
- Target entity name (must exist in the ontology or be one you're suggesting)
- A clear description of the relationship
`;
    }

    if (focus === 'all' || focus === 'properties') {
      systemPrompt += `
Suggest new properties for existing entities. For each property:
- The entity name it belongs to (must exist in the ontology)
- Property name
- Property type (string, number, boolean, date, etc.)
- A clear description
`;
    }

    systemPrompt += `
Return your suggestions as a JSON object with the following structure:
{
  "entities": [
    {
      "id": 0,
      "name": "string",
      "type": "string",
      "description": "string",
      "properties": []
    }
  ],
  "relations": [
    {
      "id": 0,
      "name": "string",
      "source": "string",
      "target": "string",
      "description": "string"
    }
  ],
  "properties": [
    {
      "entityName": "string",
      "property": {
        "name": "string",
        "type": "string",
        "description": "string"
      }
    }
  ]
}

Your suggestions should be thoughtful and aligned with the ontology's domain and existing structure.
`;

    // Make the API call to Mistral
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "mistral-large-latest", // Use the latest Mistral model
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Generate enrichment suggestions for this ontology.' }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Mistral API error:', errorData);
      throw new Error(`Mistral API error: ${response.statusText}`);
    }

    const responseData = await response.json();
    const content = responseData.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('Empty response from Mistral AI');
    }

    try {
      const suggestions = JSON.parse(content);
      
      // Validate and sanitize the suggestions
      const sanitizedSuggestions = {
        entities: Array.isArray(suggestions.entities) 
          ? suggestions.entities.map((entity: any, index: number) => ({
              id: index + 1000, // temporary ID that won't conflict with existing ones
              name: entity.name || `Entity${index + 1}`,
              type: entity.type || 'Class',
              description: entity.description || '',
              properties: Array.isArray(entity.properties) ? entity.properties : []
            }))
          : [],
        relations: Array.isArray(suggestions.relations)
          ? suggestions.relations.map((relation: any, index: number) => ({
              id: index + 2000, // temporary ID that won't conflict with existing ones
              name: relation.name || `Relation${index + 1}`,
              source: relation.source || '',
              target: relation.target || '',
              description: relation.description || ''
            }))
          : [],
        properties: Array.isArray(suggestions.properties)
          ? suggestions.properties.map((prop: any) => ({
              entityName: prop.entityName || '',
              property: {
                name: prop.property?.name || '',
                type: prop.property?.type || 'string',
                description: prop.property?.description || ''
              }
            }))
          : []
      };

      return sanitizedSuggestions;
    } catch (error) {
      console.error('Failed to parse Mistral response:', error);
      throw new Error('Failed to parse enrichment suggestions');
    }
  } catch (error) {
    console.error('Error generating Mistral suggestions:', error);
    throw new Error('Failed to generate enrichment suggestions with Mistral AI');
  }
}

/**
 * Integrate Schema.org schemas into the ontology
 */
export async function integrateSchemaOrg(
  ontology: Ontology,
  mappingType: 'suggested' | 'manual' | 'all',
  integrationType: 'extend' | 'replace' | 'annotate',
  selectedClasses: string[] = []
): Promise<Ontology> {
  // Create a copy of the ontology to avoid mutations
  const enrichedOntology = JSON.parse(JSON.stringify(ontology));
  
  // Ensure all required properties exist
  if (!Array.isArray(enrichedOntology.entities)) {
    enrichedOntology.entities = [];
  }
  
  if (!Array.isArray(enrichedOntology.relations)) {
    enrichedOntology.relations = [];
  }
  
  if (!Array.isArray(enrichedOntology.versions)) {
    enrichedOntology.versions = [];
  }
  
  // Define common Schema.org classes based on the ontology domain
  let schemaClasses = getSchemaClassesForDomain(enrichedOntology.domain || '');
  
  // Filter classes based on selection if selectedClasses array is not empty
  if (selectedClasses && selectedClasses.length > 0) {
    schemaClasses = schemaClasses.filter(schemaClass => 
      selectedClasses.includes(schemaClass.name)
    );
  }
  
  // Get the highest existing entity ID to avoid conflicts
  const maxEntityId = Math.max(0, ...enrichedOntology.entities.map((e: any) => e.id || 0));
  const maxRelationId = Math.max(0, ...enrichedOntology.relations.map((r: any) => r.id || 0));
  
  let nextEntityId = maxEntityId + 1;
  let nextRelationId = maxRelationId + 1;
  
  if (integrationType === 'extend') {
    // Add new Schema.org entities
    const newEntities = schemaClasses.map((schemaClass, index) => {
      return {
        id: nextEntityId + index,
        name: schemaClass.name,
        type: 'Class',
        description: schemaClass.description,
        properties: schemaClass.properties.map(prop => ({
          name: prop.name,
          type: prop.type,
          description: prop.description
        }))
      };
    });
    
    enrichedOntology.entities = [...enrichedOntology.entities, ...newEntities];
    
    // Add schema.org relation types
    const newRelations = schemaClasses
      .filter(c => c.relations && c.relations.length > 0)
      .flatMap((schemaClass, classIndex) => {
        return (schemaClass.relations || []).map((relation, relationIndex) => {
          return {
            id: nextRelationId + classIndex + relationIndex,
            name: relation.name,
            source: schemaClass.name,
            target: relation.target,
            description: relation.description
          };
        });
      });
      
    enrichedOntology.relations = [...enrichedOntology.relations, ...newRelations];
  } 
  else if (integrationType === 'replace') {
    // Map existing entities to Schema.org classes based on similarity
    enrichedOntology.entities = enrichedOntology.entities.map((entity: any) => {
      const matchingSchemaClass = findMatchingSchemaClass(entity, schemaClasses);
      
      if (matchingSchemaClass) {
        return {
          ...entity,
          name: entity.name,
          description: entity.description + ' (Mapped to Schema.org: ' + matchingSchemaClass.name + ')',
          properties: [...entity.properties, ...matchingSchemaClass.properties.map(prop => ({
            name: prop.name,
            type: prop.type,
            description: prop.description + ' (From Schema.org)'
          }))]
        };
      }
      
      return entity;
    });
  }
  else if (integrationType === 'annotate') {
    // Add Schema.org annotations to existing entities and properties
    enrichedOntology.entities = enrichedOntology.entities.map((entity: any) => {
      const matchingSchemaClass = findMatchingSchemaClass(entity, schemaClasses);
      
      if (matchingSchemaClass) {
        return {
          ...entity,
          description: entity.description + ' (Schema.org equivalent: ' + matchingSchemaClass.name + ')'
        };
      }
      
      return entity;
    });
  }
  
  return enrichedOntology;
}

/**
 * Find matching Schema.org class for a given entity
 */
function findMatchingSchemaClass(entity: any, schemaClasses: any[]): any | null {
  // Simple matching based on name similarity
  const entityName = entity.name.toLowerCase();
  
  for (const schemaClass of schemaClasses) {
    const schemaName = schemaClass.name.toLowerCase();
    
    // Check for exact match or contained words
    if (
      entityName === schemaName ||
      entityName.includes(schemaName) ||
      schemaName.includes(entityName)
    ) {
      return schemaClass;
    }
  }
  
  return null;
}

/**
 * Get Schema.org classes appropriate for a domain
 */
function getSchemaClassesForDomain(domain: string): any[] {
  // Base Schema.org classes that apply to most domains
  const baseClasses = [
    {
      name: 'Thing',
      description: 'The most generic type of item in Schema.org.',
      properties: [
        { name: 'name', type: 'string', description: 'The name of the item.' },
        { name: 'description', type: 'string', description: 'A description of the item.' },
        { name: 'url', type: 'string', description: 'URL of the item.' },
        { name: 'image', type: 'string', description: 'An image of the item.' }
      ],
      relations: []
    },
    {
      name: 'Person',
      description: 'A person (alive, dead, undead, or fictional).',
      properties: [
        { name: 'givenName', type: 'string', description: 'Given name. In the U.S., the first name of a Person.' },
        { name: 'familyName', type: 'string', description: 'Family name. In the U.S., the last name of a Person.' },
        { name: 'email', type: 'string', description: 'Email address.' },
        { name: 'birthDate', type: 'date', description: 'Date of birth.' }
      ],
      relations: [
        { name: 'memberOf', target: 'Organization', description: 'An Organization to which this Person belongs.' }
      ]
    },
    {
      name: 'Organization',
      description: 'An organization such as a school, NGO, corporation, club, etc.',
      properties: [
        { name: 'legalName', type: 'string', description: 'The official name of the organization.' },
        { name: 'foundingDate', type: 'date', description: 'The date that this organization was founded.' },
        { name: 'address', type: 'string', description: 'Physical address of the item.' }
      ],
      relations: [
        { name: 'member', target: 'Person', description: 'A member of this organization.' },
        { name: 'subOrganization', target: 'Organization', description: 'A relationship between two organizations.' }
      ]
    },
    {
      name: 'Place',
      description: 'Entities that have a somewhat fixed, physical extension.',
      properties: [
        { name: 'address', type: 'string', description: 'Physical address of the item.' },
        { name: 'latitude', type: 'number', description: 'The latitude of a location.' },
        { name: 'longitude', type: 'number', description: 'The longitude of a location.' }
      ],
      relations: [
        { name: 'containedIn', target: 'Place', description: 'The basic containment relation between places.' }
      ]
    }
  ];
  
  // Domain-specific Schema.org classes
  const domainClasses: Record<string, any[]> = {
    education: [
      {
        name: 'EducationalOrganization',
        description: 'An educational organization.',
        properties: [
          { name: 'alumni', type: 'array', description: 'Alumni of an organization.' }
        ],
        relations: [
          { name: 'offers', target: 'Course', description: 'Courses offered by the educational organization.' }
        ]
      },
      {
        name: 'Course',
        description: 'A description of an educational course.',
        properties: [
          { name: 'courseCode', type: 'string', description: 'The identifier for the course.' },
          { name: 'numberOfCredits', type: 'number', description: 'The number of credits this course provides.' }
        ],
        relations: [
          { name: 'hasPart', target: 'CourseInstance', description: 'An offering of the course at a specific time and place.' }
        ]
      }
    ],
    business: [
      {
        name: 'Product',
        description: 'Any offered product or service.',
        properties: [
          { name: 'brand', type: 'string', description: 'The brand of the product.' },
          { name: 'manufacturer', type: 'string', description: 'The manufacturer of the product.' },
          { name: 'price', type: 'number', description: 'The price of the product.' }
        ],
        relations: [
          { name: 'manufacturer', target: 'Organization', description: 'The organization that manufactures the product.' }
        ]
      },
      {
        name: 'Offer',
        description: 'An offer to sell a product or provide a service.',
        properties: [
          { name: 'price', type: 'number', description: 'The price of the offer.' },
          { name: 'priceCurrency', type: 'string', description: 'The currency of the price.' },
          { name: 'availability', type: 'string', description: 'The availability of the offer.' }
        ],
        relations: [
          { name: 'itemOffered', target: 'Product', description: 'The product being offered.' }
        ]
      }
    ],
    healthcare: [
      {
        name: 'MedicalCondition',
        description: 'Any condition of the human body that affects health.',
        properties: [
          { name: 'code', type: 'string', description: 'A medical code for the condition.' },
          { name: 'signOrSymptom', type: 'string', description: 'A sign or symptom of this condition.' }
        ],
        relations: [
          { name: 'possibleTreatment', target: 'MedicalTherapy', description: 'A possible treatment for the condition.' }
        ]
      },
      {
        name: 'MedicalTherapy',
        description: 'A medical therapy is a treatment of patients.',
        properties: [
          { name: 'adverseOutcome', type: 'string', description: 'A possible complication or side effect of this therapy.' },
          { name: 'contraindication', type: 'string', description: 'A contraindication for this therapy.' }
        ],
        relations: [
          { name: 'treats', target: 'MedicalCondition', description: 'The condition treated by this therapy.' }
        ]
      }
    ]
  };
  
  // Determine which domain-specific classes to include
  let domainSpecificClasses: any[] = [];
  
  const lowerDomain = domain.toLowerCase();
  if (lowerDomain.includes('educat') || lowerDomain.includes('school') || lowerDomain.includes('learn')) {
    domainSpecificClasses = [...domainSpecificClasses, ...domainClasses.education];
  }
  
  if (lowerDomain.includes('business') || lowerDomain.includes('company') || lowerDomain.includes('product')) {
    domainSpecificClasses = [...domainSpecificClasses, ...domainClasses.business];
  }
  
  if (lowerDomain.includes('health') || lowerDomain.includes('medical') || lowerDomain.includes('care')) {
    domainSpecificClasses = [...domainSpecificClasses, ...domainClasses.healthcare];
  }
  
  return [...baseClasses, ...domainSpecificClasses];
}