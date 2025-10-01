/**
 * OpenAI Codex planning integration for Tygent.
 *
 * Normalises Codex workflow payloads into ServicePlan instances for execution
 * by the scheduler.
 */

import { ServicePlanBuilder } from '../service-bridge';
import type { ServicePlan } from '../service-bridge';

export interface OpenAICodexPlanPayload extends Record<string, any> {
  workflow?: Record<string, any>;
  steps?: unknown;
  actions?: unknown;
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
        const record = item as Record<string, unknown>;
        const id = record.id ?? record.name ?? record.url;
        if (typeof id === 'string') {
          items.push(id);
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

function extractNodes(payload: OpenAICodexPlanPayload): Record<string, any>[] {
  const workflow = payload.workflow;
  if (workflow && typeof workflow === 'object') {
    const nodes = workflow.nodes ?? workflow.steps;
    if (Array.isArray(nodes)) {
      return nodes as Record<string, any>[];
    }
  }
  const steps = payload.steps ?? payload.actions;
  if (Array.isArray(steps)) {
    return steps as Record<string, any>[];
  }
  throw new Error('OpenAI Codex payload missing step definitions');
}

export class OpenAICodexPlanAdapter {
  constructor(
    private readonly payload: OpenAICodexPlanPayload,
    private readonly builder: ServicePlanBuilder = new ServicePlanBuilder(),
  ) {}

  toServicePlan(): ServicePlan {
    const nodes = extractNodes(this.payload);
    const planName =
      this.payload.name ??
      this.payload.workflow?.name ??
      'openai_codex_plan';

    const planPayload: Record<string, any> = {
      name: String(planName),
      steps: [] as Record<string, any>[],
    };

    for (const node of nodes) {
      if (!node || typeof node !== 'object') {
        throw new TypeError('OpenAI Codex nodes must be objects');
      }
      planPayload.steps.push(this.formatStep(node as Record<string, any>));
    }

    const prefetchLinks = this.collectPrefetchLinks();
    if (prefetchLinks.length) {
      planPayload.prefetch = { links: prefetchLinks };
    }

    return this.builder.build(planPayload);
  }

  private formatStep(node: Record<string, any>): Record<string, any> {
    const name = node.name ?? node.id;
    if (typeof name !== 'string' || !name.trim()) {
      throw new Error("OpenAI Codex node missing 'name'");
    }

    const prompt =
      node.prompt ??
      node.instruction ??
      node.code ??
      node.description ??
      '';

    const dependencies = asList(
      node.dependencies ?? node.deps ?? node.parents ?? node.requires,
    );

    const metadata = {
      ...asMapping(node.metadata),
    };

    const provider = node.provider ?? metadata.provider ?? 'openai';
    metadata.provider = provider;
    metadata.framework = metadata.framework ?? 'openai_codex';
    metadata.prompt = metadata.prompt ?? String(prompt ?? '');
    metadata.kind = metadata.kind ?? (node.kind ?? 'llm');

    const level = node.level ?? node.stage;
    if (level !== undefined && metadata.level === undefined) {
      metadata.level = level;
    }

    const tags = new Set<string>([
      ...asList(node.tags),
      ...asList(metadata.tags),
      'openai-codex',
    ]);

    const links = asList(node.links ?? node.resources ?? node.urls);

    const tokenEstimate =
      node.token_estimate ??
      node.tokenEstimate ??
      node.tokens ??
      metadata.token_estimate ??
      metadata.tokenEstimate;
    if (tokenEstimate !== undefined && metadata.token_estimate === undefined) {
      metadata.token_estimate = tokenEstimate;
    }

    const isCritical = asBool(
      node.critical ?? node.is_critical ?? metadata.is_critical,
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

  private collectPrefetchLinks(): string[] {
    const seen = new Set<string>();
    const links: string[] = [];
    const add = (candidates: unknown) => {
      for (const item of asList(candidates)) {
        if (!seen.has(item)) {
          seen.add(item);
          links.push(item);
        }
      }
    };

    add(this.payload.prefetch_links);
    const workflow = this.payload.workflow;
    if (workflow && typeof workflow === 'object') {
      add((workflow as Record<string, any>).prefetch_links);
      const prefetch = (workflow as Record<string, any>).prefetch;
      if (prefetch && typeof prefetch === 'object') {
        add((prefetch as Record<string, any>).links);
      }
    }
    add(this.payload.links);
    add(this.payload.resources);

    return links;
  }
}

export function patch(): void {
  const candidates = ['openai/codex/planning', 'openai.codex.planning'];
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
        const adapter = new OpenAICodexPlanAdapter(payload);
        return adapter.toServicePlan();
      };
      return;
    } catch (error) {
      // Optional dependency not present; continue.
    }
  }
}

export default OpenAICodexPlanAdapter;
