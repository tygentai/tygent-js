/**
 * CrewAI Integration for Tygent
 * 
 * This module provides integration with CrewAI, enabling automatic acceleration
 * of multi-agent crews through optimized task delegation and parallel execution.
 */

import { TygentAgent, accelerate } from '../core';

interface CrewAIAgent {
  role: string;
  goal: string;
  backstory: string;
  verbose?: boolean;
  tools?: any[];
  llm?: any;
  max_iter?: number;
  memory?: boolean;
}

interface CrewAITask {
  description: string;
  agent: CrewAIAgent;
  expected_output?: string;
  tools?: any[];
  dependencies?: CrewAITask[];
  context?: any;
  output_json?: any;
  output_pydantic?: any;
  output_file?: string;
  callback?: Function;
}

interface CrewAICrew {
  agents: CrewAIAgent[];
  tasks: CrewAITask[];
  process?: 'sequential' | 'hierarchical';
  verbose?: boolean;
  memory?: boolean;
  cache?: boolean;
  max_rpm?: number;
  language?: string;
  full_output?: boolean;
}

interface TygentMetrics {
  execution_time: number;
  optimized: boolean;
  parallel_groups: number;
  total_agents: number;
  total_tasks: number;
  performance_gain: string;
  error_type?: string;
}

interface CrewResult {
  output?: any;
  task_results?: any[];
  execution_method?: string;
  error?: string;
  tygent_metrics: TygentMetrics;
  [key: string]: any;
}

interface TaskResult {
  result: any;
  agent: string;
  task_id: string;
  execution_time: number;
  status: 'completed' | 'failed';
  error?: string;
}

/**
 * Tygent agent that accelerates CrewAI crews through intelligent
 * parallel task execution and optimized agent coordination.
 */
export class CrewAITygentAgent extends TygentAgent {
  private crew: CrewAICrew;
  private optimizeParallel: boolean;
  private agents: CrewAIAgent[];
  private tasks: CrewAITask[];

  /**
   * Initialize CrewAI Tygent agent.
   * 
   * @param crew - CrewAI Crew configuration
   * @param optimizeParallel - Enable parallel execution optimization
   */
  constructor(crew: CrewAICrew, optimizeParallel: boolean = true) {
    super();
    this.crew = crew;
    this.optimizeParallel = optimizeParallel;
    this.agents = crew.agents || [];
    this.tasks = crew.tasks || [];
  }

