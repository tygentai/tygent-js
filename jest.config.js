/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.ts'],
  testPathIgnorePatterns: [
    '<rootDir>/tests/integrations/test-microsoft-ai.ts',
    '<rootDir>/tests/integrations/test-salesforce.ts',
    '<rootDir>/tests/dag.test.ts',
    '<rootDir>/tests/multi-agent.test.ts',
  ],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
};

module.exports = config;