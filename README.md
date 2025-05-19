# Tygent JavaScript Package

Transform LLM Agents into High-Performance Engines with DAG optimization.

## Installation

```bash
npm install tygent
```

## Overview

Tygent converts agent-generated plans into typed Directed Acyclic Graphs (DAGs) for optimized execution through critical path analysis. This enables parallel execution of independent tasks and more efficient use of resources.

## Key Features

- **DAG Optimization**: Transform sequential plans into parallel execution graphs
- **Typed Execution**: Strong typing for inputs and outputs between nodes
- **Critical Path Analysis**: Identify and optimize the critical execution path
- **Constraint-Aware Scheduling**: Schedule tasks based on resource constraints
- **Dynamic Runtime Adaptation**: Adapt execution based on intermediate results

## Quick Start

```typescript
import { DAG, ToolNode, LLMNode, Scheduler } from 'tygent';

// Create a DAG for your workflow
const dag = new DAG("my_workflow");

// Define tool functions
const searchData = async (inputs) => {
  // Implementation
  return { results: `Search results for ${inputs.query}` };
};

const extractInfo = async (inputs) => {
  // Implementation
  return { extracted: `Extracted from ${inputs.results}` };
};

// Add nodes to the DAG
dag.addNode(new ToolNode("search", searchData));
dag.addNode(new ToolNode("extract", extractInfo));
dag.addNode(new LLMNode(
  "analyze", 
  "gpt-4o", 
  "Analyze this data: {extracted}"
));

// Define execution flow with dependencies
dag.addEdge("search", "extract", { results: "results" });
dag.addEdge("extract", "analyze", { extracted: "extracted" });

// Create a scheduler to execute the DAG
const scheduler = new Scheduler(dag);

// Execute the workflow
const executeWorkflow = async () => {
  const result = await scheduler.execute({ query: "What is the latest news about AI?" });
  console.log(result);
};

executeWorkflow();
```

## Advanced Usage: Creating an Agent

```typescript
import { Agent, ToolNode } from 'tygent';

// Create an agent
const agent = new Agent("my_agent");

// Register tools with the agent
agent.registerTool(new ToolNode("search", searchFunction));
agent.registerTool(new ToolNode("calculator", calculateFunction));
agent.registerTool(new ToolNode("weather", getWeatherFunction));

// Generate a plan for a task
const generatePlan = async () => {
  const plan = await agent.plan("Find the population of New York and multiply it by the average temperature");
  console.log("Plan:", plan);
  
  // Convert the plan to a DAG
  const dag = await agent.planToDag("Find the population of New York and multiply it by the average temperature");
  
  // Use a scheduler to execute the DAG
  const scheduler = new Scheduler(dag);
  const result = await scheduler.execute({});
  console.log("Result:", result);
};

generatePlan();
```

## Documentation

For detailed documentation and more examples, visit [tygent.ai](https://tygent.ai/docs) or check out the [examples repository](https://github.com/tygent-ai/tygent-examples).
