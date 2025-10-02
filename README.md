[![CI](https://github.com/tygentai/tygent-js/workflows/CI/badge.svg)](https://github.com/tygentai/tygent-js/actions)
[![npm version](https://badge.fury.io/js/tygent.svg)](https://badge.fury.io/js/tygent)
[![Node.js 16+](https://img.shields.io/badge/node-16+-green.svg)](https://nodejs.org/)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)
# Tygent (JavaScript / TypeScript)

Tygent restructures unorganised LLM agent plans into explicit execution artefacts so you can orchestrate steps deterministically and fetch the right context at the right time. Directed execution graphs[^dag] are the default structure the TypeScript runtime produces, pairing node metadata with prefetch directives that the scheduler and tooling understand.

## Highlights
- **Structured planner** – parse natural-language or JSON payloads into typed steps with dependencies, tags, and link metadata (`PlanParser`, `ServicePlanBuilder`).
- **Context-aware scheduler** – `Scheduler` consumes the structured plan to prioritise nodes, respect latency models, honour token budgets, and emit audit hooks; `executeParallel` adds batched concurrency.
- **Drop-in acceleration** – `accelerate()` wraps callables, framework objects, or service payloads and returns an executor backed by the structured representation.
- **Adaptive executor** – `AdaptiveExecutor` and rewrite rules adjust the plan mid-flight for fallbacks, branching, or resource-aware behaviour while preserving metadata.
- **Multi-agent orchestration** – `MultiAgentManager` and `CommunicationBus` coordinate agents using the shared structured context; the legacy `MultiAgentOrchestrator` continues to emit conversation graphs[^dag] for demos.
- **Service & CLI** – the bundled CLI manages tenant state, ingestors, and API keys, and can host a simple HTTP service (`tygent serve`) that surfaces structured plan conversions and catalogue endpoints.
- **Structured logging** – `getLogger()` provides namespace-scoped JSON logging with level control via the `TYGENT_LOG_LEVEL` environment variable.
- **Coding-agent integrations** – adapters for Gemini CLI, Claude Code, and OpenAI Codex convert planning payloads into `ServicePlan` objects with rich metadata.

## Coding-agent integrations

Tygent ships plan adapters for popular coding assistants so you can normalise their planning payloads into `ServicePlan` structures without rewriting the agent.

- `GeminiCLIPlanAdapter` converts Google Gemini CLI plans (`tygent/integrations/gemini-cli`).
- `ClaudeCodePlanAdapter` handles Anthropic's Claude Code planning traces.
- `OpenAICodexPlanAdapter` supports historical OpenAI Codex workflow payloads.

```typescript
import { GeminiCLIPlanAdapter, Scheduler } from 'tygent';

const adapter = new GeminiCLIPlanAdapter(geminiPayload);
const servicePlan = adapter.toServicePlan();
const scheduler = new Scheduler(servicePlan.plan);
await scheduler.execute({ repo: 'acme/web' });
```

Each adapter also exposes a patch helper (`patchGeminiCLI`, `patchClaudeCode`, `patchOpenAICodex`) that injects a `toTygentServicePlan` method into the upstream planner when the optional dependency is present.

## Installation

```bash
npm install tygent
# or
yarn add tygent
```

The package targets Node.js 16+ and ships compiled JavaScript (`dist/`) and type definitions.

## Quick tour

These examples follow the journey from unstructured ideas to structured plans that expose dependencies, metadata, and context-prefetch hints to the runtime.

### 1. Accelerate a plan dictionary

```typescript
import { accelerate } from 'tygent';

const plan = {
  steps: [
    { id: 'collect', type: 'tool', action: (inputs: any) => ({ sources: inputs.query }) },
    {
      id: 'summarise',
      type: 'tool',
      action: (inputs: any) => `Summary: ${inputs.collect.sources}`,
      dependencies: ['collect'],
      critical: true,
    },
  ],
};

const executePlan = accelerate(plan);

async function run() {
  const result = await executePlan({ query: 'AI funding' });
  console.log(result.summarise);
}

run().catch(console.error);
```

`accelerate` detects plan-like payloads (including the service bridge format) and builds a structured graph[^dag]/scheduler pair automatically.

### 2. Wrap existing functions

```typescript
import { accelerate } from 'tygent';

const fetchProfile = accelerate(async (userId: string) => {
  // Existing implementation
  return { user: userId };
});

async function run() {
  const profile = await fetchProfile('acct_42');
  console.log(profile);
}

run().catch(console.error);
```

When passed a framework object (LangChain agent, OpenAI Assistant, LlamaIndex index, etc.), `accelerate` looks for `plan`, `getPlan`, or `workflow` attributes, converts them into structured graphs[^dag], and returns a thin wrapper that proxies the original API.

### 3. Build and run the structured graph

```typescript
import { DAG, ToolNode, Scheduler } from 'tygent';

const dag = new DAG('content');
dag.addNode(new ToolNode('search', () => ({ hits: ['url'] })));
dag.addNode(new ToolNode('summarise', (inputs) => `Summary of ${inputs.search.hits}`));
dag.addEdge('search', 'summarise');

async function run() {
  const scheduler = new Scheduler(dag, { priorityNodes: ['summarise'] });
  const results = await scheduler.execute({ query: 'latest research' });
  console.log(results.summarise);
}

run().catch(console.error);
```

The scheduler supports sequential execution via `execute` and batched parallel execution with `executeParallel`, respecting token budgets, rate limits, and latency hints provided on nodes.

### 4. Adaptive executor

```typescript
import { AdaptiveExecutor, createFallbackRule, DAG, ToolNode } from 'tygent';

const base = new DAG('workflow');
base.addNode(
  new ToolNode('primary', (inputs) => {
    if (!inputs.ok) {
      return { status: 'error' };
    }
    return { status: 'ok', value: 1 / (inputs.divisor ?? 1) };
  }),
);

const executor = new AdaptiveExecutor(base, [
  createFallbackRule(
    (state) => state.primary?.status === 'error',
    (dag) => {
      const patched = dag.copy();
      const fallback = new ToolNode('fallback', () => ({ status: 'ok', value: 1 }));
      patched.addNode(fallback);
      patched.addEdge('primary', 'fallback');
      return patched;
    },
    'fallback_on_error',
  ),
]);

async function run() {
  const outputs = await executor.execute({ ok: false });
  console.log(outputs.fallback);
}

run().catch(console.error);
```

Rewrite rules can also branch conditionally (`createConditionalBranchRule`) or adapt to resource signals (`createResourceAdaptationRule`).

### 5. Multi-agent coordination

```typescript
import { MultiAgentManager } from 'tygent';

const manager = new MultiAgentManager('support');

manager.addAgent('analyser', {
  async execute(inputs) {
    return { keywords: inputs.question.split(' ') };
  },
});

manager.addAgent('retrieval', {
  async execute() {
    return { docs: ['reset-guide.md'] };
  },
});

async function run() {
  const result = await manager.execute({ question: 'How do I reset my password?' });
  console.log(result);
}

run().catch(console.error);
```

`CommunicationBus` provides a shared mailbox when agents want to exchange messages; the orchestrator helper (`MultiAgentOrchestrator`) constructs conversation graphs[^dag] for legacy demos.

## Service plans, CLI, and logging

- **ServicePlanBuilder** – converts SaaS payloads into `PlanParser`-ready structures, applies prompt templating, merges link metadata, and registers optional LLM runtimes via `LLMRuntimeRegistry`.
- **Prefetch** – `prefetchMany` is a stub that records URLs; override it or wrap `ServicePlan.prefetch()` to integrate a real cache/downloader.
- **CLI** – invoke with `npx tygent <command>`:
  ```bash
  npx tygent register --name "Acme" --email ops@example.com
  npx tygent list-accounts
  npx tygent generate-key --account acct_123 --label demo
  npx tygent configure-ingestor --account acct_123 --name langchain
  npx tygent serve --port 8080
  ```
  State is written to `service_state.json` (override with `--state` or `TYGENT_SERVICE_STATE`). The HTTP service currently exposes `/health`, `/catalog`, and `/accounts` endpoints as building blocks for demos.
- **Logging** – create namespace loggers with `getLogger('scheduler')`. Set `TYGENT_LOG_LEVEL` to `trace|debug|info|warn|error` to tune verbosity. All internal components log structured JSON to stdout.

## Planner adapters

Tygent can ingest plans emitted by other tooling and normalise them into scheduler-ready service plans. The integration bundle now includes adapters for the most common CLI planners:
- `GeminiCLIPlanAdapter` with `patchGeminiCLI()` to attach `toTygentServicePlan` onto the optional `gemini-cli` runtime
- `ClaudeCodePlanAdapter` with `patchClaudeCode()` for Anthropic's Claude Code editor payloads
- `OpenAICodexPlanAdapter` with `patchOpenAICodex()` for legacy Codex workflow payloads

Each adapter accepts the raw payload and returns a `ServicePlan`, so you can execute the converted steps via the standard runtime:

```typescript
import { GeminiCLIPlanAdapter, accelerate } from 'tygent';

const adapter = new GeminiCLIPlanAdapter(geminiPayload);
const servicePlan = adapter.toServicePlan();

const executePlan = accelerate(servicePlan.plan);
const outputs = await executePlan({ topic: 'structured planning' });
```

Call the corresponding `patch*` helper if you would like the third-party planner to expose `toTygentServicePlan` directly when the optional dependency is installed.


## Examples

TypeScript examples live under `examples/`; run them after a build:

```bash
npm run build
node dist/examples/multi-agent.js
```

Highlighted samples:
- `examples/advanced-customer-support.ts` – incremental structured graph[^dag] creation and scheduling
- `examples/dynamic-adaptive.ts` – AdaptiveExecutor rewrite rules in action
- `examples/langchain-integration.ts` – accelerating a LangChain workflow
- `examples/service-plan.ts` – building and executing service plans end-to-end

## Editor extensions

- **VS Code** (`vscode-extension/`) – exposes a *Tygent: Enable Agent* command that injects `tygent.install()` (and missing imports) into the active Python or TypeScript agent so you can adopt the structured planner in-place.
- **Cursor** (`cursor-extension/`) – ships the equivalent *Tygent: Enable Agent (Cursor)* command for Cursor’s command palette, enabling one-click upgrades inside Cursor workspaces.

Both extensions are TypeScript projects; run `npm run compile` in the respective folder to build, then load the generated package via VS Code’s Extension Development Host or Cursor’s extension loader.

## Testing

```bash
npm install
npm run build
npm test
```

`jest` drives the unit tests under `tests/`. Use `npm test -- --coverage` for coverage reports or `npx jest tests/dag.test.ts` to run the structured graph[^dag] suite. The repository also includes an integration smoke test (`test-multi-agent.js`).

## Project layout

```
src/
├── accelerate.ts        # drop-in wrappers for functions & frameworks
├── scheduler.ts         # structured graph execution engine[^dag] + hooks
├── adaptive-executor.ts
├── multi-agent.ts
├── service-bridge.ts    # service plan builder & runtime registry
├── service/             # CLI state manager and HTTP server
└── integrations/        # optional framework helpers
```

Compiled artefacts land in `dist/`; `coverage/` is produced by Jest when coverage is enabled.

[^dag]: Tygent materialises plans as typed directed acyclic graphs (DAGs) so dependencies, prefetch hints, and context fabric descriptors remain explicit for the execution engine and integrations.

---

Questions or ideas? Open a GitHub issue or email support@tygent.ai.
