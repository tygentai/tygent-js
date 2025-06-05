/**
 * Base node classes for Tygent.
 */

// Import type definitions we need
import { DAG } from './dag';

/**
 * Base node class for execution in the DAG.
 */
export class Node {
  name: string;
  dependencies: string[] = [];
  
  /**
   * Initialize a node.
   * 
   * @param name - The name of the node
   */
  constructor(name: string) {
    this.name = name;
  }
  
  /**
   * Set the dependencies of this node.
   * 
   * @param dependencies - List of node names this node depends on
   */
  setDependencies(dependencies: string[]): void {
    this.dependencies = dependencies;
  }
  
  /**
   * Execute the node with the given inputs.
   * 
   * @param inputs - Dictionary of input values
   * @returns The result of the node execution
   */
  async execute(inputs: Record<string, any>): Promise<any> {
    throw new Error("Subclasses must implement execute()");
  }
}

/**
 * Base class for LLM nodes.
 */
export class LLMNode extends Node {
  protected model: any;
  promptTemplate: string = "";
  
  /**
   * Initialize an LLM node.
   * 
   * @param name - The name of the node
   * @param model - LLM model instance
   * @param promptTemplate - Template string for the prompt
   */
  constructor(
    name: string, 
    model?: any,
    promptTemplate: string = ""
  ) {
    super(name);
    this.model = model;
    this.promptTemplate = promptTemplate;
  }

  /**
   * Get the model instance.
   */
  getModel(): any {
    return this.model;
  }

  /**
   * Get the prompt template.
   */
  getPromptTemplate(): string {
    return this.promptTemplate;
  }
}

/**
 * Memory node for storing and retrieving information.
 */
export class MemoryNode extends Node {
  private memory: Record<string, any> = {};
  
  /**
   * Initialize a memory node.
   * 
   * @param name - The name of the memory node
   */
  constructor(name: string) {
    super(name);
  }
  
  /**
   * Store information in memory.
   * 
   * @param key - The key to store the information under
   * @param value - The value to store
   */
  store(key: string, value: any): void {
    this.memory[key] = value;
  }
  
  /**
   * Retrieve information from memory.
   * 
   * @param key - The key to retrieve
   * @returns The stored value, or undefined if not found
   */
  retrieve(key: string): any {
    return this.memory[key];
  }
  
  /**
   * Clear all stored memory.
   */
  clear(): void {
    this.memory = {};
  }
  
  /**
   * Execute the memory node.
   * This implementation passes through inputs as outputs.
   * 
   * @param inputs - Dictionary of input values
   * @returns The inputs as outputs
   */
  async execute(inputs: Record<string, any>): Promise<any> {
    return inputs;
  }
}

/**
 * Tool node for executing functions.
 */
export class ToolNode extends Node {
  private func: (inputs: Record<string, any>) => Promise<any> | any;
  public id: string; // Add id property required by agent.ts
  public nodeType: string = 'tool'; // Add nodeType property required by agent.ts
  
  /**
   * Initialize a tool node.
   * 
   * @param name - The name of the node
   * @param func - The function to execute
   */
  constructor(
    name: string,
    func: (inputs: Record<string, any>) => Promise<any> | any
  ) {
    super(name);
    this.func = func;
    this.id = name; // Set id to be the same as name for compatibility
  }
  
  /**
   * Execute the tool node with the given inputs.
   * 
   * @param inputs - Dictionary of input values
   * @returns The result of the function execution
   */
  async execute(inputs: Record<string, any>): Promise<any> {
    try {
      const result = this.func(inputs);
      
      // Handle both synchronous and asynchronous functions
      if (result instanceof Promise) {
        return await result;
      }
      
      return result;
    } catch (error) {
      console.error(`Error executing tool ${this.name}:`, error);
      throw error;
    }
  }
}