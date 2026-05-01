import { MergeAlgorithmTypeValue } from '@shared/schema';

// Simple approach: Setup caching for API keys that gets updated on server start
let OPENAI_API_KEY: string | undefined;
let MISTRAL_API_KEY: string | undefined;

// This method should be called at server startup to load keys
export function loadApiKeysFromEnvironment() {
  OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
  console.log(`API Keys loaded from environment. OpenAI: ${OPENAI_API_KEY ? 'Found' : 'Not found'}, Mistral: ${MISTRAL_API_KEY ? 'Found' : 'Not found'}`);
}

// Method to manually update keys - can be called from routes that update keys
export function updateApiKey(provider: string, key: string | undefined) {
  if (provider === 'openai') {
    OPENAI_API_KEY = key;
  } else if (provider === 'mistral') {
    MISTRAL_API_KEY = key;
  }
}

/**
 * Checks if the required API key for an algorithm is available
 * @param algorithm The merge algorithm type
 * @returns Object with success status and message if error
 */
export function checkAlgorithmApiKey(algorithm: MergeAlgorithmTypeValue): {
  success: boolean;
  message?: string;
} {
  if (algorithm === 'openai') {
    if (!OPENAI_API_KEY) {
      return {
        success: false,
        message: "OpenAI API key is required for the OpenAI entity resolution algorithm"
      };
    }
  } else if (algorithm === 'mistral') {
    if (!MISTRAL_API_KEY) {
      return {
        success: false,
        message: "Mistral API key is required for the Mistral entity resolution algorithm"
      };
    }
  }
  
  // All checks passed or no checks needed
  return { success: true };
}

/**
 * Gets the appropriate API key for an algorithm if needed
 * @param algorithm The merge algorithm type or model name
 * @returns The API key if needed, undefined otherwise
 */
export function getApiKeyForAlgorithm(algorithm: string): string | undefined {
  // Handle specific model names and map them to providers
  if (algorithm === 'openai' || algorithm.startsWith('gpt-') || algorithm === 'gpt-4o' || algorithm === 'gpt-4' || algorithm === 'gpt-3.5-turbo') {
    return OPENAI_API_KEY;
  } else if (algorithm === 'mistral' || algorithm.startsWith('mistral-') || algorithm === 'mistral-large' || algorithm === 'mistral-medium') {
    return MISTRAL_API_KEY;
  }
  
  return undefined;
}