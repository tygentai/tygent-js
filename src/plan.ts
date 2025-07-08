export interface PlanStep {
  id: string;
  type: 'tool' | 'llm';
  action: any;
  dependencies?: string[];
}

export interface PlanObject {
  steps: PlanStep[];
}

import { DAG } from './dag';
import { Node, ToolNode, LLMNode } from './nodes';

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
      const lines = plan.split(/\n+/).map(l => l.trim()).filter(l => l);
      let prevId: string | null = null;
      let step = 1;
      for (const line of lines) {
        const id = `step_${step++}`;
        let node;
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
        let node;
        if (step.type === 'tool') {
          const func = typeof step.action === 'string' ? toolMap[step.action] : step.action;
          node = new ToolNode(step.id, func || (()=>({result:step.id})));
        } else {
          node = new LLMNode(step.id, undefined, step.action);
        }
        if (step.dependencies) {
          node.setDependencies(step.dependencies);
        }
        dag.addNode(node);
      }
      for (const step of plan.steps) {
        if (step.dependencies) {
          for (const dep of step.dependencies) {
            dag.addEdge(dep, step.id);
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

      // Map original node ids to prefixed ids
      const idMap: Record<string, string> = {};
      for (const node of partial.getAllNodes()) {
        idMap[node.name] = `${prefix}${node.name}`;
      }

      // Clone nodes with new ids and dependencies
      for (const node of partial.getAllNodes()) {
        const newId = idMap[node.name];
        let cloned: Node;
        if (node instanceof ToolNode) {
          const func = (node as any).func;
          cloned = new ToolNode(newId, func, node.tokenCost, node.latency);
        } else if (node instanceof LLMNode) {
          cloned = new LLMNode(
            newId,
            (node as any).model,
            node.promptTemplate,
            node.tokenCost,
            node.latency
          );
        } else {
          cloned = new Node(newId, node.tokenCost, node.latency);
        }
        const deps = node.dependencies.map(d => idMap[d]);
        cloned.setDependencies(deps);
        merged.addNode(cloned);
      }

      // Replicate edges
      const edges = (partial as any).edges as Map<string, string[]>;
      edges.forEach((targets, from) => {
        for (const to of targets) {
          merged.addEdge(idMap[from], idMap[to]);
        }
      });

      // Connect previous plan to current
      const [roots, leaves] = partial.getRootsAndLeaves();
      const renamedRoots = roots.map(r => idMap[r]);
      const renamedLeaves = leaves.map(l => idMap[l]);
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
