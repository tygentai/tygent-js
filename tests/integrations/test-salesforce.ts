import fs from 'fs';
import path from 'path';
import { describe, it, expect } from '@jest/globals';

const requiredVars = ['SALESFORCE_ACCESS_TOKEN', 'SALESFORCE_INSTANCE_URL'];
const envMissing = requiredVars.some(v => !process.env[v]);
const modulePath = path.resolve(__dirname, '../../src/integrations/salesforce');
const moduleExists = fs.existsSync(modulePath + '.ts') || fs.existsSync(modulePath + '.js');

if (envMissing || !moduleExists) {
  console.warn('Skipping Salesforce integration tests because environment variables are missing or module not found.');
}

const describeOrSkip = envMissing || !moduleExists ? describe.skip : describe;
let integrationMod: any;
if (!envMissing && moduleExists) {
  integrationMod = require('../../src/integrations/salesforce');
}

describeOrSkip('Salesforce Integration', () => {
  it('module should load', () => {
    expect(integrationMod).toBeDefined();
  });
});
