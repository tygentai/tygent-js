/**
 * Unit tests for the multi-agent module.
 */

import { 
  CommunicationBus, 
  createMessage, 
  MultiAgentOrchestrator,
  AgentRole, 
  OptimizationSettings,
  Message 
} from '../src/multi-agent';
import { Agent } from '../src/agent';
import { DAG } from '../src/dag';
import { ToolNode, LLMNode } from '../src/nodes';

describe('Message', () => {
  test('createMessage creates messages with correct attributes', () => {
    const message = createMessage(
      'agent1',
      'agent2',
      'Hello, agent2!',
      'standard'
    );
    
    expect(message.fromAgent).toBe('agent1');
    expect(message.toAgent).toBe('agent2');
    expect(message.content).toBe('Hello, agent2!');
    expect(message.messageType).toBe('standard');
    expect(message.id).toBeDefined();
    expect(message.timestamp).toBeDefined();
  });
});

describe('CommunicationBus', () => {
  test('publish and subscribe work correctly', () => {
    const bus = new CommunicationBus();
    
    // Create a mock callback
    const callback = jest.fn();
    
    // Subscribe to messages for agent2
    bus.subscribe('agent2', callback);
    
    // Create and publish a message
    const message = createMessage(
      'agent1',
      'agent2',
      'Hello, agent2!',
      'standard'
    );
    bus.publish(message);
    
    // Check that the callback was called with the message
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(message);
  });
  
  test('broadcast messages are delivered to all subscribers', () => {
    const bus = new CommunicationBus();
    
    // Create mock callbacks
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    const broadcastCallback = jest.fn();
    
    // Subscribe to specific agents and broadcasts
    bus.subscribe('agent1', callback1);
    bus.subscribe('agent2', callback2);
    bus.subscribe('*', broadcastCallback);
    
    // Create and publish a broadcast message
    const message = createMessage(
      'agent1',
      'all',
      'Hello, everyone!',
      'broadcast'
    );
    bus.publish(message);
    
    // Check that the broadcast callback was called
    expect(broadcastCallback).toHaveBeenCalledTimes(1);
    expect(broadcastCallback).toHaveBeenCalledWith(message);
  });
  
  test('getMessages retrieves messages correctly', () => {
    const bus = new CommunicationBus();
    
    // Create and publish messages
    const message1 = createMessage('agent1', 'agent2', 'Hello 1');
    const message2 = createMessage('agent1', 'agent2', 'Hello 2');
    const message3 = createMessage('agent2', 'agent1', 'Response');
    
    bus.publish(message1);
    bus.publish(message2);
    bus.publish(message3);
    
    // Get all messages
    const allMessages = bus.getMessages();
    expect(allMessages.length).toBe(3);
    
    // Get messages for agent1
    const agent1Messages = bus.getMessages('agent1');
    expect(agent1Messages.length).toBe(1);
    expect(agent1Messages[0]).toBe(message3);
    
    // Test with limit
    const limitedMessages = bus.getMessages(undefined, 2);
    expect(limitedMessages.length).toBe(2);
    expect(limitedMessages[0]).toBe(message2);
    expect(limitedMessages[1]).toBe(message3);
  });
});

