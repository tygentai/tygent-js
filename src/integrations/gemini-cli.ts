/**
 * Gemini CLI planning integration for Tygent.
 *
 * Normalises Gemini CLI plan payloads into ServicePlan objects so they can be
 * executed by the DAG scheduler.
 */

import { ServicePlanBuilder } from '../service-bridge';
import type { ServicePlan } from '../service-bridge';

export interface GeminiCLIPlanPayload extends Record<string, any> {
  plan?: Record<string, any>;
  steps?: unknown;
  tasks?: unknown;
}

function asList(value: unknown): string[] {
  if (value == null) {
    return [];
  }
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value) || typeof (value as any)[Symbol.iterator] === 'function') {
    const items: string[] = [];
    for (const item of value as any[]) {
      if (typeof item === 'string') {
        items.push(item);
      } else if (item && typeof item === 'object') {
        const url = (item as Record<string, unknown>).url;
        if (typeof url === 'string') {
          items.push(url);
        }
      }
    }
    return items;
  }
  return [];
}

function asMapping(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, any>) };
  }
  return {};
}

function asBool(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'critical'].includes(value.toLowerCase());
  }
  return Boolean(value);
}

function extractPlan(payload: GeminiCLIPlanPayload): Record<string, any> {
  const plan = payload.plan;
  if (plan && typeof plan === 'object') {
    return plan;
  }
  return payload as Record<string, any>;
}

export class GeminiCLIPlanAdapter {
  constructor(
    private readonly payload: GeminiCLIPlanPayload,
    private readonly builder: ServicePlanBuilder = new ServicePlanBuilder(),
  ) {}

  toServicePlan(): ServicePlan {
    const planSection = extractPlan(this.payload);
    const steps = planSection.steps ?? planSection.tasks ?? [];

    if (!Array.isArray(steps)) {
      throw new Error('Gemini CLI payload requires an array of steps');
    }

    const name =
      planSection.name ??
      this.payload.name ??
      this.payload.task ??
      'gemini_cli_plan';

    const planPayload: Record<string, any> = {
      name: String(name),
      steps: [] as Record<string, any>[],
    };

    for (const step of steps) {
      if (!step || typeof step !== 'object') {
        throw new TypeError('Gemini CLI step entries must be objects');
      }
      planPayload.steps.push(this.formatStep(step as Record<string, any>));
    }

    const prefetchLinks = this.collectPrefetchLinks(planSection);
    if (prefetchLinks.length) {
      planPayload.prefetch = { links: prefetchLinks };
    }

    return this.builder.build(planPayload);
  }

  private formatStep(step: Record<string, any>): Record<string, any> {
    const name = step.name ?? step.id ?? step.title;
    if (typeof name !== 'string' || !name.trim()) {
      throw new Error("Gemini CLI step missing 'name'");
    }

    const prompt =
      step.prompt ??
      step.instruction ??
      step.description ??
      step.command ??
      '';

    const dependencies = asList(step.dependencies ?? step.deps);

    const metadata = {
      ...asMapping(step.metadata),
    };

    const provider = step.provider ?? metadata.provider ?? 'google';
    metadata.provider = provider;
    metadata.framework = metadata.framework ?? 'gemini_cli';
    metadata.prompt = metadata.prompt ?? String(prompt ?? '');
    metadata.kind = metadata.kind ?? (step.kind ?? 'llm');

    const level = step.level ?? step.stage;
    if (level !== undefined && metadata.level === undefined) {
      metadata.level = level;
    }

    const tags = new Set<string>([
      ...asList(step.tags),
      ...asList(metadata.tags),
      'gemini-cli',
    ]);

    const links = asList(step.links ?? step.resources ?? step.urls);

    const tokenEstimate =
      step.token_estimate ??
      step.tokenEstimate ??
      step.tokens ??
      metadata.token_estimate ??
      metadata.tokenEstimate;
    if (tokenEstimate !== undefined && metadata.token_estimate === undefined) {
      metadata.token_estimate = tokenEstimate;
    }

    const isCritical = asBool(
      step.critical ?? step.is_critical ?? metadata.is_critical,
    );

    return {
      name: String(name),
      kind: metadata.kind ?? 'llm',
      prompt: String(prompt ?? ''),
      dependencies,
      metadata,
      tags: Array.from(tags).sort(),
      links,
      is_critical: isCritical,
      token_estimate: tokenEstimate,
    };
  }

  private collectPrefetchLinks(planSection: Record<string, any>): string[] {
    const seen = new Set<string>();
    const links: string[] = [];

    const addLinks = (candidates: unknown) => {
      for (const item of asList(candidates)) {
        if (!seen.has(item)) {
          seen.add(item);
          links.push(item);
        }
      }
    };

    addLinks(planSection.prefetch_links);
    addLinks(planSection.links);

    if (planSection.prefetch && typeof planSection.prefetch === 'object') {
      addLinks((planSection.prefetch as Record<string, any>).links);
    }

    addLinks(planSection.attachments);

    return links;
  }
}

export function patch(): void {
  const candidates = ['gemini-cli/planner', 'gemini_cli/planner'];
  for (const candidate of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const moduleRef: any = require(candidate);
      const plannerCls = moduleRef?.Planner;
      if (!plannerCls || typeof plannerCls !== 'function') {
        continue;
      }
      if (typeof plannerCls.prototype?.toTygentServicePlan === 'function') {
        return;
      }
      plannerCls.prototype.toTygentServicePlan = function toTygentServicePlan(payload: Record<string, any>): ServicePlan {
        const adapter = new GeminiCLIPlanAdapter(payload);
        return adapter.toServicePlan();
      };
      return;
    } catch (error) {
      // Optional dependency is not available; continue to next candidate.
    }
  }
}

export default GeminiCLIPlanAdapter;
