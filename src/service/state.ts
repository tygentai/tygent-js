import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getLogger } from '../logging';

const log = getLogger('service-state');

export interface ApiKeyRecord {
  hash: string;
  label: string;
  createdAt: string;
}

export interface AccountRecordData {
  accountId: string;
  name: string;
  email: string;
  createdAt: string;
  ingestorConfig: Record<string, unknown>;
  apiKeys: ApiKeyRecord[];
}

export class AccountRecord implements AccountRecordData {
  accountId: string;
  name: string;
  email: string;
  createdAt: string;
  ingestorConfig: Record<string, unknown>;
  apiKeys: ApiKeyRecord[];

  constructor(data: AccountRecordData) {
    this.accountId = data.accountId;
    this.name = data.name;
    this.email = data.email;
    this.createdAt = data.createdAt;
    this.ingestorConfig = { ...data.ingestorConfig };
    this.apiKeys = [...data.apiKeys];
  }

  toJSON(): AccountRecordData {
    return {
      accountId: this.accountId,
      name: this.name,
      email: this.email,
      createdAt: this.createdAt,
      ingestorConfig: { ...this.ingestorConfig },
      apiKeys: this.apiKeys.map((record) => ({ ...record })),
    };
  }

  static hydrate(payload: any): AccountRecord {
    const apiKeys: ApiKeyRecord[] = Array.isArray(payload?.apiKeys)
      ? payload.apiKeys.map((raw: any) => ({
          hash: String(raw.hash ?? ''),
          label: String(raw.label ?? ''),
          createdAt: String(raw.createdAt ?? new Date().toISOString()),
        }))
      : [];

    return new AccountRecord({
      accountId: String(payload?.accountId ?? ''),
      name: String(payload?.name ?? ''),
      email: String(payload?.email ?? ''),
      createdAt: String(payload?.createdAt ?? new Date().toISOString()),
      ingestorConfig: typeof payload?.ingestorConfig === 'object' && payload?.ingestorConfig
        ? { ...payload.ingestorConfig }
        : {},
      apiKeys,
    });
  }
}

export interface ServiceStatePayload {
  accounts: AccountRecordData[];
}

function utcIso(): string {
  return new Date().toISOString();
}

function hashKey(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function defaultStatePath(): string {
  const envOverride = process.env.TYGENT_SERVICE_STATE;
  if (envOverride) {
    return path.resolve(envOverride);
  }
  return path.resolve(__dirname, '../../service_state.json');
}

export class ServiceState {
  private readonly path: string;
  private accounts: Map<string, AccountRecord> = new Map();

  constructor(statePath: string = defaultStatePath()) {
    this.path = statePath;
    this.load();
  }

  registerAccount(name: string, email: string): AccountRecord {
    const accountId = `acct_${crypto.randomBytes(6).toString('hex')}`;
    const record = new AccountRecord({
      accountId,
      name,
      email,
      createdAt: utcIso(),
      ingestorConfig: {},
      apiKeys: [],
    });
    this.accounts.set(accountId, record);
    this.flush();
    log.info('Registered account', { accountId });
    return record;
  }

  listAccounts(): AccountRecord[] {
    return Array.from(this.accounts.values()).map((acc) => new AccountRecord(acc.toJSON()));
  }

  setIngestorConfig(accountId: string, config: Record<string, unknown>): void {
    const account = this.requireAccount(accountId);
    account.ingestorConfig = { ...config };
    this.flush();
    log.info('Updated ingestor configuration', { accountId });
  }

  createApiKey(accountId: string, label: string = 'default'): string {
    const account = this.requireAccount(accountId);
    const key = crypto.randomBytes(32).toString('base64url');
    account.apiKeys.push({ hash: hashKey(key), label, createdAt: utcIso() });
    this.flush();
    log.info('Generated API key', { accountId, label });
    return key;
  }

  revokeApiKey(accountId: string, label: string): boolean {
    const account = this.requireAccount(accountId);
    const before = account.apiKeys.length;
    account.apiKeys = account.apiKeys.filter((record) => record.label !== label);
    const changed = account.apiKeys.length !== before;
    if (changed) {
      this.flush();
      log.info('Revoked API key', { accountId, label });
    }
    return changed;
  }

  resolveApiKey(apiKey: string): AccountRecord | undefined {
    const hashed = hashKey(apiKey);
    for (const account of this.accounts.values()) {
      if (account.apiKeys.some((record) => record.hash === hashed)) {
        return new AccountRecord(account.toJSON());
      }
    }
    return undefined;
  }

  private ensureParent(): void {
    fs.mkdirSync(path.dirname(this.path), { recursive: true });
  }

  private load(): void {
    if (!fs.existsSync(this.path)) {
      return;
    }
    try {
      const raw = JSON.parse(fs.readFileSync(this.path, 'utf-8')) as ServiceStatePayload;
      const accounts = Array.isArray(raw.accounts) ? raw.accounts : [];
      for (const record of accounts) {
        const account = AccountRecord.hydrate(record);
        if (account.accountId) {
          this.accounts.set(account.accountId, account);
        }
      }
      log.debug('Loaded service state', { path: this.path, accounts: this.accounts.size });
    } catch (error) {
      log.error('Failed to load service state file', { path: this.path, error });
      throw error;
    }
  }

  private flush(): void {
    this.ensureParent();
    const payload: ServiceStatePayload = {
      accounts: this.listAccounts().map((record) => record.toJSON()),
    };
    fs.writeFileSync(this.path, JSON.stringify(payload, null, 2), 'utf-8');
  }

  private requireAccount(accountId: string): AccountRecord {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error(`Unknown account id: ${accountId}`);
    }
    return account;
  }
}
