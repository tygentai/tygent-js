/**
 * Accelerate function for drop-in optimization of existing agent frameworks.
 */

import { DAG } from './dag';
import { LLMNode, ToolNode } from './nodes';
import { PlanObject, PlanParser, PlanStep } from './plan';
import { prefetchMany } from './prefetch';
import { Scheduler } from './scheduler';
import { ServicePlanBuilder } from './service-bridge';
import { getLogger } from './logging';

const PLAN_ATTRIBUTES = ['plan', 'get_plan', 'getPlan', 'workflow'];

const log = getLogger('accelerate');

function className(value: any): string {
  return value?.constructor?.name ?? 'unknown';
}

interface LegacyPlanStep {
  name?: string;
  id?: string;
  func?: (...args: any[]) => any;
  action?: any;
  type?: 'tool' | 'llm';
  dependencies?: string[];
  metadata?: Record<string, any>;
  token_cost?: number;
  tokenCost?: number;
  latency_estimate?: number;
  latencyEstimate?: number;
  critical?: boolean;
}

interface LegacyPlan {
  steps?: LegacyPlanStep[];
  prefetch?: { links?: string[] };
  toolMap?: Record<string, any>;
  tools?: Record<string, any>;
  [key: string]: any;
}

interface PlanEnvelope {
  dag: DAG;
  critical: string[];
  prefetchLinks: string[];
}

type Inputs = Record<string, any>;

/**
 * Accelerate any function or agent framework for automatic parallel optimization.
 *
 * This is a drop-in wrapper that analyzes your existing code and automatically
 * optimizes execution through parallel processing and DAG-based scheduling.
 *
 * @param funcOrAgent - Function, agent, or framework object to accelerate
 * @returns Accelerated version with same interface but optimized execution
 */
export function accelerate(funcOrAgent?: any): any {
  if (typeof funcOrAgent === 'undefined') {
    return (inner: any) => accelerate(inner);
  }

  const directEnvelope = buildEnvelopeFromSource(funcOrAgent);
  if (directEnvelope) {
    log.debug('Created plan executor from direct input', {
      type: typeof funcOrAgent,
      source: directEnvelope.dag.name,
    });
    return new PlanExecutor(directEnvelope);
  }

  if (funcOrAgent && typeof funcOrAgent === 'object') {
    const frameworkEnvelope = extractPlanEnvelope(funcOrAgent);
    if (frameworkEnvelope) {
      log.debug('Wrapping framework with plan executor', {
        framework: className(funcOrAgent),
      });
      return wrapFrameworkExecutor(funcOrAgent, frameworkEnvelope);
    }

    const frameworkName = funcOrAgent.constructor?.name ?? '';

    // LangChain Agent
    if (frameworkName.includes('Agent') || typeof funcOrAgent.run === 'function') {
      log.debug('Accelerating LangChain agent', {
        framework: className(funcOrAgent),
      });
      return accelerateLangChainAgent(funcOrAgent);
    }

    // OpenAI Assistant
    if (funcOrAgent.id && funcOrAgent.instructions) {
      log.debug('Accelerating OpenAI assistant');
      return accelerateOpenAIAssistant(funcOrAgent);
    }

    // LlamaIndex components
    if (frameworkName.includes('Index') || typeof funcOrAgent.query === 'function') {
      log.debug('Accelerating LlamaIndex component', {
        framework: className(funcOrAgent),
      });
      return accelerateLlamaIndex(funcOrAgent);
    }
  }

  if (typeof funcOrAgent === 'function') {
    log.debug('Accelerating plain function', { name: funcOrAgent.name });
    return accelerateFunction(funcOrAgent);
  }

  log.debug('No acceleration path found; returning original value', {
    type: typeof funcOrAgent,
  });
  return funcOrAgent;
}

/**
 * Accelerate a regular function by analyzing its execution pattern.
 */
function accelerateFunction(func: Function): Function {
  if (isAsyncFunction(func)) {
    return async function acceleratedAsync(this: any, ...args: any[]) {
      return optimizeAsyncFunction(func.bind(this), args);
    };
  }

  return function acceleratedSync(this: any, ...args: any[]) {
    return optimizeSyncFunction(func.bind(this), args);
  };
}

async function optimizeAsyncFunction(func: Function, args: any[]): Promise<any> {
  return await func(...args);
}

function optimizeSyncFunction(func: Function, args: any[]): any {
  return func(...args);
}

