/**
 * u732bu53ebu68c0u6d4bu6a21u5757
 * u63d0u4f9bu732bu53ebu68c0u6d4bu529fu80fduff0cu9002u7528u4e8eReact Native
 */

import { Audio } from 'expo-av';
import { AudioFeatures, AudioAnalysisResult } from './audioTypes';
import { AudioProcessor } from './audioProcessor';
import { AliBaiLianSDK } from './aliBaiLianSDK';

// u5b9au4e49u732bu53ebu68c0u6d4bu5668u72b6u6001
export enum MeowDetectorState {
  Idle = 'idle',
  Recording = 'recording',
  Processing = 'processing',
  Detected = 'detected'
}

// u6a21u5757u914du7f6e
interface MeowDetectorConfig {
  // u767eu70bcSDKu914du7f6e
  baiLianConfig?: {
    appId: string;
    apiKey: string;
  };
  // u97f3u9891u5904u7406u5668u914du7f6e
  audioProcessorConfig?: {
    sampleRate?: number;
    silenceThreshold?: number;
    minSilenceTime?: number;
    minProcessTime?: number;
    maxBufferTime?: number;
  };
  // u56deu8c03u51fdu6570
  onStateChange?: (state: MeowDetectorState) => void;
  onMeowDetected?: (result: AudioAnalysisResult) => void;
  onAnalysisResult?: (text: string) => void;
  onError?: (error: Error) => void;
}

