/**
 * Multi-agent support for Tygent.
 * 
 * This module provides classes for managing multiple agents working together:
 * - MultiAgentOrchestrator: Creates and manages multiple agents
 * - CommunicationBus: Handles inter-agent communication
 * - Message: Represents messages passed between agents
 */

import { Agent } from './agent';
import { DAG } from './dag';
import { BaseNode, ToolNode, LLMNode } from './nodes';

/**
 * Represents a message passed between agents.
 */
export interface Message {
  id: string;
  fromAgent: string;
  toAgent: string;
  content: string;
  timestamp: number;
  messageType: 'standard' | 'request' | 'response' | 'broadcast';
}

/**
 * Function signature for message handlers
 */
export type MessageHandler = (message: Message) => void;

/**
 * Handles communication between agents.
 */
export class CommunicationBus {
  /** Queue of all messages sent */
  private messageQueue: Message[] = [];
  
  /** Callbacks for message delivery */
  private subscribers: Record<string, MessageHandler[]> = {};
  
  /**
   * Publish a message to the bus.
   * 
   * @param message The message to publish
   */
  publish(message: Message): void {
    this.messageQueue.push(message);
    
    // Deliver to specific agent if targeted
    if (this.subscribers[message.toAgent]) {
      for (const callback of this.subscribers[message.toAgent]) {
        callback(message);
      }
    }
    
    // Deliver to broadcast subscribers if it's a broadcast
    if (message.messageType === 'broadcast' && this.subscribers['*']) {
      for (const callback of this.subscribers['*']) {
        callback(message);
      }
    }
  }
  
  /**
   * Subscribe to messages.
   * 
   * @param agentId The agent ID to subscribe for, or "*" for all broadcasts
   * @param callback Function to call when a message is received
   */
  subscribe(agentId: string, callback: MessageHandler): void {
    if (!this.subscribers[agentId]) {
      this.subscribers[agentId] = [];
    }
    this.subscribers[agentId].push(callback);
  }
  
  /**
   * Get messages from the queue.
   * 
   * @param agentId Optional agent ID to filter messages for
   * @param limit Optional limit on number of messages to return
   * @returns List of messages
   */
  getMessages(agentId?: string, limit?: number): Message[] {
    let messages: Message[] = [];
    
    if (!agentId) {
      messages = [...this.messageQueue];
    } else {
      messages = this.messageQueue.filter(msg => 
        msg.toAgent === agentId || 
        (msg.messageType === 'broadcast' && msg.fromAgent !== agentId)
      );
    }
    
    if (limit !== undefined) {
      return messages.slice(-limit);
    }
    return messages;
  }
}

/**
 * Defines a role for an agent in a multi-agent system.
 */
export interface AgentRole {
  /** Role name (e.g., "Researcher", "Critic") */
  name: string;
  
  /** Role description */
  description: string;
  
  /** System prompt for the agent in this role */
  systemPrompt: string;
}

/**
 * Settings for optimizing multi-agent interactions.
 */
export interface OptimizationSettings {
  /** Whether to batch messages between agents */
  batchMessages: boolean;
  
  /** Whether agents can think in parallel */
  parallelThinking: boolean;
  
  /** Whether agents share memory */
  sharedMemory: boolean;
  
  /** Threshold for early stopping (0.0 = disabled) */
  earlyStopThreshold: number;
}

/**
 * Manages multiple agents working together.
 */
export class MultiAgentOrchestrator {
  /** Map of agent IDs to agent instances */
  private agents: Map<string, Agent> = new Map();
  
  /** Map of agent IDs to roles */
  private agentRoles: Map<string, AgentRole> = new Map();
  
  /** Communication bus for inter-agent messaging */
  private communicationBus: CommunicationBus = new CommunicationBus();
  
  /** LLM model to use for planning */
  private planningModel: string;
  
  /**
   * Initialize a multi-agent orchestrator.
   * 
   * @param planningModel LLM model to use for planning
   */
  constructor(planningModel: string = "gpt-4o") {
    this.planningModel = planningModel;
  }
  
