import { KnowledgeGraph } from 'shared/schema';
import fs from 'fs';
import path from 'path';

/**
 * A simple triple in RDF format
 */
interface RDFTriple {
  subject: string;
  predicate: string;
  object: string;
}

/**
 * Parse an RDF file into a knowledge graph
 * @param filePath Path to the RDF file
 * @returns Knowledge graph extracted from the RDF file
 */
export async function parseRDF(filePath: string): Promise<KnowledgeGraph> {
  const fileName = path.basename(filePath);
  const fileContent = fs.readFileSync(filePath, 'utf8');
  
  // This is a simplified RDF parser that handles the basic Turtle format
  // A full implementation would use a proper RDF parser library
  const triples: RDFTriple[] = [];
  
  try {
    // Very basic RDF/Turtle parser for common cases
    // Look for lines in format: <subject> <predicate> <object> .
    const lines = fileContent.split('\n');
    
    let currentSubject = '';
    
    lines.forEach(line => {
      line = line.trim();
      
      // Skip comments and empty lines
      if (line.startsWith('#') || !line) return;
      
      // Check if this is a triple definition
      if (line.includes(' ')) {
        const parts = line.split(' ').filter(p => p.trim() && p !== '.');
        
        // Handle basic triple pattern: subject predicate object .
        if (parts.length >= 3) {
          let subject = parts[0];
          
          // If shorthand notation is used with semicolons
          if (subject === ';') {
            subject = currentSubject;
          } else {
            // Update current subject for shorthand notation
            currentSubject = subject;
          }
          
          // Clean up URI brackets if present
          subject = subject.replace(/[<>]/g, '');
          const predicate = parts[1].replace(/[<>]/g, '');
          const object = parts.slice(2).join(' ').replace(/[<>]/g, '').replace(/\s*\.$/, '');
          
          triples.push({ subject, predicate, object });
        }
      }
    });
  } catch (error) {
    console.error('Error parsing RDF:', error);
  }
  
  // If no triples were found, provide some fallback 
  if (triples.length === 0) {
    // Extract any URIs from the file content for a basic representation
    const uriPattern = /<(https?:\/\/[^>]+)>/g;
    const uris: string[] = [];
    let match;
    
    while ((match = uriPattern.exec(fileContent)) !== null) {
      uris.push(match[1]);
    }
    
    // Create basic triples from URIs if found
    if (uris.length > 0) {
      uris.forEach((uri, index) => {
        if (index < uris.length - 1) {
          triples.push({
            subject: uri,
            predicate: 'related_to',
            object: uris[index + 1]
          });
        }
      });
    }
  }
  
  // Convert triples to graph
  const nodes: KnowledgeGraph['nodes'] = [];
  const links: KnowledgeGraph['links'] = [];
  const nodeMap = new Map<string, number>();
  
  // Add file node
  let nextId = 1;
  const fileNodeId = nextId++;
  nodes.push({ id: fileNodeId, name: fileName, group: 3 });
  
  // Add rdf nodes and connections
  triples.forEach(triple => {
    // Get or create subject node
    let subjectId: number;
    if (nodeMap.has(triple.subject)) {
      subjectId = nodeMap.get(triple.subject)!;
    } else {
      subjectId = nextId++;
      nodeMap.set(triple.subject, subjectId);
      
      // Use the last part of the URI as a more readable name
      const subjectName = triple.subject.split(/[/#]/).pop() || triple.subject;
      nodes.push({ 
        id: subjectId, 
        name: subjectName.length > 30 ? `${subjectName.substring(0, 27)}...` : subjectName, 
        group: 1 
      });
    }
    
    // Get or create object node
    let objectId: number;
    if (nodeMap.has(triple.object)) {
      objectId = nodeMap.get(triple.object)!;
    } else {
      objectId = nextId++;
      nodeMap.set(triple.object, objectId);
      
      // Use the last part of the URI as a more readable name
      const objectName = triple.object.split(/[/#]/).pop() || triple.object;
      nodes.push({ 
        id: objectId, 
        name: objectName.length > 30 ? `${objectName.substring(0, 27)}...` : objectName, 
        group: 2 
      });
    }
    
    // Create the link
    // Use the last part of the predicate as a more readable name
    const predicateName = triple.predicate.split(/[/#]/).pop() || triple.predicate;
    links.push({ 
      source: subjectId, 
      target: objectId, 
      label: predicateName.length > 20 ? `${predicateName.substring(0, 17)}...` : predicateName, 
      value: 1 
    });
    
    // Also link to file node for context
    if (!links.some(l => l.source === fileNodeId && l.target === subjectId)) {
      links.push({ source: fileNodeId, target: subjectId, label: 'contains', value: 1 });
    }
  });
  
  // If no triples were found, show a message
  if (nodes.length <= 1) {
    const messageId = nextId++;
    nodes.push({ 
      id: messageId, 
      name: 'No valid RDF triples found in file', 
      group: 4 
    });
    links.push({ 
      source: fileNodeId, 
      target: messageId, 
      label: 'info', 
      value: 1 
    });
  }
  
  return { nodes, links };
}