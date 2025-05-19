/**
 * Scheduler module provides execution engines for running DAGs efficiently.
 */

import { DAG } from './dag';

/**
 * Scheduler executes a DAG by scheduling nodes in topological order.
 */
export class Scheduler {
  /** The DAG to execute */
  dag: DAG;
  
  /** Maximum number of parallel workers */
  maxWorkers: number;
  
  /**
   * Initialize a scheduler.
   * 
   * @param dag The DAG to execute
   * @param maxWorkers Maximum number of parallel workers (default: 10)
   */
  constructor(dag: DAG, maxWorkers = 10) {
    this.dag = dag;
    this.maxWorkers = maxWorkers;
  }
  
  /**
   * Execute the DAG with the given input.
   * 
   * @param inputData Input data for the DAG
   * @returns Results from the DAG execution
   */
  async execute(inputData: any): Promise<Record<string, any>> {
    // Initialize with the input data
    const nodeOutputs: Record<string, any> = { input: { data: inputData } };
    const executedNodes: Set<string> = new Set();
    
    // Get nodes in topological order
    const topoOrder = this.dag.getTopologicalOrder();
    
    // Track execution times
    const executionTimes: Record<string, number> = {};
    const startTime = Date.now();
    
    for (const nodeId of topoOrder) {
      const node = this.dag.nodes[nodeId];
      
      // Get inputs for this node
      const inputs = this.dag.getNodeInputs(nodeId, nodeOutputs);
      
      // Execute the node
      const nodeStartTime = Date.now();
      try {
        const result = await node.execute(inputs);
        // Store the result
        nodeOutputs[nodeId] = result;
      } catch (error: any) {
        nodeOutputs[nodeId] = { error: error.message || 'Unknown execution error' };
      }
      const nodeEndTime = Date.now();
      
      // Record execution time and mark as executed
      executionTimes[nodeId] = (nodeEndTime - nodeStartTime) / 1000; // Convert to seconds
      executedNodes.add(nodeId);
    }
    
    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000; // Convert to seconds
    
    // Build and return a comprehensive result
    return {
      results: nodeOutputs,
      executionTimes,
      totalTime,
      executedNodes: Array.from(executedNodes)
    };
  }
}

/**
 * Advanced executor that utilizes parallelism and adapts execution based on conditions.
 */
export class AdaptiveExecutor {
  /** The DAG to execute */
  dag: DAG;
  
  /** Maximum number of parallel workers */
  maxWorkers: number;
  
  /**
   * Initialize an adaptive executor.
   * 
   * @param dag The DAG to execute
   * @param maxWorkers Maximum number of parallel workers (default: 10)
   */
  constructor(dag: DAG, maxWorkers = 10) {
    this.dag = dag;
    this.maxWorkers = maxWorkers;
  }
  
  /**
   * Execute the DAG with parallel execution where possible.
   * 
   * @param inputData Input data for the DAG
   * @returns Results from the DAG execution
   */
  async execute(inputData: any): Promise<Record<string, any>> {
    // Initialize with the input data
    const nodeOutputs: Record<string, any> = { input: { data: inputData } };
    const executedNodes: Set<string> = new Set();
    
    // Get dependency count for each node
    const dependencies: Record<string, number> = {};
    for (const nodeId in this.dag.nodes) {
      dependencies[nodeId] = 0;
    }
    
    for (const [fromId, toList] of Object.entries(this.dag.edges)) {
      for (const toId of toList) {
        dependencies[toId] = (dependencies[toId] || 0) + 1;
      }
    }
    
    // Nodes with no dependencies can be executed right away
    let readyNodes = Object.keys(dependencies).filter(nodeId => dependencies[nodeId] === 0);
    
    // Track execution times
    const executionTimes: Record<string, number> = {};
    const startTime = Date.now();
    
    // Continue until all nodes are processed
    while (readyNodes.length > 0) {
      // Process nodes in parallel, limited by maxWorkers
      const batchSize = Math.min(readyNodes.length, this.maxWorkers);
      const batch = readyNodes.slice(0, batchSize);
      readyNodes = readyNodes.slice(batchSize);
      
      const batchPromises = batch.map(async nodeId => {
        const node = this.dag.nodes[nodeId];
        
        // Get inputs for this node
        const inputs = this.dag.getNodeInputs(nodeId, nodeOutputs);
        
        // Execute the node
        const nodeStartTime = Date.now();
        try {
          const result = await node.execute(inputs);
          // Store the result
          nodeOutputs[nodeId] = result;
        } catch (error: any) {
          nodeOutputs[nodeId] = { error: error.message || 'Unknown execution error' };
        }
        const nodeEndTime = Date.now();
        
        // Record execution time and mark as executed
        executionTimes[nodeId] = (nodeEndTime - nodeStartTime) / 1000; // Convert to seconds
        executedNodes.add(nodeId);
        
        // Update dependencies and find newly ready nodes
        for (const toId of this.dag.edges[nodeId] || []) {
          dependencies[toId] -= 1;
          if (dependencies[toId] === 0) {
            readyNodes.push(toId);
          }
        }
      });
      
      // Wait for all tasks in this batch to complete
      await Promise.all(batchPromises);
    }
    
    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000; // Convert to seconds
    
    // Build and return a comprehensive result
    return {
      results: nodeOutputs,
      executionTimes,
      totalTime,
      executedNodes: Array.from(executedNodes)
    };
  }
}