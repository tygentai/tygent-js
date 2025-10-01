/**
 * Multi-agent orchestration example.
 * Mirrors `examples/multi_agent_python_example.py` at a high level.
 */

import { MultiAgentManager } from '../src';

class AnalyzerAgent {
  async execute(inputs: Record<string, any>) {
    const question: string = inputs.question ?? '';
    console.log(`[Analyzer] analysing: ${question}`);
    if (question.toLowerCase().includes('refund')) {
      return { intent: 'product_return', keywords: ['refund', 'return'] };
    }
    return { intent: 'general', keywords: [] };
  }
}

class KnowledgeAgent {
  async execute(inputs: Record<string, any>) {
    console.log('[Knowledge] looking up information');
    if (inputs.intent === 'product_return') {
      return { answer: 'Products can be returned within 30 days with a receipt.' };
    }
    return { answer: 'I will connect you with an agent for more details.' };
  }
}

class ResponseAgent {
  async execute(inputs: Record<string, any>) {
    console.log('[Responder] drafting reply');
    return {
      response: `Hello! Regarding your question: ${inputs.question}. ${inputs.answer ?? ''}`,
    };
  }
}

async function main(): Promise<void> {
  const manager = new MultiAgentManager('support_flow');
  manager.addAgent('analyzer', new AnalyzerAgent());
  manager.addAgent('knowledge', new KnowledgeAgent());
  manager.addAgent('responder', new ResponseAgent());

  const outputs = await manager.execute({ question: 'Can I get a refund?' });
  console.log('\n=== Multi-agent outputs ===');
  console.log(outputs);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Multi-agent example failed', error);
    process.exitCode = 1;
  });
}
