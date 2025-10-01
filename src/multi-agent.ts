/**
 * Multi-agent support for Tygent.
 */

import { Agent } from './agent';
import { DAG } from './dag';
import { LLMNode, ToolNode } from './nodes';

export interface Message {
  id: string;
  fromAgent: string;
  toAgent: string;
  content: any;
  timestamp: number;
}

export class CommunicationBus {
  private messages: Message[] = [];

  async send(fromAgent: string, toAgent: string, content: any): Promise<Message> {
    const message: Message = {
      id: generateId(),
      fromAgent,
      toAgent,
      content,
      timestamp: Date.now(),
    };
    this.messages.push(message);
    return message;
  }

  async receive(agentId: string, since?: number): Promise<Message[]> {
    return this.messages.filter((msg) => {
      if (msg.toAgent !== agentId) {
        return false;
      }
      if (typeof since === 'number') {
        return msg.timestamp > since;
      }
      return true;
    });
  }

  getAllMessages(): Message[] {
    return [...this.messages];
  }
}

type AgentExecutor = {
  execute(inputs: Record<string, any>): Promise<any> | any;
};

export class MultiAgentManager {
  private agents = new Map<string, AgentExecutor>();
  private communicationBus = new CommunicationBus();

  constructor(public name: string) {}

  addAgent(agentName: string, agent: AgentExecutor): void {
    this.agents.set(agentName, agent);
  }

  async execute(inputs: Record<string, any>): Promise<Record<string, any>> {
    const tasks: Array<Promise<[string, any]>> = [];
    for (const [name, agent] of this.agents.entries()) {
      const task = (async () => {
        try {
          const result = await agent.execute(inputs);
          return [name, result] as [string, any];
        } catch (error: any) {
          const message = error instanceof Error ? error.message : String(error);
          return [name, { error: message }] as [string, any];
        }
      })();
      tasks.push(task);
    }

    const resolved = await Promise.all(tasks);
    return resolved.reduce<Record<string, any>>((acc, [name, result]) => {
      acc[name] = result;
      return acc;
    }, {});
  }

  getBus(): CommunicationBus {
    return this.communicationBus;
  }
}

export interface AgentRole {
  name: string;
  description: string;
  systemPrompt: string;
}

export interface OptimizationSettings {
  batchMessages: boolean;
  parallelThinking: boolean;
  sharedMemory: boolean;
  earlyStopThreshold: number;
}

/**
 * Legacy orchestrator maintained for compatibility. Builds a simple conversation DAG
 * between registered roles and executes it sequentially or in parallel based on
 * provided optimization settings.
 */
export class MultiAgentOrchestrator {
  private agents: Map<string, Agent> = new Map();
  private agentRoles: Map<string, AgentRole> = new Map();
  private communicationBus = new CommunicationBus();
  private planningModel: string;

  constructor(planningModel: string = 'gpt-4o') {
    this.planningModel = planningModel;
  }

  addAgent(agentId: string, role: AgentRole): Agent {
    const agent = new Agent(`${role.name} (${agentId})`, true, undefined, this.planningModel);
    this.agents.set(agentId, agent);
    this.agentRoles.set(agentId, role);
    return agent;
  }

  async executeConversation(
    query: string,
    optimizationSettings?: OptimizationSettings,
  ): Promise<Record<string, any>> {
    const dag = this.createConversationDag(query, optimizationSettings);
    return this.executeDag(dag, { query });
  }

  createConversationDag(
    query: string,
    optimizationSettings?: OptimizationSettings,
  ): DAG {
    const settings = optimizationSettings || {
      batchMessages: false,
      parallelThinking: true,
      sharedMemory: true,
      earlyStopThreshold: 0,
    };

    const dag = new DAG(`conversation_${Date.now().toString(36)}`);
    const inputNode = new ToolNode('input', () => ({ query }));
    dag.addNode(inputNode);

    const agentNodes: Record<string, LLMNode> = {};
    for (const [agentId, role] of this.agentRoles.entries()) {
      const agentNode = new LLMNode(
        `agent_${agentId}`,
        this.planningModel,
        `Act as ${role.name}. ${role.description}\n${role.systemPrompt}`,
      );
      (agentNode as any).execute = async (inputs: any) => ({
        agent_id: agentId,
        response: `Response from ${role.name} about ${inputs.query ?? ''}`,
        timestamp: Date.now(),
      });
      agentNodes[agentId] = agentNode;
      dag.addNode(agentNode);
    }

    const outputNode = new ToolNode('output', (payload: any) => payload);
    dag.addNode(outputNode);

    if (settings.parallelThinking) {
      for (const agentId of this.agentRoles.keys()) {
        dag.addEdge('input', `agent_${agentId}`);
        dag.addEdge(`agent_${agentId}`, 'output');
      }
    } else {
      let previous = 'input';
      for (const agentId of this.agentRoles.keys()) {
        dag.addEdge(previous, `agent_${agentId}`);
        previous = `agent_${agentId}`;
      }
      dag.addEdge(previous, 'output');
    }

    return dag;
  }

  private async executeDag(dag: DAG, initialInputs: Record<string, any>): Promise<Record<string, any>> {
    const nodeOrder = dag.getTopologicalOrder();
    const results: Record<string, any> = { input: initialInputs };

    for (const nodeId of nodeOrder) {
      if (nodeId === 'input') {
        continue;
      }
      const node = dag.getNode(nodeId);
      if (!node) {
        continue;
      }
      const inputs = dag.getNodeInputs(nodeId, results);
      const output = await (node as any).execute(inputs);
      results[nodeId] = output;
    }

    return results;
  }
}

function generateId(): string {
  return `msg_${Math.random().toString(36).slice(2, 10)}`;
}
