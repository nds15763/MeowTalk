const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function(env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);
  
  // 将 publicPath 设置为相对路径
  config.output.publicPath = './';
  
  return config;
};
