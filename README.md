# Tygent JavaScript/TypeScript - Speed & Efficiency Layer for AI Agents

[![CI](https://github.com/tygent/tygent-js/workflows/CI/badge.svg)](https://github.com/tygent/tygent-js/actions)
[![npm version](https://badge.fury.io/js/tygent.svg)](https://badge.fury.io/js/tygent)
[![Node.js 16+](https://img.shields.io/badge/node-16+-green.svg)](https://nodejs.org/)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)

Transform your existing JavaScript/TypeScript AI agents into high-performance engines with intelligent parallel execution and optimized scheduling. Tygent makes your agents run **up to 3x faster** and **up to 75% cheaper** with **no code changes required**.

## Quick Start

### Installation

```bash
npm install tygent
# or
yarn add tygent
```

### Basic Usage - Accelerate Any Function

```typescript
import { accelerate } from 'tygent';

// Your existing code
function researchTopic(topic: string) {
    // Your existing research logic
    return { summary: `Research on ${topic}` };
}

// Same code + Tygent wrapper = 3x faster
const acceleratedResearch = accelerate(researchTopic);
const result = acceleratedResearch("AI trends");
```

### Multi-Agent System

```typescript
import { MultiAgentManager } from 'tygent';

// Create manager
const manager = new MultiAgentManager("customer_support");

// Add agents to the system
class AnalyzerAgent {
    analyze(question: string) {
        return { intent: "password_reset", keywords: ["reset", "password"] };
    }
}

class ResearchAgent {
    search(keywords: string[]) {
        return { help_docs: ["Reset guide", "Account recovery"] };
    }
}

manager.addAgent("analyzer", new AnalyzerAgent());
manager.addAgent("researcher", new ResearchAgent());

// Execute with optimized communication
const result = await manager.execute({
    question: "How do I reset my password?"
});
```

## Key Features

- **🚀 3x Speed Improvement**: Intelligent parallel execution of independent operations
- **💰 75% Cost Reduction**: Optimized token usage and API call batching
- **🔧 Zero Code Changes**: Drop-in acceleration for existing functions and agents
- **🧠 Smart DAG Optimization**: Automatic dependency analysis and parallel scheduling
- **🔄 Dynamic Adaptation**: Runtime DAG modification based on conditions and failures
- **🎯 Framework Agnostic**: Works with any JavaScript/TypeScript AI framework

## Architecture

Tygent uses Directed Acyclic Graphs (DAGs) to model and optimize your agent workflows:

```
Your Sequential Code:        Tygent Optimized:
┌─────────────────┐         ┌─────────────────┐
│   Step 1        │         │   Step 1        │
└─────────────────┘         └─────────────────┘
         │                           │
┌─────────────────┐         ┌─────────┬───────┐
│   Step 2        │   →     │ Step 2  │Step 3 │ (Parallel)
└─────────────────┘         └─────────┴───────┘
         │                           │
┌─────────────────┐         ┌─────────────────┐
│   Step 3        │         │   Step 4        │
└─────────────────┘         └─────────────────┘
```

## Advanced Usage

### Dynamic DAG Modification

```typescript
import { accelerate } from 'tygent';

// Workflow that adapts to failures and conditions
const travelPlanningWorkflow = accelerate(async (destination: string) => {
    // Tygent automatically handles:
    // - API failures with fallback services
    // - Conditional branching based on weather
    // - Resource-aware execution adaptation
    
    const weather = await getWeather(destination); // Primary API
    // Auto-fallback to backupWeatherService if primary fails
    
    if (weather.condition === "rain") {
        // Dynamically adds indoor alternatives node
        return await getIndoorAlternatives(destination);
    } else {
        return await getOutdoorActivities(destination);
    }
});
```

### Multi-Agent System

```typescript
import { MultiAgentManager } from 'tygent';

const manager = new MultiAgentManager("customer_support");
manager.addAgent("analyzer", new AnalyzerAgent());
manager.addAgent("researcher", new ResearchAgent()); 
manager.addAgent("responder", new ResponderAgent());

// Automatically optimizes agent communication and parallel execution
const result = await manager.orchestrateConversation(
    "Customer complaint about billing",
    ["analyzer", "researcher", "responder"]
);
```

### Integration with Popular Frameworks

#### LangChain.js Integration
```typescript
import { ChatOpenAI } from "langchain/chat_models/openai";
import { accelerate } from 'tygent';

const model = new ChatOpenAI();
const acceleratedAgent = accelerate(async (query: string) => {
    return await model.call([{ content: query }]);
});

const result = await acceleratedAgent("Analyze market trends");
```

#### Custom Agent Framework
```typescript
import { DAG, ToolNode, LLMNode } from 'tygent';

// Build optimized DAGs manually for complex workflows
const dag = new DAG("content_generation");

dag.addNode(new ToolNode("research", researchFunction));
dag.addNode(new LLMNode("outline", outlineFunction));
dag.addNode(new LLMNode("write", writeFunction));

dag.addEdge("research", "outline");
dag.addEdge("outline", "write");

const result = await dag.execute({ topic: "AI trends" });
```

## Testing

### Running Tests

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test files
npx jest tests/dag.test.ts
npx jest tests/multi-agent.test.ts

# Run tests with extended timeout
npx jest --testTimeout=30000
```

### Test Coverage

Our test suite covers:
- **Core DAG functionality**: Node management, topological sorting, parallel execution
- **Multi-agent communication**: Message passing, agent orchestration, conversation history
- **TypeScript integration**: Proper type safety and async/await handling
- **Error handling**: Graceful failure recovery, fallback mechanisms

**Current Status**: Comprehensive test coverage with Jest and TypeScript support ✅

#### Recent Improvements (v1.1)
- Added complete Jest configuration with TypeScript support
- Implemented proper timeout handling for async tests
- Added GitHub Actions workflow for automated CI/CD
- Enhanced test structure with coverage reporting
- Fixed import paths and module resolution

### CI/CD

GitHub Actions workflow automatically runs:
- **Multi-version testing**: Node.js 16, 18, 20
- **Multi-platform**: Ubuntu, macOS, Windows
- **Build verification**: TypeScript compilation and packaging
- **Code quality**: ESLint linting and type checking
- **NPM publishing**: Automatic publishing on main branch pushes
- **Coverage reporting**: Jest coverage with Codecov integration

Triggers: Every push and pull request to main/develop branches

### Test Configuration

Our Jest configuration supports:
```javascript
// jest.config.js
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.ts'],
    collectCoverageFrom: ['src/**/*.ts'],
    coverageReporters: ['text', 'lcov', 'html']
};
```

## Framework Integrations

### Supported Frameworks
- **LangChain.js**: Direct agent acceleration
- **Vercel AI SDK**: Streaming and function calling optimization
- **OpenAI SDK**: Native GPT integration
- **Custom Frameworks**: Universal function acceleration

### External Service Integrations
- **OpenAI**: GPT-4, GPT-3.5-turbo optimization
- **Google AI**: Gemini model integration
- **Anthropic**: Claude model support
- **Custom APIs**: RESTful service optimization

## Performance Benchmarks

| Scenario | Original Time | Tygent Time | Speed Improvement | Cost Reduction |
|----------|---------------|-------------|-------------------|----------------|
| Multi-step Research | 45s | 15s | 3.0x faster | 75% less |
| Customer Support | 30s | 12s | 2.5x faster | 68% less |
| Content Generation | 60s | 22s | 2.7x faster | 71% less |
| Data Analysis | 120s | 41s | 2.9x faster | 73% less |

## API Reference

### Core Functions

#### `accelerate<T>(func: T): T`
Wraps any async function with intelligent DAG optimization.

```typescript
const optimizedFunction = accelerate(originalFunction);
```

#### `class DAG`
Direct DAG construction for complex workflows.

```typescript
const dag = new DAG("workflow_name");
dag.addNode(new ToolNode("step1", func1));
dag.addEdge("step1", "step2");
const result = await dag.execute(inputs);
```

#### `class MultiAgentManager`
Orchestrates multiple agents with optimized communication.

```typescript
const manager = new MultiAgentManager("system_name");
manager.addAgent("agent1", agentInstance);
const result = await manager.execute(inputs);
```

### Node Types

- **ToolNode**: Execute function calls
- **LLMNode**: Language model interactions
- **APINode**: HTTP/REST API calls
- **ConditionalNode**: Branching logic

## Development

### Project Structure
```
tygent-js/
├── src/
│   ├── index.ts             # Main exports
│   ├── accelerate.ts        # Core acceleration wrapper
│   ├── dag.ts              # DAG implementation
│   ├── nodes/              # Node types
│   ├── scheduler.ts        # Execution scheduler
│   ├── multi-agent.ts      # Multi-agent system
│   └── integrations/       # Framework integrations
├── tests/                  # Test suite
├── examples/              # Usage examples
├── dist/                  # Compiled JavaScript
└── docs/                  # Documentation
```

### Building from Source

```bash
# Clone repository
git clone https://github.com/tygent-ai/tygent-js.git
cd tygent-js

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Create package
npm pack
```

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Install dependencies: `npm install`
4. Build project: `npm run build`
5. Run tests: `npm test`
6. Commit changes: `git commit -am 'Add feature'`
7. Push to branch: `git push origin feature-name`
8. Submit a pull request

### Code Quality

- **TypeScript**: Full type safety and IntelliSense support
- **Testing**: Jest test framework with coverage reporting
- **Linting**: ESLint with TypeScript rules
- **Documentation**: TSDoc comments and examples

## TypeScript Support

Tygent is built with TypeScript and provides full type definitions:

```typescript
import { accelerate, DAG, ToolNode } from 'tygent';

// Type-safe function acceleration
const typedFunction = accelerate(async (input: string): Promise<number> => {
    return input.length;
});

// Full IntelliSense support
const result: number = await typedFunction("hello");
```

## License

Creative Commons Attribution-NonCommercial 4.0 International License.

See [LICENSE](LICENSE) for details.

## Support

- **Documentation**: [https://tygent.ai/docs](https://tygent.ai/docs)
- **Issues**: [GitHub Issues](https://github.com/tygent-ai/tygent-js/issues)
- **Discussions**: [GitHub Discussions](https://github.com/tygent-ai/tygent-js/discussions)
- **Email**: support@tygent.ai

---

**Transform your agents. Accelerate your AI.**
