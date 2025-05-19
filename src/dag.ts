/**
 * DAG module provides the core DAG (Directed Acyclic Graph) implementation for Tygent.
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseNode } from './nodes';

type EdgeMapping = Record<string, string>;
type ConditionFunction = (outputs: Record<string, any>) => boolean;

/**
 * Directed Acyclic Graph that represents a workflow of computation nodes.
 * 
 * DAGs are created by LLMs using the plan an agent generates for its actions.
 */
export class DAG {
  /** Unique identifier for the DAG */
  id: string;
  
  /** Name of the DAG */
  name: string;
  
  /** Nodes in the DAG */
  nodes: Record<string, BaseNode>;
  
  /** Edges in the DAG (from -> to[]) */
  edges: Record<string, string[]>;
  
  /** Conditional edges in the DAG (from -> to -> condition) */
  conditionalEdges: Record<string, Record<string, ConditionFunction>>;
  
  /** Mappings for edges (from -> to -> mapping) */
  edgeMappings: Record<string, Record<string, EdgeMapping>>;
  
  /**
   * Create a new DAG.
   * 
   * @param name The name of the DAG
   */
  constructor(name: string) {
    this.id = uuidv4();
    this.name = name;
    this.nodes = {};
    this.edges = {};
    this.conditionalEdges = {};
    this.edgeMappings = {};
  }
  
  /**
   * Add a node to the DAG.
   * 
   * @param node The node to add
   */
  addNode(node: BaseNode): void {
    if (this.nodes[node.id]) {
      throw new Error(`Node with id ${node.id} already exists in the DAG`);
    }
    
    this.nodes[node.id] = node;
    
    if (!this.edges[node.id]) {
      this.edges[node.id] = [];
    }
  }
  
  /**
   * Add a directed edge between two nodes.
   * 
   * @param fromNodeId The source node ID
   * @param toNodeId The target node ID
   * @param mapping Optional mapping of output fields from source to input fields of target
   */
  addEdge(fromNodeId: string, toNodeId: string, mapping?: EdgeMapping): void {
    if (!this.nodes[fromNodeId]) {
      throw new Error(`Source node ${fromNodeId} does not exist in the DAG`);
    }
    
    if (!this.nodes[toNodeId]) {
      throw new Error(`Target node ${toNodeId} does not exist in the DAG`);
    }
    
    if (!this.edges[fromNodeId]) {
      this.edges[fromNodeId] = [];
    }
    
    if (!this.edges[fromNodeId].includes(toNodeId)) {
      this.edges[fromNodeId].push(toNodeId);
    }
    
    if (mapping) {
      if (!this.edgeMappings[fromNodeId]) {
        this.edgeMappings[fromNodeId] = {};
      }
      
      this.edgeMappings[fromNodeId][toNodeId] = mapping;
    }
  }
  
  /**
   * Add a conditional edge between two nodes.
   * 
   * @param fromNodeId The source node ID
   * @param toNodeId The target node ID
   * @param condition Function that evaluates if the edge should be traversed
   * @param mapping Optional mapping of output fields from source to input fields of target
   */
  addConditionalEdge(fromNodeId: string, toNodeId: string, 
                    condition: ConditionFunction, mapping?: EdgeMapping): void {
    // First add a normal edge
    this.addEdge(fromNodeId, toNodeId, mapping);
    
    // Then add the condition
    if (!this.conditionalEdges[fromNodeId]) {
      this.conditionalEdges[fromNodeId] = {};
    }
    
    this.conditionalEdges[fromNodeId][toNodeId] = condition;
  }
  
  /**
   * Return a valid topological ordering of the nodes.
   * 
   * @returns A list of node IDs in topological order
   */
  getTopologicalOrder(): string[] {
    const visited = new Set<string>();
    const tempVisited = new Set<string>();
    const order: string[] = [];
    
    const visit = (nodeId: string): void => {
      if (tempVisited.has(nodeId)) {
        throw new Error(`DAG contains a cycle including node ${nodeId}`);
      }
      
      if (!visited.has(nodeId)) {
        tempVisited.add(nodeId);
        
        const neighbors = this.edges[nodeId] || [];
        for (const neighbor of neighbors) {
          visit(neighbor);
        }
        
        tempVisited.delete(nodeId);
        visited.add(nodeId);
        order.push(nodeId);
      }
    };
    
    for (const nodeId of Object.keys(this.nodes)) {
      if (!visited.has(nodeId)) {
        visit(nodeId);
      }
    }
    
    return order.reverse();
  }
  
  /**
   * Map outputs from previous nodes to inputs for a specific node.
   * 
   * @param nodeId The ID of the node to get inputs for
   * @param outputs The current outputs from all nodes
   * @returns A dictionary of inputs for the specified node
   */
  getNodeInputs(nodeId: string, outputs: Record<string, any>): Record<string, any> {
    const inputs: Record<string, any> = {};
    
    // Find all edges that point to this node
    for (const [fromNodeId, toNodes] of Object.entries(this.edges)) {
      if (toNodes.includes(nodeId)) {
        // Check if there's a condition that prevents this edge
        if (this.conditionalEdges[fromNodeId]?.[nodeId]) {
          if (!this.conditionalEdges[fromNodeId][nodeId](outputs)) {
            continue; // Skip this edge if condition is not met
          }
        }
        
        // Check if there's a mapping for this edge
        const mapping = this.edgeMappings[fromNodeId]?.[nodeId];
        
        if (mapping) {
          // Apply the mapping
          for (const [srcKey, dstKey] of Object.entries(mapping)) {
            if (outputs[fromNodeId] && srcKey in outputs[fromNodeId]) {
              inputs[dstKey] = outputs[fromNodeId][srcKey];
            }
          }
        } else if (outputs[fromNodeId]) {
          // No mapping, just forward all outputs
          Object.assign(inputs, outputs[fromNodeId]);
        }
      }
    }
    
    return inputs;
  }
  
  /**
   * Convert the DAG to an object representation.
   * 
   * @returns An object representation of the DAG
   */
  toObject(): Record<string, any> {
    return {
      id: this.id,
      name: this.name,
      nodes: Object.fromEntries(
        Object.entries(this.nodes).map(([id, node]) => [id, node.toObject()])
      ),
      edges: this.edges,
      // Note: Can't easily serialize conditional edges or mappings
    };
  }
  
  /**
   * Create a DAG from an object representation.
   * 
   * @param data Object containing the DAG specification
   * @returns A reconstructed DAG
   */
  static fromObject(data: Record<string, any>): DAG {
    const dag = new DAG(data.name);
    dag.id = data.id;
    
    // Reconstruct edges
    dag.edges = data.edges;
    
    // Note: The nodes would need to be reconstructed with their proper types
    // This would require factories for each node type
    
    return dag;
  }
}