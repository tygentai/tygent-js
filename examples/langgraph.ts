/**
 * LangGraph-style workflow converted into a Tygent DAG.
 */

import { DAG } from '../src';
import { ToolNode } from '../src/nodes';
import { Scheduler } from '../src/scheduler';

function createWorkflow(): DAG {
  const dag = new DAG('langgraph_workflow');

  dag.addNode(new ToolNode('search', async (inputs: Record<string, any>) => {
    console.log(`Executing search with query: ${inputs.query}`);
    return { search_results: 'Simulated search results for renewable energy' };
  }));

  dag.addNode(new ToolNode('synthesize', async (inputs: Record<string, any>) => {
    console.log(`Synthesizing results: ${inputs.search_results}`);
    return { synthesis: 'Synthesised information about renewable energy trends' };
  }));

  dag.addEdge('search', 'synthesize');
  return dag;
}

async function main(): Promise<void> {
  console.log('\nTygent + LangGraph Integration Example');
  console.log('======================================\n');

  const dag = createWorkflow();
  const scheduler = new Scheduler(dag);
  const outputs = await scheduler.execute({ query: 'renewable energy' });

  console.log('\nResults:');
  for (const [nodeId, value] of Object.entries(outputs)) {
    if (nodeId === '__inputs') continue;
    console.log(`  - ${nodeId}:`, value);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('LangGraph example failed', error);
    process.exitCode = 1;
  });
}
