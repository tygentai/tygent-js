/**
 * Microsoft Azure OpenAI integration example (simulated).
 *
 * The Python sample uses the `azure-openai` SDK. This TypeScript version logs
 * the required environment variables and then runs a simulated DAG to
 * demonstrate how Tygent would orchestrate multiple prompts.
 */

import { accelerate } from '../src';

type Step = {
  id: string;
  action: (inputs: Record<string, string>) => Promise<string>;
  dependencies?: string[];
};

const steps: Step[] = [
  {
    id: 'market_overview',
    action: async ({ industry, region }: Record<string, string>) =>
      `Overview of ${industry} in ${region}`,
  },
  {
    id: 'market_trends',
    action: async ({ industry, region }: Record<string, string>) =>
      `Emerging trends for ${industry} in ${region}`,
  },
  {
    id: 'competitor_analysis',
    action: async ({ industry, region }: Record<string, string>) =>
      `Competitor analysis for ${industry} in ${region}`,
  },
  {
    id: 'entry_strategy',
    dependencies: ['market_overview', 'market_trends', 'competitor_analysis'],
    action: async (inputs: Record<string, string>) =>
      `Strategy using ${inputs.market_overview}, ${inputs.market_trends}, ${inputs.competitor_analysis}`,
  },
];

async function main(): Promise<void> {
  if (!process.env.AZURE_OPENAI_KEY || !process.env.AZURE_OPENAI_ENDPOINT) {
    console.warn('Set AZURE_OPENAI_KEY and AZURE_OPENAI_ENDPOINT to use the real Azure OpenAI SDK.');
    console.warn('Falling back to a simulated execution.');
  }

  const accelerated = accelerate({ steps });
  const result = await accelerated.execute({ industry: 'Renewable energy', region: 'Southeast Asia' });
  console.log('\n=== Simulated Azure OpenAI Entry Strategy ===');
  console.log(result.entry_strategy);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Microsoft AI example failed', error);
    process.exitCode = 1;
  });
}
