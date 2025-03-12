/**
 * 猫叫检测模块
 * 提供猫叫检测功能，适用于React Native
 */

import { Audio } from 'expo-av';
import { AudioFeatures, AudioAnalysisResult } from './audioTypes';
import { AudioProcessor } from './audioProcessor';
import { AliBaiLianSDK } from './aliBaiLianSDK';
import { NativeModules, Platform } from 'react-native';

// 获取原生模块
const { MeowDetectorNative } = NativeModules;

// 定义猫叫检测器状态
export enum MeowDetectorState {
  Idle = 'idle',
  Recording = 'recording',
  Processing = 'processing',
  Detected = 'detected'
}

// 模块配置
interface MeowDetectorConfig {
  // 百炼SDK配置
  baiLianConfig?: {
    appId: string;
    apiKey: string;
  };
  // 音频处理器配置
  audioProcessorConfig?: {
    sampleRate?: number;
    silenceThreshold?: number;
    minSilenceTime?: number;
    minProcessTime?: number;
    maxBufferTime?: number;
  };
  // 回调函数
  onStateChange?: (state: MeowDetectorState) => void;
  onMeowDetected?: (result: AudioAnalysisResult) => void;
  onAnalysisResult?: (text: string) => void;
  onError?: (error: Error) => void;
}

/**
 * 猫叫检测器模块
 */
export class MeowDetectorModule {
  private recording: Audio.Recording | null = null;
  private processor: AudioProcessor | null = null;
  private baiLianSDK: AliBaiLianSDK | null = null;
  private processingInterval: NodeJS.Timeout | null = null;
  private isListening: boolean = false;
  private state: MeowDetectorState = MeowDetectorState.Idle;
  private config: MeowDetectorConfig;
  private audioBuffer: Float32Array = new Float32Array();
  private useNativeModule: boolean = false;
  
  /**
   * 创建猫叫检测器模块
   */
  constructor(config: MeowDetectorConfig = {}) {
    this.config = config;
    
    // 检查是否可以使用原生模块
    this.useNativeModule = Platform.OS === 'android' && !!MeowDetectorNative;
    console.log(`使用原生模块: ${this.useNativeModule ? '是' : '否'}`);
    
    // 初始化音频处理器
    this.processor = new AudioProcessor(config.audioProcessorConfig);
    
    // 初始化百炼SDK（如果配置了）
    if (config.baiLianConfig && config.baiLianConfig.appId && config.baiLianConfig.apiKey) {
      this.baiLianSDK = new AliBaiLianSDK({
        appId: config.baiLianConfig.appId,
        apiKey: config.baiLianConfig.apiKey
      });
    }
  }
  
  /**
   * 获取当前状态
   */
  public getState(): MeowDetectorState {
    return this.state;
  }
  
  /**
   * 设置状态并触发回调
   */
  private setState(newState: MeowDetectorState): void {
    this.state = newState;
    if (this.config.onStateChange) {
      this.config.onStateChange(newState);
    }
  }
  
  /**
   * 开始录音和检测
   */
  public async startListening(): Promise<void> {
    if (this.isListening) {
      return;
    }
    
    try {
      // 申请音频权限
      await Audio.requestPermissionsAsync();
      
      // 设置音频模式
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: 1, // 1 对应 DUCK_OTHERS 模式
        shouldDuckAndroid: true,
        interruptionModeAndroid: 1, // 1 对应 DUCK_OTHERS 模式
        playThroughEarpieceAndroid: false,
      });
      
      // 准备录音
      this.recording = new Audio.Recording();
      
      // 使用 expo-av 预设的录音选项
      const recordingOptions = {
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.AAC_ADTS,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.MEDIUM,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      };
      
      await this.recording.prepareToRecordAsync(recordingOptions);
      
      // 绑定更新事件
      this.recording.setOnRecordingStatusUpdate(this.onRecordingStatusUpdate);
      
      // 开始录音
      await this.recording.startAsync();
      this.isListening = true;
      this.setState(MeowDetectorState.Recording);
      
      // 设置定时处理
      this.processingInterval = setInterval(() => {
        this.processAudioBuffer();
      }, 500);
      
