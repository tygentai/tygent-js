import { getLogger } from '../logging';

const log = getLogger('ingestors');

export interface StepSpec {
  kind: string;
  prompt: string;
  deps: string[];
  links: string[];
  metadata: Record<string, unknown>;
}

export interface IngestorDescription {
  name: string;
  summary: string;
}

export abstract class BasePlanIngestor {
  abstract readonly name: string;

  constructor(public readonly config: Record<string, unknown> = {}) {}

  abstract ingest(plan: Record<string, unknown>): Record<string, StepSpec>;

  describe(): IngestorDescription {
    return { name: this.name, summary: this.constructor.name };
  }
}

export class GenericPlanIngestor extends BasePlanIngestor {
  readonly name: string = 'generic';

  ingest(plan: Record<string, unknown>): Record<string, StepSpec> {
    const steps = Array.isArray(plan.steps) ? plan.steps : [];
    if (!steps.length) {
      throw new Error('Plan contains no steps');
    }
    const spec: Record<string, StepSpec> = {};
    for (const raw of steps) {
      if (typeof raw !== 'object' || !raw) {
        throw new Error('Plan steps must be objects');
      }
      const name = String((raw as any).name ?? '');
      if (!name) {
        throw new Error('Each step requires a string name');
      }
      if (spec[name]) {
        throw new Error(`Duplicate step name ${name}`);
      }
      const kind = String((raw as any).kind ?? 'llm');
      const prompt = String((raw as any).prompt ?? '');
      const deps = Array.isArray((raw as any).deps) ? (raw as any).deps.map(String) : [];
      const links = Array.isArray((raw as any).links) ? (raw as any).links.map(String) : [];
      const metadata = typeof (raw as any).metadata === 'object' && (raw as any).metadata
        ? { ...(raw as any).metadata }
        : {};
      spec[name] = { kind, prompt, deps, links, metadata };
    }
    return spec;
  }
}

export class LangChainIngestor extends GenericPlanIngestor {
  readonly name: string = 'langchain';
}

export class CrewAIIngestor extends GenericPlanIngestor {
  readonly name: string = 'crewai';
}

export class PlanIngestorRegistry {
  private readonly ingestors: Map<string, () => BasePlanIngestor> = new Map();

  constructor() {
    this.register(() => new GenericPlanIngestor());
    this.register(() => new LangChainIngestor());
    this.register(() => new CrewAIIngestor());
  }

  register(factory: () => BasePlanIngestor): void {
    const name = factory().name;
    this.ingestors.set(name, factory);
  }

  create(name: string, config: Record<string, unknown> = {}): BasePlanIngestor {
    const factory = this.ingestors.get(name);
    if (!factory) {
      throw new Error(`Unknown ingestor: ${name}`);
    }
    const instance = factory();
    Object.assign(instance.config, config);
    return instance;
  }

  describe(): Record<string, string> {
    const payload: Record<string, string> = {};
    for (const [name, factory] of this.ingestors.entries()) {
      payload[name] = factory().describe().summary;
    }
    return payload;
  }
}

export const DEFAULT_INGESTOR_REGISTRY = new PlanIngestorRegistry();

log.debug('Initialised ingestor registry', { ingestors: DEFAULT_INGESTOR_REGISTRY.describe() });
