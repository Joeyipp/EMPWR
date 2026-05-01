/**
 * API client for interacting with the backend
 */

/**
 * Generic API request function for interacting with the backend
 * @param url The URL to make the request to
 * @param options Request options like method, headers, data, etc.
 * @returns The response data
 */
export const apiRequest = async (url: string, options: {
  method?: string;
  headers?: Record<string, string>;
  data?: any;
} = {}): Promise<any> => {
  const { method = 'GET', headers = {}, data } = options;
  
  const requestOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    ...(data ? { body: JSON.stringify(data) } : {})
  };
  
  const response = await fetch(url, requestOptions);
  
  // Check content type before trying to parse JSON
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    // If not JSON, try to get the text response for better error messages
    const text = await response.text();
    throw new Error(`Server returned a non-JSON response: ${text.substring(0, 100)}...`);
  }
  
  if (!response.ok) {
    try {
      const error = await response.json();
      throw new Error(error.message || error.error || `Failed with status: ${response.status}`);
    } catch (jsonError) {
      throw new Error(`Failed with status: ${response.status}`);
    }
  }
  
  const responseData = await response.json();
  return responseData.data || responseData;
};

/**
 * Save a knowledge graph to the database
 * @param graph The knowledge graph to save
 * @param name Optional name for the graph
 * @param description Optional description for the graph
 * @returns The saved graph ID and a success message
 */
export const saveGraph = async (graph: any, name?: string, description?: string): Promise<{ graphId: number; message: string }> => {
  const response = await fetch('/api/save-graph', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      graph,
      name,
      description
    }),
  });

  // Check content type before trying to parse JSON
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    // If not JSON, try to get the text response for better error messages
    const text = await response.text();
    throw new Error(`Server returned a non-JSON response: ${text.substring(0, 100)}...`);
  }

  if (!response.ok) {
    try {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save graph');
    } catch (jsonError) {
      throw new Error(`Failed to save graph (Status: ${response.status})`);
    }
  }

  const result = await response.json();
  return result.data;
};

/**
 * Process all sources and generate a knowledge graph
 * @param sources Array of sources to process
 * @returns Generated knowledge graph with analysis and summary
 */
export const processAllSources = async (sources: any[]): Promise<{ graph: any; summary: string; analysis: string }> => {
  const response = await fetch('/api/process-sources', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sources
    }),
  });

  // Check content type before trying to parse JSON
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    // If not JSON, try to get the text response for better error messages
    const text = await response.text();
    throw new Error(`Server returned a non-JSON response: ${text.substring(0, 100)}...`);
  }

  if (!response.ok) {
    try {
      const error = await response.json();
      throw new Error(error.error || 'Failed to process sources');
    } catch (jsonError) {
      throw new Error(`Failed to process sources (Status: ${response.status})`);
    }
  }

  try {
    const data = await response.json();
    return {
      graph: data.data.graph,
      summary: data.data.summary,
      analysis: data.data.analysis || "Analysis not available" // Add analysis content
    };
  } catch (jsonError) {
    throw new Error('Failed to parse response as JSON. The server may have returned invalid data.');
  }
};

/**
 * Create a new OpenAI Assistant for knowledge graph generation
 * @param apiKey OpenAI API key
 * @param name Optional name for the assistant
 * @param instructions Optional instructions for the assistant
 * @returns Assistant and thread IDs
 */
export const createAssistant = async (
  apiKey: string,
  name?: string,
  instructions?: string
): Promise<{ assistantId: string; threadId: string }> => {
  const response = await fetch('/api/assistant/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      apiKey,
      name,
      instructions
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create assistant');
  }

  const data = await response.json();
  return data.data;
};

/**
 * Send a message to an OpenAI Assistant
 * @param apiKey OpenAI API key
 * @param assistantId Assistant ID to message
 * @param threadId Thread ID to use
 * @param message Message content to send
 * @returns Assistant's response message
 */
export const sendMessageToAssistant = async (
  apiKey: string,
  assistantId: string,
  threadId: string,
  message: string
): Promise<{ messageId: string; content: string }> => {
  const response = await fetch('/api/assistant/message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      apiKey,
      assistantId,
      threadId,
      message
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to send message to assistant');
  }

  const data = await response.json();
  return data.data;
};

/**
 * Create an assistant for a specific graph
 * @param graphId ID of the graph
 * @param apiKey OpenAI API key
 * @returns Assistant and thread IDs
 */
export const createGraphAssistant = async (
  graphId: number,
  apiKey: string
): Promise<{ assistantId: string; threadId: string }> => {
  const response = await fetch(`/api/graphs/create-assistant/${graphId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      apiKey
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create graph assistant');
  }

  const data = await response.json();
  return data.data;
};

/**
 * Send a message to a graph assistant
 * @param message Message content to send
 * @param assistantId Assistant ID to message
 * @param threadId Thread ID to use
 * @param apiKey OpenAI API key
 * @returns Assistant's response message
 */
export const sendMessageToGraphAssistant = async (
  message: string,
  assistantId: string,
  threadId: string,
  apiKey: string
): Promise<{ messageId: string; content: string }> => {
  const response = await fetch('/api/graphs/assistant-message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      assistantId,
      threadId,
      apiKey
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to send message to graph assistant');
  }

  const data = await response.json();
  return data.data;
};

/**
 * Process a URL with a specified source system
 * @param url URL to process
 * @param sourceSystem Source system to use (schema, wikidata, dbpedia, general)
 * @returns Extraction result
 */
export const processUrl = async (
  url: string, 
  sourceSystem: string
): Promise<any> => {
  const response = await fetch('/api/extract/url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      sourceSystem
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to process URL');
  }

  const data = await response.json();
  return data.data;
};

/**
 * Get API key status
 * @returns Whether an API key is available
 */
export const getApiKeyStatus = async (): Promise<boolean> => {
  try {
    const response = await fetch('/api/api-keys/status');
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    return data.hasKey;
  } catch (error) {
    console.error('Error checking API key status:', error);
    return false;
  }
};

/**
 * Get all API keys
 * @returns Array of stored API keys
 */
export const getApiKeys = async (): Promise<any[]> => {
  const response = await fetch('/api/api-keys');
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get API keys');
  }
  
  const data = await response.json();
  return data.data;
};

/**
 * Create a new API key
 * @param provider API provider (openai, anthropic, etc.)
 * @param key API key value
 * @param name Optional friendly name
 * @returns Created API key object
 */
export const createApiKey = async (
  provider: string,
  key: string,
  name?: string
): Promise<any> => {
  const response = await fetch('/api/api-keys', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      provider,
      key,
      name
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create API key');
  }
  
  const data = await response.json();
  return data.data;
};

/**
 * Delete an API key
 * @param id ID of the API key to delete
 * @returns Success status
 */
export const deleteApiKey = async (id: number): Promise<boolean> => {
  const response = await fetch(`/api/api-keys/${id}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete API key');
  }
  
  return true;
};