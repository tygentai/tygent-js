/**
 * Main entry point for the Tygent library
 */

// Core components
export { DAG } from './dag';
export { Node, LLMNode, ToolNode, MemoryNode } from './nodes';
export { Scheduler, StopExecution } from './scheduler';
export { accelerate } from './accelerate';
export { PlanParser } from './plan';
export { Agent, PlanAuditHook } from './agent';

// Advanced execution utilities
export {
  AdaptiveExecutor,
  RewriteRule,
  createFallbackRule,
  createConditionalBranchRule,
  createResourceAdaptationRule,
} from './adaptive-executor';

// Multi-agent orchestration
export {
  CommunicationBus,
  Message,
  MultiAgentManager,
  MultiAgentOrchestrator,
} from './multi-agent';

// Service plan utilities
export {
  ServicePlanBuilder,
  DEFAULT_LLM_RUNTIME,
  LLMRuntimeRegistry,
} from './service-bridge';
export { prefetchMany } from './prefetch';

// Auditing helpers
export { auditDag, auditPlan, auditPlans } from './audit';

// Integration patch installer
export { install } from './patch';

// Logging utilities
export { logger, getLogger, type LogLevel } from './logging';

// Service tooling
export {
  ServiceState,
  defaultStatePath,
  AccountRecord,
  type AccountRecordData,
  type ApiKeyRecord,
} from './service/state';
export {
  DEFAULT_INGESTOR_REGISTRY,
  type BasePlanIngestor,
  type StepSpec,
} from './service/ingestors';
export { createServer, startServer, type ServerOptions } from './service/server';
export { ServicePlan } from './service-bridge';
