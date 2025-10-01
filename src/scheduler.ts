/**
 * DAG Scheduler for optimized execution of nodes.
 */
import fs from 'fs';
import path from 'path';
import { DAG } from './dag';
import { Node } from './nodes';
import { getLogger } from './logging';

export interface SchedulerHookConfig {
  beforeNodeExecute?: SimpleHook;
  afterNodeExecute?: SimpleHook;
}

type SimpleHook = (
  node: Node,
  inputs?: Record<string, any>,
  output?: any,
  scheduler?: Scheduler
) => Promise<boolean | void> | boolean | void;

export interface SchedulerOptions {
  maxParallelNodes?: number;
  maxExecutionTime?: number;
  priorityNodes?: string[];
  tokenBudget?: number;
  requestsPerMinute?: number;
  latencyModel?: Record<string, number>;
  auditFile?: string;
  auditDir?: string;
  hooks?: SchedulerHook[] | SchedulerHookConfig;
}

export interface SchedulerHookArgs {
  stage: 'before' | 'after';
  node: Node;
  inputs: Record<string, any>;
  output: any;
  scheduler: Scheduler;
}

export type SchedulerHook = (args: SchedulerHookArgs) => Promise<boolean | void> | boolean | void;

export class StopExecution extends Error {
  constructor(message = 'Scheduler execution stopped by hook') {
    super(message);
    this.name = 'StopExecution';
  }
}

export class Scheduler {
  dag: DAG;
  maxParallelNodes = 4;
  maxExecutionTime = 60_000; // milliseconds
  priorityNodes: string[] = [];
  tokenBudget?: number;
  tokensUsed = 0;
  requestsPerMinute?: number;
  private requestTimestamps: number[] = [];
  latencyModel?: Record<string, number>;
  auditFile?: string;
  auditDir?: string;
  hooks: SchedulerHook[] = [];
  private readonly log = getLogger('scheduler');

  constructor(dag: DAG, options: SchedulerOptions = {}) {
    this.dag = dag;
    this.configure(options);
  }

  configure(options: SchedulerOptions = {}): void {
    if (options.maxParallelNodes !== undefined) {
      this.maxParallelNodes = options.maxParallelNodes;
    }
    if (options.maxExecutionTime !== undefined) {
      this.maxExecutionTime = options.maxExecutionTime;
    }
    if (options.priorityNodes !== undefined) {
      this.priorityNodes = [...options.priorityNodes];
    }
    if (options.tokenBudget !== undefined) {
      this.tokenBudget = options.tokenBudget;
    }
    if (options.requestsPerMinute !== undefined) {
      this.requestsPerMinute = options.requestsPerMinute;
    }
    if (options.latencyModel !== undefined) {
      this.latencyModel = { ...options.latencyModel };
    }
    if (options.auditFile !== undefined) {
      this.auditFile = options.auditFile;
    }
    if (options.auditDir !== undefined) {
      this.auditDir = options.auditDir;
      if (this.auditDir && !fs.existsSync(this.auditDir)) {
        fs.mkdirSync(this.auditDir, { recursive: true });
      }
    }
    if (options.hooks !== undefined) {
      this.hooks = normalizeHooks(options.hooks, this);
    }
  }

  registerHook(hook: SchedulerHook): void {
    this.hooks.push(hook);
  }

