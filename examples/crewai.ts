/**
 * CrewAI integration example.
 * Mirrors the Python helper by delegating to `exampleCrewAIAcceleration` when available.
 */

import { exampleCrewAIAcceleration } from '../src/integrations/crewai';

async function main(): Promise<void> {
  if (typeof exampleCrewAIAcceleration !== 'function') {
    console.warn('CrewAI integration is not available in this build.');
    return;
  }

  const result = await exampleCrewAIAcceleration();
  console.log('\n=== CrewAI + Tygent Results ===');
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('CrewAI example failed', error);
    process.exitCode = 1;
  });
}
