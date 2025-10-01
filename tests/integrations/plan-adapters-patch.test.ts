import { describe, it, expect, afterEach } from '@jest/globals';

afterEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('Integration patch helpers', () => {
  it('patchGeminiCLI attaches toTygentServicePlan when Planner exists', async () => {
    jest.doMock('gemini-cli/planner', () => {
      class Planner {}
      return { Planner };
    }, { virtual: true });

    const mod = await import('../../src/integrations/gemini-cli');
    mod.patch();

    const { Planner } = require('gemini-cli/planner') as { Planner: any };
    expect(typeof Planner.prototype.toTygentServicePlan).toBe('function');
    const plan = Planner.prototype.toTygentServicePlan({ plan: { steps: [] } });
    expect(plan.plan.steps).toHaveLength(0);
  });

  it('patchClaudeCode attaches toTygentServicePlan when Planner exists', async () => {
    jest.doMock('claude-code/planner', () => {
      class Planner {}
      return { Planner };
    }, { virtual: true });

    const mod = await import('../../src/integrations/claude-code');
    mod.patch();

    const { Planner } = require('claude-code/planner') as { Planner: any };
    expect(typeof Planner.prototype.toTygentServicePlan).toBe('function');
    const plan = Planner.prototype.toTygentServicePlan({ tasks: [] });
    expect(plan.plan.steps).toHaveLength(0);
  });

  it('patchOpenAICodex attaches toTygentServicePlan when Planner exists', async () => {
    jest.doMock('openai/codex/planning', () => {
      class Planner {}
      return { Planner };
    }, { virtual: true });

    const mod = await import('../../src/integrations/openai-codex');
    mod.patch();

    const { Planner } = require('openai/codex/planning') as { Planner: any };
    expect(typeof Planner.prototype.toTygentServicePlan).toBe('function');
    const plan = Planner.prototype.toTygentServicePlan({ steps: [] });
    expect(plan.plan.steps).toHaveLength(0);
  });
});
