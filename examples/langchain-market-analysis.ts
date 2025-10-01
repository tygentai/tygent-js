/**
 * LangChain-style market analysis example (simulated plan generation).
 * Provides a drop-in accelerated execution even without real LangChain deps.
 */

import { accelerate } from '../src';

type PlanNode = {
  prompt: string;
  deps: string[];
};

type Plan = Record<string, PlanNode>;

const SIMULATED_PLAN: Plan = {
  industry_overview: {
    prompt: 'Provide an overview of {industry} in {region}.',
    deps: [],
  },
  competitor_landscape: {
    prompt: 'List key competitors in {industry} for {region}.',
    deps: [],
  },
  customer_trends: {
    prompt: 'Summarize customer behavior trends in {industry}.',
    deps: [],
  },
  regulatory_environment: {
    prompt: 'Highlight regulatory considerations for {industry}.',
    deps: [],
  },
  executive_summary: {
    prompt:
      'Create an executive summary using {industry_overview}, {competitor_landscape}, {customer_trends}, {regulatory_environment}.',
    deps: ['industry_overview', 'competitor_landscape', 'customer_trends', 'regulatory_environment'],
  },
};

function simulateLLM(prompt: string, inputs: Record<string, string>): string {
  const filled = prompt.replace(/\{([^}]+)\}/g, (_, key) => inputs[key] ?? `[${key}]`);
  return `Simulated response to: ${filled}`;
}

async function runSequential(plan: Plan, context: Record<string, string>): Promise<Record<string, string>> {
  const outputs: Record<string, string> = {};
  for (const [name, node] of Object.entries(plan)) {
    const promptInputs = { ...context, ...outputs };
    outputs[name] = simulateLLM(node.prompt, promptInputs);
  }
  return outputs;
}

async function runAccelerated(plan: Plan, context: Record<string, string>): Promise<Record<string, string>> {
  const steps = Object.entries(plan).map(([name, node]) => ({
    id: name,
    type: 'tool' as const,
    action: async (inputs: Record<string, string>) => simulateLLM(node.prompt, inputs),
    dependencies: node.deps,
  }));

  const accelerated = accelerate({ steps });
  const result = await accelerated.execute(context);
  return Object.fromEntries(
    Object.entries(result).filter(([key]) => key !== 'prefetch' && key !== '__inputs') as [string, string][],
  );
}

async function main(): Promise<void> {
  const context = {
    industry: 'Renewable energy',
    region: 'Southeast Asia',
  };

  console.log('=== Simulated LangChain Market Analysis ===\n');
  const sequential = await runSequential(SIMULATED_PLAN, context);
  console.log('Sequential executive summary:\n', sequential.executive_summary);

  const accelerated = await runAccelerated(SIMULATED_PLAN, context);
  console.log('\nAccelerated executive summary:\n', accelerated.executive_summary);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('LangChain market analysis example failed', error);
    process.exitCode = 1;
  });
}
