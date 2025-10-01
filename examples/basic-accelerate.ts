/**
 * Basic accelerate() example.
 * Mirrors `examples/python_example.py` from the Python distribution.
 */

import { performance } from 'perf_hooks';
import { accelerate } from '../src';

type Weather = { temperature: number; conditions: string; location: string };

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function searchData(query: string): Promise<string> {
  console.log(`Searching for: ${query}`);
  await sleep(500);
  return `Search results for "${query}"`;
}

async function getWeather(location: string): Promise<Weather> {
  console.log(`Getting weather for: ${location}`);
  await sleep(300);
  return { temperature: 72, conditions: 'Sunny', location };
}

async function analyzeData(searchResults: string, weather: Weather): Promise<string> {
  console.log('Analyzing combined data...');
  await sleep(200);
  return `Analysis: ${searchResults} combined with weather ${JSON.stringify(weather)}`;
}

async function workflow(): Promise<string> {
  console.log('Starting workflow...');
  const searchResults = await searchData('artificial intelligence advancements');
  const weather = await getWeather('New York');
  const analysis = await analyzeData(searchResults, weather);
  console.log(`Final result: ${analysis}`);
  return analysis;
}

async function timed<T>(label: string, fn: () => Promise<T>): Promise<{ result: T; duration: number }>
{
  console.log(`=== ${label} ===`);
  const start = performance.now();
  const result = await fn();
  const duration = (performance.now() - start) / 1000;
  console.log(`${label} time: ${duration.toFixed(2)}s\n`);
  return { result, duration };
}

async function main(): Promise<void> {
  const standard = await timed('Standard Execution', workflow);

  const acceleratedWorkflow = accelerate(workflow);
  const accelerated = await timed('Accelerated Execution', acceleratedWorkflow);

  console.log(`Results match: ${standard.result === accelerated.result}`);
  if (standard.duration > accelerated.duration) {
    const improvement = ((standard.duration - accelerated.duration) / standard.duration) * 100;
    console.log(`Performance improvement: ${improvement.toFixed(1)}% faster`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Example failed', error);
    process.exitCode = 1;
  });
}
