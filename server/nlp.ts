import nlp from 'compromise';
import { KnowledgeGraph, Node, Link } from '@shared/schema';

// Entity group mappings
enum EntityGroup {
  PERSON = 1,
  PLACE = 2, 
  CONCEPT = 3,
  ORGANIZATION = 4,
  DATE = 5,
  OTHER = 6
}

// Simple function to determine entity group based on the entity type
function getEntityGroup(type: string): EntityGroup {
  if (type === 'Person') return EntityGroup.PERSON;
  if (type === 'Place') return EntityGroup.PLACE;
  if (type === 'Organization') return EntityGroup.ORGANIZATION;
  if (type === 'Date') return EntityGroup.DATE;
  if (type === 'Concept') return EntityGroup.CONCEPT;
  return EntityGroup.OTHER;
}

// Process text to extract entities and relationships
export function processText(text: string): KnowledgeGraph {
  const doc = nlp(text);
  
  // Extract named entities
  const people = doc.people().out('array') as string[];
  const places = doc.places().out('array') as string[];
  const organizations = doc.organizations().out('array') as string[];
  // Fix: Use proper date extraction in compromise
  const dates = doc.match('#Date').out('array') as string[];
  
  // Custom extraction for concepts/terms (nouns that aren't entities)
  const concepts = doc.match('#Noun').not('#Person').not('#Place').not('#Organization').not('#Date').out('array') as string[];
  
  // Define entity type interface
  interface EntityInfo {
    name: string;
    type: string;
  }
  
  // Deduplicate entities
  const allEntities = [
    ...people.map((name: string) => ({ name, type: 'Person' })),
    ...places.map((name: string) => ({ name, type: 'Place' })),
    ...organizations.map((name: string) => ({ name, type: 'Organization' })),
    ...dates.map((name: string) => ({ name, type: 'Date' })),
    ...concepts.map((name: string) => ({ name, type: 'Concept' }))
  ].filter((entity: EntityInfo, index: number, self: EntityInfo[]) => 
    self.findIndex((e: EntityInfo) => e.name === entity.name) === index
  );
  
  // Current timestamp for data provenance
  const currentTimestamp = new Date().toISOString();
  
  // Create nodes
  const nodes: Node[] = allEntities.map((entity, index) => ({
    id: index + 1,
    name: entity.name,
    group: getEntityGroup(entity.type),
    dataSource: 'spacy',
    timestamp: currentTimestamp
  }));
  
  // Extract relationships
  const links: Link[] = [];
  let relationId = 1;
  
  // Analyze sentences to extract subject-verb-object relationships
  const sentences = doc.sentences().out('array') as string[];
  sentences.forEach((sentence: string) => {
    const sentenceDoc = nlp(sentence);
    
    // Find subject-verb-object patterns
    const subjects = sentenceDoc.match('#Person|#Organization|#Place').out('array') as string[];
    const verbs = sentenceDoc.verbs().out('array') as string[];
    const objects = sentenceDoc.match('#Noun').not('#Person').not('#Organization').not('#Place').out('array') as string[];
    
    // Connect subjects to objects with verbs as relationships
    subjects.forEach((subject: string) => {
      const subjectNode = nodes.find(node => node.name === subject);
      if (!subjectNode) return;
      
      objects.forEach((object: string) => {
        const objectNode = nodes.find(node => node.name === object);
        if (!objectNode) return;
        
        // Use the first verb as the relationship
        if (verbs.length > 0) {
          links.push({
            source: subjectNode.id,
            target: objectNode.id,
            value: 1,
            label: verbs[0],
            dataSource: 'spacy',
            timestamp: currentTimestamp
          });
          relationId++;
        }
      });
    });
  });
  
  // If we didn't extract enough relationships, create proximity-based ones
  if (links.length < nodes.length / 2) {
    // Create relationships based on co-occurrence in sentences
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const sourceEntity = allEntities[i];
        const targetEntity = allEntities[j];
        
        // Check if both entities appear in the same sentence
        const coOccurs = sentences.some((sentence: string) => 
          sentence.includes(sourceEntity.name) && sentence.includes(targetEntity.name)
        );
        
        if (coOccurs) {
          // Create a generic "related to" link
          links.push({
            source: nodes[i].id,
            target: nodes[j].id,
            value: 1,
            label: "related to",
            dataSource: 'spacy',
            timestamp: currentTimestamp
          });
          relationId++;
        }
      }
    }
  }
  
  return { nodes, links };
}
