import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform, PermissionsAndroid, NativeModules, NativeEventEmitter } from 'react-native';
import { MOCK_CONFIG, MockSDK, mockEventEmitter } from '../config/mock';

// 在文件顶部添加 Web 平台检测
const isWeb = Platform.OS === 'web';

// SDK 配置
const MeowTalkSDKModule = Platform.select({
  web: MOCK_CONFIG.ENABLE_MOCK ? MockSDK : undefined,
  default: NativeModules.MeowTalkSDK,
});

const sdkEvents = isWeb && MOCK_CONFIG.ENABLE_MOCK 
  ? mockEventEmitter 
  : new NativeEventEmitter(MeowTalkSDKModule);

interface AudioRecorderProps {
  onEmotionDetected?: (result: any) => void;
  onAudioData?: (data: any) => void;
  onRecordingState?: (recording: boolean) => void;
  onLog?: (message: string) => void;
}

export default function AudioRecorder({ onEmotionDetected, onAudioData, onRecordingState, onLog }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const timestamp = (new Date()).valueOf();
  const [streamId] = useState(`stream_${timestamp}`);

  // 音量监控
  const monitorVolume = useCallback((startTime: number) => {
    if (!isRecording || !analyser) {
      return;
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
    const volume = average / 255;
    
    // 向上传递音频数据
    onAudioData?.({
      metering: volume,
      isRecording,
      durationMillis: Date.now() - startTime,
      isDoneRecording: false,
      audioData: dataArray // 传递原始音频数据
    });

    if (isRecording) {
      requestAnimationFrame(() => monitorVolume(startTime));
    }
  }, [isRecording, analyser, onAudioData]);

  // Web 平台的录音实现
  const startWebRecording = async () => {
    try {
      const hasPermission = await requestPermission();
      if (!hasPermission) {
        onLog?.('没有录音权限');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      const recorder = new MediaRecorder(stream);
      setMediaRecorder(recorder);

      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyserNode = context.createAnalyser();
      source.connect(analyserNode);
      setAudioContext(context);
      setAnalyser(analyserNode);

      const startTime = Date.now();
      monitorVolume(startTime);
      
      recorder.start();
      setIsRecording(true);
      onRecordingState?.(true);
      onLog?.('开始录音');
    } catch (error: any) {
      console.error('开始录音失败:', error);
      onLog?.(`录音失败: ${error.message}`);
    }
  };

  // 停止 Web 录音
  const stopWebRecording = async () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    if (audioContext) {
      audioContext.close();
    }
    setMediaRecorder(null);
    setAudioContext(null);
    setAnalyser(null);
    setIsRecording(false);
    onRecordingState?.(false);
    onLog?.('停止录音');
  };

  // 请求录音权限
  const requestPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);

        const granted = 
          grants['android.permission.WRITE_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED &&
          grants['android.permission.READ_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED &&
          grants['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED;

        if (!granted) {
          onLog?.('未获得所需权限');
          return false;
        }
        return true;
      } catch (err) {
        console.error('权限请求错误:', err);
        onLog?.(`权限请求错误: ${err}`);
        return false;
      }
    } else if (Platform.OS === 'ios') {
      // iOS 权限请求在 Info.plist 中配置，这里只需要处理 web
      return true;
    } else if (isWeb) {
      try {
        // Web 平台使用 getUserMedia API 请求权限
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // 获取到权限后立即停止流
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch (err) {
        console.error('Web 录音权限请求失败:', err);
        onLog?.(`Web 录音权限请求失败: ${err}`);
        return false;
      }
    }
    return true;
  };

  // 初始化 SDK
  useEffect(() => {
    let isInitialized = false;

    const initSDK = async () => {
      // 防止重复初始化
      if (isInitialized) {
        return;
      }

      try {
        // 在 mock 模式下不初始化 SDK
        if (isWeb && MOCK_CONFIG.ENABLE_MOCK) {
          console.log('Mock 模式，跳过 SDK 初始化');
          isInitialized = true;
          return;
        }

        if (!MeowTalkSDKModule) {
          throw new Error('SDK not available');
        }

        await MeowTalkSDKModule.initializeSDK({ model: 'default' });
        console.log('SDK 初始化成功');
        isInitialized = true;

        const subscription = sdkEvents.addListener(
          'onEmotionDetected',
          (result: any) => {
            onEmotionDetected?.(result);
          }
        );

        return () => {
          subscription.remove();
          isInitialized = false;
        };
      } catch (err: any) {
        console.error('SDK 初始化失败:', err);
        onLog?.(`SDK 初始化失败: ${err.message}`);
      }
    };

    initSDK();
  }, []); // 移除依赖项，只在组件挂载时初始化一次

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={[styles.recordButton, isRecording && styles.recording]} 
        onPressIn={startWebRecording}
        onPressOut={stopWebRecording}
      >
        <Text style={styles.buttonText}>
          {isRecording ? '松开结束' : '按住说话'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  recording: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
