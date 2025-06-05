/**
 * Agent module provides the agent implementation that can create DAGs from natural language plans.
 */

import OpenAI from 'openai';
import { DAG } from './dag';
import { Node, LLMNode, MemoryNode, ToolNode } from './nodes';

/**
 * Agent creates and manages DAGs from natural language plans.
 * 
 * The agent can:
 * 1. Generate a plan from a natural language input
 * 2. Convert the plan into a typed DAG
 * 3. Execute the plan using a scheduler
 */
export class Agent {
  /** Name of the agent */
  name: string;
  
  /** Whether to use planning */
  planningEnabled: boolean;
  
  /** LLM model to use for planning */
  planningModel: string;
  
  /** Registered tools */
  tools: Record<string, ToolNode>;
  
  /** Memory node for the agent */
  memory: MemoryNode;
  
  /** The execution DAG created from the plan */
  executionDag?: DAG;
  
  /** OpenAI client instance */
  private openaiClient?: OpenAI;
  
  /**
   * Initialize an agent.
   * 
   * @param name Name of the agent
   * @param planningEnabled Whether to use planning (default: true)
   * @param memory Optional memory node for the agent
   * @param planningModel LLM model to use for planning (default: "gpt-4o")
   */
  constructor(name: string, planningEnabled = true, 
              memory?: MemoryNode,
              planningModel = "gpt-4o") {
    this.name = name;
    this.planningEnabled = planningEnabled;
    this.planningModel = planningModel;
    this.tools = {};
    this.memory = memory || new MemoryNode("memory");
    
    // Initialize OpenAI client if API key is available
    if (process.env.OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }
  
  /**
   * Register a tool with the agent.
   * 
   * @param tool Tool node to register
   */
  registerTool(tool: ToolNode): void {
    this.tools[tool.id] = tool;
  }
  
  /**
   * Generate a plan for a given task.
   * 
   * @param task The task to plan for
   * @returns A string containing the plan
   */
  async plan(task: string): Promise<string> {
    if (!this.planningEnabled) {
      return `Direct execution of task: ${task}`;
    }
    
    // Use the OpenAI client if available
    if (this.openaiClient) {
      try {
        // List available tools
        const toolDescriptions = Object.entries(this.tools)
          .map(([id, tool]) => `- ${id}: ${tool.nodeType}`)
          .join('\n');
        
        const prompt = `
        Task: ${task}
        
        Available tools:
        ${toolDescriptions}
        
        Generate a step-by-step plan to accomplish this task.
        Each step should be clear and actionable.
        Format your response as a numbered list.
        `;
        
        const completion = await this.openaiClient.chat.completions.create({
          model: this.planningModel,
          messages: [
            { role: "system", content: "You are an AI assistant that creates detailed execution plans." },
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
        });
        
        return completion.choices[0].message.content || '';
      } catch (error: any) {
        console.error("Error generating plan:", error.message);
      }
    }
    
    // Fallback for testing or when OpenAI is not available
    return `
    Plan for: ${task}
    
    1. Analyze the task requirements
    2. Gather necessary information
    3. Process information
    4. Generate results
    5. Verify accuracy of results
    6. Present final answer
    `;
  }
  
  /**
   * Set the execution DAG for the agent.
   * 
   * @param dag The DAG to use for execution
   */
  setExecutionDag(dag: DAG): void {
    this.executionDag = dag;
  }
  
  /**
   * Convert a task to a DAG by first generating a plan and then converting it.
   * 
   * @param task The task to create a DAG for
   * @returns A DAG representing the plan for the task
   */
  async planToDag(task: string): Promise<DAG> {
    // Generate a plan
    const plan = await this.plan(task);
    
    // Convert plan to DAG
    return this._convertPlanToDag(plan, task);
  }
  
  /**
   * Convert a plan to a DAG using an LLM.
   * 
   * @param plan The plan to convert
   * @param task The original task
   * @returns A DAG representing the plan
   */
  private async _convertPlanToDag(plan: string, task: string): Promise<DAG> {
    // Create a new DAG
    const dag = new DAG(`dag_for_${task.substring(0, 20).replace(/\s+/g, '_')}`);
    
    if (this.openaiClient) {
      try {
        // List available tools
        const toolDescriptions = Object.entries(this.tools)
          .map(([id, tool]) => `- ${id}: ${tool.nodeType}`)
          .join('\n');
        
        const prompt = `
        Task: ${task}
        
        Plan:
        ${plan}
        
        Available tools:
        ${toolDescriptions}
        
        Convert this plan into a DAG (Directed Acyclic Graph) structure.
        Identify which steps can be executed in parallel and which have dependencies.
        Format your response as a JSON object with:
        1. nodes: array of node objects with id, type (tool, llm, input, output), and description
        2. edges: array of edge objects with from (node id) and to (node id)
        3. parallelizable: array of sets of node ids that can be executed in parallel
        `;
        
        const completion = await this.openaiClient.chat.completions.create({
          model: this.planningModel,
          messages: [
            { role: "system", content: "You are an AI assistant that converts plans to optimized execution graphs." },
            { role: "user", content: prompt }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        });
        
        // Process the response and build the DAG
        try {
          const dagStructure = JSON.parse(completion.choices[0].message.content || '{}');
          
          // This would be a more complete implementation to process the JSON response
          // For now we'll use a fallback approach
        } catch (error: any) {
          console.error("Error parsing DAG structure:", error.message);
        }
      } catch (error: any) {
        console.error("Error converting plan to DAG:", error.message);
      }
    }
    
    // For testing or when OpenAI is not available, create a simple DAG
    const inputFunction = (input: any) => ({ data: input });
    const processFunction = (input: any) => ({ processed: `Processed: ${input.data}` });
    const outputFunction = (input: any) => input.processed;
    
    const inputNode = new ToolNode("input", inputFunction);
    const processNode = new LLMNode("process", this.planningModel, "Process the following: {data}");
    const outputNode = new ToolNode("output", outputFunction);
    
    dag.addNode(inputNode);
    dag.addNode(processNode);
    dag.addNode(outputNode);
    
    dag.addEdge("input", "process", { data: "data" });
    dag.addEdge("process", "output", { response: "processed" });
    
    return dag;
  }
}