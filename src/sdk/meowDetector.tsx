import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Audio } from 'expo-av';
import { AliBaiLianSDK } from './aliBaiLianSDK';
import { AudioProcessor } from './audioProcessor';
import { AudioFeatures, AudioAnalysisResult } from './audioTypes';

/**
 * 猫叫检测状态
 */
export enum MeowDetectorState {
  Idle = 'idle',
  Recording = 'recording',
  Processing = 'processing',
  Detected = 'detected'
}

// 导出猫叫检测器引用类型
export interface MeowDetectorRef {
  startListening: () => Promise<void>;
  stopListening: () => void;
  isListening: boolean;
  detectorState: MeowDetectorState;
}

interface MeowDetectorProps {
  // 检测到猫叫时的回调，返回是否是猫叫和音频特征
  onMeowDetected?: (isMeow: boolean, features?: AudioFeatures) => void;
  baiLianConfig?: {
    appId: string;
    apiKey: string;
  };
  // 是否显示UI组件
  showUI?: boolean;
}

/**
 * 猫叫检测组件
 */
const MeowDetector = forwardRef<MeowDetectorRef, MeowDetectorProps>(({ 
  onMeowDetected,
  baiLianConfig,
  showUI = false
}, ref) => {
  // 状态
  const [detectorState, setDetectorState] = useState<MeowDetectorState>(MeowDetectorState.Idle);
  const [isListening, setIsListening] = useState(false);
  
  // Refs
  const recordingRef = useRef<Audio.Recording | null>(null);
  const processorRef = useRef<AudioProcessor | null>(null);
  const baiLianSDKRef = useRef<AliBaiLianSDK | null>(null);
  const audioProcessingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // 向父组件暴露方法
  useImperativeHandle(ref, () => ({
    startListening,
    stopListening,
    isListening,
    detectorState
  }), [isListening, detectorState]);
  
  // 初始化百炼SDK和音频处理器
  useEffect(() => {
    // 初始化百炼SDK
    if (baiLianConfig && baiLianConfig.appId && baiLianConfig.apiKey) {
      baiLianSDKRef.current = new AliBaiLianSDK({
        appId: baiLianConfig.appId,
        apiKey: baiLianConfig.apiKey
      });
    }
    
    // 初始化音频处理器
    processorRef.current = new AudioProcessor({
      sampleRate: 44100 // 默认采样率
    });
    
    return () => {
      // 清理
      stopListening();
    };
  }, [baiLianConfig]);
  
  // 开始监听音频
  const startListening = async () => {
    try {
      // 请求麦克风权限
      const permissionResponse = await Audio.requestPermissionsAsync();
      if (permissionResponse.status !== 'granted') {
        console.error('未获取到麦克风权限');
        return;
      }
      
      // 设置音频模式
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: 1, // 相当于旧版的 INTERRUPTION_MODE_IOS_DUCK_OTHERS
        shouldDuckAndroid: true,
        interruptionModeAndroid: 1, // 相当于旧版的 INTERRUPTION_MODE_ANDROID_DUCK_OTHERS
        playThroughEarpieceAndroid: false,
      });
      
      // 创建录音实例
      const recording = new Audio.Recording();
      
      // 使用自定义录音选项，支持所有平台
      await recording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.MAX,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });
      
      // 监听录音状态更新
      recording.setOnRecordingStatusUpdate(onRecordingStatusUpdate);
      recordingRef.current = recording;
      
      // 开始录音
      await recording.startAsync();
      setIsListening(true);
      setDetectorState(MeowDetectorState.Recording);
      
      // 设置音频处理间隔
      audioProcessingIntervalRef.current = setInterval(() => {
        processAudioBuffer();
      }, 500); // 每500ms处理一次
      
      console.log('开始监听猫叫声...');
      
    } catch (error) {
      console.error('获取麦克风权限失败:', error);
    }
  };
  
  // 录音状态更新回调
  const onRecordingStatusUpdate = (status: Audio.RecordingStatus) => {
    if (!status.isRecording) return;
    
    try {
      // 模拟音频数据
      simulateAudioData();
    } catch (error) {
      console.error('处理音频数据错误:', error);
    }
  };
  
  // 模拟音频数据生成
  const simulateAudioData = () => {
    if (!processorRef.current) return;
    
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
        data[i] = Math.sin(2 * Math.PI * freq * i / 44100) * 0.5;
      }
    }
    
    // 添加到处理器
    processorRef.current.addAudioData(data);
  };
  
  // 处理音频缓冲区
  const processAudioBuffer = () => {
    if (!processorRef.current || !isListening) {
      return;
    }
    
    // 检查是否需要处理音频
    if (processorRef.current.shouldProcessAudio()) {
      setDetectorState(MeowDetectorState.Processing);
      
      // 处理音频
      const result = processorRef.current.processAudio();
      
      // 调用回调，返回是否是猫叫和音频特征
      if (onMeowDetected) {
        onMeowDetected(result.isMeow, result.features);
      }
      
      // 如果检测到猫叫
      if (result.isMeow) {
        setDetectorState(MeowDetectorState.Detected);
        console.log('检测到猫叫声:', result);
      } else {
        setDetectorState(MeowDetectorState.Recording);
      }
    }
  };
  
  // 停止监听音频
  const stopListening = () => {
    // 清除处理间隔
    if (audioProcessingIntervalRef.current) {
      clearInterval(audioProcessingIntervalRef.current);
      audioProcessingIntervalRef.current = null;
    }
    
    // 停止录音
    const stopRecording = async () => {
      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch (error) {
          console.error('停止录音失败:', error);
        }
        recordingRef.current = null;
      }
    };
    
    stopRecording();
    
    // 重置音频处理器
    if (processorRef.current) {
      processorRef.current.reset();
    }
    
    setIsListening(false);
    setDetectorState(MeowDetectorState.Idle);
  };
  
  // 切换监听状态
  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };
  
  return (
    showUI ? (
      <View style={styles.container}>
        <TouchableOpacity 
          style={[styles.button, isListening ? styles.stopButton : styles.startButton]} 
          onPress={toggleListening}
        >
          <Text style={styles.buttonText}>
            {isListening ? '停止监听' : '开始监听'}
          </Text>
        </TouchableOpacity>
        
        <Text style={styles.statusText}>
          {detectorState === MeowDetectorState.Idle && '未启动'}
          {detectorState === MeowDetectorState.Recording && '正在监听...'}
          {detectorState === MeowDetectorState.Processing && '处理中...'}
          {detectorState === MeowDetectorState.Detected && '检测到猫叫！'}
        </Text>
      </View>
    ) : null
  );
});

// 样式
const styles = StyleSheet.create({
  container: {
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    margin: 8,
    alignItems: 'center',
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  startButton: {
    backgroundColor: '#1677ff',
  },
  stopButton: {
    backgroundColor: '#ff4d4f',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '500',
  },
  statusText: {
    marginTop: 8,
    fontSize: 14,
  }
});

export default MeowDetector;
