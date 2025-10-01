/**
 * Salesforce + Einstein integration example (simulated).
 */

import { accelerate } from '../src';

const steps = [
  {
    id: 'accounts_data',
    action: async ({ industry }: Record<string, string>) =>
      `Accounts in ${industry} with revenue > $5M`,
  },
  {
    id: 'opportunities_data',
    dependencies: ['accounts_data'],
    action: async () => 'Opportunities linked to the high-value accounts',
  },
  {
    id: 'next_best_actions',
    dependencies: ['accounts_data', 'opportunities_data'],
    action: async (inputs: Record<string, string>) =>
      `Recommended actions based on ${inputs.accounts_data} and ${inputs.opportunities_data}`,
  },
];

async function main(): Promise<void> {
  console.log('To run against real Salesforce data, install `simple-salesforce` and configure credentials.');
  console.log('Executing simulated workflow...\n');

  const accelerated = accelerate({ steps });
  const result = await accelerated.execute({ industry: 'Technology' });
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Salesforce example failed', error);
    process.exitCode = 1;
  });
}