  /**
   * Add an agent with a specific role.
   * 
   * @param agentId The ID for the agent
   * @param role The role for the agent
   * @returns The created agent
   */
  addAgent(agentId: string, role: AgentRole): Agent {
    const agent = new Agent(
      `${role.name} (${agentId})`,
      true, // planning enabled
      undefined, // memory node - default will be created
      this.planningModel
    );
    
    this.agents.set(agentId, agent);
    this.agentRoles.set(agentId, role);
    
    // Set up message handling
    this.communicationBus.subscribe(agentId, this.handleMessage.bind(this));
    
    return agent;
  }
  
  /**
   * Handle a message received by an agent.
   * 
   * @param message The message received
   */
  private handleMessage(message: Message): void {
    // In a full implementation, this would update the agent's context
    // and potentially trigger responses
  }
  
  /**
   * Create a DAG representing the conversation flow.
   * 
   * @param query The initial query/topic
   * @param optimizationSettings Optional optimization settings
   * @returns A DAG representing the conversation
   */
  createConversationDag(
    query: string, 
    optimizationSettings?: OptimizationSettings
  ): DAG {
    const settings = optimizationSettings || {
      batchMessages: false,
      parallelThinking: true,
      sharedMemory: true,
      earlyStopThreshold: 0.0
    };
    
    const dag = new DAG(`conversation_${Date.now().toString(36)}`);
    
    // Create input node for the query
    const inputNode = new ToolNode("input", (x: any) => ({ query }));
    dag.addNode(inputNode);
    
    // Create agent nodes
    const agentNodes: Record<string, LLMNode> = {};
    
    for (const [agentId, role] of this.agentRoles.entries()) {
      // Create a function that will process this agent's turn
      const createAgentFunction = (agentId: string) => {
        return async (inputs: any) => {
          const agent = this.agents.get(agentId);
          const role = this.agentRoles.get(agentId);
          
          if (!agent || !role) {
            throw new Error(`Agent or role not found for ID: ${agentId}`);
          }
          
          // Construct prompt with context from inputs
          const queryText = inputs.query || "";
          const context = inputs.context || "";
          
          const prompt = `
          You are acting as ${role.name}. ${role.description}
          
          ${role.systemPrompt}
          
          Here is the question or topic:
          ${queryText}
          
          ${context ? `Here is additional context: ${context}` : ""}
          `;
          
          // In a real implementation, this would use the agent to generate a response
          // For now, we'll just return a placeholder
          return {
            agent_id: agentId,
            response: `Response from ${role.name} about ${queryText}`,
            timestamp: Date.now()
          };
        };
      };
      
      // Create the node for this agent
      const agentNode = new LLMNode(
        `agent_${agentId}`,
        this.planningModel,
        `Generate response for ${role.name}`
      );
      
      // Override the process method with our custom function
      (agentNode as any).process = createAgentFunction(agentId);
      
      agentNodes[agentId] = agentNode;
      dag.addNode(agentNode);
    }
    
    // Create output/aggregation node
    const outputNode = new ToolNode("output", (x: any) => x);
    dag.addNode(outputNode);
    
    // Create edges based on optimization settings
    if (settings.parallelThinking) {
      // Connect input to all agents in parallel
      for (const agentId of this.agentRoles.keys()) {
        dag.addEdge("input", `agent_${agentId}`, { query: "query" });
      }
      
      // Connect all agents to output
      for (const agentId of this.agentRoles.keys()) {
        dag.addEdge(`agent_${agentId}`, "output");
      }
    } else {
      // Connect in sequence
      let prevNodeId = "input";
      for (const agentId of this.agentRoles.keys()) {
        dag.addEdge(prevNodeId, `agent_${agentId}`);
        prevNodeId = `agent_${agentId}`;
      }
      
      // Connect last agent to output
      dag.addEdge(prevNodeId, "output");
    }
    
    return dag;
  }
  
  /**
   * Execute a multi-agent conversation.
   * 
   * @param query The initial query/topic
   * @param optimizationSettings Optional optimization settings
   * @returns The results of the conversation
   */
  async executeConversation(
    query: string,
    optimizationSettings?: OptimizationSettings
  ): Promise<Record<string, any>> {
    // Create DAG for the conversation
    const dag = this.createConversationDag(query, optimizationSettings);
    
    // Execute the DAG
    const results = await this.executeDag(dag, { query });
    
    return results;
  }
  
