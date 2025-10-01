import { accelerate } from '../src/accelerate';
import { DEFAULT_LLM_RUNTIME } from '../src/service-bridge';

describe('accelerate - plan dictionaries', () => {
  it('executes plan nodes and propagates outputs through dependencies', async () => {
    const plan = {
      steps: [
        {
          id: 'inc',
          type: 'tool' as const,
          action: async ({ x }: { x: number }) => ({ a: x + 1 }),
        },
        {
          id: 'double',
          type: 'tool' as const,
          dependencies: ['inc'],
          action: async ({ a }: { a: number }) => ({ value: a * 2 }),
        },
      ],
    };

    const accelerated = accelerate(plan);
    const result = await accelerated.execute({ x: 2 });

    expect(result.inc).toEqual({ a: 3 });
    expect(result.double).toEqual({ value: 6 });
  });
});

describe('accelerate - framework object', () => {
  it('wraps framework plans exposed via get_plan()', async () => {
    const framework = {
      get_plan() {
        return {
          steps: [
            {
              id: 'first',
              type: 'tool' as const,
              action: async () => ({ value: 1 }),
            },
            {
              id: 'second',
              type: 'tool' as const,
              dependencies: ['first'],
              action: async ({ value }: { value: number }) => ({ doubled: value * 2 }),
            },
          ],
        };
      },
      frameworkProperty: 'retained',
    };

    const accelerated = accelerate(framework);
    const outputs = await accelerated.execute({});

    expect(outputs.second).toEqual({ doubled: 2 });
    expect(accelerated.frameworkProperty).toBe('retained');
  });
});

describe('accelerate - service payloads', () => {
  it('builds service plans, performs prefetch, and calls registered runtimes', async () => {
    const calls: Array<{ prompt: string; metadata: Record<string, any>; inputs: Record<string, any> }> = [];
    const providerName = `test-provider-${Date.now()}`;

    DEFAULT_LLM_RUNTIME.register(providerName, async (prompt, metadata, inputs) => {
      calls.push({ prompt, metadata: { ...metadata }, inputs: { ...inputs } });
      return { text: prompt.toUpperCase() };
    });

    const payload = {
      name: 'service',
      steps: [
        {
          name: 'discover',
          kind: 'llm',
          prompt: 'Research {topic}',
          metadata: { provider: providerName },
          links: ['https://docs'],
        },
        {
          name: 'summarize',
          kind: 'llm',
          prompt: 'Summarize {discover[result][text]}',
          metadata: { provider: providerName },
          dependencies: ['discover'],
        },
      ],
      prefetch: { links: ['https://docs'] },
    };

    const accelerated = accelerate(payload);
    const results = await accelerated.execute({ topic: 'latency' });

    expect(calls).toHaveLength(2);
    expect(calls[0].prompt).toBe('Research latency');
    expect(calls[0].inputs.prefetch['https://docs']).toBe('prefetched');
    expect(results.discover.result.text).toBe('RESEARCH LATENCY');
    expect(results.summarize.result.text).toBe('SUMMARIZE RESEARCH LATENCY');
  });
});

describe('accelerate - async functions', () => {
  it('returns accelerated async functions without altering behaviour', async () => {
    const original = async (value: number) => value + 5;
    const accelerated = accelerate(original);

    await expect(accelerated(7)).resolves.toBe(12);
  });
});