  async execute(
    dagOrInputs?: DAG | Record<string, any>,
    maybeInputs?: Record<string, any>
  ): Promise<Record<string, any>> {
    let dag: DAG;
    let inputs: Record<string, any>;

    if (!dagOrInputs) {
      dag = this.dag;
      inputs = {};
    } else if (dagOrInputs instanceof DAG) {
      dag = dagOrInputs;
      inputs = { ...(maybeInputs ?? {}) };
      this.dag = dagOrInputs;
    } else {
      dag = this.dag;
      inputs = { ...(dagOrInputs ?? {}) };
    }

    this.tokensUsed = 0;
    this.requestTimestamps = [];
    this.log.debug('Starting DAG execution', {
      dag: dag.name,
      tokenBudget: this.tokenBudget,
      priority: this.priorityNodes,
    });

    let order = dag.getTopologicalOrder();
    this.log.trace('Execution order calculated', { order });
    if (this.priorityNodes.length) {
      const priority = new Set(this.priorityNodes);
      const prioritized = order.filter((name) => priority.has(name));
      const remaining = order.filter((name) => !priority.has(name));
      order = [...prioritized, ...remaining];
    }

    const results: Record<string, any> = { ...inputs };

    for (const nodeName of order) {
      const node = dag.getNode(nodeName);
      if (!node) {
        continue;
      }

      try {
        const executionResult = await this.runNode(dag, node, inputs, results);
        results[executionResult.name] = executionResult.output;
      } catch (error) {
        if (error instanceof StopExecution) {
          break;
        }
        throw error;
      }
    }

    this.log.debug('DAG execution finished', {
      dag: dag.name,
      tokensUsed: this.tokensUsed,
      nodeCount: Object.keys(results).length,
    });

    return results;
  }

  async executeParallel(
    dagOrInputs?: DAG | Record<string, any>,
    maybeInputs?: Record<string, any>
  ): Promise<Record<string, any>> {
    let dag: DAG;
    let inputs: Record<string, any>;

    if (!dagOrInputs) {
      dag = this.dag;
      inputs = {};
    } else if (dagOrInputs instanceof DAG) {
      dag = dagOrInputs;
      inputs = { ...(maybeInputs ?? {}) };
      this.dag = dagOrInputs;
    } else {
      dag = this.dag;
      inputs = { ...(dagOrInputs ?? {}) };
    }

    return this.runParallel(dag, inputs);
  }

  private async runParallel(dag: DAG, globalInputs: Record<string, any>): Promise<Record<string, any>> {
    this.tokensUsed = 0;
    this.requestTimestamps = [];
    this.log.debug('Starting parallel execution', {
      dag: dag.name,
      maxParallel: this.maxParallelNodes,
    });

    const results: Record<string, any> = { ...globalInputs };
    const pending = new Map<string, number>();
    const priority = new Set(this.priorityNodes);
    const ready: string[] = [];

    for (const node of dag.getAllNodes()) {
      const deps = node.dependencies || [];
      pending.set(node.name, deps.length);
      if (deps.length === 0) {
        ready.push(node.name);
      }
    }

    const limit = this.maxParallelNodes && this.maxParallelNodes > 0 ? this.maxParallelNodes : Infinity;
    const executing = new Map<string, Promise<void>>();

    const pickNext = (): string | undefined => {
      if (!ready.length) {
        return undefined;
      }
      if (!priority.size) {
        return ready.shift();
      }
      const idx = ready.findIndex((name) => priority.has(name));
      if (idx === -1) {
        return ready.shift();
      }
      const [selected] = ready.splice(idx, 1);
      return selected;
    };

    const schedule = (nodeName: string) => {
      const node = dag.getNode(nodeName);
      if (!node) {
        return;
      }
      const promise = this.runNode(dag, node, globalInputs, results).then((output) => {
        results[output.name] = output.output;
        const successors = dag.edges.get(output.name) || [];
        for (const successor of successors) {
          const remaining = (pending.get(successor) ?? 0) - 1;
          pending.set(successor, remaining);
          if (remaining === 0) {
            ready.push(successor);
          }
        }
      }).finally(() => {
        executing.delete(nodeName);
      });
      executing.set(nodeName, promise);
    };

    while (ready.length > 0 || executing.size > 0) {
      while (ready.length > 0 && executing.size < limit) {
        const next = pickNext();
        if (next === undefined) {
          break;
        }
        schedule(next);
      }

      if (executing.size > 0) {
        await Promise.race(executing.values());
      }
    }

    this.log.debug('Parallel execution finished', {
      dag: dag.name,
      tokensUsed: this.tokensUsed,
      executed: Object.keys(results).length,
    });
    return results;
  }

