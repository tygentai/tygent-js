/**
 * Nodes module provides the different types of nodes that can be used in a Tygent DAG.
 */

import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';

type NodeType = 'base' | 'llm' | 'tool' | 'memory' | 'input' | 'output';

/**
 * Node constraints interface to set limits on execution
 */
export interface NodeConstraints {
  /** Maximum allowed latency in milliseconds before timing out */
  maxLatency?: number;
  
  /** Maximum number of input tokens allowed */
  maxInputTokens?: number;
  
  /** Maximum number of output tokens allowed */
  maxOutputTokens?: number;
  
  /** Maximum memory usage in MB */
  maxMemoryMB?: number;
  
  /** Maximum number of concurrent executions */
  maxConcurrency?: number;
  
  /** Priority level (higher numbers = higher priority) */
  priority?: number;
  
  /** Resource requirements */
  resources?: {
    /** CPU cores required */
    cpu?: number;
    /** Memory in MB required */
    memory?: number;
    /** GPU memory in MB required */
    gpu?: number;
  };
}

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
  
  /** Execution constraints */
  constraints: NodeConstraints;
  
  /**
   * Initialize a base node.
   * 
   * @param id Unique identifier for the node
   * @param nodeType Type of the node
   * @param inputSchema Expected schema for node inputs
   * @param outputSchema Expected schema for node outputs
   * @param expectedLatency Expected execution time (seconds)
   * @param constraints Execution constraints
   */
  constructor(id: string, nodeType: NodeType, 
              inputSchema?: Record<string, any>, 
              outputSchema?: Record<string, any>,
              expectedLatency?: number,
              constraints?: NodeConstraints) {
    this.id = id;
    this.nodeType = nodeType;
    this.inputSchema = inputSchema;
    this.outputSchema = outputSchema;
    this.expectedLatency = expectedLatency;
    this.constraints = constraints || {};
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
   * Check if execution would violate constraints
   * 
   * @param inputs Input values to check
   * @returns True if constraints are satisfied, false otherwise
   */
  checkConstraints(inputs: Record<string, any>): boolean {
    // Check input size constraints if specified
    if (this.constraints.maxInputTokens) {
      const inputString = JSON.stringify(inputs);
      // Simple approximation: 1 token ≈ 4 characters for English text
      const estimatedTokens = Math.ceil(inputString.length / 4);
      if (estimatedTokens > this.constraints.maxInputTokens) {
        throw new Error(`Input exceeds maximum allowed tokens (${estimatedTokens} > ${this.constraints.maxInputTokens})`);
      }
    }
    
    // Check memory constraints if specified
    if (this.constraints.maxMemoryMB) {
      // This is a simplification - actual memory measurement would vary by environment
      const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
      if (memoryUsage > this.constraints.maxMemoryMB) {
        throw new Error(`Memory usage exceeds maximum allowed (${memoryUsage.toFixed(2)}MB > ${this.constraints.maxMemoryMB}MB)`);
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
      expectedLatency: this.expectedLatency,
      constraints: this.constraints
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
    
    // Check constraint satisfaction
    this.checkConstraints(inputs);
    
    // Format the prompt template with the inputs
    let prompt = this.promptTemplate;
    for (const [key, value] of Object.entries(inputs)) {
      const placeholder = `{${key}}`;
      if (prompt.includes(placeholder)) {
        prompt = prompt.replace(placeholder, String(value));
      }
    }
    
    // Apply latency constraint with Promise.race if specified
    const executionPromise = this._executeWithClient(prompt);
    
    if (this.constraints.maxLatency) {
      const timeoutPromise = new Promise<Record<string, any>>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`LLM execution timed out after ${this.constraints.maxLatency}ms`));
        }, this.constraints.maxLatency);
      });
      
      return Promise.race([executionPromise, timeoutPromise]);
    }
    
    return executionPromise;
  }
  
  /**
   * Execute the actual LLM call with the OpenAI client
   * 
   * @param prompt The formatted prompt to send
   * @returns Response from the LLM
   */
  private async _executeWithClient(prompt: string): Promise<Record<string, any>> {
    // Use the OpenAI client if available
    if (this.openaiClient) {
      try {
        // Apply token constraints to request
        const maxTokens = this.constraints.maxOutputTokens || this.maxTokens;
        
        const completion = await this.openaiClient.chat.completions.create({
          model: this.model,
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: prompt }
          ],
          temperature: this.temperature,
          max_tokens: maxTokens,
        });
        
        const response = completion.choices[0].message.content || '';
        
        // Check if response exceeds constraints (as a safeguard)
        if (this.constraints.maxOutputTokens) {
          // Simple approximation: 1 token ≈ 4 characters for English text
          const estimatedTokens = Math.ceil(response.length / 4);
          if (estimatedTokens > this.constraints.maxOutputTokens) {
            return { 
              response: response.substring(0, this.constraints.maxOutputTokens * 4),
              warning: `Response truncated to fit token limit (${this.constraints.maxOutputTokens})`
            };
          }
        }
        
        return { response };
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
    
    // Check constraint satisfaction
    this.checkConstraints(inputs);
    
    // Apply latency constraint with Promise.race if specified
    const executionPromise = this._executeWithTimeout(inputs);
    
    if (this.constraints.maxLatency) {
      const timeoutPromise = new Promise<Record<string, any>>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Tool execution timed out after ${this.constraints.maxLatency}ms`));
        }, this.constraints.maxLatency);
      });
      
      return Promise.race([executionPromise, timeoutPromise]);
    }
    
    return executionPromise;
  }
  
  /**
   * Execute the tool function with input constraints
   * 
   * @param inputs Input values for the tool
   * @returns Output from the tool execution
   */
  private async _executeWithTimeout(inputs: Record<string, any>): Promise<Record<string, any>> {
    try {
      // Track resource usage if specified
      let resourceUsage: any = null;
      if (this.constraints.resources) {
        // Simple heap memory usage tracking as example
        resourceUsage = process.memoryUsage();
      }
      
      // Call the tool function with the inputs
      const result = await this.toolFn(inputs);
      
      // If resource tracking is enabled, compare after execution
      if (resourceUsage && this.constraints.resources?.memory) {
        const afterUsage = process.memoryUsage();
        const memoryDelta = (afterUsage.heapUsed - resourceUsage.heapUsed) / (1024 * 1024);
        
        if (memoryDelta > this.constraints.resources.memory) {
          console.warn(`Tool ${this.id} exceeded memory usage constraint: ${memoryDelta.toFixed(2)}MB > ${this.constraints.resources.memory}MB`);
        }
      }
      
      // Check output size constraints if specified
      if (this.constraints.maxOutputTokens && result) {
        const outputStr = typeof result === 'object' ? JSON.stringify(result) : String(result);
        // Simple approximation: 1 token ≈ 4 characters for English text
        const estimatedTokens = Math.ceil(outputStr.length / 4);
        
        if (estimatedTokens > this.constraints.maxOutputTokens) {
          // For object results, we can't easily truncate, so we return a warning
          if (typeof result === 'object') {
            return { 
              ...result,
              warning: `Result exceeds max output tokens (${estimatedTokens} > ${this.constraints.maxOutputTokens})`
            };
          }
          // For string results, we can truncate
          const truncated = outputStr.substring(0, this.constraints.maxOutputTokens * 4);
          return { 
            result: truncated,
            warning: `Result truncated to fit token limit (${this.constraints.maxOutputTokens})`
          };
        }
      }
      
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