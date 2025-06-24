import { describe, it, expect } from '@jest/globals';
import { DAG } from '../src/dag';
import { ToolNode } from '../src/nodes';
import { Scheduler } from '../src/scheduler';
import { performance } from 'perf_hooks';

function sleepNode(name: string, ms: number) {
  return new ToolNode(name, async () => {
    await new Promise(res => setTimeout(res, ms));
    return name;
  });
}

describe('Scheduler Benchmark', () => {
  it('parallel execution is faster than sequential', async () => {
    const dag = new DAG('bench');
    dag.addNode(sleepNode('a', 50));
    dag.addNode(sleepNode('b', 50));
    dag.addNode(sleepNode('c', 50));

    const scheduler = new Scheduler(dag);

    const startSeq = performance.now();
    await scheduler.execute();
    const seqTime = performance.now() - startSeq;

    const startPar = performance.now();
    await scheduler.executeParallel();
    const parTime = performance.now() - startPar;

    expect(parTime).toBeLessThan(seqTime);
  });
});
