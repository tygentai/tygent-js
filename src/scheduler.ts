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
 * Resource tracker to monitor and manage execution resources
 */
export class ResourceTracker {
  /** Total CPU cores available */
  totalCPU: number;
  
  /** Total memory in MB available */
  totalMemoryMB: number;
  
  /** Total GPU memory in MB available */
  totalGPUMemoryMB: number;
  
  /** Currently used CPU cores */
  usedCPU: number;
  
  /** Currently used memory in MB */
  usedMemoryMB: number;
  
  /** Currently used GPU memory in MB */
  usedGPUMemoryMB: number;
  
  /** Map of active node executions and their resource usage */
  activeExecutions: Map<string, any>;
  
  /**
   * Initialize a resource tracker.
   * 
   * @param totalCPU Total CPU cores available
   * @param totalMemoryMB Total memory in MB available
   * @param totalGPUMemoryMB Total GPU memory in MB available
   */
  constructor(totalCPU = 4, totalMemoryMB = 8192, totalGPUMemoryMB = 4096) {
    this.totalCPU = totalCPU;
    this.totalMemoryMB = totalMemoryMB;
    this.totalGPUMemoryMB = totalGPUMemoryMB;
    this.usedCPU = 0;
    this.usedMemoryMB = 0;
    this.usedGPUMemoryMB = 0;
    this.activeExecutions = new Map();
  }
  
  /**
   * Check if there are enough resources to execute a node.
   * 
   * @param nodeId ID of the node to check
   * @param constraints Resource constraints for the node
   * @returns True if sufficient resources are available
   */
  hasResourcesFor(nodeId: string, constraints: any): boolean {
    const resources = constraints?.resources || {};
    const requiredCPU = resources.cpu || 0.1; // Default minimal CPU usage
    const requiredMemory = resources.memory || 10; // Default minimal memory usage
    const requiredGPU = resources.gpu || 0; // Default no GPU
    
    return (
      this.usedCPU + requiredCPU <= this.totalCPU &&
      this.usedMemoryMB + requiredMemory <= this.totalMemoryMB &&
      this.usedGPUMemoryMB + requiredGPU <= this.totalGPUMemoryMB
    );
  }
  
  /**
   * Allocate resources for a node execution.
   * 
   * @param nodeId ID of the node
   * @param constraints Resource constraints for the node
   * @returns True if resources were successfully allocated
   */
  allocate(nodeId: string, constraints: any): boolean {
    if (!this.hasResourcesFor(nodeId, constraints)) {
      return false;
    }
    
    const resources = constraints?.resources || {};
    const requiredCPU = resources.cpu || 0.1;
    const requiredMemory = resources.memory || 10;
    const requiredGPU = resources.gpu || 0;
    
    this.usedCPU += requiredCPU;
    this.usedMemoryMB += requiredMemory;
    this.usedGPUMemoryMB += requiredGPU;
    
    this.activeExecutions.set(nodeId, {
      cpu: requiredCPU,
      memory: requiredMemory,
      gpu: requiredGPU,
      startTime: Date.now()
    });
    
    return true;
  }
  
  /**
   * Release resources after node execution.
   * 
   * @param nodeId ID of the completed node
   */
  release(nodeId: string): void {
    const resources = this.activeExecutions.get(nodeId);
    if (resources) {
      this.usedCPU -= resources.cpu;
      this.usedMemoryMB -= resources.memory;
      this.usedGPUMemoryMB -= resources.gpu;
      this.activeExecutions.delete(nodeId);
    }
  }
  
  /**
   * Get current resource utilization as a percentage.
   * 
   * @returns Object with utilization percentages
   */
  getUtilization(): Record<string, number> {
    return {
      cpu: (this.usedCPU / this.totalCPU) * 100,
      memory: (this.usedMemoryMB / this.totalMemoryMB) * 100,
      gpu: (this.usedGPUMemoryMB / this.totalGPUMemoryMB) * 100
    };
  }
}

/**
 * Advanced executor that utilizes parallelism and adapts execution based on constraints.
 */
export class AdaptiveExecutor {
  /** The DAG to execute */
  dag: DAG;
  
  /** Maximum number of parallel workers */
  maxWorkers: number;
  
