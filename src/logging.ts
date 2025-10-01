/**
 * Lightweight structured logger with level filtering.
 */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
};

export interface LogContext {
  [key: string]: unknown;
}

function resolveLevel(): LogLevel {
  const raw = process.env.TYGENT_LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
  return raw && LEVEL_ORDER[raw] ? raw : 'info';
}

class Logger {
  private readonly namespace: string;
  private level: LogLevel;

  constructor(namespace: string, level: LogLevel = resolveLevel()) {
    this.namespace = namespace;
    this.level = level;
  }

  child(suffix: string): Logger {
    return new Logger(`${this.namespace}:${suffix}`, this.level);
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  trace(message: string, context: LogContext = {}): void {
    this.log('trace', message, context);
  }

  debug(message: string, context: LogContext = {}): void {
    this.log('debug', message, context);
  }

  info(message: string, context: LogContext = {}): void {
    this.log('info', message, context);
  }

  warn(message: string, context: LogContext = {}): void {
    this.log('warn', message, context);
  }

  error(message: string, context: LogContext = {}): void {
    this.log('error', message, context);
  }

  private log(level: LogLevel, message: string, context: LogContext): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.level]) {
      return;
    }
    const entry = {
      ts: new Date().toISOString(),
      level,
      namespace: this.namespace,
      msg: message,
      ...context,
    };
    const serialized = JSON.stringify(entry);
    switch (level) {
      case 'trace':
      case 'debug':
        // eslint-disable-next-line no-console
        console.debug(serialized);
        break;
      case 'info':
        // eslint-disable-next-line no-console
        console.info(serialized);
        break;
      case 'warn':
        // eslint-disable-next-line no-console
        console.warn(serialized);
        break;
      case 'error':
        // eslint-disable-next-line no-console
        console.error(serialized);
        break;
      default:
        // eslint-disable-next-line no-console
        console.log(serialized);
    }
  }
}

export const logger = new Logger('tygent');

export function getLogger(namespace: string): Logger {
  return logger.child(namespace);
}