describe.skip('MultiAgentOrchestrator', () => {
  test('addAgent adds agents with correct roles', () => {
    const orchestrator = new MultiAgentOrchestrator();
    
    const role: AgentRole = {
      name: 'Researcher',
      description: 'Finds information',
      systemPrompt: 'You are a researcher'
    };
    
    const agent = orchestrator.addAgent('researcher', role);
    
    // Check that the agent was added correctly
    expect((orchestrator as any).agents.get('researcher')).toBe(agent);
    expect((orchestrator as any).agentRoles.get('researcher')).toBe(role);
  });
  
  test('createConversationDag creates DAG with correct structure for parallel thinking', () => {
    const orchestrator = new MultiAgentOrchestrator();
    
    // Add agents
    orchestrator.addAgent('agent1', { 
      name: 'Role1', 
      description: 'Description1', 
      systemPrompt: 'Prompt1' 
    });
    orchestrator.addAgent('agent2', { 
      name: 'Role2', 
      description: 'Description2', 
      systemPrompt: 'Prompt2' 
    });
    
    // Create a DAG with parallel thinking
    const optimizationSettings: OptimizationSettings = {
      batchMessages: false,
      parallelThinking: true,
      sharedMemory: true,
      earlyStopThreshold: 0.0
    };
    
    const dag = orchestrator.createConversationDag('Test query', optimizationSettings);
    
    // Verify DAG structure
    expect(dag.getNode('input')).toBeDefined();
    expect(dag.getNode('agent_agent1')).toBeDefined();
    expect(dag.getNode('agent_agent2')).toBeDefined();
    expect(dag.getNode('output')).toBeDefined();
    
    // Verify edges for parallel execution
    expect((dag as any).edges.get('input')).toContain('agent_agent1');
    expect((dag as any).edges.get('input')).toContain('agent_agent2');
    expect((dag as any).edges.get('agent_agent1')).toContain('output');
    expect((dag as any).edges.get('agent_agent2')).toContain('output');
  });
  
  test('createConversationDag creates DAG with correct structure for sequential thinking', () => {
    const orchestrator = new MultiAgentOrchestrator();
    
    // Add agents
    orchestrator.addAgent('agent1', { 
      name: 'Role1', 
      description: 'Description1', 
      systemPrompt: 'Prompt1' 
    });
    orchestrator.addAgent('agent2', { 
      name: 'Role2', 
      description: 'Description2', 
      systemPrompt: 'Prompt2' 
    });
    
    // Create a DAG with sequential thinking
    const optimizationSettings: OptimizationSettings = {
      batchMessages: false,
      parallelThinking: false,
      sharedMemory: true,
      earlyStopThreshold: 0.0
    };
    
    const dag = orchestrator.createConversationDag('Test query', optimizationSettings);
    
    // Verify edges for sequential execution
    expect((dag as any).edges.get('input')).toContain('agent_agent1');
    expect((dag as any).edges.get('agent_agent1')).toContain('agent_agent2');
    expect((dag as any).edges.get('agent_agent2')).toContain('output');
  });
  
  test('findCriticalPath identifies critical path in a DAG', () => {
    const orchestrator = new MultiAgentOrchestrator();
    
    // Create a simple DAG manually
    const dag = new DAG('test_dag');
    
    // Add nodes and edges that form a known critical path
    const inputNode = new ToolNode('input', (x: any) => x);
    const agent1Node = new LLMNode('agent_agent1', 'model', 'prompt');
    const agent2Node = new LLMNode('agent_agent2', 'model', 'prompt');
    const outputNode = new ToolNode('output', (x: any) => x);
    
    dag.addNode(inputNode);
    dag.addNode(agent1Node);
    dag.addNode(agent2Node);
    dag.addNode(outputNode);
    
    // Path: input -> agent1 -> output
    dag.addEdge('input', 'agent_agent1');
    dag.addEdge('agent_agent1', 'output');
    
    // Alternative path: input -> agent2 -> output
    dag.addEdge('input', 'agent_agent2');
    dag.addEdge('agent_agent2', 'output');
    
    const criticalPath = orchestrator.findCriticalPath(dag);
    
    // The critical path should contain these nodes (exact order depends on implementation)
    expect(criticalPath).toContain('input');
    expect(criticalPath).toContain('output');
    expect(criticalPath.includes('agent_agent1') || criticalPath.includes('agent_agent2')).toBeTruthy();
  });
  
  test('executeConversation executes a conversation and returns results', async () => {
    const orchestrator = new MultiAgentOrchestrator();
    
    // Add agents
    orchestrator.addAgent('agent1', { 
      name: 'Role1', 
      description: 'Description1', 
      systemPrompt: 'Prompt1' 
    });
    orchestrator.addAgent('agent2', { 
      name: 'Role2', 
      description: 'Description2', 
      systemPrompt: 'Prompt2' 
    });
    
    // Create a spy on the executeDag method to avoid actual execution
    const mockResults = {
      input: { query: 'Test query' },
      agent_agent1: {
        agent_id: 'agent1',
        response: 'Response from Agent 1',
        timestamp: 12345
      },
      agent_agent2: {
        agent_id: 'agent2',
        response: 'Response from Agent 2',
        timestamp: 12346
      },
      output: {
        result: 'Combined result'
      }
    };
    
    // Mock the private executeDag method
    (orchestrator as any).executeDag = jest.fn().mockResolvedValue(mockResults);
    
    // Execute the conversation
    const results = await orchestrator.executeConversation('Test query');
    
    // Verify results
    expect(results).toBe(mockResults);
    expect(results.agent_agent1.response).toBe('Response from Agent 1');
    expect(results.agent_agent2.response).toBe('Response from Agent 2');
  });
});