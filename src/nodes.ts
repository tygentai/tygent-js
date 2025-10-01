/**
 * Base node classes for Tygent.
 */

export type LatencyModel<T extends Node = Node> = (node: T) => number;

export const DEFAULT_LLM_LATENCY_MODEL: LatencyModel<LLMNode> = (node) => {
  const cost = typeof node.tokenCost === 'number' ? node.tokenCost : 0;
  return 500 + cost * 10;
};

export const DEFAULT_TOOL_LATENCY_MODEL: LatencyModel<ToolNode> = () => 100;

export interface NodeMetadata {
  [key: string]: any;
}

/**
 * Base node class for execution in the DAG.
 */
export class Node {
  name: string;
  dependencies: string[] = [];
  tokenCost: number;
  latency: number;
  protected latencyModel?: LatencyModel<Node>;
  metadata: NodeMetadata;

  /**
   * Initialize a node.
   */
  constructor(
    name: string,
    tokenCost: number = 0,
    latency: number = 0,
    latencyModel?: LatencyModel<Node>,
    metadata: NodeMetadata = {}
  ) {
    this.name = name;
    this.tokenCost = tokenCost;
    this.latency = latency;
    this.latencyModel = latencyModel;
    this.metadata = { ...metadata };
  }

  /** Update dependencies for this node. */
  setDependencies(dependencies: string[]): void {
    this.dependencies = [...dependencies];
  }

  /** Replace the latency model. */
  setLatencyModel(model?: LatencyModel<Node>): void {
    this.latencyModel = model;
  }

  /** Update the static latency value in milliseconds. */
  setLatency(latency: number): void {
    this.latency = latency;
  }

  /** Merge metadata onto the node. */
  setMetadata(metadata: NodeMetadata): void {
    this.metadata = { ...metadata };
  }

  /** Get estimated token cost. */
  getTokenCost(): number {
    return this.tokenCost;
  }

  /** Get estimated latency in milliseconds. */
  getLatency(): number {
    if (this.latencyModel) {
      try {
        const value = this.latencyModel(this);
        if (typeof value === 'number' && !Number.isNaN(value)) {
          return value;
        }
      } catch (error) {
        // Ignore model failures and fall back to static latency.
      }
    }
    return this.latency;
  }

  /** Retrieve a metadata value. */
  getMetadata<T = any>(key: string): T | undefined {
    return this.metadata[key] as T | undefined;
  }

  /** Execute the node with the given inputs. */
  async execute(_inputs: Record<string, any>): Promise<any> {
    throw new Error('Subclasses must implement execute()');
  }

  /** Create a shallow clone of this node. */
  clone<T extends Node = Node>(): T {
    const cloned: T = Object.create(Object.getPrototypeOf(this));
    Object.assign(cloned, this);
    cloned.dependencies = [...this.dependencies];
    cloned.metadata = { ...this.metadata };
    return cloned;
  }
}

/**
 * Base class for LLM nodes.
 */
export class LLMNode extends Node {
  protected model: any;
  promptTemplate: string = '';

  constructor(
    name: string,
    model?: any,
    promptTemplate: string = '',
    tokenCost: number = 0,
    latency: number = 0,
    latencyModel: LatencyModel<LLMNode> = DEFAULT_LLM_LATENCY_MODEL,
    metadata: NodeMetadata = {}
  ) {
    super(name, tokenCost, latency, latencyModel as LatencyModel<Node>, metadata);
    this.model = model;
    this.promptTemplate = promptTemplate;
  }

  getModel(): any {
    return this.model;
  }

  getPromptTemplate(): string {
    return this.promptTemplate;
  }

  setPromptTemplate(template: string): void {
    this.promptTemplate = template;
  }

  formatPrompt(
    inputs: Record<string, any>,
    nodeOutputs: Record<string, any> = {}
  ): string {
    const variables = { ...inputs, ...nodeOutputs };
    try {
      return this.promptTemplate.replace(/\{([^}]+)\}/g, (_match, key) => {
        const value = variables[key];
        return value !== undefined ? String(value) : `[missing:${key}]`;
      });
    } catch (error) {
      return this.promptTemplate;
    }
  }
}

/**
 * Memory node for storing and retrieving information.
 */
export class MemoryNode extends Node {
  private memory: Record<string, any> = {};

  constructor(
    name: string,
    tokenCost: number = 0,
    latency: number = 0,
    metadata: NodeMetadata = {}
  ) {
    super(name, tokenCost, latency, undefined, metadata);
  }

  store(key: string, value: any): void {
    this.memory[key] = value;
  }

  retrieve<T = any>(key: string): T | undefined {
    return this.memory[key] as T | undefined;
  }

  clear(): void {
    this.memory = {};
  }

  async execute(inputs: Record<string, any>): Promise<any> {
    Object.entries(inputs).forEach(([key, value]) => {
      this.store(key, value);
    });
    return { ...inputs };
  }
}

/**
 * Tool node for executing functions.
 */
export class ToolNode extends Node {
  private func: (inputs: Record<string, any>) => Promise<any> | any;
  public id: string;
  public nodeType: string = 'tool';

  constructor(
    name: string,
    func: (inputs: Record<string, any>) => Promise<any> | any,
    tokenCost: number = 0,
    latency: number = 0,
    latencyModel: LatencyModel<ToolNode> = DEFAULT_TOOL_LATENCY_MODEL,
    metadata: NodeMetadata = {}
  ) {
    super(name, tokenCost, latency, latencyModel as LatencyModel<Node>, metadata);
    this.func = func;
    this.id = name;
  }

  getFunction(): (inputs: Record<string, any>) => Promise<any> | any {
    return this.func;
  }

  async execute(inputs: Record<string, any>): Promise<any> {
    try {
      const result = this.func(inputs);
      return await Promise.resolve(result);
    } catch (error) {
      console.error(`Error executing tool ${this.name}:`, error);
      throw error;
    }
  }
}
