import { describe, it, expect } from '@jest/globals';
import { PlanParser, PlanObject } from '../src/plan';
import { ToolNode } from '../src/nodes';

describe('PlanParser', () => {
  it('parses string plan into DAG', () => {
    const plan = `Summarize question\ntool: search\nAnswer question`;
    const dag = PlanParser.parse(plan, { search: (i: any) => ({ result: i }) });
    expect(dag.getAllNodes().length).toBe(3);
    const node = dag.getNode('step_2');
    expect(node instanceof ToolNode).toBe(true);
    expect((dag as any).edges.get('step_1')).toContain('step_2');
    expect((dag as any).edges.get('step_2')).toContain('step_3');
  });

  it('parses object plan into DAG', () => {
    const planObj: PlanObject = {
      steps: [
        { id: 'a', type: 'tool', action: 'search', dependencies: [] },
        { id: 'b', type: 'llm', action: 'Write {a}', dependencies: ['a'] }
      ]
    };
    const dag = PlanParser.parse(planObj, { search: () => 'ok' });
    expect(dag.getAllNodes().length).toBe(2);
    expect((dag as any).edges.get('a')).toContain('b');
  });

  it('merges multiple plans into a single DAG', () => {
    const plan1 = `tool: search\nSummarize results`;
    const plan2 = `tool: calc\nAnswer`;

    const dag = PlanParser.parseMultiple(
      [plan1, plan2],
      {
        search: () => ({ result: 's' }),
        calc: () => ({ result: 1 })
      }
    );

    // Should contain four nodes with prefixed ids
    expect(dag.getAllNodes().length).toBe(4);

    // Ensure plans are connected sequentially
    const edges = (dag as any).edges;
    expect(edges.get('p1_step_2')).toContain('p2_step_1');
  });
});
