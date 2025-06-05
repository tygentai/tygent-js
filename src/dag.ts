/**
 * Directed Acyclic Graph (DAG) implementation for Tygent.
 */
import { Node } from './nodes';

/**
 * Directed Acyclic Graph (DAG) for execution planning.
 */
export class DAG {
  name: string;
  nodes: Map<string, Node> = new Map(); // Changed to public for multi-agent.ts compatibility
  private edges: Map<string, string[]> = new Map();
  private nodeInputs: Map<string, Record<string, any>> = new Map();
  
  /**
   * Initialize a DAG.
   * 
   * @param name - The name of the DAG
   */
  constructor(name: string) {
    this.name = name;
  }
  
  /**
   * Add a node to the DAG.
   * 
   * @param node - The node to add
   */
  addNode(node: Node): void {
    this.nodes.set(node.name, node);
    this.edges.set(node.name, []);
    
    // Add edges for dependencies
    for (const dep of node.dependencies) {
      if (this.nodes.has(dep)) {
        const depEdges = this.edges.get(dep) || [];
        depEdges.push(node.name);
        this.edges.set(dep, depEdges);
      }
    }
  }
  
  /**
   * Add an edge between two nodes.
   * 
   * @param from - The source node name
   * @param to - The target node name
   * @param metadata - Optional metadata to associate with the edge
   */
  addEdge(from: string, to: string, metadata?: any): void {
    if (!this.nodes.has(from)) {
      throw new Error(`Source node '${from}' not found in DAG`);
    }
    
    if (!this.nodes.has(to)) {
      throw new Error(`Target node '${to}' not found in DAG`);
    }
    
    const edges = this.edges.get(from) || [];
    
    // Avoid adding duplicate edges
    if (!edges.includes(to)) {
      edges.push(to);
      this.edges.set(from, edges);
    }
  }
  
  /**
   * Check if the DAG has a node with the given name.
   * 
   * @param name - The name of the node to check
   * @returns True if the node exists, False otherwise
   */
  hasNode(name: string): boolean {
    return this.nodes.has(name);
  }
  
  /**
   * Get a node by name.
   * 
   * @param name - The name of the node to get
   * @returns The node if it exists, undefined otherwise
   */
  getNode(name: string): Node | undefined {
    return this.nodes.get(name);
  }
  
  /**
   * Get all nodes in the DAG.
   * 
   * @returns Array of all nodes
   */
  getAllNodes(): Node[] {
    return Array.from(this.nodes.values());
  }
  
  /**
   * Get the inputs for a node.
   * 
   * @param nodeId - The node ID to get inputs for
   * @param nodeResults - Optional results from previous nodes
   * @returns The node's inputs
   */
  getNodeInputs(nodeId: string, nodeResults?: Record<string, any>): Record<string, any> {
    const baseInputs = this.nodeInputs.get(nodeId) || {};
    
    // If nodeResults are provided, incorporate them based on dependencies
    if (nodeResults) {
      const node = this.nodes.get(nodeId);
      if (node && node.dependencies) {
        // Combine inputs from dependencies
        const combinedInputs = { ...baseInputs };
        
        for (const depId of node.dependencies) {
          if (depId in nodeResults) {
            Object.assign(combinedInputs, nodeResults[depId]);
          }
        }
        
        return combinedInputs;
      }
    }
    
    return baseInputs;
  }
  
  /**
   * Set the inputs for a node.
   * 
   * @param nodeId - The node ID to set inputs for
   * @param inputs - The inputs to set
   */
  setNodeInputs(nodeId: string, inputs: Record<string, any>): void {
    this.nodeInputs.set(nodeId, inputs);
  }
  
  /**
   * Get the topological ordering of nodes in the DAG.
   * 
   * @returns List of node names in topological order
   */
  getTopologicalOrder(): string[] {
    // Mark all nodes as unvisited
    const visited: Map<string, boolean> = new Map();
    // Store temporary marks for cycle detection
    const tempMarks: Map<string, boolean> = new Map();
    // Store the result
    const result: string[] = [];
    
    const visit = (nodeName: string): void => {
      // If node has a temporary mark, we've found a cycle
      if (tempMarks.get(nodeName)) {
        throw new Error(`Cycle detected in DAG at node ${nodeName}`);
      }
      
      // If node hasn't been visited yet
      if (!visited.get(nodeName)) {
        // Mark temporarily for cycle detection
        tempMarks.set(nodeName, true);
        
        // Visit all prerequisite nodes (those that must be executed before this one)
        const node = this.nodes.get(nodeName);
        if (node) {
          for (const dep of node.dependencies) {
            if (this.nodes.has(dep)) {
              visit(dep);
            }
          }
        }
        
        // Mark as visited and add to result
        visited.set(nodeName, true);
        tempMarks.set(nodeName, false);
        result.push(nodeName);
      }
    };
    
    // Visit all nodes
    for (const [nodeName] of this.nodes) {
      if (!visited.get(nodeName)) {
        visit(nodeName);
      }
    }
    
    // Return in reverse order for execution (dependencies first)
    return result.reverse();
  }
  
  /**
   * Get the root and leaf nodes of the DAG.
   * 
   * @returns Tuple of [roots, leaves] node names
   */
  getRootsAndLeaves(): [string[], string[]] {
    // Root nodes have no dependencies
    const roots: string[] = [];
    for (const [nodeName, node] of this.nodes) {
      if (node.dependencies.length === 0) {
        roots.push(nodeName);
      }
    }
    
    // Leaf nodes have no nodes that depend on them
    const leaves: string[] = [];
    for (const [nodeName, edges] of this.edges) {
      if (edges.length === 0) {
        leaves.push(nodeName);
      }
    }
    
    return [roots, leaves];
  }
}