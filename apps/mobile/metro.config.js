// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
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

// @meal/shared 的 src/*.ts 使用 .js 扩展名导入（NodeNext ESM 严格要求，编译后 dist 用）。
// Metro 直接读 src/*.ts 时会去找对应 .js（不存在），bundling 失败。
// 在这里拦截：packages/shared/src/**/*.ts 里的 `./foo.js` 相对引用剥掉 .js，
// 让 Metro 走 sourceExts 默认规则命中 .ts。
const sharedSrcDir = path.resolve(workspaceRoot, 'packages/shared/src');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const origin = context.originModulePath || '';
  if (
    origin.startsWith(sharedSrcDir) &&
    moduleName.startsWith('./') &&
    moduleName.endsWith('.js')
  ) {
    const tsCandidate = path.resolve(
      path.dirname(origin),
      moduleName.replace(/\.js$/, '.ts'),
    );
    if (fs.existsSync(tsCandidate)) {
      return context.resolveRequest(context, moduleName.slice(0, -3), platform);
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
