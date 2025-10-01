/**
 * Google AI (Gemini) integration example.
 * Requires the `@google/generative-ai` package and a GOOGLE_API_KEY in the environment.
 */

import { GoogleAIIntegration } from '../src/integrations/google-ai';

async function main(): Promise<void> {
  if (!process.env.GOOGLE_API_KEY) {
    console.warn('Set GOOGLE_API_KEY to run this example.');
    return;
  }

  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const client = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

  const integration = new GoogleAIIntegration(client.getGenerativeModel({ model: 'gemini-pro' }));
  integration.addNode('research', 'Gather product information');
  integration.addNode('write', 'Write a friendly summary', ['research']);

  integration.optimize({ maxParallelCalls: 2, priorityNodes: ['research'] });

  const results = await integration.execute({ topic: 'Sustainable packaging' });
  console.log(results);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Google AI example failed', error);
    process.exitCode = 1;
  });
}
