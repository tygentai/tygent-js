/**
 * DAG Scheduler for optimized execution of nodes.
 */
import { DAG } from './dag';
import { Node } from './nodes';

/**
 * Scheduler options for execution control.
 */
export interface SchedulerOptions {
  maxParallelNodes?: number;
  maxExecutionTime?: number;
  priorityNodes?: string[];
  tokenBudget?: number;
  rateLimitPerSecond?: number;
  latencyModel?: Record<string, number>;
}

/**
 * Scheduler for DAG execution with optimization capabilities.
 */
export class Scheduler {
  dag: DAG;
  maxParallelNodes: number = 4;
  maxExecutionTime: number = 30000; // 30 seconds
  priorityNodes: string[] = [];
  tokenBudget?: number;
  rateLimitPerSecond?: number;
  latencyModel?: Record<string, number>;
  private lastExecution: number = 0;
  private tokensUsed: number = 0;

  /**
   * Initialize a scheduler with a DAG and options.
   * 
   * @param dag - The DAG to schedule
   * @param options - Scheduling options
   */
  constructor(dag: DAG, options: SchedulerOptions = {}) {
    this.dag = dag;
    
    if (options.maxParallelNodes !== undefined) {
      this.maxParallelNodes = options.maxParallelNodes;
    }
    
    if (options.maxExecutionTime !== undefined) {
      this.maxExecutionTime = options.maxExecutionTime;
    }
    
    if (options.priorityNodes !== undefined) {
      this.priorityNodes = options.priorityNodes;
    }

    if (options.tokenBudget !== undefined) {
      this.tokenBudget = options.tokenBudget;
    }

    if (options.rateLimitPerSecond !== undefined) {
      this.rateLimitPerSecond = options.rateLimitPerSecond;
    }

    if (options.latencyModel !== undefined) {
      this.latencyModel = options.latencyModel;
    }
  }

  /**
   * Execute the DAG with the given inputs.
   * 
   * @param inputs - Initial inputs for the DAG
   * @returns Result of the execution
   */
  async execute(inputs: Record<string, any> = {}): Promise<Record<string, any>> {
    const results: Record<string, any> = { ...inputs };
    const order = this.dag.getTopologicalOrder();

    // Execute nodes in topological order
    for (const nodeName of order) {
      const node = this.dag.getNode(nodeName);
      if (!node) continue;

      // rate limiting
      if (this.rateLimitPerSecond) {
        const interval = 1000 / this.rateLimitPerSecond;
        const now = Date.now();
        const wait = this.lastExecution + interval - now;
        if (wait > 0) {
          await new Promise(res => setTimeout(res, wait));
        }
        this.lastExecution = Date.now();
      }

      // token budget check
      const cost = node.getTokenCost ? node.getTokenCost() : 0;
      if (this.tokenBudget !== undefined && this.tokensUsed + cost > this.tokenBudget) {
        throw new Error('Token budget exceeded');
      }
      this.tokensUsed += cost;

      // Collect inputs for this node from dependencies
      const nodeInputs: Record<string, any> = {};
      for (const dep of node.dependencies) {
        if (results[dep] !== undefined) {
          nodeInputs[dep] = results[dep];
        }
      }
      
      // Add global inputs
      for (const [key, value] of Object.entries(inputs)) {
        if (nodeInputs[key] === undefined) {
          nodeInputs[key] = value;
        }
      }
      
      // Execute the node
      try {
        const result = await node.execute(nodeInputs);
        const latency = this.latencyModel?.[nodeName] ?? node.getLatency?.();
        if (latency && latency > 0) {
          await new Promise(res => setTimeout(res, latency));
        }
        results[nodeName] = result;
      } catch (error) {
        console.error(`Error executing node ${nodeName}:`, error);
        throw error;
      }
    }
    
    return results;
  }

  /**
   * Execute the DAG with parallelism where possible.
   * 
   * @param inputs - Initial inputs for the DAG
   * @returns Result of the parallel execution
   */
  async executeParallel(inputs: Record<string, any> = {}): Promise<Record<string, any>> {
    const results: Record<string, any> = { ...inputs };
    const levels = this.getLevelGroups();
    
    // Execute levels in sequence, but nodes within each level in parallel
    for (const level of levels) {
      const nodeTasks = level.map(async (nodeName) => {
        const node = this.dag.getNode(nodeName);
        if (!node) return;

        if (this.rateLimitPerSecond) {
          const interval = 1000 / this.rateLimitPerSecond;
          const now = Date.now();
          const wait = this.lastExecution + interval - now;
          if (wait > 0) {
            await new Promise(res => setTimeout(res, wait));
          }
          this.lastExecution = Date.now();
        }

        const cost = node.getTokenCost ? node.getTokenCost() : 0;
        if (this.tokenBudget !== undefined && this.tokensUsed + cost > this.tokenBudget) {
          throw new Error('Token budget exceeded');
        }
        this.tokensUsed += cost;
        
        // Collect inputs for this node from dependencies
        const nodeInputs: Record<string, any> = {};
        for (const dep of node.dependencies) {
          if (results[dep] !== undefined) {
            nodeInputs[dep] = results[dep];
          }
        }
        
        // Add global inputs
        for (const [key, value] of Object.entries(inputs)) {
          if (nodeInputs[key] === undefined) {
            nodeInputs[key] = value;
          }
        }
        
        // Execute the node
        try {
          const result = await node.execute(nodeInputs);
          const latency = this.latencyModel?.[nodeName] ?? node.getLatency?.();
          if (latency && latency > 0) {
            await new Promise(res => setTimeout(res, latency));
          }
          return { nodeName, result };
        } catch (error) {
          console.error(`Error executing node ${nodeName}:`, error);
          throw error;
        }
      });
      
      // Wait for all nodes in this level to complete
      const levelResults = await Promise.all(nodeTasks);
      
      // Store results
      for (const item of levelResults) {
        if (item) {
          results[item.nodeName] = item.result;
        }
      }
    }
    
    return results;
  }

  /**
   * Group nodes by their level in the DAG.
   * 
   * @returns Array of node groups by level
   */
  private getLevelGroups(): string[][] {
    const levels: Map<string, number> = new Map();
    const order = this.dag.getTopologicalOrder();
    
    // Initialize all nodes to level 0
    for (const nodeName of order) {
      levels.set(nodeName, 0);
    }
    
    // Compute level for each node
    for (const nodeName of order) {
      const node = this.dag.getNode(nodeName);
      if (!node) continue;
      
      for (const dep of node.dependencies) {
        if (levels.has(dep)) {
          const depLevel = levels.get(dep) || 0;
          const currentLevel = levels.get(nodeName) || 0;
          levels.set(nodeName, Math.max(currentLevel, depLevel + 1));
        }
      }
    }
    
    // Group nodes by level
    const levelGroups: string[][] = [];
    const maxLevel = Math.max(...Array.from(levels.values()));
    
    for (let i = 0; i <= maxLevel; i++) {
      const nodesAtLevel = Array.from(levels.entries())
        .filter(([_, level]) => level === i)
        .map(([name, _]) => name);
        
      if (nodesAtLevel.length > 0) {
        levelGroups.push(nodesAtLevel);
      }
    }
    
    return levelGroups;
  }
}