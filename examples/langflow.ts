/**
 * Langflow integration example invoking the helper from the integration module.
 */

import { exampleLangflowAcceleration } from '../src/integrations/langflow';

async function main(): Promise<void> {
  if (typeof exampleLangflowAcceleration !== 'function') {
    console.warn('Langflow integration unavailable in this build.');
    return;
  }

  const result = await exampleLangflowAcceleration();
  console.log('\n=== Langflow + Tygent Results ===');
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Langflow example failed', error);
    process.exitCode = 1;
  });
}
