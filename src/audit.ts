/**
 * Audit utilities for plans and DAGs.
 */

import { DAG } from './dag';
import { PlanObject, PlanParser } from './plan';

export function auditDag(dag: DAG): string {
  const lines: string[] = [`DAG: ${dag.name}`];
  for (const node of dag.getAllNodes()) {
    const deps = node.dependencies.length ? node.dependencies.join(', ') : 'none';
    lines.push(`- ${node.name}: depends on ${deps}`);
  }
  return lines.join(String.fromCharCode(10));
}

export function auditPlan(plan: PlanObject): string {
  const dag = PlanParser.parse(plan);
  return auditDag(dag);
}

export function auditPlans(plans: Array<string | PlanObject>): string {
  const dag = PlanParser.parseMultiple(plans);
  return auditDag(dag);
}
