/**
 * Service plan builder + prefetch demonstration.
 */

import { ServicePlanBuilder, DEFAULT_LLM_RUNTIME } from '../src/service-bridge';

DEFAULT_LLM_RUNTIME.register('echo-uppercase', async (prompt) => ({ text: prompt.toUpperCase() }));

const payload = {
  name: 'support_playbook',
  steps: [
    {
      name: 'discover',
      kind: 'llm',
      prompt: 'Research {topic}',
      metadata: { provider: 'echo-uppercase', token_estimate: 64 },
      links: ['https://example.com/policy'],
    },
    {
      name: 'summarize',
      kind: 'llm',
      prompt: 'Summarize {discover[result][text]} for a customer email.',
      metadata: { provider: 'echo-uppercase' },
      dependencies: ['discover'],
    },
  ],
  prefetch: { links: ['https://example.com/policy'] },
};

async function main(): Promise<void> {
  const builder = new ServicePlanBuilder();
  const plan = builder.build(payload);
  console.log('Built service plan with steps:', plan.plan.steps.length);

  const prefetched = await plan.prefetch();
  console.log('Prefetched assets:', prefetched);

  const executor = plan.plan.steps.map((step) => step.id); // simple inspection
  console.log('Step IDs:', executor);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Service plan example failed', error);
    process.exitCode = 1;
  });
}
