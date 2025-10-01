/**
 * Demonstrates runtime DAG rewriting with AdaptiveExecutor.
 * Mirrors the intent of `examples/dynamic_dag_example.py`.
 */

import { DAG } from '../src';
import { ToolNode } from '../src/nodes';
import {
  AdaptiveExecutor,
  RewriteRule,
  createFallbackRule,
  createConditionalBranchRule,
} from '../src/adaptive-executor';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const dag = new DAG('travel_planner');

dag.addNode(new ToolNode('fetch_weather', async ({ destination }) => {
  console.log(`Fetching weather for ${destination}...`);
  await sleep(200);
  if (destination === 'Unknown City') {
    throw new Error('Weather service unavailable');
  }
  return { destination, weather: { condition: 'rain', temperature: 60 } };
}));

dag.addNode(new ToolNode('pick_activities', async ({ weather }) => {
  await sleep(150);
  if (weather?.condition === 'rain') {
    return { activities: ['Visit museum', 'See a show'] };
  }
  return { activities: ['Go hiking', 'City tour'] };
}));

dag.addEdge('fetch_weather', 'pick_activities');

const fallbackRule: RewriteRule = createFallbackRule(
  (state) => state.error?.message?.includes('Weather service'),
  (currentDag) => {
    console.log('Applying fallback rule: inserting backup weather node');
    const updated = currentDag.copy();
    updated.addNode(new ToolNode('fallback_weather', async ({ destination }) => {
      console.log(`Using backup weather service for ${destination}...`);
      await sleep(100);
      return { destination, weather: { condition: 'clear', temperature: 75 } };
    }));
    updated.addEdge('fallback_weather', 'pick_activities');
    return updated;
  },
  'weather_fallback',
);

const sunshineRule: RewriteRule = createConditionalBranchRule(
  (state) => state.fetch_weather?.weather?.condition === 'clear',
  (currentDag) => {
    console.log('Adding sunshine bonus node');
    const updated = currentDag.copy();
    updated.addNode(new ToolNode('bonus_suggestions', async () => {
      await sleep(100);
      return { bonus: ['Sunset cruise', 'Outdoor concert'] };
    }));
    updated.addEdge('fetch_weather', 'bonus_suggestions');
    return updated;
  },
  'sunshine_bonus',
);

const executor = new AdaptiveExecutor(dag, [fallbackRule, sunshineRule]);

async function main(): Promise<void> {
  console.log('\n=== Example 1: Successful weather call ===');
  const result1 = await executor.execute({ destination: 'Lisbon' });
  console.log(JSON.stringify(result1, null, 2));

  console.log('\n=== Example 2: Trigger fallback ===');
  const result2 = await executor.execute({ destination: 'Unknown City' });
  console.log(JSON.stringify(result2, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Adaptive example failed', error);
    process.exitCode = 1;
  });
}
