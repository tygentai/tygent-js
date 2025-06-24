import fs from 'fs';
import path from 'path';
import { describe, it, expect } from '@jest/globals';

const requiredVars = ['AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_ENDPOINT'];
const envMissing = requiredVars.some(v => !process.env[v]);
const modulePath = path.resolve(__dirname, '../../src/integrations/microsoft-ai');
const moduleExists = fs.existsSync(modulePath + '.ts') || fs.existsSync(modulePath + '.js');

if (envMissing || !moduleExists) {
  console.warn('Skipping Microsoft AI integration tests because environment variables are missing or module not found.');
}

const describeOrSkip = envMissing || !moduleExists ? describe.skip : describe;
let integrationMod: any;
if (!envMissing && moduleExists) {
  integrationMod = require('../../src/integrations/microsoft-ai');
}

describeOrSkip('Microsoft AI Integration', () => {
  it('module should load', () => {
    expect(integrationMod).toBeDefined();
  });
});