      console.log('开始监听猫叫');
      
    } catch (error) {
      console.error('启动音频捕捉失败:', error);
      if (this.config.onError) {
        this.config.onError(error as Error);
      }
    }
  }
  
  /**
   * 录音状态更新回调
   */
  private onRecordingStatusUpdate = async (status: Audio.RecordingStatus) => {
    if (!status.isRecording) {
      return;
    }
    
    try {
      // 获取最新音频数据
      if (this.recording && status.isRecording) {
        const uri = this.recording.getURI();
        if (uri) {
          // 注意：这里的获取音频数据方式需要根据实际情况调整
          // Expo的Audio API不直接提供原始音频数据访问
          // 实际项目中可能需要使用原Native模块或第三方库
          
          // 模拟音频数据的生成
          this.simulateAudioData();
        }
      }
    } catch (error) {
      console.error('处理音频数据错误:', error);
    }
  }
  
  /**
   * 模拟音频数据生成
   * 注意：实际项目中需要替换成真实的音频数据采集
   */
  private simulateAudioData() {
    if (!this.processor) return;
    
    // 创建一个模拟的音频数据片段，实际应用中需要替换成真实采集到的音频数据
    const bufferSize = 1024;
    const data = new Float32Array(bufferSize);
    
    // 随机生成一些数据用于测试
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.1; // 低幅度噪声
    }
    
    // 模拟5%的概率生成猫叫声
    if (Math.random() < 0.05) {
      // 模拟猫叫声 - 生成一个600Hz的正弦波
      const freq = 600 + Math.random() * 100; // 550-650Hz的正弦波
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.sin(2 * Math.PI * freq * i / 44100) * 0.5;
      }
    }
    
    // 添加到处理器
    this.processor.addAudioData(data);
  }
  
  /**
   * 处理音频缓冲区
   */
  private processAudioBuffer(): void {
    if (!this.processor || !this.isListening) {
      return;
    }
    
    // 检查是否需要处理音频
    if (this.processor.shouldProcessAudio()) {
      this.setState(MeowDetectorState.Processing);
      
      // 获取缓冲区数据
      const audioData = this.processor.getAudioBuffer();
      
      if (this.useNativeModule && MeowDetectorNative) {
        // 使用原生模块处理音频
        console.log('使用原生模块处理音频数据，长度:', audioData.length);
        
        // 将Float32Array转换为普通数组，因为React Native桥接不支持TypedArray
        const dataArray = Array.from(audioData);
        
        MeowDetectorNative.processAudio(dataArray)
          .then((result: string) => {
            try {
              const analysisResult = JSON.parse(result);
              
              // 处理分析结果
              if (analysisResult.status === 'success' && analysisResult.emotion) {
                if (this.config.onMeowDetected) {
                  this.config.onMeowDetected({
                    isMeow: true,
                    emotion: analysisResult.emotion,
                    confidence: analysisResult.confidence,
                    features: analysisResult.features
                  });
                }
                
                this.setState(MeowDetectorState.Detected);
              } else {
                console.log('分析结果:', analysisResult);
              }
            } catch (error) {
              console.error('解析分析结果失败:', error);
            }
          })
          .catch((error: Error) => {
            console.error('原生模块处理音频失败:', error);
            if (this.config.onError) {
              this.config.onError(error);
            }
          });
      } else {
        // 使用JavaScript处理音频
        this.processAudioWithJS(audioData);
      }
      
      // 清空处理器缓冲区
      this.processor.clearBuffer();
    }
  }
  
  /**
   * 使用JavaScript处理音频
   */
  private processAudioWithJS(audioData: Float32Array): void {
    // 这里是JavaScript的音频处理逻辑
    // 实际项目中可能需要更复杂的算法
    
    // 简单的能量检测示例
    let energy = 0;
    for (let i = 0; i < audioData.length; i++) {
      energy += audioData[i] * audioData[i];
    }
    energy /= audioData.length;
    
    // 简单阈值判断
    const isMeow = energy > 0.01;
    
    if (isMeow) {
      // 创建符合 AudioFeatures 接口的特征对象
      const features: AudioFeatures = {
        Duration: audioData.length / 44100,
        Energy: energy,
        RootMeanSquare: Math.sqrt(energy),
        ZeroCrossRate: 0.01, // 简化值
        PeakFreq: 600,       // 简化值
        FundamentalFreq: 600, // 简化值
        Pitch: 600,          // 简化值
        SpectralCentroid: 1000, // 简化值
        SpectralRolloff: 2000   // 简化值
      };
      
      // 触发回调
      if (this.config.onMeowDetected) {
        this.config.onMeowDetected({
          isMeow: true,
          emotion: 'unknown', // JavaScript版本不提供情感分析
          confidence: 0.5,
          features: features
        });
      }
      
      this.setState(MeowDetectorState.Detected);
    }
  }
  
  /**
   * 停止录音和检测
   */
  public async stopListening(): Promise<void> {
    if (!this.isListening) {
      return;
    }
    
    // 清除定时器
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    // 停止录音
    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
      } catch (error) {
        console.error('停止录音失败:', error);
      }
      this.recording = null;
    }
    
    // 重置状态
    this.isListening = false;
    this.setState(MeowDetectorState.Idle);
    
    console.log('停止监听猫叫');
  }
}
