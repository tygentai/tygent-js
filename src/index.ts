/**
 * Tygent: Transform LLM Agents into High-Performance Engines
 * 
 * Tygent converts agent-generated plans into typed Directed Acyclic Graphs (DAGs) 
 * for optimized execution through critical path analysis. It also supports multi-agent
 * orchestration with optimized communication patterns.
 */

export { DAG } from './dag';
export { BaseNode, LLMNode, ToolNode, MemoryNode } from './nodes';
export { Scheduler, AdaptiveExecutor } from './scheduler';
export { Agent } from './agent';
export { 
  MultiAgentOrchestrator,
  CommunicationBus,
  createMessage,
  Message,
  AgentRole,
  OptimizationSettings
} from './multi-agent';