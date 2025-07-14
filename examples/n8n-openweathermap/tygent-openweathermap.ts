import { DAG } from '../../src/dag';
import { ToolNode } from '../../src/nodes';
import { Scheduler } from '../../src/scheduler';
import { accelerate } from '../../src/accelerate';
import { ChatOpenAI } from 'langchain/chat_models/openai';

// Base model instance
const openai = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// Accelerated wrapper around the OpenAI call using Tygent
const callLLM = accelerate(async (prompt: string) => {
  return await openai.call([{ content: prompt }]);
});

// Node to fetch current weather for New York using Open-Meteo
const fetchWeather = new ToolNode('OpenMeteo', async () => {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=40.7128&longitude=-74.0060&current_weather=true';
  const res = await fetch(url);
  return res.json();
});

// Node to ask OpenAI what time is best for a walk
const planWalk = new ToolNode('WalkAdvisor', async ({ OpenMeteo }) => {
  const temp = OpenMeteo.current_weather.temperature;
  const code = OpenMeteo.current_weather.weathercode;
  const prompt = `The current temperature in New York City is ${temp}°C and the weather code is ${code}. What time of day would be good for a walk?`;
  const result = await callLLM(prompt);
  console.log(result);
  return { recommendation: result };
});

planWalk.setDependencies(['OpenMeteo']);

const dag = new DAG('walk_advisor');
dag.addNode(fetchWeather);
dag.addNode(planWalk);

const scheduler = new Scheduler(dag);

// Execute the workflow once. A cron job could trigger this script every morning.
(async () => {
  await scheduler.execute();
})();
