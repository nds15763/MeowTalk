// 文件: src/sdk/AudioDataManager.ts

import { Platform } from "react-native";
import AudioProcessor from "./audioProcessor";

/**
 * 音频数据管理器
 * 单例模式，统一管理音频数据的采集、处理和分析
 */
class AudioDataManager {
  private static instance: AudioDataManager | null = null;
  private processor: AudioProcessor | null = null;
  private isSimulating: boolean = false;
  private lastSimulationTime: number = 0;
  private simulationInterval: number = 50; // 降低到50毫秒，增加采样频率
  private audioBufferSize: number = 220; // 降低到220个采样点，约为0.05秒的数据

  private constructor() {
    // 私有构造函数，防止外部直接创建实例
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): AudioDataManager {
    if (!AudioDataManager.instance) {
      AudioDataManager.instance = new AudioDataManager();
    }
    return AudioDataManager.instance;
  }

  /**
   * 初始化音频处理器
   */
  public initProcessor(processor: AudioProcessor): void {
    this.processor = processor;
  }

  /**
   * 模拟音频数据生成
   * 使用节流控制，避免频繁调用
   */
  public simulateAudioData(): void {
    if (!this.processor) {
      console.log("音频处理器未初始化，无法模拟音频数据");
      return;
    }

    // 检查是否需要节流控制
    const now = Date.now();
    const elapsed = now - this.lastSimulationTime;
    
    // 检查是否正在模拟
    if (this.isSimulating) {
      console.log(`正在模拟音频数据，跳过本次调用`);
      return;
    }

    // 设置状态为正在模拟
    this.isSimulating = true;

    try {
      // 计算应生成的音频数据量 - 基于实际流逝的时间
      let dataSize;
      
      if (this.lastSimulationTime === 0) {
        dataSize = 220; // 首次生成小量数据
      } else {
        // 根据上次调用的时间间隔计算应生成的数据量
        // 4410Hz 采样率，每秒应有4410个采样点
        const timeInSeconds = elapsed / 1000;
        dataSize = Math.round(timeInSeconds * 4410);

        // 限制单次数据量不超过 1秒
        const maxDataSize = 4410;
        if (dataSize > maxDataSize) {
          dataSize = maxDataSize;
        }
      }

      // 创建一个模拟的音频数据片段
      const data = new Float32Array(dataSize);

      // 随机生成一些数据用于测试
      for (let i = 0; i < dataSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.1; // 低幅度噪声
      }

      // 模拟5%的概率生成猫叫声
      if (Math.random() < 0.05) {
        // 模拟猫叫声 - 生成一个600Hz的正弦波
        const freq = 600 + Math.random() * 100; // 550-650Hz的正弦波
        for (let i = 0; i < dataSize; i++) {
          // 使用准确的4410Hz采样率计算时间点
          const time = i / 4410;
          data[i] = Math.sin(2 * Math.PI * freq * time) * 0.5;
        }
      }

      // 添加到处理器
      this.processor.addAudioData(data);
      
      this.lastSimulationTime = now; // 在成功添加后更新时间戳
      
      console.log(
        `添加模拟音频数据，长度: ${dataSize}，采样率: 4410Hz，` +
        `持续时间: ${(dataSize / 4410).toFixed(3)}秒，` +
        `实际间隔: ${elapsed}ms，匹配度: ${(dataSize / 4410 / (elapsed / 1000)).toFixed(2)}x`
      );
    } finally {
      // 无论成功与否，重置模拟状态
      this.isSimulating = false;
    }
  }

  /**
   * 处理来自Web Audio API的数据
   */
  public processWebAudioData(audioDataArray: Uint8Array): void {
    if (!this.processor) return;

    // 将Uint8Array转换为Float32Array
    const audioDataFloat = new Float32Array(audioDataArray.length);
    for (let i = 0; i < audioDataArray.length; i++) {
      // 将0-255的值转换为-1到1之间的浮点数
      audioDataFloat[i] = audioDataArray[i] / 128.0 - 1.0;
    }

    // 降采样以减少数据量，保留大约4410Hz的采样率 (原始通常是44100Hz)
    const samplingFactor = 10; // 每10个采样点取1个
    const sampledData = new Float32Array(
      Math.floor(audioDataFloat.length / samplingFactor)
    );
    for (let i = 0; i < sampledData.length; i++) {
      sampledData[i] = audioDataFloat[i * samplingFactor];
    }

    // 添加数据到处理器
    this.processor.addAudioData(sampledData);
    console.log(`添加了${sampledData.length}个真实音频采样点到处理器`);
  }

  /**
   * 处理来自原生模块的数据
   */
  public processNativeAudioData(audioData: number[]): void {
    if (!this.processor) return;
    this.processor.addAudioData(new Float32Array(audioData));
    console.log("成功处理原生音频数据，长度:", audioData.length);
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.processor = null;
    this.isSimulating = false;
  }

  /**
   * 重置状态
   * 在停止模拟和清理资源时使用
   */
  public reset(): void {
    this.isSimulating = false;
    this.lastSimulationTime = 0;
    // 不需要重置processor，因为它可能还需要被使用
  }
}

export default AudioDataManager;