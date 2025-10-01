/**
 * Tygent Integrations
 *
 * This module provides integrations with popular LLM frameworks and platforms.
 */

// Export integrations
export * from './google-ai';
export {
  CrewAITygentAgent,
  accelerateCrew,
  optimizeCrewWorkflow,
  tygentCrew,
  exampleCrewAIAcceleration,
  type CrewAICrew,
  type CrewAIAgent,
  type CrewAITask,
  type CrewResult,
  type TaskResult,
  type TygentMetrics as CrewAITygentMetrics,
} from './crewai';

export {
  LangflowTygentAgent,
  accelerateLangflowFlow,
  optimizeLangflowWorkflow,
  tygentLangflow,
  type LangflowFlow,
  type FlowResult,
  type TygentMetrics as LangflowTygentMetrics,
} from './langflow';
