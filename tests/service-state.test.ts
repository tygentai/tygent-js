import fs from 'fs';
import os from 'os';
import path from 'path';
import { ServiceState } from '../src/service/state';

function tempFile(): string {
  return path.join(os.tmpdir(), `tygent-state-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
}

describe('ServiceState', () => {
  it('registers accounts and persists to disk', () => {
    const file = tempFile();
    const state = new ServiceState(file);
    const account = state.registerAccount('Acme', 'ops@acme.test');
    expect(account.accountId).toContain('acct_');
    expect(fs.existsSync(file)).toBe(true);

    const reloaded = new ServiceState(file);
    const accounts = reloaded.listAccounts();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].accountId).toBe(account.accountId);
  });

  it('manages ingestor config and API keys', () => {
    const file = tempFile();
    const state = new ServiceState(file);
    const account = state.registerAccount('Beta', 'beta@example.com');

    state.setIngestorConfig(account.accountId, { name: 'generic', config: { foo: 'bar' } });
    const key = state.createApiKey(account.accountId, 'default');
    expect(typeof key).toBe('string');

    const resolved = state.resolveApiKey(key);
    expect(resolved?.accountId).toBe(account.accountId);

    const revoked = state.revokeApiKey(account.accountId, 'default');
    expect(revoked).toBe(true);
    const resolvedAfter = state.resolveApiKey(key);
    expect(resolvedAfter).toBeUndefined();
  });
});
