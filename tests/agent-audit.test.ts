import { describe, it, expect } from '@jest/globals';
import { Agent, PlanAuditHook, DAG, ToolNode } from '../src';
import { Scheduler } from '../src/scheduler';
import fs from 'fs';
import path from 'path';

describe('Plan auditing', () => {
  it('allows audit hook to modify plan', async () => {
    const agent = new Agent('audit-test');
    const hook: PlanAuditHook = (plan) => plan.replace('Analyze', 'Review');
    const dag = await agent.planToDag('sample task', hook);
    expect(dag).toBeInstanceOf(DAG);
  });

  it('throws when audit hook rejects plan', async () => {
    const agent = new Agent('audit-test');
    const hook: PlanAuditHook = () => false;
    await expect(agent.planToDag('sample task', hook)).rejects.toThrow(/audit/);
  });
});

describe('Scheduler audit trail and hooks', () => {
  it('writes audit file and can stop execution', async () => {
    const dag = new DAG('audit');
    const a = new ToolNode('a', () => ({ val: 1 }));
    const b = new ToolNode('b', () => ({ val: 2 }));
    b.setDependencies(['a']);
    dag.addNode(a);
    dag.addNode(b);
    dag.addEdge('a', 'b');

    const dir = path.join(__dirname, 'audit_tmp');
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true });
    }

    const scheduler = new Scheduler(dag, {
      auditDir: dir,
      hooks: {
        beforeNodeExecute: (node) => {
          if (node.name === 'b') return false;
        }
      }
    });

    const result = await scheduler.execute();
    expect(result['a']).toBeDefined();
    expect(result['b']).toBeUndefined();
    const fileA = path.join(dir, 'a.json');
    const fileB = path.join(dir, 'b.json');
    expect(fs.existsSync(fileA)).toBe(true);
    expect(fs.existsSync(fileB)).toBe(false);
  });
});
