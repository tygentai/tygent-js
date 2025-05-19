/**
 * Nodes module provides the different types of nodes that can be used in a Tygent DAG.
 */

import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';

type NodeType = 'base' | 'llm' | 'tool' | 'memory' | 'input' | 'output';

/**
 * Base class for all node types in the Tygent system.
 */
export abstract class BaseNode {
  /** Unique identifier for the node */
  id: string;
  
  /** Type of the node */
  nodeType: NodeType;
  
  /** Expected schema for node inputs */
  inputSchema?: Record<string, any>;
  
  /** Expected schema for node outputs */
  outputSchema?: Record<string, any>;
  
  /** Expected execution time (seconds) */
  expectedLatency?: number;
  
  /**
   * Initialize a base node.
   * 
   * @param id Unique identifier for the node
   * @param nodeType Type of the node
   * @param inputSchema Expected schema for node inputs
   * @param outputSchema Expected schema for node outputs
   * @param expectedLatency Expected execution time (seconds)
   */
  constructor(id: string, nodeType: NodeType, 
              inputSchema?: Record<string, any>, 
              outputSchema?: Record<string, any>,
              expectedLatency?: number) {
    this.id = id;
    this.nodeType = nodeType;
    this.inputSchema = inputSchema;
    this.outputSchema = outputSchema;
    this.expectedLatency = expectedLatency;
  }
  
  /**
   * Execute the node functionality.
   * 
   * @param inputs Input values for the node
   * @returns Output values from the node execution
   */
  abstract execute(inputs: Record<string, any>): Promise<Record<string, any>>;
  
  /**
   * Validate input values against the schema.
   * 
   * @param inputs Input values to validate
   * @returns True if inputs are valid, throws exception otherwise
   */
  validateInputs(inputs: Record<string, any>): boolean {
    if (!this.inputSchema) {
      return true;
    }
    
    for (const [key, expectedType] of Object.entries(this.inputSchema)) {
      if (!(key in inputs)) {
        throw new Error(`Required input '${key}' not provided`);
      }
      
      // Basic type checking - should be enhanced with proper schema validation
      if (typeof inputs[key] !== expectedType) {
        throw new TypeError(`Input '${key}' has type ${typeof inputs[key]}, expected ${expectedType}`);
      }
    }
    
    return true;
  }
  
  /**
   * Convert the node to an object representation.
   * 
   * @returns An object representing the node
   */
  toObject(): Record<string, any> {
    return {
      id: this.id,
      type: this.nodeType,
      expectedLatency: this.expectedLatency
    };
  }
}

/**
 * Node that represents an LLM call in the workflow.
 */
export class LLMNode extends BaseNode {
  /** The LLM model to use */
  model: string;
  
  /** The template for constructing prompts */
  promptTemplate: string;
  
  /** Sampling temperature for the LLM */
  temperature: number;
  
  /** Maximum tokens to generate */
  maxTokens?: number;
  
  /** OpenAI client instance */
  private openaiClient?: OpenAI;
  
  /**
   * Initialize an LLM node.
   * 
   * @param id Unique identifier for the node
   * @param model The LLM model to use
   * @param promptTemplate The template for constructing prompts
   * @param inputSchema Expected schema for node inputs
   * @param outputSchema Expected schema for node outputs
   * @param expectedLatency Expected execution time (seconds)
   * @param temperature Sampling temperature for the LLM
   * @param maxTokens Maximum tokens to generate
   */
  constructor(id: string, model: string, promptTemplate: string,
              inputSchema?: Record<string, any>,
              outputSchema?: Record<string, any>,
              expectedLatency?: number,
              temperature: number = 0.7,
              maxTokens?: number) {
    super(id, 'llm', inputSchema, outputSchema, expectedLatency);
    this.model = model;
    this.promptTemplate = promptTemplate;
    this.temperature = temperature;
    this.maxTokens = maxTokens;
    
    // Initialize OpenAI client if API key is available
    if (process.env.OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }
  
  /**
   * Execute an LLM call.
   * 
   * @param inputs Input values for the LLM
   * @returns Output from the LLM
   */
  async execute(inputs: Record<string, any>): Promise<Record<string, any>> {
    this.validateInputs(inputs);
    
    // Format the prompt template with the inputs
    let prompt = this.promptTemplate;
    for (const [key, value] of Object.entries(inputs)) {
      const placeholder = `{${key}}`;
      if (prompt.includes(placeholder)) {
        prompt = prompt.replace(placeholder, String(value));
      }
    }
    
    // Use the OpenAI client if available
    if (this.openaiClient) {
      try {
        const completion = await this.openaiClient.chat.completions.create({
          model: this.model,
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: prompt }
          ],
          temperature: this.temperature,
          max_tokens: this.maxTokens,
        });
        
        return { response: completion.choices[0].message.content || '' };
      } catch (error: any) {
        return { error: `Error calling OpenAI API: ${error.message || 'Unknown error'}` };
      }
    }
    
