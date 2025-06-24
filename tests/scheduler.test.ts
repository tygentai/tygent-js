import { describe, it, expect } from '@jest/globals';
import { DAG } from '../src/dag';
import { ToolNode } from '../src/nodes';
import { Scheduler } from '../src/scheduler';

function wait(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

describe('Scheduler', () => {
  it('enforces token budget', async () => {
    const dag = new DAG('budget');
    dag.addNode(new ToolNode('a', () => 1, 5));
    dag.addNode(new ToolNode('b', () => 2, 5));
    dag.addEdge('a', 'b');
    const scheduler = new Scheduler(dag, { tokenBudget: 8 });
    await expect(scheduler.execute()).rejects.toThrow(/Token budget/);
  });

  it('applies latency model', async () => {
    const dag = new DAG('latency');
    dag.addNode(new ToolNode('a', async () => { return 'x'; }, 0));
    dag.addNode(new ToolNode('b', async () => { return 'y'; }, 0));
    dag.addEdge('a', 'b');
    const scheduler = new Scheduler(dag, { latencyModel: { a: 50, b: 50 } });
    const start = Date.now();
    await scheduler.execute();
    const duration = Date.now() - start;
    expect(duration).toBeGreaterThanOrEqual(90);
  });
});
