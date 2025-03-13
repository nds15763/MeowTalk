const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// 添加额外的node_modules解析路径
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
];

// 添加对特定模块的处理
config.resolver.extraNodeModules = {
  ...require('node-libs-react-native'),
  'openai': path.resolve(__dirname, 'node_modules/openai'),
};

module.exports = config;
