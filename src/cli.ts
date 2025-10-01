#!/usr/bin/env node
import { createInterface } from 'readline';
import { stdin as input, stdout as output } from 'process';
import { DEFAULT_INGESTOR_REGISTRY } from './service/ingestors';
import { ServiceState, defaultStatePath } from './service/state';
import { startServer } from './service/server';
import { logger } from './logging';

interface ParsedArgs {
  command: string | null;
  options: Record<string, string>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const options: Record<string, string> = {};
  let command: string | null = null;

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const value = args[i + 1]?.startsWith('--') || args[i + 1] === undefined ? 'true' : args[++i];
      options[key] = value ?? 'true';
    } else if (!command) {
      command = token;
    }
  }

  return { command, options };
}

async function prompt(label: string, defaultValue?: string): Promise<string> {
  const rl = createInterface({ input, output });
  const question = defaultValue ? `${label} [${defaultValue}]: ` : `${label}: `;
  const answer = await new Promise<string>((resolve) => rl.question(question, resolve));
  rl.close();
  const trimmed = answer.trim();
  if (!trimmed && defaultValue !== undefined) {
    return defaultValue;
  }
  if (!trimmed) {
    return prompt(label, defaultValue);
  }
  return trimmed;
}

function resolveStatePath(option?: string): string {
  return option ? option : defaultStatePath();
}

async function handleRegister(options: Record<string, string>): Promise<void> {
  const state = new ServiceState(resolveStatePath(options.state));
  const name = options.name ?? (await prompt('Account name'));
  const email = options.email ?? (await prompt('Contact email'));
  const record = state.registerAccount(name, email);
  console.log(JSON.stringify(record.toJSON(), null, 2));
}

async function handleConfigureIngestor(options: Record<string, string>): Promise<void> {
  const state = new ServiceState(resolveStatePath(options.state));
  const accountId = options.account ?? (await prompt('Account id'));
  const name = options.name ?? (await prompt('Ingestor name', 'generic'));
  const rawConfig = options.config ?? (await prompt('Ingestor config (JSON)', '{}'));
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(rawConfig);
  } catch (error) {
    throw new Error(`Failed to parse JSON config: ${String(error)}`);
  }
  state.setIngestorConfig(accountId, { name, config: parsed });
  console.log(`Updated ingestor configuration for ${accountId} -> ${name}`);
}

async function handleGenerateKey(options: Record<string, string>): Promise<void> {
  const state = new ServiceState(resolveStatePath(options.state));
  const accountId = options.account ?? (await prompt('Account id'));
  const label = options.label ?? (await prompt('Key label', 'default'));
  const apiKey = state.createApiKey(accountId, label);
  console.log('Generated Tygent API key (store securely, it will not be shown again):');
  console.log(apiKey);
}

async function handleListAccounts(options: Record<string, string>): Promise<void> {
  const state = new ServiceState(resolveStatePath(options.state));
  const payload = state.listAccounts().map((acc) => acc.toJSON());
  console.log(JSON.stringify(payload, null, 2));
}

async function handleCatalog(): Promise<void> {
  console.log(JSON.stringify({ ingestors: DEFAULT_INGESTOR_REGISTRY.describe() }, null, 2));
}

async function handleServe(options: Record<string, string>): Promise<void> {
  const port = options.port ? Number(options.port) : 8080;
  const statePath = resolveStatePath(options.state);
  await startServer({ port, statePath });
  console.log(`Service server listening on http://127.0.0.1:${port}`);
}

function printHelp(): void {
  console.log(`Tygent CLI

Usage:
  tygent <command> [options]

Commands:
  register             Register a new tenant account
  configure-ingestor   Configure default plan ingestor for an account
  generate-key         Generate an API key for an account
  list-accounts        List registered accounts
  catalog              Show available plan ingestors
  serve                Run the local SaaS planner service

Common options:
  --state <path>       Specify an alternate service state file location
`);
}

export async function main(argv = process.argv): Promise<void> {
  const { command, options } = parseArgs(argv);
  try {
    switch (command) {
      case 'register':
        await handleRegister(options);
        break;
      case 'configure-ingestor':
        await handleConfigureIngestor(options);
        break;
      case 'generate-key':
        await handleGenerateKey(options);
        break;
      case 'list-accounts':
        await handleListAccounts(options);
        break;
      case 'catalog':
        await handleCatalog();
        break;
      case 'serve':
        await handleServe(options);
        break;
      case null:
      case 'help':
      case '--help':
        printHelp();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exitCode = 1;
    }
  } catch (error) {
    logger.error('CLI command failed', { command, error });
    console.error(`Error: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
