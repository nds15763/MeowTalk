import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform, PermissionsAndroid } from 'react-native';
import { MOCK_CONFIG } from '../config/mock';
import AudioRecorderPlayer, {
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
  AudioSourceAndroidType,
  OutputFormatAndroidType,
  AudioEncoderAndroidType,
  AudioSet
} from 'react-native-audio-recorder-player';

// 在文件顶部添加 Web 平台检测
const isWeb = Platform.OS === 'web';

// SDK 模块类型定义
interface MeowTalkSDKType {
  initializeSDK: (config: { model: string }) => Promise<void>;
}

// SDK 模块声明
declare const MeowTalkSDKModule: MeowTalkSDKType;

// SDK 事件类型定义
interface SDKEvents {
  addListener: (event: string, callback: (result: any) => void) => { remove: () => void };
}

// SDK 事件模块声明
declare const sdkEvents: SDKEvents;

interface AudioRecorderProps {
  onEmotionDetected?: (result: any) => void;
  onAudioData?: (data: any) => void;
  onRecordingState?: (recording: boolean) => void;
  onLog?: (message: string) => void;
}

export default function AudioRecorder({ onEmotionDetected, onAudioData, onRecordingState, onLog }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [recordTime, setRecordTime] = useState('00:00:00');
  const timestamp = (new Date()).valueOf();
  const [streamId] = useState(`stream_${timestamp}`);
  const audioRecorderPlayer = new AudioRecorderPlayer();

  // 音频配置
  const audioSet: AudioSet = {
    AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
    AudioSourceAndroid: AudioSourceAndroidType.MIC,
    OutputFormatAndroid: OutputFormatAndroidType.AAC_ADTS,
    AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
    AVNumberOfChannelsKeyIOS: 2,
    AVFormatIDKeyIOS: AVEncodingOption.aac,
  };

  // 初始化SDK
  useEffect(() => {
    if (!isWeb) return;

    // 初始化SDK
    const initSDK = async () => {
      try {
        // 处理CORS预检请求
        const preflightResponse = await fetch(`${MOCK_CONFIG.SERVER.URL}/init`, {
          method: 'OPTIONS',
          headers: {
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'content-type,accept',
          },
        });

        // 调用SDK的初始化接口
        const response = await fetch(`${MOCK_CONFIG.SERVER.URL}/init`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            streamId,
            sampleRate: 44100,  // 采样率
            channels: 1,        // 单声道
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`SDK初始化失败: ${errorText}`);
        }

        const result = await response.json();
        onLog?.('SDK初始化成功');
        onLog?.(`初始化结果: ${JSON.stringify(result)}`);
      } catch (error) {
        onLog?.(`SDK初始化失败: ${error}`);
      }
    };

    initSDK();
  }, [isWeb, streamId, onLog]);

  // Web 平台的录音实现
  const startWebRecording = async () => {
    try {
      const hasPermission = await requestPermission();
      if (!hasPermission) {
        onLog?.('没有录音权限');
        return;
      }

      // 调用 start 接口
      const startResponse = await fetch(`${MOCK_CONFIG.SERVER.URL}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          streamId,
        }),
      });

      if (!startResponse.ok) {
        const errorText = await startResponse.text();
        throw new Error(`开始录音失败: ${errorText}`);
      }

      onLog?.('开始录音会话成功');

      // 开始录音
      const uri = await audioRecorderPlayer.startRecorder(undefined, audioSet);
      audioRecorderPlayer.addRecordBackListener((e) => {
        setRecordSecs(e.currentPosition);
        setRecordTime(audioRecorderPlayer.mmssss(Math.floor(e.currentPosition)));
        
        // 发送音频数据
        const audioDataPacket = {
          metering: e.currentMetering || 0,
          durationMillis: e.currentPosition,
          audioData: e.currentMetering ? [e.currentMetering] : []
        };

        fetch(`${MOCK_CONFIG.SERVER.URL}/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            streamId,
            data: e.currentMetering ? [e.currentMetering] : [],
          }),
        }).catch(error => {
          onLog?.(`发送音频数据失败: ${error}`);
        });

        onAudioData?.(audioDataPacket);
      });

      setIsRecording(true);
      onRecordingState?.(true);
      onLog?.('开始录音');
    } catch (error: any) {
      console.error('开始录音失败:', error);
      onLog?.(`开始录音失败: ${error.message}`);
    }
  };

  // 停止 Web 录音
  const stopWebRecording = async () => {
    try {
      if (audioRecorderPlayer) {
        const result = await audioRecorderPlayer.stopRecorder();
        audioRecorderPlayer.removeRecordBackListener();
        onLog?.('录音已停止');
      }

      // 调用 stop 接口
      const stopResponse = await fetch(`${MOCK_CONFIG.SERVER.URL}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          streamId,
        }),
      });

      if (!stopResponse.ok) {
        const errorText = await stopResponse.text();
        throw new Error(`停止录音失败: ${errorText}`);
      }

      onLog?.('停止录音会话成功');
    } catch (error: any) {
      console.error('停止录音失败:', error);
      onLog?.(`停止录音失败: ${error.message}`);
    }

    setIsRecording(false);
    onRecordingState?.(false);
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