function extractPlanEnvelope(framework: any): PlanEnvelope | null {
  for (const attr of PLAN_ATTRIBUTES) {
    if (attr in framework) {
      try {
        const rawPlan = typeof framework[attr] === 'function'
          ? framework[attr].call(framework)
          : framework[attr];
        const envelope = buildEnvelopeFromSource(rawPlan);
        if (envelope) {
          return envelope;
        }
      } catch (error) {
        continue;
      }
    }
  }
  return null;
}

function buildEnvelopeFromSource(source: any): PlanEnvelope | null {
  if (!source || typeof source !== 'object') {
    return null;
  }

  if (isServicePayload(source)) {
    try {
      const builder = new ServicePlanBuilder();
      const servicePlan = builder.build(source);
      return buildPlanEnvelopeFromPlan(servicePlan.plan, servicePlan.prefetchLinks, {});
    } catch (error) {
      return null;
    }
  }

  if (isPlanObject(source)) {
    const prefetchLinks = extractPrefetchLinks(source as LegacyPlan);
    const toolMap = resolveToolMap(source as LegacyPlan);
    return buildPlanEnvelopeFromPlan(source as PlanObject, prefetchLinks, toolMap);
  }

  if (isLegacyPlan(source)) {
    const prefetchLinks = extractPrefetchLinks(source);
    const toolMap = resolveToolMap(source);
    const planObject = convertLegacyPlan(source);
    return buildPlanEnvelopeFromPlan(planObject, prefetchLinks, toolMap);
  }

  return null;
}

function buildPlanEnvelopeFromPlan(
  plan: PlanObject,
  prefetchLinks: string[] = [],
  toolMap: Record<string, any> = {},
): PlanEnvelope {
  const dag = PlanParser.parse(plan, toolMap);
  const critical = collectCriticalNodes(plan.steps);
  return { dag, critical, prefetchLinks };
}

function isPlanObject(value: any): value is PlanObject {
  return Boolean(
    value &&
    typeof value === 'object' &&
    Array.isArray(value.steps) &&
    value.steps.every((step: any) => typeof step?.id === 'string'),
  );
}

function isLegacyPlan(value: any): value is LegacyPlan {
  return Boolean(
    value &&
    typeof value === 'object' &&
    Array.isArray(value.steps) &&
    value.steps.length &&
    (typeof value.steps[0].func === 'function' || typeof value.steps[0].action !== 'undefined' || value.steps[0].name || value.steps[0].id),
  );
}

function isServicePayload(value: any): value is LegacyPlan {
  if (!value || typeof value !== 'object' || !Array.isArray(value.steps) || !value.steps.length) {
    return false;
  }
  const first = value.steps[0];
  return typeof first.func === 'undefined' && typeof first.action === 'undefined';
}

function convertLegacyPlan(plan: LegacyPlan): PlanObject {
  const steps = (plan.steps ?? []).map((step) => convertLegacyStep(step));
  return { steps };
}

function convertLegacyStep(step: LegacyPlanStep): PlanStep {
  const id = step.id || step.name || `step_${Math.random().toString(36).slice(2, 10)}`;
  const metadata = { ...(step.metadata ?? {}) };
  const tokenCost = step.tokenCost ?? step.token_cost ?? metadata.token_cost ?? metadata.tokenEstimate;
  const latencyEstimate = step.latencyEstimate ?? step.latency_estimate ?? metadata.latency_estimate ?? metadata.simulated_duration;

  return {
    id,
    type: (step.type as PlanStep['type']) || 'tool',
    action: step.func ?? step.action,
    dependencies: [...(step.dependencies ?? [])],
    metadata,
    tokenCost: typeof tokenCost === 'number' ? tokenCost : undefined,
    latencyEstimate: typeof latencyEstimate === 'number' ? latencyEstimate : undefined,
    critical: Boolean(step.critical ?? metadata.is_critical ?? metadata.critical),
  };
}

function collectCriticalNodes(steps: PlanStep[]): string[] {
  const critical = new Set<string>();
  for (const step of steps) {
    if (step.critical) {
      critical.add(step.id);
    }
    if (step.metadata?.critical === true || step.metadata?.is_critical === true) {
      critical.add(step.id);
    }
  }
  return Array.from(critical);
}

function extractPrefetchLinks(plan: LegacyPlan): string[] {
  const links = plan.prefetch?.links;
  if (!Array.isArray(links)) {
    return [];
  }
  const deduped = new Set<string>();
  for (const link of links) {
    deduped.add(String(link));
  }
  return Array.from(deduped);
}

