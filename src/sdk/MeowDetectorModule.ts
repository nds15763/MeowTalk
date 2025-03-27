/**
 * 猫叫检测模块
 * 提供猫叫检测功能，适用于React Native
 */

import { Audio } from "expo-av";
import { AudioFeatures, AudioAnalysisResult } from "./audioTypes";
import { AudioProcessor } from "./audioProcessor";
import { AliBaiLianSDK } from "./aliBaiLianSDK";
import { NativeModules, Platform } from "react-native";
import AudioDataManager from "./AudioDataManager";

// 获取原生模块
const { MeowDetectorNative } = NativeModules;

// 定义猫叫检测器状态
export enum MeowDetectorState {
  Idle = "idle",
  Listening = "listening",
  Recording = "recording",
  Processing = "processing",
  Detected = "detected",
  Error = "error",
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
  onStarted?: () => void;
  onStopped?: () => void;
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
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private audioAnalyser: AnalyserNode | null = null;
  private audioDataArray: Uint8Array | null = null;
  private animationFrame: number | null = null;

  /**
   * 创建猫叫检测器模块
   */
  constructor(config: MeowDetectorConfig = {}) {
    this.config = config;

    // 检查是否可以使用原生模块
    this.useNativeModule = Platform.OS === "android" && !!MeowDetectorNative;
    console.log(`使用原生模块: ${this.useNativeModule ? "是" : "否"}`);

    // 初始化音频处理器
    this.processor = new AudioProcessor(config.audioProcessorConfig);
    
    // 初始化音频数据管理器
    AudioDataManager.getInstance().initProcessor(this.processor);

    // 初始化百炼SDK（如果配置了）
    if (
      config.baiLianConfig &&
      config.baiLianConfig.appId &&
      config.baiLianConfig.apiKey
    ) {
      this.baiLianSDK = new AliBaiLianSDK({
        appId: config.baiLianConfig.appId,
        apiKey: config.baiLianConfig.apiKey,
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
    if (this.state !== MeowDetectorState.Idle) {
      console.log("已经在监听中，请先停止");
      return;
    }

    try {
      this.setState(MeowDetectorState.Listening);
      console.log("开始配置音频会话...");

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
          extension: ".m4a",
          outputFormat: Audio.AndroidOutputFormat.AAC_ADTS,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 4410, // 修改采样率
          numberOfChannels: 1,
          bitRate: 16 * 4410,
        },
        ios: {
          extension: ".m4a",
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.MEDIUM,
          sampleRate: 4410, // 修改采样率
          numberOfChannels: 1,
          bitRate: 16 * 4410,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: "audio/webm",
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
      }, 100); // 修改处理间隔

      console.log("开始监听猫叫");

      // Web平台使用Web Audio API获取真实音频数据
      if (Platform.OS === "web") {
        this.setupWebAudio();
      }
    } catch (error) {
      console.error("启动音频捕捉失败:", error);
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
              // 使用音频数据管理器处理原生音频数据
              AudioDataManager.getInstance().processNativeAudioData(audioData);
              console.log("成功获取音频数据，长度:", audioData.length);
            } else {
              console.log("没有新的音频数据");
            }
          } catch (error) {
            console.error("获取音频数据失败:", error);
          }
        } else if (Platform.OS === "web") {
          // Web 平台使用模拟音频数据
          AudioDataManager.getInstance().simulateAudioData();
        } else {
          // 如果不能使用原生模块，使用模拟数据
          console.log("非原生平台，使用模拟音频数据");
          AudioDataManager.getInstance().simulateAudioData();
        }
      }
    } catch (error) {
      console.error("处理音频数据错误:", error);
      if (this.config.onError) {
        this.config.onError(error as Error);
      }
    }
  };

  /**
   * 处理音频缓冲区中的数据
   */
  private async processAudioBuffer(): Promise<void> {
    // 确保有处理器和数据
    if (!this.processor) return;

    // 获取缓冲区数据
    const audioData = this.processor.getAudioBuffer();

    // 计算实际持续时间（秒）
    const durationSeconds = audioData.length / 4410; // 使用正确的采样率4410Hz

    // 日志输出缓冲区状态
    console.log(
      `处理音频数据，长度: ${
        audioData.length
      }，持续时间: ${durationSeconds.toFixed(2)}秒，采样率: 4410Hz`
    );

    // 确定是否需要处理音频
    let shouldProcess = false;

    // 条件1: 至少有2秒的数据
    if (durationSeconds >= 2.0) {
      shouldProcess = true;
      console.log("条件满足: 至少2秒数据");
    }

    // 条件2: 自上次处理已经过去了至少5秒（强制处理）
    const timeSinceLastProcess =
      (Date.now() - this.processor.getLastProcessTime()) / 1000;
    if (timeSinceLastProcess >= 5.0 && durationSeconds >= 1.0) {
      shouldProcess = true;
      console.log(
        `条件满足: 距离上次处理已过去${timeSinceLastProcess.toFixed(1)}秒`
      );
    }

    // 如果不满足处理条件
    if (!shouldProcess) {
      console.log("音频数据未达到处理条件，继续收集");
      return;
    }

    // 备份当前音频数据用于后续处理
    const audioDataBackup = new Float32Array(audioData);

    // 开始处理音频数据
    if (this.useNativeModule && MeowDetectorNative) {
      // 使用原生模块处理音频
      this.setState(MeowDetectorState.Processing);

      MeowDetectorNative.processAudio(Array.from(audioData))
        .then((result: string) => {
          try {
            const analysisResult = JSON.parse(result);

            // 无论结果如何，都输出详细的音频分析信息
            console.log(
              "音频分析结果:",
              JSON.stringify(analysisResult, null, 2)
            );

            // 处理分析结果
            if (analysisResult.status === "success") {
              if (analysisResult.isMeow) {
                console.log(
                  `检测到猫叫，情感: ${analysisResult.emotion}, 可信度: ${analysisResult.confidence}`
                );
                console.log(
                  "音频特征:",
                  JSON.stringify(analysisResult.features, null, 2)
                );

                if (this.config.onMeowDetected) {
                  this.config.onMeowDetected({
                    isMeow: true,
                    emotion: analysisResult.emotion,
                    confidence: analysisResult.confidence,
                    features: analysisResult.features,
                  });
                }

                this.setState(MeowDetectorState.Detected);
              } else {
                console.log(
                  "未检测到猫叫，分析特征:",
                  JSON.stringify(analysisResult.features, null, 2)
                );

                // 即使没有检测到猫叫，也可以选择触发回调，但isMeow为false
                if (this.config.onMeowDetected) {
                  this.config.onMeowDetected({
                    isMeow: false,
                    emotion: "none",
                    confidence: 0,
                    features: analysisResult.features,
                  });
                }
              }
            } else {
              console.log("分析结果异常:", analysisResult);
            }

            // 清空处理器缓冲区
            if (this.processor) {
              this.processor.clearBuffer();

              // 保存最近 0.5 秒的音频数据作为重叠
              const samplesToKeep = Math.floor(0.5 * 4410); // 0.5秒的数据量
              if (audioDataBackup.length > samplesToKeep) {
                const newBuffer = audioDataBackup.slice(-samplesToKeep);
                this.processor.addAudioData(newBuffer);
                console.log(
                  `保留最近 ${(samplesToKeep / 4410).toFixed(
                    2
                  )} 秒的音频数据作为重叠`
                );
              }
            }
          } catch (error) {
            console.error("解析分析结果失败:", error);
          }
        })
        .catch((error: Error) => {
          console.error("原生模块处理音频失败:", error);
          if (this.config.onError) {
            this.config.onError(error);
          }
        });
    } else {
      // 使用JavaScript处理音频
      this.processAudioWithJS(audioDataBackup);

      // 清空处理器缓冲区
      if (this.processor) {
        this.processor.clearBuffer();

        // 保存最近 0.5 秒的音频数据作为重叠
        const samplesToKeep = Math.floor(0.5 * 4410); // 0.5秒的数据量
        if (audioDataBackup.length > samplesToKeep) {
          const newBuffer = audioDataBackup.slice(-samplesToKeep);
          this.processor.addAudioData(newBuffer);
          console.log(
            `保留最近 ${(samplesToKeep / 4410).toFixed(2)} 秒的音频数据作为重叠`
          );
        }
      }
    }
  }

  /**
   * 使用JavaScript处理音频
   */
  private processAudioWithJS(audioData: Float32Array): void {
    if (!this.processor) return;

    // 计算能量
    let energy = 0;
    for (let i = 0; i < audioData.length; i++) {
      energy += audioData[i] * audioData[i];
    }
    energy /= audioData.length;

    // 使用AudioProcessor提取音频特征
    let features: AudioFeatures;
    if (this.processor) {
      // 添加音频数据到处理器
      this.processor.addAudioData(audioData);
      
      // 处理音频并提取特征
      const result = this.processor.processAudio();
      features = result.features;
      
      console.log("使用AudioProcessor提取的音频特征:", JSON.stringify(features, null, 2));
    } else {
      // 如果没有处理器，使用默认值
      features = {
        Duration: audioData.length / 4410,
        Energy: energy,
        RootMeanSquare: Math.sqrt(energy),
        ZeroCrossRate: 0.01,
        PeakFreq: 600,
        FundamentalFreq: 600,
        Pitch: 600,
        SpectralCentroid: 1000,
        SpectralRolloff: 2000,
      };
      console.log("使用默认值的音频特征:", JSON.stringify(features, null, 2));
    }

    // 输出音频特征用于调试
    console.log("JS处理音频特征:", JSON.stringify(features, null, 2));

    // 多特征判断，参考Go版本的isCatMeow函数
    // 1. 能量阈值检查
    const energyValid = energy >= 100 && energy <= 1500;
    
    // 2. 音高范围检查（简化版）
    const pitchValid = features.Pitch >= 200 && features.Pitch <= 800;
    
    // 3. 持续时间特征
    const durationValid = features.Duration >= 0.5 && features.Duration <= 3.0;
    
    // 4. 谐波结构检查（简化版）
    const centroidValid = features.SpectralCentroid >= 700 && features.SpectralCentroid <= 1800;
    
    // 5. 过零率检查
    const zeroCrossValid = features.ZeroCrossRate >= 0.1 && features.ZeroCrossRate <= 0.25;
    
    // 计算有效特征数量
    let validCount = 0;
    if (energyValid) validCount++;
    if (pitchValid) validCount++;
    if (durationValid) validCount++;
    if (centroidValid) validCount++;
    if (zeroCrossValid) validCount++;
    
    // 至少满足4个条件才认为是猫叫
    const isMeow = validCount >= 4;
    
    // 计算置信度 (0.0-1.0)
    const confidence = validCount / 5.0;
    
    console.log("猫叫检测结果: 能量=", energyValid, ", 音高=", pitchValid, ", 持续时间=", durationValid, 
      ", 谐波结构=", centroidValid, ", 过零率=", zeroCrossValid, ", 总得分=", validCount, "/5");

    console.log("音频特征:", JSON.stringify(features, null, 2));

    if (isMeow) {
      console.log("JS检测到猫叫，置信度:", confidence);

      // 触发回调
      if (this.config.onMeowDetected) {
        this.config.onMeowDetected({
          isMeow: true,
          emotion: "unknown", // JavaScript版本不提供情感分析
          confidence: confidence,
          features: features,
        });
      }

      this.setState(MeowDetectorState.Detected);
    } else {
      console.log("JS未检测到猫叫，置信度:", confidence);

      // 即使没有检测到猫叫，也触发回调，但isMeow为false
      if (this.config.onMeowDetected) {
        this.config.onMeowDetected({
          isMeow: false,
          emotion: "none",
          confidence: confidence,
          features: features,
        });
      }
    }
  }

  /**
   * Web平台使用Web Audio API获取真实音频数据
   */
  private async setupWebAudio(): Promise<void> {
    try {
      // 获取麦克风访问权限并创建媒体流
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaStream = stream;

      // 创建AudioContext和分析器
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      this.audioContext = audioContext;

      // 创建分析器节点
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      this.audioAnalyser = analyser;

      // 创建音频源并连接到分析器
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // 准备数据数组
      const bufferLength = analyser.frequencyBinCount;
      this.audioDataArray = new Uint8Array(bufferLength);

      // 开始周期性采集音频数据
      this.startAudioCapture();

      console.log("Web Audio API 初始化成功，开始采集真实音频数据");
    } catch (error) {
      console.error("初始化Web Audio API失败:", error);
      // 降级到模拟数据
      AudioDataManager.getInstance().simulateAudioData();

      if (this.config.onError) {
        this.config.onError(error as Error);
      }
    }
  }

  /**
   * 开始周期性采集Web音频数据
   */
  private startAudioCapture(): void {
    if (!this.audioAnalyser || !this.audioDataArray) {
      console.error("音频分析器未初始化");
      return;
    }

    // 定义采集函数
    const captureAudio = () => {
      if (this.state !== MeowDetectorState.Listening) return;

      // 获取频域数据
      this.audioAnalyser!.getByteFrequencyData(this.audioDataArray!);

      // 使用AudioDataManager处理Web Audio API数据
      AudioDataManager.getInstance().processWebAudioData(this.audioDataArray!);

      // 继续下一帧采集
      this.animationFrame = requestAnimationFrame(captureAudio);
    };

    // 开始采集
    this.animationFrame = requestAnimationFrame(captureAudio);
  }

  /**
   * 停止录音和检测
   */
  public async stopListening(): Promise<void> {
    if (this.state === MeowDetectorState.Idle) {
      console.log("已经停止监听");
      return;
    }

    try {
      // 清除定时器
      if (this.processingInterval) {
        clearInterval(this.processingInterval);
        this.processingInterval = null;
      }

      // 停止录音
      if (this.recording) {
        await this.recording.stopAndUnloadAsync();
        this.recording = null;
        console.log("停止录音");
      }

      // 停止Web音频捕获
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
        console.log("停止Web音频捕获");
      }

      // 关闭AudioContext
      if (this.audioContext) {
        await this.audioContext.close();
        this.audioContext = null;
        console.log("关闭AudioContext");
      }

      // 停止媒体流
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((track) => track.stop());
        this.mediaStream = null;
        console.log("停止媒体流");
      }

      // 清空处理器缓冲区
      if (this.processor) {
        this.processor.clearBuffer();
      }

      // 重置音频数据管理器
      AudioDataManager.getInstance().reset();

      this.setState(MeowDetectorState.Idle);
      console.log("停止监听猫叫");

      if (this.config.onStopped) {
        this.config.onStopped();
      }
    } catch (error) {
      console.error("停止监听失败:", error);

      if (this.config.onError) {
        this.config.onError(error as Error);
      }
    }
  }
}