    // Simulate a response for testing purposes
    return { response: `Simulated LLM response to prompt: ${prompt.substring(0, 50)}...` };
  }
  
  /**
   * Convert LLM node to object representation.
   * 
   * @returns An object representing the LLM node
   */
  toObject(): Record<string, any> {
    const baseObject = super.toObject();
    return {
      ...baseObject,
      model: this.model,
      temperature: this.temperature,
      maxTokens: this.maxTokens
    };
  }
}

/**
 * Node that represents a tool or function call in the workflow.
 */
export class ToolNode extends BaseNode {
  /** The function to execute */
  toolFn: Function;
  
  /**
   * Initialize a tool node.
   * 
   * @param id Unique identifier for the node
   * @param toolFn The function to execute
   * @param inputSchema Expected schema for node inputs
   * @param outputSchema Expected schema for node outputs
   * @param expectedLatency Expected execution time (seconds)
   */
  constructor(id: string, toolFn: Function, 
              inputSchema?: Record<string, any>,
              outputSchema?: Record<string, any>,
              expectedLatency?: number) {
    super(id, 'tool', inputSchema, outputSchema, expectedLatency);
    this.toolFn = toolFn;
  }
  
  /**
   * Execute the tool function.
   * 
   * @param inputs Input values for the tool
   * @returns Output from the tool execution
   */
  async execute(inputs: Record<string, any>): Promise<Record<string, any>> {
    this.validateInputs(inputs);
    
    try {
      // Call the tool function with the inputs
      const result = await this.toolFn(inputs);
      
      // If the result is already a dict, return it
      if (result !== null && typeof result === 'object') {
        return result;
      }
      
      // If it's a simple value, wrap it
      return { result };
    } catch (error: any) {
      return { error: error.message || 'Unknown error in tool execution' };
    }
  }
  
  /**
   * Convert tool node to object representation.
   * 
   * @returns An object representing the tool node
   */
  toObject(): Record<string, any> {
    const baseObject = super.toObject();
    return {
      ...baseObject,
      functionName: this.toolFn.name || 'anonymous'
    };
  }
}

/**
 * Node that represents a memory operation in the workflow.
 */
export class MemoryNode extends BaseNode {
  /** In-memory storage */
  private memory: Record<string, any>;
  
  /**
   * Initialize a memory node.
   * 
   * @param id Unique identifier for the node
   * @param inputSchema Expected schema for node inputs
   * @param outputSchema Expected schema for node outputs
   * @param expectedLatency Expected execution time (seconds)
   */
  constructor(id: string, 
              inputSchema?: Record<string, any>,
              outputSchema?: Record<string, any>,
              expectedLatency: number = 0.1) {
    super(id, 'memory', inputSchema, outputSchema, expectedLatency);
    this.memory = {};
  }
  
  /**
   * Execute a memory operation.
   * 
   * @param inputs Input values for the memory operation
   * @returns Current state of the memory
   */
  async execute(inputs: Record<string, any>): Promise<Record<string, any>> {
    this.validateInputs(inputs);
    
    // Special operations for memory
    const operation = inputs.operation || 'store';
    
    if (operation === 'store') {
      // Store key-value pairs
      for (const [key, value] of Object.entries(inputs)) {
        if (key !== 'operation') {
          this.memory[key] = value;
        }
      }
    } else if (operation === 'retrieve') {
      // Retrieve specific keys
      const result: Record<string, any> = {};
      const keys = inputs.keys || Object.keys(this.memory);
      for (const key of keys) {
        if (key in this.memory) {
          result[key] = this.memory[key];
        }
      }
      return result;
    } else if (operation === 'clear') {
      // Clear specific keys or all memory
      const keys = inputs.keys || Object.keys(this.memory);
      for (const key of keys) {
        if (key in this.memory) {
          delete this.memory[key];
        }
      }
    }
    
    // Return the current state of memory
    return { ...this.memory };
  }
  
  /**
   * Convert memory node to object representation.
   * 
   * @returns An object representing the memory node
   */
  toObject(): Record<string, any> {
    const baseObject = super.toObject();
    return {
      ...baseObject,
      memorySize: Object.keys(this.memory).length
    };
  }
}