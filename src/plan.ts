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
import { ToolNode, LLMNode } from './nodes';

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
}