  /** Resource tracker for constraint-aware scheduling */
  resourceTracker: ResourceTracker;
  
  /** Default concurrency limits by node type */
  typeConcurrencyLimits: Record<string, number>;
  
  /** Current concurrent executions by node type */
  typeConcurrentExecutions: Record<string, number>;
  
  /**
   * Initialize an adaptive executor.
   * 
   * @param dag The DAG to execute
   * @param maxWorkers Maximum number of parallel workers (default: 10)
   * @param resourceTracker Optional resource tracker
   */
  constructor(dag: DAG, maxWorkers = 10, resourceTracker?: ResourceTracker) {
    this.dag = dag;
    this.maxWorkers = maxWorkers;
    this.resourceTracker = resourceTracker || new ResourceTracker();
    
    // Default concurrency limits by node type
    this.typeConcurrencyLimits = {
      'llm': 5,   // Limit LLM calls to 5 concurrent operations
      'tool': 8,  // Tools can have more concurrency
      'memory': 10, // Memory operations have high concurrency
      'input': 10,
      'output': 10
    };
    
    // Initialize concurrent execution counters
    this.typeConcurrentExecutions = {
      'llm': 0,
      'tool': 0,
      'memory': 0,
      'input': 0,
      'output': 0
    };
  }
  
  /**
   * Prioritize ready nodes based on constraints and critical path.
   * 
   * @param readyNodes List of nodes ready for execution
   * @returns Sorted list of nodes in priority order
   */
  prioritizeNodes(readyNodes: string[]): string[] {
    // Create a priority score for each node
    const nodePriorities = readyNodes.map(nodeId => {
      const node = this.dag.nodes[nodeId];
      const constraints = node.constraints || {};
      
      // Base priority - higher is more important
      let priority = constraints.priority || 0;
      
      // Node type priority factors
      if (node.nodeType === 'llm') {
        priority += 1; // LLM calls are often on critical path
      } else if (node.nodeType === 'tool') {
        priority += 0.5; // Tools are important but may vary
      }
      
      // Resource constraint factors
      if (constraints.resources?.gpu) {
        priority += 2; // GPU operations should start early to maximize utilization
      }
      
      // Time constraint factors
      if (constraints.maxLatency && constraints.maxLatency < 500) {
        priority += 3; // High priority for low-latency requirements
      }
      
      // Concurrency constraint factor
      const typeConcurrencyLimit = this.typeConcurrencyLimits[node.nodeType] || this.maxWorkers;
      const typeConcurrency = this.typeConcurrentExecutions[node.nodeType] || 0;
      const concurrencyFactor = 1 - (typeConcurrency / typeConcurrencyLimit);
      priority *= concurrencyFactor; // Lower priority if many of this type are running
      
      return { nodeId, priority };
    });
    
    // Sort by priority (descending)
    nodePriorities.sort((a, b) => b.priority - a.priority);
    
    // Return sorted node IDs
    return nodePriorities.map(item => item.nodeId);
  }
  
  /**
   * Check if a node can be executed given constraints and resources.
   * 
   * @param nodeId ID of the node to check
   * @returns True if the node can be executed
   */
  canExecuteNode(nodeId: string): boolean {
    const node = this.dag.nodes[nodeId];
    const constraints = node.constraints || {};
    
    // Check type-specific concurrency limits
    const typeConcurrencyLimit = this.typeConcurrencyLimits[node.nodeType] || this.maxWorkers;
    const typeConcurrency = this.typeConcurrentExecutions[node.nodeType] || 0;
    
    if (typeConcurrency >= typeConcurrencyLimit) {
      return false;
    }
    
    // Check node-specific concurrency
    if (constraints.maxConcurrency !== undefined && 
        this.typeConcurrentExecutions[node.nodeType] >= constraints.maxConcurrency) {
      return false;
    }
    
    // Check if resources are available
    return this.resourceTracker.hasResourcesFor(nodeId, constraints);
  }
  
