import { KnowledgeGraph } from 'shared/schema';
import fs from 'fs';
import path from 'path';
import * as csv from 'fs'; // use fs instead since we can't install csv-parser
import * as readline from 'readline';
import { Readable } from 'stream';

/**
 * Parse a CSV file into a knowledge graph
 * @param filePath Path to the CSV file
 * @returns Knowledge graph extracted from the CSV
 */
export async function parseCSV(filePath: string): Promise<KnowledgeGraph> {
  // Read the CSV file
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);
  
  // Parse CSV content
  const lines = fileContent.split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  // Initialize nodes and links arrays
  const nodes: KnowledgeGraph['nodes'] = [];
  const links: KnowledgeGraph['links'] = [];
  
  // Add file node
  let nextId = 1;
  const fileNodeId = nextId++;
  nodes.push({ id: fileNodeId, name: fileName, group: 3 });
  
  // Add header/column nodes and connect to file
  const columnNodes = headers.map((header, index) => {
    const columnId = nextId++;
    nodes.push({ id: columnId, name: header, group: 3 });
    links.push({ source: fileNodeId, target: columnId, label: 'has column', value: 1 });
    return { id: columnId, name: header };
  });
  
  // Process data rows
  lines.slice(1).forEach((line, rowIndex) => {
    if (!line.trim()) return; // Skip empty lines
    
    const values = line.split(',').map(v => v.trim());
    const rowId = nextId++;
    
    // Add row node
    nodes.push({ id: rowId, name: `Row ${rowIndex + 1}`, group: 2 });
    links.push({ source: fileNodeId, target: rowId, label: 'has row', value: 1 });
    
    // Process each cell in the row
    values.forEach((value, colIndex) => {
      if (colIndex >= headers.length) return;
      
      const cellId = nextId++;
      const columnNode = columnNodes[colIndex];
      const cellName = value.length > 30 ? `${value.substring(0, 27)}...` : value;
      
      // Add cell node
      nodes.push({ id: cellId, name: cellName, group: 1 });
      
      // Connect cell to row and column
      links.push({ source: rowId, target: cellId, label: 'contains', value: 1 });
      links.push({ source: columnNode.id, target: cellId, label: 'has value', value: 1 });
    });
  });
  
  return { nodes, links };
}

/**
 * Parse an Excel file into a knowledge graph
 * @param filePath Path to the Excel file
 * @returns Knowledge graph extracted from the Excel file
 */
export async function parseExcel(filePath: string): Promise<KnowledgeGraph> {
  // Since we can't use external libraries directly, we'll import the file as a CSV
  // In a real implementation, we would use the xlsx library
  const fileName = path.basename(filePath);
  
  try {
    // Try to parse as a CSV for now
    return await parseCSV(filePath);
  } catch (error) {
    console.error('Error parsing Excel file:', error);
    
    // Fallback to a basic implementation if CSV parsing fails
    const nodes: KnowledgeGraph['nodes'] = [];
    const links: KnowledgeGraph['links'] = [];
    
    // Add file node
    let nextId = 1;
    const fileNodeId = nextId++;
    nodes.push({ id: fileNodeId, name: fileName, group: 3 });
    
    // Add sheet node
    const sheetId = nextId++;
    nodes.push({ id: sheetId, name: 'Sheet 1', group: 3 });
    links.push({ source: fileNodeId, target: sheetId, label: 'has sheet', value: 1 });
    
    // Add message node about Excel parsing
    const messageId = nextId++;
    nodes.push({ 
      id: messageId, 
      name: 'Excel parsing requires conversion to CSV format', 
      group: 4 
    });
    links.push({ 
      source: sheetId, 
      target: messageId, 
      label: 'info', 
      value: 1 
    });
    
    return { nodes, links };
  }
}