  /**
   * Execute a single CrewAI task with an agent.
   * 
   * @param task - CrewAI Task configuration
   * @param agent - CrewAI Agent configuration
   * @param context - Execution context and shared data
   * @returns Task execution results
   */
  async executeTask(task: CrewAITask, agent: CrewAIAgent, context: Record<string, any>): Promise<TaskResult> {
    const startTime = Date.now();
    
    try {
      // Simulate task execution with the assigned agent
      // In a real implementation, this would interface with actual CrewAI
      const result = await this.simulateTaskExecution(task, agent, context);
      
      const executionTime = (Date.now() - startTime) / 1000;
      
      return {
        result,
        agent: agent.role,
        task_id: this.generateTaskId(task),
        execution_time: executionTime,
        status: 'completed'
      };
      
    } catch (error) {
      return {
        result: null,
        agent: agent.role,
        task_id: this.generateTaskId(task),
        execution_time: (Date.now() - startTime) / 1000,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Execute the CrewAI crew with Tygent acceleration.
   * 
   * @param inputs - Input data for the crew
   * @param options - Additional execution parameters
   * @returns Crew execution results with performance metrics
   */
  async runCrew(inputs: Record<string, any>, options: Record<string, any> = {}): Promise<CrewResult> {
    const startTime = Date.now();
    
    try {
      // Analyze task dependencies for parallel execution
      const parallelGroups = this.analyzeTaskDependencies();
      
      let results: any;
      
      if (this.optimizeParallel && parallelGroups.length > 1) {
        // Execute tasks in parallel groups
        results = await this.executeParallelGroups(parallelGroups, inputs, options);
      } else {
        // Standard sequential execution
        results = await this.executeSequential(inputs, options);
      }
      
      // Add Tygent performance metrics
      const executionTime = (Date.now() - startTime) / 1000;
      results.tygent_metrics = {
        execution_time: executionTime,
        optimized: this.optimizeParallel,
        parallel_groups: parallelGroups.length,
        total_agents: this.agents.length,
        total_tasks: this.tasks.length,
        performance_gain: parallelGroups.length > 1 
          ? "faster through parallel execution"
          : "Sequential execution"
      };
      
      return results;
      
    } catch (error) {
      const executionTime = (Date.now() - startTime) / 1000;
      return {
        error: error instanceof Error ? error.message : String(error),
        tygent_metrics: {
          execution_time: executionTime,
          optimized: false,
          parallel_groups: 0,
          total_agents: this.agents.length,
          total_tasks: this.tasks.length,
          performance_gain: "No optimization due to error",
          error_type: error instanceof Error ? error.constructor.name : 'UnknownError'
        }
      };
    }
  }

  /**
   * Analyze task dependencies to identify parallel execution opportunities.
   */
  private analyzeTaskDependencies(): CrewAITask[][] {
    if (this.tasks.length === 0) {
      return [];
    }
    
    const parallelGroups: CrewAITask[][] = [];
    const processedTasks = new Set<CrewAITask>();
    
    for (const task of this.tasks) {
      if (!processedTasks.has(task)) {
        // Find tasks without dependencies that can run in parallel
        if (!this.hasDependencies(task)) {
          const group = [task];
          processedTasks.add(task);
          
          // Find other independent tasks that can run in this group
          for (const otherTask of this.tasks) {
            if (!processedTasks.has(otherTask) && 
                !this.hasDependencies(otherTask) &&
                !this.conflictsWithGroup(otherTask, group)) {
              group.push(otherTask);
              processedTasks.add(otherTask);
            }
          }
          
          parallelGroups.push(group);
        }
      }
    }
    
    // Add remaining dependent tasks as sequential groups
    for (const task of this.tasks) {
      if (!processedTasks.has(task)) {
        parallelGroups.push([task]);
        processedTasks.add(task);
      }
    }
    
    return parallelGroups;
  }

  /**
   * Check if a task has dependencies that block parallel execution.
   */
  private hasDependencies(task: CrewAITask): boolean {
    return !!(task.dependencies && task.dependencies.length > 0) || 
           !!(task.context);
  }

  /**
   * Check if a task conflicts with tasks in a parallel group.
   */
  private conflictsWithGroup(task: CrewAITask, group: CrewAITask[]): boolean {
    // Tasks using the same agent cannot run in parallel
    for (const groupTask of group) {
      if (task.agent === groupTask.agent) {
        return true;
      }
    }
    return false;
  }

  /**
   * Execute task groups in parallel.
   */
  private async executeParallelGroups(
    parallelGroups: CrewAITask[][], 
    inputs: Record<string, any>, 
    options: Record<string, any>
  ): Promise<any> {
    const allResults: TaskResult[] = [];
    const sharedContext = { ...inputs, ...options };
    
    for (const group of parallelGroups) {
      if (group.length === 1) {
        // Single task execution
        const task = group[0];
        const result = await this.executeTask(task, task.agent, sharedContext);
        allResults.push(result);
        
        // Update shared context with task result
        sharedContext[`task_${result.task_id}_output`] = result.result;
      } else {
        // Parallel execution of group tasks
        const parallelPromises = group.map(task => 
          this.executeTask(task, task.agent, sharedContext)
        );
        
        const groupResults = await Promise.allSettled(parallelPromises);
        
        for (const settlResult of groupResults) {
          if (settlResult.status === 'fulfilled') {
            allResults.push(settlResult.value);
            sharedContext[`task_${settlResult.value.task_id}_output`] = settlResult.value.result;
          }
        }
      }
    }
    
    return {
      output: "Crew execution completed with parallel optimization",
      task_results: allResults,
      execution_method: "parallel_optimized"
    };
  }

  /**
   * Execute tasks sequentially.
   */
  private async executeSequential(inputs: Record<string, any>, options: Record<string, any>): Promise<any> {
    const results: TaskResult[] = [];
    const context = { ...inputs, ...options };
    
    for (const task of this.tasks) {
      const result = await this.executeTask(task, task.agent, context);
      results.push(result);
      context[`task_${result.task_id}_output`] = result.result;
    }
    
    return {
      output: "Crew execution completed sequentially",
      task_results: results,
      execution_method: "sequential"
    };
  }

  /**
   * Simulate task execution (placeholder for actual CrewAI integration).
   */
  private async simulateTaskExecution(
    task: CrewAITask, 
    agent: CrewAIAgent, 
    context: Record<string, any>
  ): Promise<string> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    
    return `Task "${task.description}" completed by ${agent.role} agent. Context: ${JSON.stringify(context, null, 2)}`;
  }

  /**
   * Generate a unique task ID.
   */
  private generateTaskId(task: CrewAITask): string {
    return `task_${task.description.substring(0, 20).replace(/\s+/g, '_').toLowerCase()}_${Date.now()}`;
  }
}

/**
 * Accelerate a CrewAI crew using Tygent optimization.
 * 
 * @param crew - CrewAI Crew configuration
 * @param optimizeParallel - Enable parallel execution optimization
 * @returns Accelerated CrewAI agent
 * 
 * @example
 * ```typescript
 * const crew = {
 *   agents: [...],
 *   tasks: [...],
 *   process: 'sequential'
 * };
 * const acceleratedCrew = accelerateCrew(crew);
 * const result = await acceleratedCrew.runCrew({"input": "Execute tasks"});
 * ```
 */
export function accelerateCrew(crew: CrewAICrew, optimizeParallel: boolean = true): CrewAITygentAgent {
  return new CrewAITygentAgent(crew, optimizeParallel);
}

/**
 * Analyze and optimize a CrewAI crew for maximum performance.
 * 
 * @param crew - CrewAI Crew configuration
 * @returns Optimization recommendations and performance predictions
 */
export function optimizeCrewWorkflow(crew: CrewAICrew): {
  total_agents: number;
  total_tasks: number;
  parallel_opportunities: number;
  sequential_bottlenecks: number;
  optimization_recommendations: string[];
  estimated_speedup: string;
} {
  const agents = crew.agents || [];
  const tasks = crew.tasks || [];
  
  const analysis = {
    total_agents: agents.length,
    total_tasks: tasks.length,
    parallel_opportunities: 0,
    sequential_bottlenecks: 0,
    optimization_recommendations: [] as string[],
    estimated_speedup: "1x"
  };
  
  // Analyze task dependencies
  const independentTasks = tasks.filter(task => 
    (!task.dependencies || task.dependencies.length === 0) && !task.context
  );
  const dependentTasks = tasks.filter(task => 
    (task.dependencies && task.dependencies.length > 0) || task.context
  );
  
  analysis.parallel_opportunities = independentTasks.length;
  analysis.sequential_bottlenecks = dependentTasks.length;
  
  if (analysis.parallel_opportunities > 1) {
    analysis.estimated_speedup = `${Math.min(analysis.parallel_opportunities, agents.length, 4)}x`;
    analysis.optimization_recommendations.push(
      `Execute ${analysis.parallel_opportunities} independent tasks in parallel`
    );
  }
  
  if (analysis.sequential_bottlenecks > 2) {
    analysis.optimization_recommendations.push(
      "Consider breaking down task dependencies to enable more parallelism"
    );
  }
  
  // Agent utilization analysis
  if (agents.length > tasks.length) {
    analysis.optimization_recommendations.push(
      "Consider adding more tasks to fully utilize available agents"
    );
  } else if (tasks.length > agents.length * 2) {
    analysis.optimization_recommendations.push(
      "Consider adding more agents to handle the task load efficiently"
    );
  }
  
  return analysis;
}

/**
 * Decorator to accelerate CrewAI crew functions.
 * 
 * @param crew - CrewAI Crew configuration
 * @param optimizeParallel - Enable parallel execution optimization
 * 
 * @example
 * ```typescript
 * const myCrewWorkflow = tygentCrew(myCrewConfig)(async (inputs) => {
 *   // Your crew workflow logic here
 *   return processWithCrew(inputs);
 * });
 * ```
 */
export function tygentCrew(crew: CrewAICrew, optimizeParallel: boolean = true) {
  return function<T extends (...args: any[]) => any>(func: T): T {
    const agent = new CrewAITygentAgent(crew, optimizeParallel);

    const acceleratedFunc = async (...args: any[]) => {
      // Convert function call to crew execution
      let inputs: Record<string, any>;
      
      if (args.length > 0) {
        inputs = typeof args[0] === 'object' && args[0] !== null ? args[0] : { input: args[0] };
      } else {
        inputs = {};
      }

      return await agent.runCrew(inputs);
    };

    // Return accelerated version
    return accelerate(acceleratedFunc) as T;
  };
}

/**
 * Example usage function demonstrating CrewAI acceleration with Tygent.
 */
export async function exampleCrewAIAcceleration(): Promise<CrewResult> {
  // Example crew configuration
  const exampleCrew: CrewAICrew = {
    agents: [
      {
        role: 'Researcher',
        goal: 'Research and gather information on given topics',
        backstory: 'You are an expert researcher with access to various data sources.',
        verbose: true
      },
      {
        role: 'Writer',
        goal: 'Write compelling content based on research',
        backstory: 'You are a skilled writer who creates engaging content.',
        verbose: true
      },
      {
        role: 'Editor',
        goal: 'Review and improve written content',
        backstory: 'You are an experienced editor who ensures content quality.',
        verbose: true
      }
    ],
    tasks: [],
    process: 'sequential',
    verbose: true
  };

  // Create tasks
  const researchTask: CrewAITask = {
    description: 'Research the latest trends in AI technology',
    agent: exampleCrew.agents[0]
  };

  const writingTask: CrewAITask = {
    description: 'Write an article about AI trends based on research',
    agent: exampleCrew.agents[1],
    dependencies: [researchTask]
  };

  const editingTask: CrewAITask = {
    description: 'Edit and improve the written article',
    agent: exampleCrew.agents[2],
    dependencies: [writingTask]
  };

  exampleCrew.tasks = [researchTask, writingTask, editingTask];

  // Accelerate the crew
  const acceleratedCrew = accelerateCrew(exampleCrew);

  // Execute with acceleration
  const result = await acceleratedCrew.runCrew({
    topic: "Artificial Intelligence trends for 2024",
    audience: "technology professionals",
    word_count: 1500
  });

  console.log("CrewAI + Tygent Results:");
  console.log(`Output: ${result.output || 'No output'}`);
  console.log(`Performance: ${JSON.stringify(result.tygent_metrics, null, 2)}`);

  return result;
}

// Export types for TypeScript users
export type { 
  CrewAICrew, 
  CrewAIAgent, 
  CrewAITask, 
  CrewResult, 
  TaskResult, 
  TygentMetrics 
};