  /**
   * Execute the DAG with constraint-aware parallel execution.
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
    
    // Track execution times and additional metrics
    const executionTimes: Record<string, number> = {};
    const constraintViolations: Record<string, string[]> = {};
    const startTime = Date.now();
    
    // Running node promises
    const runningPromises: Map<string, Promise<void>> = new Map();
    
    // Continue until all nodes are processed
    while (readyNodes.length > 0 || runningPromises.size > 0) {
      // Prioritize ready nodes based on constraints
      const prioritizedNodes = this.prioritizeNodes(readyNodes);
      
      // Try to schedule as many nodes as possible within constraints
      for (const nodeId of prioritizedNodes) {
        if (this.canExecuteNode(nodeId)) {
          const node = this.dag.nodes[nodeId];
          const nodeType = node.nodeType;
          
          // Update concurrency counters
          this.typeConcurrentExecutions[nodeType] = (this.typeConcurrentExecutions[nodeType] || 0) + 1;
          
          // Allocate resources
          this.resourceTracker.allocate(nodeId, node.constraints);
          
          // Remove from ready list
          readyNodes = readyNodes.filter(id => id !== nodeId);
          
          // Create and store the execution promise
          const executionPromise = this.executeNode(nodeId, nodeOutputs, dependencies, executionTimes, constraintViolations)
            .then(() => {
              // Update ready nodes list with newly ready nodes
              for (const toId of this.dag.edges[nodeId] || []) {
                dependencies[toId] -= 1;
                if (dependencies[toId] === 0) {
                  readyNodes.push(toId);
                }
              }
              
              // Release resources
              this.resourceTracker.release(nodeId);
              
              // Update concurrency counters
              this.typeConcurrentExecutions[nodeType] -= 1;
              
              // Remove from running promises
              runningPromises.delete(nodeId);
            });
          
          runningPromises.set(nodeId, executionPromise);
          
          // If we've reached max workers, stop scheduling for now
          if (runningPromises.size >= this.maxWorkers) {
            break;
          }
        }
      }
      
      // If we have running promises and can't schedule more (or have none to schedule)
      if (runningPromises.size > 0) {
        // Wait for at least one promise to resolve before continuing
        await Promise.race(runningPromises.values());
      } else if (readyNodes.length > 0) {
        // If we have ready nodes but couldn't schedule any, there's a resource deadlock
        // Wait a bit and retry (in real systems, this would need better deadlock detection)
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000; // Convert to seconds
    
    // Build and return a comprehensive result
    return {
      results: nodeOutputs,
      executionTimes,
      totalTime,
      executedNodes: Array.from(executedNodes),
      constraintViolations,
      resourceUtilization: this.resourceTracker.getUtilization()
    };
  }
  
  /**
   * Execute a single node and handle its results.
   * 
   * @param nodeId ID of the node to execute
   * @param nodeOutputs Current outputs from all nodes
   * @param dependencies Current dependency counts
   * @param executionTimes Execution time tracking
   * @param constraintViolations Constraint violation tracking
   */
  private async executeNode(
    nodeId: string,
    nodeOutputs: Record<string, any>,
    dependencies: Record<string, number>,
    executionTimes: Record<string, number>,
    constraintViolations: Record<string, string[]>
  ): Promise<void> {
    const node = this.dag.nodes[nodeId];
    
    // Get inputs for this node
    const inputs = this.dag.getNodeInputs(nodeId, nodeOutputs);
    
    // Execute the node
    const nodeStartTime = Date.now();
    try {
      const result = await node.execute(inputs);
      
      // Check for warnings that indicate constraint issues
      if (result.warning) {
        if (!constraintViolations[nodeId]) {
          constraintViolations[nodeId] = [];
        }
        constraintViolations[nodeId].push(result.warning);
      }
      
      // Store the result
      nodeOutputs[nodeId] = result;
    } catch (error: any) {
      // Handle constraint violations specially
      if (error.message && error.message.includes('exceeds maximum allowed')) {
        if (!constraintViolations[nodeId]) {
          constraintViolations[nodeId] = [];
        }
        constraintViolations[nodeId].push(error.message);
        
        // Still need to provide a result
        nodeOutputs[nodeId] = { 
          error: error.message,
          constraintViolation: true
        };
      } else {
        // Regular execution error
        nodeOutputs[nodeId] = { 
          error: error.message || 'Unknown execution error'
        };
      }
    }
    const nodeEndTime = Date.now();
    
    // Record execution time
    executionTimes[nodeId] = (nodeEndTime - nodeStartTime) / 1000; // Convert to seconds
  }
}