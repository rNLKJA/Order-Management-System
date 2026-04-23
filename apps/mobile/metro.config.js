// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// monorepo: Metro 能解析 workspace 下的包
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

// pnpm 使用 symlinks，这个设置让 Metro 正确处理 symlink（保持 symlink 路径不 realpath）
// 避免 react 双实例问题
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
