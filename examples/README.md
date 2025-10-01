# Tygent JavaScript Examples

These examples mirror the Python samples in `tygent-py/examples` and demonstrate the
same concepts using TypeScript.

Build the project and run the compiled JavaScript from `dist/examples`:

```bash
npm run build
node dist/examples/basic-accelerate.js
```

## Available Samples

| Python reference                         | TypeScript example                     | Highlights |
|-----------------------------------------|----------------------------------------|-----------|
| `python_example.py`                     | `basic-accelerate.ts`                  | Drop-in acceleration for existing workflows |
| `advanced_python_example.py`            | `advanced-customer-support.ts`         | Customer support orchestration with personalized responses |
| `dynamic_dag_example.py`                | `dynamic-adaptive.ts`                  | Runtime DAG rewriting with fallback and conditional branches |
| `multi_agent_python_example.py`         | `multi-agent.ts`                       | Multi-agent coordination with parallel execution |
| `crewai_example.py`                     | `crewai.ts`                            | Accelerated CrewAI orchestration |
| `langchain_integration.py`              | `langchain-integration.ts`             | Mock LangChain tools accelerated with Tygent |
| `langchain_market_analysis.py`          | `langchain-market-analysis.ts`         | Simulated plan generation + accelerated execution |
| `langflow_example.py`                   | `langflow.ts`                          | Invokes the Langflow integration helper |
| `langgraph_integration.py`              | `langgraph.ts`                         | Converts a simple LangGraph workflow to a DAG |
| `service_bridge` demos                  | `service-plan.ts`                      | Service-plan builder, nested templating, prefetch |
| `google_ai_example.py`                  | `google-ai.ts`                         | Gemini integration (requires `@google/generative-ai`) |
| `google_adk_market_analysis.py`         | `google-adk-market-analysis.ts`        | Simulated ADK-style market analysis plan |
| `microsoft_ai_example.py`               | `microsoft-ai.ts`                      | Simulated Azure OpenAI workflow |
| `salesforce_example.py`                 | `salesforce.ts`                        | Simulated Salesforce CRM optimization |

Examples that depend on external vendors (Google ADK, Azure OpenAI, Salesforce)
run in simulated mode by default; install the respective SDKs and configure API
keys to connect them to live services.
