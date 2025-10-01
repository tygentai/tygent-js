import { CommunicationBus, MultiAgentManager, MultiAgentOrchestrator } from '../src/multi-agent';

describe('CommunicationBus', () => {
  it('stores and retrieves messages with optional timestamps', async () => {
    const bus = new CommunicationBus();
    const sent = await bus.send('alpha', 'beta', { text: 'hello' });

    const received = await bus.receive('beta');
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      id: sent.id,
      fromAgent: 'alpha',
      toAgent: 'beta',
      content: { text: 'hello' },
    });

    const none = await bus.receive('beta', sent.timestamp + 1);
    expect(none).toHaveLength(0);
  });
});

describe('MultiAgentManager', () => {
  it('executes registered agents and aggregates their results', async () => {
    const manager = new MultiAgentManager('support_center');

    manager.addAgent('researcher', {
      execute: async (inputs: Record<string, any>) => ({ topic: inputs.topic, notes: 'found' }),
    });

    manager.addAgent('responder', {
      execute: async (inputs: Record<string, any>) => ({ reply: `Handling ${inputs.topic}` }),
    });

    const results = await manager.execute({ topic: 'reset password' });

    expect(results.researcher).toEqual({ topic: 'reset password', notes: 'found' });
    expect(results.responder).toEqual({ reply: 'Handling reset password' });
  });
});

describe('MultiAgentOrchestrator', () => {
  it('builds a conversation DAG and executes synthetic agent turns', async () => {
    const orchestrator = new MultiAgentOrchestrator('gpt-mock');

    orchestrator.addAgent('analyst', {
      name: 'Analyst',
      description: 'analyses the query',
      systemPrompt: 'be concise',
    });
    orchestrator.addAgent('writer', {
      name: 'Writer',
      description: 'drafts the response',
      systemPrompt: 'keep tone friendly',
    });

    const dag = orchestrator.createConversationDag('Investigate latency');
    expect(dag.getNode('input')).toBeDefined();
    expect(dag.getNode('agent_analyst')).toBeDefined();
    expect(dag.getNode('agent_writer')).toBeDefined();

    const result = await orchestrator.executeConversation('Investigate latency');
    expect(result.input).toEqual({ query: 'Investigate latency' });
    expect(result.agent_analyst.response).toContain('Analyst');
    expect(result.agent_writer.response).toContain('Writer');
  });
});
