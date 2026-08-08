const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

/**
 * The mobile app lives outside the npm workspace on purpose (Metro and the web
 * bundlers disagree about hoisting), so the shared packages are wired in
 * explicitly here. It consumes exactly the same api-client and validation
 * schemas as the web applications — no duplicated business rules.
 */
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [path.resolve(monorepoRoot, 'packages')];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
