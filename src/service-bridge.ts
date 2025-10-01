/**
 * Utilities for converting service payloads into executable plans.
 */

import { PlanObject, PlanStep } from './plan';
import { getLogger } from './logging';
import { prefetchMany } from './prefetch';

export type PromptHandler = (
  prompt: string,
  metadata: Record<string, any>,
  inputs: Record<string, any>
) => Promise<any> | any;

export class LLMRuntimeRegistry {
  private handlers: Map<string, PromptHandler> = new Map();

  register(provider: string, handler: PromptHandler): void {
    this.handlers.set(provider, handler);
  }

  async call(
    provider: string,
    prompt: string,
    metadata: Record<string, any>,
    inputs: Record<string, any>
  ): Promise<any> {
    const handler = this.handlers.get(provider);
    if (!handler) {
      throw new Error(`No runtime registered for provider '${provider}'`);
    }
    const result = handler(prompt, metadata, inputs);
    return result instanceof Promise ? await result : result;
  }
}

export const DEFAULT_LLM_RUNTIME = new LLMRuntimeRegistry();

DEFAULT_LLM_RUNTIME.register('echo', async (prompt, metadata, inputs) => ({
  prompt,
  metadata: { ...metadata },
  inputs: { ...inputs },
}));

const log = getLogger('service-bridge');

export class ServicePlan {
  constructor(
    public readonly plan: PlanObject,
    public readonly prefetchLinks: string[],
    public readonly raw: Record<string, any>,
  ) {}

  async prefetch(): Promise<Record<string, string>> {
    if (!this.prefetchLinks.length) {
      return {};
    }
    log.debug('Prefetching plan resources', { links: this.prefetchLinks });
    return prefetchMany(this.prefetchLinks);
  }

  toJSON(): Record<string, unknown> {
    return {
      plan: this.plan,
      prefetchLinks: this.prefetchLinks,
      raw: this.raw,
    };
  }
}

function renderPrompt(template: string, inputs: Record<string, any>): string {
  if (!template) {
    return '';
  }
  return template.replace(/\{([^}]+)\}/g, (_match, rawKey) => {
    const value = resolvePath(inputs, String(rawKey));
    return value !== undefined && value !== null ? String(value) : '';
  });
}

function resolvePath(source: Record<string, any>, rawPath: string): any {
  if (!rawPath) {
    return undefined;
  }
  const normalized = rawPath
    .replace(/\[(?:'|")?([^\[\]'"]+)(?:'|")?\]/g, '.$1')
    .replace(/^\.+/, '');
  const segments = normalized.split('.').map((segment) => segment.trim()).filter(Boolean);
  let cursor: any = source;
  for (const segment of segments) {
    if (cursor == null) {
      return undefined;
    }
    cursor = cursor[segment];
  }
  return cursor;
}

export class ServicePlanBuilder {
  constructor(private registry: LLMRuntimeRegistry = DEFAULT_LLM_RUNTIME) {}

  build(payload: Record<string, any>): ServicePlan {
    const stepsPayload = payload.steps;
    if (!Array.isArray(stepsPayload)) {
      throw new Error("Service payload missing 'steps' array");
    }

    const steps: PlanStep[] = [];

    for (const step of stepsPayload) {
      if (typeof step !== 'object' || !step) {
        continue;
      }
      const name = typeof step.name === 'string' ? step.name : undefined;
      if (!name) {
        throw new Error('Each step in payload requires a string name');
      }
      const prompt = typeof step.prompt === 'string' ? step.prompt : '';
      const kind = typeof step.kind === 'string' ? step.kind : 'llm';
      const dependencies = Array.isArray(step.dependencies) ? [...step.dependencies] : [];
      const metadata = typeof step.metadata === 'object' && step.metadata ? { ...step.metadata } : {};
      const links = Array.isArray(step.links) ? [...step.links] : [];
      const tags = Array.isArray(step.tags) ? [...step.tags] : [];
      const provider = typeof metadata.provider === 'string' ? metadata.provider : 'echo';

      if (tags.length) {
        metadata.tags = Array.from(new Set([...(metadata.tags || []), ...tags]));
      }
      if (links.length) {
        metadata.links = Array.from(new Set([...(metadata.links || []), ...links]));
      }
      if (step.level !== undefined && metadata.level === undefined) {
        metadata.level = step.level;
      }
      metadata.prompt = prompt;
      metadata.kind = kind;

      const tokenEstimate = metadata.token_estimate ?? metadata.tokenEstimate;
      const tokenCost = Number.isFinite(tokenEstimate) ? Number(tokenEstimate) : 0;

      const func = this.buildStepFunction(name, prompt, kind, metadata, provider);

      steps.push({
        id: name,
        type: 'tool',
        action: func,
        dependencies,
        metadata,
        tokenCost,
        latencyEstimate: typeof metadata.latency_estimate === 'number'
          ? metadata.latency_estimate
          : typeof metadata.simulated_duration === 'number'
            ? metadata.simulated_duration
            : undefined,
        critical: Boolean(step.is_critical || metadata.is_critical),
      });
    }

    const plan: PlanObject = { steps };
    const prefetchLinks: string[] = [];
    const seen = new Set<string>();
    const payloadPrefetch = payload.prefetch?.links;
    if (Array.isArray(payloadPrefetch)) {
      for (const link of payloadPrefetch) {
        const url = String(link);
        if (!seen.has(url)) {
          seen.add(url);
          prefetchLinks.push(url);
        }
      }
    }

    const servicePlan = new ServicePlan(plan, prefetchLinks, { ...payload });
    log.debug('Built service plan', {
      name: payload.name ?? 'service_plan',
      steps: plan.steps.length,
      prefetch: prefetchLinks.length,
    });
    return servicePlan;
  }

  private buildStepFunction(
    name: string,
    promptTemplate: string,
    kind: string,
    metadata: Record<string, any>,
    provider: string
  ) {
    return async (inputs: Record<string, any>) => {
      const renderedPrompt = renderPrompt(promptTemplate, inputs);
      const payload: {
        step: string;
        prompt: string;
        inputs: Record<string, any>;
        metadata: Record<string, any>;
        kind: string;
        result?: any;
      } = {
        step: name,
        prompt: renderedPrompt,
        inputs: { ...inputs },
        metadata: { ...metadata },
        kind,
      };
      if (kind === 'llm') {
        const result = await this.registry.call(provider, renderedPrompt, metadata, inputs);
        payload.result = result;
      } else {
        payload.result = { echo: renderedPrompt };
      }
      return payload;
    };
  }
}
