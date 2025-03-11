// 检查 expo-av 中的 Audio 对象具有哪些枚举
const fs = require('fs');

try {
  // 直接读取 expo-av 的类型定义文件
  const typesPath = 'node_modules/expo-av/build/Audio/Audio.d.ts';
  const content = fs.readFileSync(typesPath, 'utf8');
  
  // 输出到文件中
  fs.writeFileSync('audio-types.txt', content);
  console.log('已将 Audio 类型定义写入 audio-types.txt');
} catch (err) {
  console.error('读取类型定义失败:', err);
}
