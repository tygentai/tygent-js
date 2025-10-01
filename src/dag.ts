/**
 * Directed Acyclic Graph (DAG) implementation for Tygent.
 */

import { Node } from './nodes';

export interface EdgeMetadata {
  [key: string]: any;
}

/**
 * Directed Acyclic Graph (DAG) for execution planning.
 */
export class DAG {
  name: string;
  nodes: Map<string, Node> = new Map();
  edges: Map<string, string[]> = new Map();
  edgeMetadata: Map<string, Map<string, EdgeMetadata>> = new Map();
  private nodeInputs: Map<string, Record<string, any>> = new Map();

  constructor(name: string) {
    this.name = name;
  }

  addNode(node: Node): void {
    this.nodes.set(node.name, node);
    if (!this.edges.has(node.name)) {
      this.edges.set(node.name, []);
    }
  }

  addEdge(from: string, to: string, metadata?: EdgeMetadata): void {
    if (!this.nodes.has(from)) {
      throw new Error(`Source node '${from}' not found in DAG`);
    }
    if (!this.nodes.has(to)) {
      throw new Error(`Target node '${to}' not found in DAG`);
    }

    const targets = this.edges.get(from) || [];
    if (!targets.includes(to)) {
      targets.push(to);
      this.edges.set(from, targets);
    }

    const targetNode = this.nodes.get(to);
    if (targetNode && !targetNode.dependencies.includes(from)) {
      targetNode.setDependencies([...targetNode.dependencies, from]);
    }

    if (metadata) {
      let metaMap = this.edgeMetadata.get(from);
      if (!metaMap) {
        metaMap = new Map<string, EdgeMetadata>();
        this.edgeMetadata.set(from, metaMap);
      }
      metaMap.set(to, { ...metadata });
    }
  }

  hasNode(name: string): boolean {
    return this.nodes.has(name);
  }

  getNode(name: string): Node | undefined {
    return this.nodes.get(name);
  }

  getAllNodes(): Node[] {
    return Array.from(this.nodes.values());
  }

  getEdgeMetadata(from: string, to: string): EdgeMetadata | undefined {
    return this.edgeMetadata.get(from)?.get(to);
  }

  setNodeInputs(nodeId: string, inputs: Record<string, any>): void {
    this.nodeInputs.set(nodeId, { ...inputs });
  }

  getNodeInputs(nodeId: string, nodeResults: Record<string, any> = {}): Record<string, any> {
    const baseInputs = { ...(this.nodeInputs.get(nodeId) || {}) };
    const node = this.nodes.get(nodeId);
    if (!node) {
      return baseInputs;
    }

    for (const dep of node.dependencies) {
      if (dep in nodeResults) {
        const value = nodeResults[dep];
        if (value && typeof value === 'object') {
          Object.assign(baseInputs, value);
          baseInputs[dep] = value;
        } else {
          baseInputs[dep] = value;
        }
      }
    }
    return baseInputs;
  }

  getTopologicalOrder(): string[] {
    const visited: Set<string> = new Set();
    const temp: Set<string> = new Set();
    const result: string[] = [];

    const visit = (nodeName: string) => {
      if (temp.has(nodeName)) {
        throw new Error(`Cycle detected in DAG at node ${nodeName}`);
      }
      if (visited.has(nodeName)) {
        return;
      }
      temp.add(nodeName);
      const node = this.nodes.get(nodeName);
      if (node) {
        for (const dep of node.dependencies) {
          if (this.nodes.has(dep)) {
            visit(dep);
          }
        }
      }
      temp.delete(nodeName);
      visited.add(nodeName);
      result.push(nodeName);
    };

    for (const nodeName of this.nodes.keys()) {
      if (!visited.has(nodeName)) {
        visit(nodeName);
      }
    }

    return result;
  }

  getRootsAndLeaves(): [string[], string[]] {
    const roots: string[] = [];
    const leaves: string[] = [];

    for (const [name, node] of this.nodes.entries()) {
      if (node.dependencies.length === 0) {
        roots.push(name);
      }
      const targets = this.edges.get(name) || [];
      if (targets.length === 0) {
        leaves.push(name);
      }
    }

    return [roots, leaves];
  }

  copy(): DAG {
    const clone = new DAG(this.name);
    for (const node of this.nodes.values()) {
      clone.addNode(node.clone());
    }
    for (const [from, targets] of this.edges.entries()) {
      for (const to of targets) {
        clone.addEdge(from, to, this.getEdgeMetadata(from, to));
      }
    }
    for (const [nodeId, inputs] of this.nodeInputs.entries()) {
      clone.setNodeInputs(nodeId, inputs);
    }
    return clone;
  }

  computeCriticalPath(): Map<string, number> {
    const order = this.getTopologicalOrder();
    const critical = new Map<string, number>();

    for (const name of [...order].reverse()) {
      const node = this.nodes.get(name);
      const selfLatency = node ? node.getLatency() : 0;
      const children = this.edges.get(name) || [];
      if (children.length === 0) {
        critical.set(name, selfLatency);
      } else {
        let maxChild = 0;
        for (const child of children) {
          maxChild = Math.max(maxChild, critical.get(child) || 0);
        }
        critical.set(name, selfLatency + maxChild);
      }
    }

    return critical;
  }

  async execute(inputs: Record<string, any>): Promise<Record<string, any>> {
    const { Scheduler } = await import('./scheduler');
    const scheduler = new Scheduler(this);
    return scheduler.execute(inputs);
  }
}
