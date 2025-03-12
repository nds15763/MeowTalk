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
      console.log('已经在监听中');
      return;
    }
    
    try {
      // 请求录音权限
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        throw new Error('需要录音权限');
      }
      
      // 配置音频会话
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
      });
      
      // 创建录音实例
      this.recording = new Audio.Recording();
      await this.recording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.AAC_ADTS,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 4410,
          numberOfChannels: 1,
          bitRate: 16 * 4410,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.MEDIUM,
          sampleRate: 4410,
          numberOfChannels: 1,
          bitRate: 16 * 4410,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 16 * 4410,
        },
      });
      
      // 绑定更新事件
      this.recording.setOnRecordingStatusUpdate(this.onRecordingStatusUpdate);
      
      // 开始录音
      await this.recording.startAsync();
      this.isListening = true;
      this.setState(MeowDetectorState.Recording);
      
      // 设置定时处理
      this.processingInterval = setInterval(() => {
        this.processAudioBuffer();
      }, 100); // 缩短处理间隔以提高响应速度
      
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
        // 使用原生模块获取音频数据
        if (this.useNativeModule && MeowDetectorNative) {
          try {
            // 从原生层获取音频数据
            const audioData = await MeowDetectorNative.getAudioData();
            if (audioData && audioData.length > 0) {
              // 将音频数据添加到处理器
              this.processor?.addAudioData(new Float32Array(audioData));
              console.log('成功获取音频数据，长度:', audioData.length);
            } else {
              console.log('没有新的音频数据');
            }
          } catch (error) {
            console.error('获取音频数据失败:', error);
          }
        } else if (Platform.OS === 'web') {
          // Web 平台使用模拟音频数据
          this.simulateAudioData();
        } else {
          // 如果不能使用原生模块，使用模拟数据
          console.log('非原生平台，使用模拟音频数据');
          this.simulateAudioData();
        }
      }
    } catch (error) {
      console.error('处理音频数据错误:', error);
      if (this.config.onError) {
        this.config.onError(error as Error);
      }
    }
  }
  
  /**
   * 处理音频缓冲区
   */
  private processAudioBuffer(): void {
    if (!this.processor) {
      return;
    }
    
    // 获取处理器中的音频数据
    const audioData = this.processor.getAudioBuffer();
    
    if (!audioData || audioData.length === 0) {
      console.log('音频缓冲区为空');
      return;
    }
    
    // 记录处理的音频数据长度
    console.log(`处理音频数据，长度: ${audioData.length}，持续时间: ${audioData.length / 4410}秒`);
    
    // 检查是否需要处理音频
    if (this.processor.shouldProcessAudio()) {
      // 如果可以使用原生模块，则使用原生模块处理音频
      if (this.useNativeModule && MeowDetectorNative) {
        // 将Float32Array转换为普通数组，以便传递给原生模块
        const dataArray = Array.from(audioData);
        console.log('使用原生模块处理音频数据');
        
        MeowDetectorNative.processAudio(dataArray)
          .then((result: string) => {
            try {
              const analysisResult = JSON.parse(result);
              
              // 无论结果如何，都输出详细的音频分析信息
              console.log('音频分析结果:', JSON.stringify(analysisResult, null, 2));
              
              // 处理分析结果
              if (analysisResult.status === 'success') {
                if (analysisResult.isMeow) {
                  console.log(`检测到猫叫，情感: ${analysisResult.emotion}, 可信度: ${analysisResult.confidence}`);
                  console.log('音频特征:', JSON.stringify(analysisResult.features, null, 2));
                  
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
                  console.log('未检测到猫叫，分析特征:', JSON.stringify(analysisResult.features, null, 2));
                  
                  // 即使没有检测到猫叫，也可以选择触发回调，但isMeow为false
                  if (this.config.onMeowDetected) {
                    this.config.onMeowDetected({
                      isMeow: false,
                      emotion: 'none',
                      confidence: 0,
                      features: analysisResult.features
                    });
                  }
                }
              } else {
                console.log('分析结果异常:', analysisResult);
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
    } else {
      console.log('音频数据未达到处理条件，继续收集');
    }
  }
  
  /**
   * 模拟音频数据生成
   * 用于测试和调试目的
   */
  private simulateAudioData() {
    if (!this.processor) return;
    
    // 创建一个模拟的音频数据片段
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
        data[i] = Math.sin(2 * Math.PI * freq * i / 4410) * 0.5;
      }
    }
    
    // 添加到处理器
    this.processor.addAudioData(data);
    console.log('添加模拟音频数据，长度:', bufferSize);
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
    
    // 创建符合 AudioFeatures 接口的特征对象
    const features: AudioFeatures = {
      Duration: audioData.length / 4410,
      Energy: energy,
      RootMeanSquare: Math.sqrt(energy),
      ZeroCrossRate: 0.01, // 简化值
      PeakFreq: 600,       // 简化值
      FundamentalFreq: 600, // 简化值
      Pitch: 600,          // 简化值
      SpectralCentroid: 1000, // 简化值
      SpectralRolloff: 2000   // 简化值
    };
    
    // 输出音频特征用于调试
    console.log('JS处理音频特征:', JSON.stringify(features, null, 2));
    
    // 简单阈值判断
    const isMeow = energy > 0.01;
    
    if (isMeow) {
      console.log('JS检测到猫叫，能量值:', energy);
      
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
    } else {
      console.log('JS未检测到猫叫，能量值:', energy);
      
      // 即使没有检测到猫叫，也触发回调，但isMeow为false
      if (this.config.onMeowDetected) {
        this.config.onMeowDetected({
          isMeow: false,
          emotion: 'none',
          confidence: 0,
          features: features
        });
      }
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