  /**
   * Execute a DAG for multi-agent conversation.
   * 
   * @param dag The DAG to execute
   * @param initialInputs Initial inputs for the DAG
   * @returns The results of executing the DAG
   */
  private async executeDag(
    dag: DAG,
    initialInputs: Record<string, any>
  ): Promise<Record<string, any>> {
    // Topologically sort nodes
    const nodeOrder = dag.getTopologicalOrder();
    
    // Results for each node
    const nodeResults: Record<string, any> = {
      input: initialInputs
    };
    
    // Process nodes in order
    for (const nodeId of nodeOrder) {
      if (nodeId === "input") continue; // Already processed
      
      const node = dag.nodes[nodeId];
      
      // Get inputs for this node from previous nodes
      const inputs = dag.getNodeInputs(nodeId, nodeResults);
      
      // Execute the node
      if ((node as any).process && typeof (node as any).process === 'function') {
        const result = await (node as any).process(inputs);
        nodeResults[nodeId] = result;
      }
    }
    
    return nodeResults;
  }
  
  /**
   * Find the critical path in the DAG.
   * 
   * @param dag The DAG to analyze
   * @returns List of node IDs in the critical path
   */
  findCriticalPath(dag: DAG): string[] {
    // For simplicity, we'll estimate each agent node takes 1 time unit
    const nodeDurations: Record<string, number> = {};
    
    for (const nodeId in dag.nodes) {
      nodeDurations[nodeId] = nodeId.startsWith("agent_") ? 1.0 : 0.1;
    }
    
    // Topological sort
    const topoOrder = dag.getTopologicalOrder();
    
    // Earliest completion time for each node
    const earliestCompletion: Record<string, number> = {};
    
    // Predecessor on critical path
    const predecessor: Record<string, string | null> = {};
    
    // Compute earliest completion times
    for (const nodeId of topoOrder) {
      const outgoingEdges = (dag as any).edges[nodeId] || [];
      
      if (outgoingEdges.length === 0) {
        // No outgoing edges
        earliestCompletion[nodeId] = nodeDurations[nodeId];
        predecessor[nodeId] = null;
      } else {
        // Find the predecessor that gives the longest path
        let maxTime = 0.0;
        let maxPred = null;
        
        for (let i = 0; i < topoOrder.indexOf(nodeId); i++) {
          const predId = topoOrder[i];
          const predEdges = (dag as any).edges[predId] || [];
          
          if (predEdges.includes(nodeId)) {
            const timeThoughPred = earliestCompletion[predId] + nodeDurations[nodeId];
            if (timeThoughPred > maxTime) {
              maxTime = timeThoughPred;
              maxPred = predId;
            }
          }
        }
        
        earliestCompletion[nodeId] = maxTime;
        predecessor[nodeId] = maxPred;
      }
    }
    
    // Find the end node with the maximum completion time
    const endNodes: string[] = [];
    
    for (const nodeId in dag.nodes) {
      const outgoingEdges = (dag as any).edges[nodeId] || [];
      if (outgoingEdges.length === 0) {
        endNodes.push(nodeId);
      }
    }
    
    let endNode = endNodes[0];
    for (let i = 1; i < endNodes.length; i++) {
      if (earliestCompletion[endNodes[i]] > earliestCompletion[endNode]) {
        endNode = endNodes[i];
      }
    }
    
    // Reconstruct critical path
    const criticalPath: string[] = [];
    let current: string | null = endNode;
    
    while (current !== null) {
      criticalPath.push(current);
      current = predecessor[current];
    }
    
    // Reverse to get start-to-end order
    return criticalPath.reverse();
  }
}

/**
 * Create a message between agents.
 * 
 * @param fromAgent ID of sending agent
 * @param toAgent ID of receiving agent 
 * @param content Message content
 * @param messageType Type of message
 * @returns A new Message object
 */
export function createMessage(
  fromAgent: string,
  toAgent: string,
  content: string,
  messageType: 'standard' | 'request' | 'response' | 'broadcast' = 'standard'
): Message {
  return {
    id: Math.random().toString(36).substring(2, 15),
    fromAgent,
    toAgent,
    content,
    timestamp: Date.now(),
    messageType
  };
}