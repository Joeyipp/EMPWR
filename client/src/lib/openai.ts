import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const DEFAULT_MODEL = "gpt-4o";

/**
 * Initialize the OpenAI client with the provided API key
 * @param apiKey OpenAI API key
 * @returns OpenAI client instance
 */
export const initializeOpenAI = (apiKey: string) => {
  return new OpenAI({ apiKey });
};

/**
 * Create a new OpenAI Assistant for knowledge graph generation
 * @param apiKey OpenAI API key
 * @param name Optional name for the assistant
 * @param instructions Optional instructions for the assistant
 * @returns Assistant ID and thread ID
 */
export const createAssistant = async (
  apiKey: string,
  name?: string,
  instructions?: string
): Promise<{ assistantId: string; threadId: string }> => {
  try {
    const openai = initializeOpenAI(apiKey);
    
    // Create the assistant
    const assistant = await openai.beta.assistants.create({
      name: name || "Knowledge Graph Assistant",
      instructions: instructions || "You are a knowledgeable assistant that helps users understand and build knowledge graphs.",
      model: DEFAULT_MODEL,
      tools: [{
        type: "function",
        function: {
          name: "extract_knowledge_graph",
          description: "Extract entities and relationships from text to create a knowledge graph",
          parameters: {
            type: "object",
            properties: {
              nodes: {
                type: "array",
                description: "List of entities extracted from the text",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Name of the entity" },
                    type: { type: "string", description: "Type of the entity (person, organization, location, concept, etc.)" },
                    group: { type: "integer", description: "Group number for categorizing the entity (1-5)" }
                  },
                  required: ["name"]
                }
              },
              links: {
                type: "array",
                description: "List of relationships between entities",
                items: {
                  type: "object",
                  properties: {
                    source: { type: "integer", description: "Index of the source entity in the nodes array (0-based)" },
                    target: { type: "integer", description: "Index of the target entity in the nodes array (0-based)" },
                    relationship: { type: "string", description: "Description of the relationship between entities" }
                  },
                  required: ["source", "target"]
                }
              }
            },
            required: ["nodes", "links"]
          }
        }
      }]
    });
    
    // Create a thread
    const thread = await openai.beta.threads.create();
    
    return {
      assistantId: assistant.id,
      threadId: thread.id
    };
  } catch (error) {
    console.error("Error creating assistant:", error);
    throw error;
  }
};

/**
 * Send a message to an OpenAI Assistant and get the response
 * @param apiKey OpenAI API key
 * @param assistantId ID of the assistant to message
 * @param threadId ID of the thread to use
 * @param message Message content to send
 * @returns The assistant's response message
 */
export const sendMessageToAssistant = async (
  apiKey: string,
  assistantId: string,
  threadId: string,
  message: string
): Promise<{
  messageId: string;
  content: string;
  toolCalls?: any[];
}> => {
  try {
    const openai = initializeOpenAI(apiKey);
    
    // Add the user message to the thread
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: message
    });
    
    // Run the assistant
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId
    });
    
    // Poll for completion
    let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    
    // Wait for the run to complete with a timeout
    const startTime = Date.now();
    const TIMEOUT_MS = 60000; // 60 second timeout for complex analyses
    
    while (runStatus.status !== "completed" && runStatus.status !== "failed" && 
           runStatus.status !== "cancelled" && runStatus.status !== "expired") {
      // Check for timeout
      if (Date.now() - startTime > TIMEOUT_MS) {
        throw new Error("Request timed out waiting for assistant response");
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    }
    
    // Check if the run completed successfully
    if (runStatus.status !== "completed") {
      throw new Error(`Assistant run ${runStatus.status}: ${runStatus.last_error?.message || "Unknown error"}`);
    }
    
    // Get the assistant's messages
    const messages = await openai.beta.threads.messages.list(threadId);
    
    // Find the last assistant message
    const assistantMessages = messages.data.filter(msg => msg.role === "assistant");
    if (assistantMessages.length === 0) {
      throw new Error("No assistant response found");
    }
    
    const lastMessage = assistantMessages[0];
    let messageContent = '';
    let toolCalls = undefined;
    
    // Extract the message content and any tool calls
    if (lastMessage.content && lastMessage.content.length > 0) {
      const contentBlock = lastMessage.content[0];
      if (contentBlock.type === 'text') {
        messageContent = contentBlock.text.value;
      }
    }
    
    // Check for tool calls (function calls)
    if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
      toolCalls = lastMessage.tool_calls;
    }
    
    return {
      messageId: lastMessage.id,
      content: messageContent,
      toolCalls
    };
  } catch (error) {
    console.error("Error sending message to assistant:", error);
    throw error;
  }
};

/**
 * Extract knowledge graph from text using OpenAI
 * @param apiKey OpenAI API key
 * @param text Text to analyze
 * @returns Extracted knowledge graph data
 */
export const extractKnowledgeGraph = async (
  apiKey: string,
  text: string
): Promise<{
  nodes: Array<{
    name: string;
    type?: string;
    group?: number;
  }>;
  links: Array<{
    source: number;
    target: number;
    relationship?: string;
  }>;
}> => {
  try {
    const openai = initializeOpenAI(apiKey);
    
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content: "Extract entities and relationships from the following text to create a knowledge graph. Identify key entities (people, organizations, locations, concepts) and the relationships between them."
        },
        {
          role: "user",
          content: text
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });
    
    const content = response.choices[0].message.content;
    
    if (!content) {
      throw new Error("No content in response");
    }
    
    const result = JSON.parse(content);
    
    // Ensure the result has the expected structure
    if (!result.nodes || !result.links) {
      throw new Error("Response does not contain valid knowledge graph data");
    }
    
    return result;
  } catch (error) {
    console.error("Error extracting knowledge graph:", error);
    throw error;
  }
};

/**
 * Analyze an image using OpenAI's Vision capabilities
 * @param apiKey OpenAI API key
 * @param base64Image Base64-encoded image data
 * @returns Analysis of the image
 */
export const analyzeImage = async (
  apiKey: string,
  base64Image: string
): Promise<string> => {
  try {
    const openai = initializeOpenAI(apiKey);
    
    const visionResponse = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this image in detail and describe its key elements, context, and any notable aspects."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ],
        },
      ],
      max_tokens: 500,
    });
    
    return visionResponse.choices[0].message.content || "No analysis provided";
  } catch (error) {
    console.error("Error analyzing image:", error);
    throw error;
  }
};

/**
 * Generate an image using DALL-E
 * @param apiKey OpenAI API key
 * @param prompt Description of the image to generate
 * @returns URL of the generated image
 */
export const generateImage = async (
  apiKey: string,
  prompt: string
): Promise<{ url: string }> => {
  try {
    const openai = initializeOpenAI(apiKey);
    
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });
    
    return { url: response.data[0].url || "" };
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
};