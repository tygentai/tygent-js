/**
 * Adaptive executor with dynamic DAG modification capabilities.
 */

import { DAG } from './dag';
import { Scheduler } from './scheduler';

export type RewriteTrigger = (state: Record<string, any>) => boolean;
export type RewriteAction = (dag: DAG, state: Record<string, any>) => DAG;

export class RewriteRule {
  constructor(
    public trigger: RewriteTrigger,
    public action: RewriteAction,
    public name: string = 'unnamed_rule'
  ) {}
}

export interface AdaptiveExecutorOptions {
  maxModifications?: number;
  scheduler?: Scheduler;
}

export class AdaptiveExecutor {
  private baseDag: DAG;
  private rewriteRules: RewriteRule[];
  private maxModifications: number;
  private scheduler: Scheduler;

  constructor(
    baseDag: DAG,
    rewriteRules: RewriteRule[] = [],
    options: AdaptiveExecutorOptions = {}
  ) {
    this.baseDag = baseDag;
    this.rewriteRules = rewriteRules;
    this.maxModifications = options.maxModifications ?? 5;
    this.scheduler = options.scheduler ?? new Scheduler(baseDag.copy());
  }

  addRule(rule: RewriteRule): void {
    this.rewriteRules.push(rule);
  }

  async execute(inputs: Record<string, any>): Promise<Record<string, any>> {
    let currentDag = this.baseDag.copy();
    let modificationCount = 0;
    const modificationHistory: Array<Record<string, any>> = [];
    const executionState: Record<string, any> = { inputs: { ...inputs } };

    while (modificationCount < this.maxModifications) {
      try {
        const result = await this.scheduler.execute(currentDag, executionState.inputs);
        Object.assign(executionState, result);
      } catch (error) {
        if ((error as Error).name === 'StopExecution') {
          break;
        }
        throw error;
      }

      const triggered: RewriteRule[] = [];
      for (const rule of this.rewriteRules) {
        try {
          if (rule.trigger(executionState)) {
            triggered.push(rule);
          }
        } catch (error) {
          // Ignore trigger failures and continue.
        }
      }

      if (!triggered.length) {
        break;
      }

      const ruleToApply = triggered[0];
      try {
        currentDag = ruleToApply.action(currentDag, executionState);
        modificationCount += 1;
        modificationHistory.push({
          ruleName: ruleToApply.name,
          modificationCount,
          triggerState: { ...executionState },
        });
      } catch (error) {
        // Stop execution on action failure.
        break;
      }
    }

    return {
      ...executionState,
      modificationHistory,
      finalDag: currentDag,
      totalModifications: modificationCount,
    };
  }
}

export function createFallbackRule(
  errorCondition: RewriteTrigger,
  fallbackNodeCreator: (dag: DAG, state: Record<string, any>) => DAG,
  ruleName = 'fallback_rule'
): RewriteRule {
  return new RewriteRule(errorCondition, fallbackNodeCreator, ruleName);
}

export function createConditionalBranchRule(
  condition: RewriteTrigger,
  branchAction: RewriteAction,
  ruleName = 'conditional_branch_rule'
): RewriteRule {
  return new RewriteRule(condition, branchAction, ruleName);
}

export function createResourceAdaptationRule(
  resourceTest: RewriteTrigger,
  adaptationAction: RewriteAction,
  ruleName = 'resource_adaptation_rule'
): RewriteRule {
  return new RewriteRule(resourceTest, adaptationAction, ruleName);
}