/**
 * u732bu53ebu68c0u6d4bu5668u6a21u5757
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
  
  /**
   * u521bu5efau732bu53ebu68c0u6d4bu5668u6a21u5757
   */
  constructor(config: MeowDetectorConfig = {}) {
    this.config = config;
    
    // u521du59cbu5316u97f3u9891u5904u7406u5668
    this.processor = new AudioProcessor(config.audioProcessorConfig);
    
    // u521du59cbu5316u767eu70bcSDKuff08u5982u679cu914du7f6eu4e86uff09
    if (config.baiLianConfig && config.baiLianConfig.appId && config.baiLianConfig.apiKey) {
      this.baiLianSDK = new AliBaiLianSDK({
        appId: config.baiLianConfig.appId,
        apiKey: config.baiLianConfig.apiKey
      });
    }
  }
  
  /**
   * u83b7u53d6u5f53u524du72b6u6001
   */
  public getState(): MeowDetectorState {
    return this.state;
  }
  
  /**
   * u8bbeu7f6eu72b6u6001u5e76u89e6u53d1u56deu8c03
   */
  private setState(newState: MeowDetectorState): void {
    this.state = newState;
    if (this.config.onStateChange) {
      this.config.onStateChange(newState);
    }
  }
  
  /**
   * u5f00u59cbu5f55u97f3u548cu68c0u6d4b
   */
  public async startListening(): Promise<void> {
    if (this.isListening) {
      return;
    }
    
    try {
      // u7533u8bf7u97f3u9891u6743u9650
      await Audio.requestPermissionsAsync();
      
      // u8bbeu7f6eu97f3u9891u6a21u5f0f
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: 1, // 1 对应 DUCK_OTHERS 模式
        shouldDuckAndroid: true,
        interruptionModeAndroid: 1, // 1 对应 DUCK_OTHERS 模式
        playThroughEarpieceAndroid: false,
      });
      
      // u51c6u5907u5f55u97f3
      this.recording = new Audio.Recording();
      
      // u4f7fu7528 expo-av u9884u8bbeu7684u5f55u97f3u9009u9879
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
      
      // u7ed1u5b9au66f4u65b0u4e8bu4ef6
      this.recording.setOnRecordingStatusUpdate(this.onRecordingStatusUpdate);
      
      // u5f00u59cbu5f55u97f3
      await this.recording.startAsync();
      this.isListening = true;
      this.setState(MeowDetectorState.Recording);
      
      // u8bbeu7f6eu5b9au65f6u5904u7406
      this.processingInterval = setInterval(() => {
        this.processAudioBuffer();
      }, 500);
      
      console.log('u5f00u59cbu76d1u542cu732bu53eb');
      
    } catch (error) {
      console.error('u542fu52a8u97f3u9891u6355u6349u5931u8d25:', error);
      if (this.config.onError) {
        this.config.onError(error as Error);
      }
    }
  }
  
  /**
   * u5f55u97f3u72b6u6001u66f4u65b0u56deu8c03
   */
  private onRecordingStatusUpdate = async (status: Audio.RecordingStatus) => {
    if (!status.isRecording) {
      return;
    }
    
    try {
      // u83b7u53d6u6700u65b0u97f3u9891u6570u636e
      if (this.recording && status.isRecording) {
        const uri = this.recording.getURI();
        if (uri) {
          // u6ce8u610fuff1au8fd9u91ccu7684u83b7u53d6u97f3u9891u6570u636eu65b9u5f0fu9700u8981u6839u636eu5b9eu9645u60c5u51b5u8c03u6574
          // Expou7684Audio APIu4e0du76f4u63a5u63d0u4f9bu539fu59cbu97f3u9891u6570u636eu8bbfu95ee
          // u5b9eu9645u9879u76eeu4e2du53efu80fdu9700u8981u4f7fu7528u539fNativeu6a21u5757u6216u7b2cu4e09u65b9u5e93
          
          // u6a21u62dfu97f3u9891u6570u636eu7684u751fu6210
          this.simulateAudioData();
        }
      }
    } catch (error) {
      console.error('u5904u7406u97f3u9891u6570u636eu9519u8bef:', error);
    }
  }
  
  /**
   * u6a21u62dfu97f3u9891u6570u636eu751fu6210
   * u6ce8u610fuff1au5b9eu9645u9879u76eeu4e2du9700u8981u66ffu6362u6210u771fu5b9eu7684u97f3u9891u6570u636eu91c7u96c6
   */
  private simulateAudioData() {
    if (!this.processor) return;
    
    // u521bu5efau4e00u4e2au6a21u62dfu7684u97f3u9891u6570u636eu7247u6bb5uff0cu5b9eu9645u5e94u7528u4e2du9700u8981u66ffu6362u6210u771fu5b9eu91c7u96c6u5230u7684u97f3u9891u6570u636e
    const bufferSize = 1024;
    const data = new Float32Array(bufferSize);
    
    // u968fu673au751fu6210u4e00u4e9bu6570u636eu4e3au4e86u6d4bu8bd5
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.1; // u4f4eu5e45u5ea6u5566u58f0
    }
    
    // u6dfbu52a0u5230u5904u7406u5668
    this.processor.addAudioData(data);
  }
  
  /**
   * u5904u7406u97f3u9891u7f13u51b2u533a
   */
  private processAudioBuffer() {
    if (!this.processor || !this.isListening) {
      return;
    }
    
    // u68c0u67e5u662fu5426u9700u8981u5904u7406u97f3u9891
    if (this.processor.shouldProcessAudio()) {
      this.setState(MeowDetectorState.Processing);
      
      // u5904u7406u97f3u9891
      const result = this.processor.processAudio();
      
      // u5982u679cu68c0u6d4bu5230u732bu53eb
      if (result.isMeow) {
        this.setState(MeowDetectorState.Detected);
        
        console.log('u68c0u6d4bu5230u732bu53ebu58f0:', result);
        
        // u89e6u53d1u68c0u6d4bu56deu8c03
        if (this.config.onMeowDetected) {
          this.config.onMeowDetected(result);
        }
        
        // u8c03u7528u767eu70bcSDK
        this.callBaiLianSDK(result);
      } else {
        this.setState(MeowDetectorState.Recording);
      }
    }
  }
  
  /**
   * u8c03u7528u767eu70bcSDK
   */
  private async callBaiLianSDK(result: AudioAnalysisResult) {
    if (!this.baiLianSDK) {
      console.warn('u767eu70bcSDKu672au521du59cbu5316');
      return;
    }
    
    try {
      // u6784u5efau63d0u793au6587u672c
      let prompt = 'u68c0u6d4bu5230u732bu53ebu58f0';
      
      if (result.emotion) {
        prompt += `uff0cu60c5u611fu5206u6790u7ed3u679cu4e3a: ${result.emotion}`;
        if (result.confidence) {
          prompt += `uff0cu7f6eu4fe1u5ea6: ${(result.confidence * 100).toFixed(2)}%`;
        }
      }
      
      // u8c03u7528u767eu70bcSDK
      const response = await this.baiLianSDK.sendTextMessage(prompt);
      
      // u5904u7406u54cdu5e94
      console.log('u767eu70bcSDKu54cdu5e94:', response);
      
      // u56deu8c03u5206u6790u7ed3u679c
      if (this.config.onAnalysisResult && response.output && response.output.text) {
        this.config.onAnalysisResult(response.output.text);
      }
      
    } catch (error) {
      console.error('u8c03u7528u767eu70bcSDKu5931u8d25:', error);
      if (this.config.onError) {
        this.config.onError(error as Error);
      }
    }
  }
  
  /**
   * u505cu6b62u5f55u97f3u548cu68c0u6d4b
   */
  public async stopListening(): Promise<void> {
    if (!this.isListening) {
      return;
    }
    
    try {
      // u6e05u9664u5904u7406u5668u5b9au65f6u5668
      if (this.processingInterval) {
        clearInterval(this.processingInterval);
        this.processingInterval = null;
      }
      
      // u505cu6b62u5f55u97f3
      if (this.recording) {
        await this.recording.stopAndUnloadAsync();
        this.recording = null;
      }
      
      // u91cdu7f6eu5904u7406u5668
      if (this.processor) {
        this.processor.reset();
      }
      
      this.isListening = false;
      this.setState(MeowDetectorState.Idle);
      console.log('u505cu6b62u76d1u542cu732bu53eb');
      
    } catch (error) {
      console.error('u505cu6b62u97f3u9891u6355u6349u5931u8d25:', error);
      if (this.config.onError) {
        this.config.onError(error as Error);
      }
    }
  }
  
  /**
   * u5207u6362u76d1u542cu72b6u6001
   */
  public async toggleListening(): Promise<void> {
    if (this.isListening) {
      await this.stopListening();
    } else {
      await this.startListening();
    }
  }
  
  /**
   * u91cau653eu8d44u6e90
   */
  public async release(): Promise<void> {
    await this.stopListening();
    this.processor = null;
    this.baiLianSDK = null;
  }
}
