# Tygent Example: Optimizing an n8n Workflow

This example shows how a simple n8n workflow can be represented as a Tygent DAG for optimized execution. The original n8n workflow comes from [OpenWeatherMap Cron Automate Scheduled](https://github.com/Zie619/n8n-workflows/blob/main/workflows/0006_Openweathermap_Cron_Automate_Scheduled.json).

The workflow fetches the current temperature using the [Open-Meteo](https://open-meteo.com/) API for New York City and then asks an OpenAI model (via LangChain) what time of day would be best for a walk. The file `Cron_Find_Best_Time_For_Walk.json` shows the corresponding n8n workflow.

`tygent-openweathermap.ts` demonstrates how the same logic can be expressed with Tygent. Nodes are defined for fetching the weather from Open-Meteo and evaluating walking conditions with OpenAI, then executed by the Tygent scheduler. This allows further optimization (parallelization, rate limiting, auditing, etc.) while keeping the overall logic intact.
