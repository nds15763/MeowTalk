/**
 * MeowDetectorNative 模块类型定义
 * 用于与原生 CGO 模块进行交互
 */

import { NativeModules } from 'react-native';

interface MeowDetectorNativeInterface {
  /**
   * 处理音频数据并返回分析结果
   * @param audioData 音频数据数组
   * @returns 包含分析结果的JSON字符串
   */
  processAudio(audioData: number[]): Promise<string>;
}

// 获取原生模块
const { MeowDetectorNative } = NativeModules;

// 检查模块是否存在
if (!MeowDetectorNative) {
  console.warn(
    '找不到 MeowDetectorNative 模块。请确保原生模块已正确配置。'
  );
}

export default MeowDetectorNative as MeowDetectorNativeInterface;
