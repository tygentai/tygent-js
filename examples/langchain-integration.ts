/**
 * LangChain integration example using mocked tools and agent.
 * Demonstrates drop-in acceleration similar to the Python example.
 */

import { accelerate } from '../src';

type ToolFn = (query: string) => string;

class MockLangChainTool {
  constructor(public readonly name: string, public readonly func: ToolFn) {}
}

class MockLangChainAgent {
  constructor(public readonly tools: MockLangChainTool[], public readonly llm: string) {}

  run(query: string): string {
    const results: string[] = [];
    for (const tool of this.tools) {
      const lower = tool.name.toLowerCase();
      if (lower.includes('search') && query.toLowerCase().includes('search')) {
        results.push(`${tool.name}: ${tool.func(query)}`);
      }
      if (lower.includes('calculator') && /\d/.test(query)) {
        results.push(`${tool.name}: ${tool.func(query)}`);
      }
    }
    const combined = results.length ? results.join('; ') : 'No tools needed';
    return `Agent response: ${query}. Tool results: ${combined}`;
  }
}

const searchTool = new MockLangChainTool('Search', (query: string) => `Search results for ${query}`);
const calculatorTool = new MockLangChainTool('Calculator', (expression: string) => `Calculated: ${expression}`);

async function main(): Promise<void> {
  console.log('Tygent + LangChain Integration Example');
  console.log('=====================================\n');

  const agent = new MockLangChainAgent([searchTool, calculatorTool], 'gpt-4');
  const query = 'Search for AI developments and calculate 2+2';

  console.log('Standard agent run:');
  const standard = agent.run(query);
  console.log(standard);

  console.log('\nAccelerated agent run:');
  const acceleratedAgent = accelerate(agent);
  const accelerated = acceleratedAgent.run(query);
  console.log(accelerated);

  console.log(`\nResults match: ${standard === accelerated}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('LangChain integration example failed', error);
    process.exitCode = 1;
  });
}
