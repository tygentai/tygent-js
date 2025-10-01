export interface PlanStep {
  id: string;
  type: 'tool' | 'llm';
  action: any;
  dependencies?: string[];
  metadata?: Record<string, any>;
  tokenCost?: number;
  latencyEstimate?: number;
  critical?: boolean;
}

export interface PlanObject {
  steps: PlanStep[];
}

import { DAG } from './dag';
import { LLMNode, Node, ToolNode } from './nodes';

const NEWLINE_PATTERN = /\r?\n+/;

/**
 * PlanParser converts high level plans into DAGs
 */
export class PlanParser {
  /**
   * Parse a plan string or object into a DAG. When a toolMap is provided,
   * tool names will be resolved to functions.
   */
  static parse(plan: string | PlanObject, toolMap: Record<string, any> = {}): DAG {
    const dag = new DAG('parsed_plan');

    if (typeof plan === 'string') {
      const lines = plan.split(NEWLINE_PATTERN).map((l) => l.trim()).filter(Boolean);
      let prevId: string | null = null;
      let stepIndex = 1;
      for (const line of lines) {
        const id = `step_${stepIndex++}`;
        let node: Node;
        const toolMatch = line.match(/tool\s*:\s*(\w+)/i);
        if (toolMatch) {
          const name = toolMatch[1];
          const func = toolMap[name] || ((inputs: any) => ({ result: `${name} output` }));
          node = new ToolNode(id, func);
        } else {
          const prompt = line.replace(/^\d+\.\s*/, '');
          node = new LLMNode(id, undefined, prompt);
        }
        dag.addNode(node);
        if (prevId) {
          dag.addEdge(prevId, id);
        }
        prevId = id;
      }
    } else {
      for (const step of plan.steps) {
        const dependencies = step.dependencies || [];
        const metadata = step.metadata || {};
        const tokenCost = typeof step.tokenCost === 'number'
          ? step.tokenCost
          : typeof metadata.token_cost === 'number'
            ? metadata.token_cost
            : typeof metadata.tokenEstimate === 'number'
              ? metadata.tokenEstimate
              : 0;
        const latencyEstimate = typeof step.latencyEstimate === 'number'
          ? step.latencyEstimate
          : typeof metadata.latency_estimate === 'number'
            ? metadata.latency_estimate
            : typeof metadata.simulated_duration === 'number'
              ? metadata.simulated_duration
              : 0;

        let node: Node;
        if (step.type === 'tool') {
          const func = typeof step.action === 'string' ? toolMap[step.action] : step.action;
          const resolvedFunc = func || (() => ({ result: step.id }));
          node = new ToolNode(step.id, resolvedFunc, tokenCost, latencyEstimate, undefined, metadata);
        } else {
          const prompt = typeof step.action === 'string' ? step.action : '';
          node = new LLMNode(step.id, undefined, prompt, tokenCost, latencyEstimate, undefined, metadata);
        }
        if (dependencies.length) {
          node.setDependencies(dependencies);
        }
        dag.addNode(node);
        dag.setNodeInputs(step.id, metadata.inputs || {});
        if (step.critical) {
          node.setMetadata({ ...node.metadata, critical: true });
        }
      }
      for (const step of plan.steps) {
        if (step.dependencies) {
          for (const dep of step.dependencies) {
            dag.addEdge(dep, step.id, step.metadata);
          }
        }
      }
    }
    return dag;
  }

  /**
   * Parse multiple plans and merge them into a single DAG. Each plan can be a
   * string or PlanObject. Nodes from each plan are prefixed to avoid name
   * collisions and plans are linked in sequence (leaves of a plan connect to the
   * roots of the next).
   */
  static parseMultiple(
    plans: Array<string | PlanObject>,
    toolMap: Record<string, any> = {}
  ): DAG {
    const merged = new DAG('merged_plans');
    let previousLeaves: string[] | null = null;

    plans.forEach((plan, index) => {
      const partial = PlanParser.parse(plan, toolMap);
      const prefix = `p${index + 1}_`;

      const idMap: Record<string, string> = {};
      for (const node of partial.getAllNodes()) {
        idMap[node.name] = `${prefix}${node.name}`;
      }

      for (const node of partial.getAllNodes()) {
        const newId = idMap[node.name];
        const cloned = node.clone();
        cloned.name = newId;
        cloned.setDependencies(node.dependencies.map((d) => idMap[d]));
        merged.addNode(cloned);
      }

      for (const [from, targets] of partial.edges.entries()) {
        for (const to of targets) {
          merged.addEdge(idMap[from], idMap[to], partial.getEdgeMetadata(from, to));
        }
      }

      const [roots, leaves] = partial.getRootsAndLeaves();
      const renamedRoots = roots.map((r) => idMap[r]);
      const renamedLeaves = leaves.map((l) => idMap[l]);
      if (previousLeaves) {
        for (const prev of previousLeaves) {
          for (const root of renamedRoots) {
            merged.addEdge(prev, root);
          }
        }
      }
      previousLeaves = renamedLeaves;
    });

    return merged;
  }
}
