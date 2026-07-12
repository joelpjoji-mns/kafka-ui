// Temp CJS mirror of jest.config.ts to bypass ts-node/ESM interop issues on Node 22.
// Loaded via `jest --config .jest/jest.config.cjs`.
const path = require('path');

module.exports = {
  rootDir: path.resolve(__dirname, '..'),
  roots: ['<rootDir>/src'],
  collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}', '!src/**/*.d.ts'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/src/generated-sources/',
    '<rootDir>/src/lib/fixtures/',
    '<rootDir>/vite.config.ts',
    '<rootDir>/src/index.tsx',
    '<rootDir>/src/serviceWorker.ts',
  ],
  coverageReporters: ['json', 'lcov', 'text', 'clover'],
  resolver: '<rootDir>/.jest/resolver.js',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  testMatch: [
    '<rootDir>/src/**/__{test,tests}__/**/*.{spec,test}.{js,jsx,ts,tsx}',
  ],
  testEnvironment: 'jsdom',
  transform: {
    '\\.[jt]sx?$': '@swc/jest',
    '^.+\\.css$': '<rootDir>/.jest/cssTransform.js',
  },
  transformIgnorePatterns: [
    '[/\\\\]node_modules[/\\\\].+\\.(js|jsx|mjs|cjs|ts|tsx)$',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  moduleNameMapper: {
    '^@tootallnate/once$': path.resolve(
      __dirname,
      'shims',
      'tootallnate-once.cjs'
    ),
  },
  modulePaths: ['<rootDir>/src'],
  resetMocks: true,
  reporters: ['default'],
};