  private async runNode(
    dag: DAG,
    node: Node,
    globalInputs: Record<string, any>,
    results: Record<string, any>
  ): Promise<{ name: string; output: any }> {
    const nodeName = node.name;
    this.log.trace('Running node', { node: nodeName });

    await this.enforceRateLimit();

    const tokenCost = node.getTokenCost();
    if (this.tokenBudget !== undefined && this.tokensUsed + tokenCost > this.tokenBudget) {
      this.log.warn('Token budget exceeded', {
        node: nodeName,
        tokensUsed: this.tokensUsed,
        nodeCost: tokenCost,
        tokenBudget: this.tokenBudget,
      });
      throw new Error('Token budget exceeded');
    }
    this.tokensUsed += tokenCost;

    const nodeInputs = dag.getNodeInputs(nodeName, results);
    for (const [key, value] of Object.entries(globalInputs)) {
      if (nodeInputs[key] === undefined) {
        nodeInputs[key] = value;
      }
    }

    await this.runHooks('before', node, nodeInputs, undefined);

    const executionPromise = node.execute(nodeInputs);

    let timer: ReturnType<typeof setTimeout> | undefined;
    let result: any;
    if (this.maxExecutionTime > 0) {
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Node ${nodeName} timed out after ${this.maxExecutionTime} ms`));
        }, this.maxExecutionTime);
      });
      result = await Promise.race([executionPromise, timeoutPromise]);
      if (timer) {
        clearTimeout(timer);
      }
    } else {
      result = await executionPromise;
    }

    const artificialLatency = this.latencyModel?.[nodeName] ?? node.getLatency();
    if (artificialLatency && artificialLatency > 0) {
      await new Promise((resolve) => setTimeout(resolve, artificialLatency));
    }

    await this.runHooks('after', node, nodeInputs, result);

    this.writeAuditEntry(nodeName, nodeInputs, result);

    this.log.trace('Node completed', { node: nodeName });
    return { name: nodeName, output: result };
  }

  private async enforceRateLimit(): Promise<void> {
    if (!this.requestsPerMinute) {
      return;
    }
    const now = Date.now();
    const windowMs = 60_000;
    this.requestTimestamps = this.requestTimestamps.filter((t) => now - t < windowMs);
    if (this.requestTimestamps.length >= this.requestsPerMinute) {
      const waitTime = windowMs - (now - this.requestTimestamps[0]);
      this.log.debug('Rate limit reached; delaying node start', { waitTime });
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    this.requestTimestamps.push(Date.now());
  }

  private async runHooks(
    stage: 'before' | 'after',
    node: Node,
    inputs: Record<string, any>,
    output: any
  ): Promise<void> {
    for (const hook of this.hooks) {
      try {
        const cont = await hook({ stage, node, inputs, output, scheduler: this });
        if (cont === false) {
          throw new StopExecution();
        }
      } catch (error) {
        if (error instanceof StopExecution) {
          throw error;
        }
        // Ignore hook exceptions to avoid halting execution.
      }
    }
  }

  private writeAuditEntry(nodeName: string, inputs: Record<string, any>, output: any): void {
    const entry = JSON.stringify({ node: nodeName, inputs, output, timestamp: Date.now() }, null, 2);
    if (this.auditDir) {
      const filePath = path.join(this.auditDir, `${nodeName}.json`);
      fs.writeFileSync(filePath, entry);
    }
    if (this.auditFile) {
      fs.appendFileSync(this.auditFile, `${entry}
`);
    }
  }
}

function normalizeHooks(hooks: SchedulerOptions['hooks'], scheduler: Scheduler): SchedulerHook[] {
  if (!hooks) {
    return [];
  }
  if (Array.isArray(hooks)) {
    return [...hooks];
  }

  const normalized: SchedulerHook[] = [];
  if (hooks.beforeNodeExecute) {
    const handler = hooks.beforeNodeExecute;
    normalized.push(({ stage, node, inputs }) => {
      if (stage !== 'before') {
        return;
      }
      return handler(node, inputs, undefined, scheduler);
    });
  }
  if (hooks.afterNodeExecute) {
    const handler = hooks.afterNodeExecute;
    normalized.push(({ stage, node, inputs, output }) => {
      if (stage !== 'after') {
        return;
      }
      return handler(node, inputs, output, scheduler);
    });
  }

  return normalized;
}
