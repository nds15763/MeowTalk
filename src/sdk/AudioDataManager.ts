// 文件: src/sdk/AudioDataManager.ts
// 在文件顶部添加导入
import RNAudioRecorderPlayer from "react-native-audio-recorder-player";

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
  private isRecording: boolean = false;
  private audioRecorderPlayer: RNAudioRecorderPlayer | null = null;
  private mediaRecorderRef: any = null;
  private mediaStreamRef: any = null;
  private audioContextRef: any = null;
  private audioAnalyserRef: any = null;
  private dataArrayRef: Uint8Array | null = null;
  private animationFrameId: number | null = null;
  private isWeb: boolean = Platform.OS === 'web';

 private constructor() {
  // 私有构造函数，防止外部直接创建实例
  if (this.isWeb) {
    // Web平台初始化
    this.initWebAudio();
  } else {
    // 原生平台初始化
    this.initNativeAudio();
  }
}
/**
 * 初始化Web平台音频系统
 */
private initWebAudio(): void {
  console.log("Web平台音频系统初始化");
  // 只进行基本初始化，实际创建时才获取权限
}

/**
 * 初始化原生平台音频系统
 */
private initNativeAudio(): void {
  try {
    this.audioRecorderPlayer = new RNAudioRecorderPlayer();
    console.log("原生平台音频系统初始化成功");
  } catch (error) {
    console.error("原生音频系统初始化失败:", error);
  }
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
 * 开始录音
 */
public async startRecording(): Promise<boolean> {
  if (!this.processor) {
    console.log("音频处理器未初始化，无法开始录音");
    return false;
  }

  if (this.isRecording) {
    console.log("已经在录音中");
    return true;
  }

  try {
    this.isRecording = true;

    if (this.isWeb) {
      return await this.startWebRecording();
    } else {
      return await this.startNativeRecording();
    }
  } catch (error) {
    this.isRecording = false;
    console.error("开始录音失败:", error);
    return false;
  }
}

/**
 * 停止录音
 */
public async stopRecording(): Promise<boolean> {
  if (!this.isRecording) {
    console.log("当前没有录音进行");
    return true;
  }

  try {
    if (this.isWeb) {
      await this.stopWebRecording();
    } else {
      await this.stopNativeRecording();
    }

    this.isRecording = false;
    return true;
  } catch (error) {
    console.error("停止录音失败:", error);
    return false;
  }
}
/**
 * 开始Web平台录音
 */
private async startWebRecording(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      throw new Error("当前环境不支持录音");
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaStreamRef = stream;
    
    // 创建AudioContext和分析器
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.audioContextRef = audioContext;
    
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    this.audioAnalyserRef = analyser;
    
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    
    const bufferLength = analyser.frequencyBinCount;
    this.dataArrayRef = new Uint8Array(bufferLength);
    
    // 开始周期性获取音频数据
    const getAudioData = () => {
      if (!this.audioAnalyserRef || !this.dataArrayRef || !this.isRecording) return;
      
      // 获取音频频域数据
      this.audioAnalyserRef.getByteFrequencyData(this.dataArrayRef);
      
      // 将Uint8Array转换为Float32Array并降采样
      const audioDataFloat = new Float32Array(this.dataArrayRef.length / 10);
      for (let i = 0; i < audioDataFloat.length; i++) {
        // 将0-255的值转换为-1到1之间的浮点数
        audioDataFloat[i] = (this.dataArrayRef[i * 10] / 128.0) - 1.0;
      }
      
      // 只有当存在有效数据时才处理
      if (audioDataFloat.some(val => Math.abs(val) > 0.01)) {
        // 发送到处理器
        if (this.processor) {
          this.processor.addAudioData(audioDataFloat);
          console.log(
            `添加真实音频数据，长度: ${audioDataFloat.length}，` +
            `估计采样率: ${audioDataFloat.length * 10}Hz，` +
            `持续时间: ${(audioDataFloat.length / 4410).toFixed(3)}秒`
          );
        }
      }
      
      // 继续下一帧
      this.animationFrameId = requestAnimationFrame(getAudioData);
    };
    
    // 开始获取数据
    this.animationFrameId = requestAnimationFrame(getAudioData);

    // 同时使用MediaRecorder作为备份
    const mediaRecorder = new MediaRecorder(stream);
    this.mediaRecorderRef = mediaRecorder;

    mediaRecorder.ondataavailable = async (e) => {
      if (!this.isRecording || !this.processor) return;
      
      try {
        const audioBlob = new Blob([e.data], { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // 转换为Float32Array，每100个采样点取一个，避免数据量太大
        const audioDataFloat = new Float32Array(Math.floor(uint8Array.length / 100));
        for (let i = 0; i < audioDataFloat.length; i++) {
          // 将0-255的值转换为-1到1之间的浮点数
          audioDataFloat[i] = (uint8Array[i * 100] / 128.0) - 1.0;
        }
        
        if (audioDataFloat.length > 0) {
          this.processor.addAudioData(audioDataFloat);
          console.log(
            `MediaRecorder音频数据，长度: ${audioDataFloat.length}，` +
            `采样率: 约${audioDataFloat.length * 100 / (audioBlob.size / 1024)}Hz`
          );
        }
      } catch (error) {
        console.error(`处理MediaRecorder数据失败:`, error);
      }
    };

    mediaRecorder.start(1000); // 每1秒触发一次数据
    console.log('开始捕获Web平台音频...');
    return true;
  } catch (error) {
    console.error(`Web平台启动录音失败:`, error);
    return false;
  }
}

/**
 * 停止Web平台录音
 */
private async stopWebRecording(): Promise<void> {
  // 停止动画帧
  if (this.animationFrameId !== null) {
    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
  }
  
  // 关闭音频上下文
  if (this.audioContextRef) {
    try {
      await this.audioContextRef.close();
    } catch (e) {
      console.error("关闭音频上下文失败:", e);
    }
    this.audioContextRef = null;
  }
  
  // 停止MediaRecorder
  if (this.mediaRecorderRef) {
    try {
      this.mediaRecorderRef.stop();
    } catch (e) {
      console.error("停止MediaRecorder失败:", e);
    }
    this.mediaRecorderRef = null;
  }
  
  // 停止媒体流
  if (this.mediaStreamRef) {
    try {
      this.mediaStreamRef.getTracks().forEach((track: MediaStreamTrack) => track.stop());
    } catch (e) {
      console.error("停止媒体流失败:", e);
    }
    this.mediaStreamRef = null;
  }
  
  console.log('停止捕获Web平台音频');
}

/**
 * 开始原生平台录音
 */
private async startNativeRecording(): Promise<boolean> {
  try {
    if (!this.audioRecorderPlayer) {
      this.audioRecorderPlayer = new RNAudioRecorderPlayer();
    }

    await this.audioRecorderPlayer.startRecorder();
    this.audioRecorderPlayer.addRecordBackListener((data) => {
      if (!this.isRecording || !this.processor) return;
      
      // 从原生录音数据中提取音频振幅信息
      // 原生录音返回的数据结构较简单，通常包含currentPosition和currentMetering
      let audioLevel = 0;
      if (data.currentMetering !== undefined) {
        // currentMetering通常是分贝值，转换为-1到1的范围
        audioLevel = Math.max(-1, Math.min(1, data.currentMetering / 100));
      }
      
      // 创建一个简单的音频数据样本
      const sampleCount = 220; // 大约0.05秒的数据
      const audioData = new Float32Array(sampleCount);
      
      // 生成一个简单的音频波形，振幅由audioLevel决定
      for (let i = 0; i < sampleCount; i++) {
        // 使用随机值模拟自然音频
        audioData[i] = (Math.random() * 2 - 1) * Math.abs(audioLevel) * 0.5;
      }
      
      // 发送到处理器
      this.processor.addAudioData(audioData);
      console.log(
        `添加原生音频数据，长度: ${audioData.length}，` +
        `音频电平: ${audioLevel.toFixed(2)}，` +
        `持续时间: ${(audioData.length / 4410).toFixed(3)}秒`
      );
    });
    
    console.log('开始捕获原生平台音频...');
    return true;
  } catch (error) {
    console.error(`原生平台启动录音失败:`, error);
    return false;
  }
}

/**
 * 停止原生平台录音
 */
private async stopNativeRecording(): Promise<void> {
  try {
    if (this.audioRecorderPlayer) {
      await this.audioRecorderPlayer.stopRecorder();
      this.audioRecorderPlayer.removeRecordBackListener();
    }
    console.log('停止捕获原生平台音频');
  } catch (error) {
    console.error(`原生平台停止录音失败:`, error);
  }
}

/**
 * 清理资源
 */
public cleanup(): void {
  // 停止录音
  this.stopRecording();
  
  // 清理资源
  this.audioRecorderPlayer = null;
  this.processor = null;
  this.isSimulating = false;
  this.isRecording = false;
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
      
      // 选择模拟声音类型
      const audioType = Math.random();
      let soundType = "";
      let mainFrequency = 0;

      if (audioType < 0.6) {
        // 60% 概率生成环境噪声 - 复杂噪声混合
        soundType = "环境噪声";
        mainFrequency = 50 + Math.floor(Math.random() * 950); // 环境噪声的频率分布广
        
        for (let i = 0; i < dataSize; i++) {
          // 基础噪声
          data[i] = (Math.random() * 2 - 1) * 0.08;
          
          // 添加多频率成分使声音更自然
          const time = i / 4410;
          // 随机低频成分
          data[i] += Math.sin(2 * Math.PI * (50 + Math.random() * 50) * time) * 0.02;
          // 随机中频成分
          if (i % 2 === 0) { // 交错添加，降低计算量
            data[i] += Math.sin(2 * Math.PI * (300 + Math.random() * 100) * time) * 0.01;
          }
          // 随机高频成分
          if (i % 4 === 0) { // 交错添加，降低计算量
            data[i] += Math.sin(2 * Math.PI * (1000 + Math.random() * 200) * time) * 0.005;
          }
        }
      } else if (audioType < 0.85) {
        // 25% 概率生成猫叫声 - 频率变化大
        soundType = "猫叫声";
        mainFrequency = 400 + Math.floor(Math.random() * 400); // 400-800Hz
        const freqVariation = 50 + Math.random() * 100; // 频率变化幅度
        const modulationRate = 0.5 + Math.random() * 2.0; // 调制速率
        
        for (let i = 0; i < dataSize; i++) {
          const time = i / 4410;
          // 使用频率调制使声音运动
          const modulation = Math.sin(2 * Math.PI * modulationRate * time);
          const currentFreq = mainFrequency + modulation * freqVariation;
          
          // 生成基础音
          data[i] = Math.sin(2 * Math.PI * currentFreq * time) * 0.4;
          
          // 添加波形谐波使其听起来更真实
          data[i] += Math.sin(2 * Math.PI * currentFreq * 2 * time) * 0.2;
          data[i] += Math.sin(2 * Math.PI * currentFreq * 3 * time) * 0.1;
          
          // 添加小量噪声
          data[i] += (Math.random() * 2 - 1) * 0.05;
        }
        
        // 添加包络效果(指数上升和下降)
        const attackSamples = Math.min(Math.floor(dataSize / 5), 200);
        const releaseSamples = Math.min(Math.floor(dataSize / 3), 300);
        
        for (let i = 0; i < attackSamples; i++) {
          data[i] *= (i / attackSamples);
        }
        
        for (let i = 0; i < releaseSamples; i++) {
          const index = dataSize - releaseSamples + i;
          if (index >= 0 && index < dataSize) {
            data[index] *= (1 - (i / releaseSamples));
          }
        }
      } else {
        // 15% 概率生成其他场景声音
        const soundChoice = Math.floor(Math.random() * 3);
        
        if (soundChoice === 0) {
          // 电子设备噪声 (如手机振动)
          soundType = "电子设备噪声";
          mainFrequency = 150 + Math.floor(Math.random() * 100);
          for (let i = 0; i < dataSize; i++) {
            const time = i / 4410;
            // 基础低频振动
            data[i] = Math.sin(2 * Math.PI * mainFrequency * time) * 0.3;
            // 添加电子噪声
            if (i % 10 === 0) {
              data[i] += (Math.random() * 2 - 1) * 0.4;
            }
          }
        } else if (soundChoice === 1) {
          // 人声背景噪声
          soundType = "人声背景";
          mainFrequency = 200 + Math.floor(Math.random() * 300);
          for (let i = 0; i < dataSize; i++) {
            const time = i / 4410;
            // 模拟人声的复杂波形
            data[i] = Math.sin(2 * Math.PI * mainFrequency * time) * 0.2;
            data[i] += Math.sin(2 * Math.PI * (mainFrequency * 1.5) * time) * 0.15;
            data[i] += Math.sin(2 * Math.PI * (mainFrequency * 2.3) * time) * 0.1;
            // 添加随机谐波变化
            data[i] += Math.sin(2 * Math.PI * (mainFrequency * (3 + Math.random())) * time) * 0.05;
            // 添加噪声
            data[i] += (Math.random() * 2 - 1) * 0.07;
          }
        } else {
          // 物体碰撞声
          soundType = "物体碰撞";
          mainFrequency = 50 + Math.floor(Math.random() * 200);
          // 生成一个随机的碰撞位置
          const hitPosition = Math.floor(dataSize * 0.2 + Math.random() * dataSize * 0.6);
          const hitWidth = 50 + Math.random() * 100;
          
          for (let i = 0; i < dataSize; i++) {
            // 基础环境噪声
            data[i] = (Math.random() * 2 - 1) * 0.05;
            
            // 添加碰撞声
            const distance = Math.abs(i - hitPosition);
            if (distance < hitWidth) {
              const impact = 1 - distance / hitWidth;
              data[i] += impact * 0.6 * Math.sin(2 * Math.PI * mainFrequency * (i / 4410));
              // 添加剥波响应
              data[i] += impact * 0.3 * Math.sin(2 * Math.PI * (mainFrequency * 2) * (i / 4410));
            }
          }
        }
      }

      // 添加到处理器
      this.processor.addAudioData(data);
      
      this.lastSimulationTime = now; // 在成功添加后更新时间戳
      
      console.log(
        `添加模拟音频数据，长度: ${dataSize}，采样率: 4410Hz，` +
        `持续时间: ${(dataSize / 4410).toFixed(3)}秒，` +
        `实际间隔: ${elapsed}ms，` +
        `类型: ${soundType}，主频率: ${mainFrequency}Hz`
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

}

export default AudioDataManager;