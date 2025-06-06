/**
 * Core module for Tygent
 * 
 * This module provides the base classes and functions used across all integrations.
 */

import { Agent } from './agent';
import { accelerate } from './accelerate';

/**
 * Base class for Tygent agents that integrate with various AI frameworks.
 */
export abstract class TygentAgent extends Agent {
  /**
   * Initialize a Tygent agent.
   * 
   * @param name Name of the agent
   * @param planningEnabled Whether to use planning (default: true)
   */
  constructor(name: string = 'TygentAgent', planningEnabled: boolean = true) {
    super(name, planningEnabled);
  }
}

// Re-export the accelerate function
export { accelerate };

// Re-export other core components
export { Agent } from './agent';
export { DAG } from './dag';
export { Node, LLMNode, ToolNode } from './nodes';
export { Scheduler } from './scheduler';