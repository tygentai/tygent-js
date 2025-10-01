import { describe, it, expect } from '@jest/globals';
import { GeminiCLIPlanAdapter } from '../../src/integrations/gemini-cli';
import { ClaudeCodePlanAdapter } from '../../src/integrations/claude-code';
import { OpenAICodexPlanAdapter } from '../../src/integrations/openai-codex';

describe('GeminiCLIPlanAdapter', () => {
  it('normalises Gemini CLI payloads into a ServicePlan', () => {
    const payload = {
      plan: {
        name: 'travel-assistant',
        steps: [
          {
            name: 'collect',
            prompt: 'Collect facts about {topic}',
            deps: [],
            metadata: { provider: 'google', tags: ['lookup'] },
            links: [{ url: 'https://docs.example.com/guide' }],
            token_estimate: 42,
            critical: 'yes',
          },
          {
            name: 'summarise',
            instruction: 'Write a summary using {collect}',
            deps: ['collect'],
          },
        ],
        links: ['https://docs.example.com/guide'],
        prefetch: { links: ['https://docs.example.com/guide', 'https://cdn.example.com/extra'] },
      },
    };

    const adapter = new GeminiCLIPlanAdapter(payload);
    const servicePlan = adapter.toServicePlan();

    expect(servicePlan.plan.steps).toHaveLength(2);

    const [collect, summarise] = servicePlan.plan.steps;
    expect(collect.id).toBe('collect');
    expect(collect.dependencies).toEqual([]);
    expect(collect.metadata?.provider).toBe('google');
    expect(collect.metadata?.framework).toBe('gemini_cli');
    expect(collect.metadata?.tags).toEqual(expect.arrayContaining(['lookup', 'gemini-cli']));
    expect(collect.critical).toBe(true);
    expect(collect.tokenCost).toBe(42);

    expect(summarise.id).toBe('summarise');
    expect(summarise.dependencies).toEqual(['collect']);
    expect(summarise.metadata?.provider).toBe('google');

    expect(servicePlan.prefetchLinks).toEqual([
      'https://docs.example.com/guide',
      'https://cdn.example.com/extra',
    ]);
  });

  it('returns an empty ServicePlan when steps are omitted', () => {
    const adapter = new GeminiCLIPlanAdapter({ plan: {} });
    const plan = adapter.toServicePlan();
    expect(plan.plan.steps).toHaveLength(0);
  });
});

describe('ClaudeCodePlanAdapter', () => {
  it('normalises Claude Code planning payloads', () => {
    const payload = {
      plan_id: 'session-123',
      tasks: [
        {
          id: 'outline',
          prompt: 'Outline repository structure',
          tags: ['analysis'],
          links: ['https://handbook.example.com'],
          critical: true,
        },
        {
          id: 'modify',
          instruction: 'Adjust files using {outline}',
          deps: ['outline'],
          metadata: { provider: 'anthropic', tags: ['edit'] },
        },
      ],
      resources: ['https://handbook.example.com'],
    };

    const adapter = new ClaudeCodePlanAdapter(payload);
    const servicePlan = adapter.toServicePlan();

    expect(servicePlan.plan.steps).toHaveLength(2);
    const [outline, modify] = servicePlan.plan.steps;

    expect(outline.id).toBe('outline');
    expect(outline.metadata?.provider).toBe('anthropic');
    expect(outline.metadata?.framework).toBe('claude_code');
    expect(outline.metadata?.tags).toEqual(expect.arrayContaining(['analysis', 'claude-code']));
    expect(outline.critical).toBe(true);

    expect(modify.dependencies).toEqual(['outline']);
    expect(modify.metadata?.provider).toBe('anthropic');

    expect(servicePlan.prefetchLinks).toEqual(['https://handbook.example.com']);
  });

  it('returns an empty ServicePlan when tasks are omitted', () => {
    const adapter = new ClaudeCodePlanAdapter({});
    const plan = adapter.toServicePlan();
    expect(plan.plan.steps).toHaveLength(0);
  });
});

describe('OpenAICodexPlanAdapter', () => {
  it('normalises Codex workflow payloads', () => {
    const payload = {
      workflow: {
        name: 'codex-plan',
        nodes: [
          {
            id: 'inspect',
            prompt: 'Inspect repo',
            tags: ['scan'],
            prefetch_links: ['https://repo.example.com'],
            token_estimate: 12,
          },
          {
            name: 'patch',
            instruction: 'Patch using {inspect}',
            parents: ['inspect'],
            metadata: { provider: 'openai' },
          },
        ],
        prefetch: { links: ['https://repo.example.com', 'https://cdn.example.com/assets'] },
      },
      links: ['https://cdn.example.com/assets'],
    };

    const adapter = new OpenAICodexPlanAdapter(payload);
    const servicePlan = adapter.toServicePlan();

    expect(servicePlan.plan.steps).toHaveLength(2);
    const [inspect, patch] = servicePlan.plan.steps;

    expect(inspect.id).toBe('inspect');
    expect(inspect.metadata?.framework).toBe('openai_codex');
    expect(inspect.metadata?.tags).toEqual(expect.arrayContaining(['scan', 'openai-codex']));
    expect(inspect.tokenCost).toBe(12);

    expect(patch.dependencies).toEqual(['inspect']);
    expect(patch.metadata?.provider).toBe('openai');

    expect(servicePlan.prefetchLinks).toEqual([
      'https://repo.example.com',
      'https://cdn.example.com/assets',
    ]);
  });

  it('throws when nodes are missing', () => {
    const adapter = new OpenAICodexPlanAdapter({});
    expect(() => adapter.toServicePlan()).toThrow('OpenAI Codex payload missing step definitions');
  });
});