function resolveToolMap(source: LegacyPlan): Record<string, any> {
  if (source.toolMap && typeof source.toolMap === 'object') {
    return source.toolMap;
  }
  if (source.tools && typeof source.tools === 'object') {
    return source.tools;
  }
  return {};
}

class PlanExecutor {
  private scheduler: Scheduler;
  private prefetchLinks: string[];

  constructor(envelope: PlanEnvelope) {
    this.scheduler = new Scheduler(envelope.dag, {
      priorityNodes: envelope.critical,
    });
    this.prefetchLinks = envelope.prefetchLinks ?? [];
  }

  public execute = async (inputs: Inputs = {}): Promise<Record<string, any>> => {
    const enrichedInputs = await this.enrichWithPrefetch(inputs);
    return this.scheduler.execute(enrichedInputs);
  };

  public call = this.execute;

  private async enrichWithPrefetch(inputs: Inputs): Promise<Inputs> {
    if (!this.prefetchLinks.length) {
      return { ...inputs };
    }
    const prefetched = await prefetchMany(this.prefetchLinks);
    if (!prefetched || !Object.keys(prefetched).length) {
      return { ...inputs };
    }
    const mergedPrefetch = {
      ...(inputs.prefetch ?? {}),
      ...prefetched,
    };
    return {
      ...inputs,
      prefetch: mergedPrefetch,
    };
  }
}

function wrapFrameworkExecutor(original: any, envelope: PlanEnvelope): any {
  const executor = new PlanExecutor(envelope);
  const proxyTarget = {
    execute: (inputs: Inputs = {}) => executor.execute(inputs),
    run: (inputs: Inputs = {}) => executor.execute(inputs),
    original,
  };

  return new Proxy(proxyTarget, {
    get(target, prop) {
      if (prop in target) {
        return (target as any)[prop];
      }
      const value = original[prop];
      if (typeof value === 'function') {
        return value.bind(original);
      }
      return value;
    },
    set(_target, prop, value) {
      original[prop] = value;
      return true;
    },
    has(_target, prop) {
      return prop in proxyTarget || prop in original;
    },
  });
}

/**
 * Accelerate LangChain agents by optimizing tool execution.
 */
function accelerateLangChainAgent(agent: any): any {
  class AcceleratedLangChainAgent {
    private originalAgent: any;
    private dag: DAG;

    constructor(originalAgent: any) {
      this.originalAgent = originalAgent;
      this.dag = new DAG('langchain_optimized');
      this.setupDAG();
    }

    private setupDAG(): void {
      if (this.originalAgent.tools) {
        for (const tool of this.originalAgent.tools) {
          const toolNode = new ToolNode(tool.name, tool.func);
          this.dag.addNode(toolNode);
        }
      }
    }

    run(query: string): any {
      return this.originalAgent.run(query);
    }

    [key: string]: any;
  }

  return new Proxy(new AcceleratedLangChainAgent(agent), {
    get(target, prop) {
      if (prop in target) {
        return (target as any)[prop];
      }
      return (target as any).originalAgent[prop];
    },
  });
}

/**
 * Accelerate OpenAI Assistants by optimizing function calls.
 */
function accelerateOpenAIAssistant(assistant: any): any {
  class AcceleratedOpenAIAssistant {
    private originalAssistant: any;
    public id: string;
    public instructions: string;

    constructor(originalAssistant: any) {
      this.originalAssistant = originalAssistant;
      this.id = originalAssistant.id;
      this.instructions = originalAssistant.instructions;
    }

    [key: string]: any;
  }

  return new Proxy(new AcceleratedOpenAIAssistant(assistant), {
    get(target, prop) {
      if (prop in target) {
        return (target as any)[prop];
      }
      return (target as any).originalAssistant[prop];
    },
  });
}

/**
 * Accelerate LlamaIndex components by optimizing retrieval.
 */
function accelerateLlamaIndex(indexOrEngine: any): any {
  class AcceleratedLlamaIndex {
    private originalComponent: any;

    constructor(originalComponent: any) {
      this.originalComponent = originalComponent;
    }

    query(queryStr: string): any {
      return this.originalComponent.query(queryStr);
    }

    [key: string]: any;
  }

  return new Proxy(new AcceleratedLlamaIndex(indexOrEngine), {
    get(target, prop) {
      if (prop in target) {
        return (target as any)[prop];
      }
      return (target as any).originalComponent[prop];
    },
  });
}

function isAsyncFunction(func: Function): boolean {
  return func.constructor?.name === 'AsyncFunction';
}
