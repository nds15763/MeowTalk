import { useState, useEffect, useCallback } from 'react';
import { useMeowDetector } from './useMeowDetector';
import { Emotion } from '../../types/emotion';
import { PermissionsAndroid, Platform } from 'react-native';
import AudioRecorder from '../AudioRecorder.web';

export function useEmotionRecorder(onEmotionDetected: (emotion: Emotion) => void) {
  const [isListening, setIsListening] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const { detectEmotion, isInitialized } = useMeowDetector();

  // 请求录音权限
  const requestPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: "需要录音权限",
          message: "需要录音权限来识别猫咪的声音",
          buttonNeutral: "稍后询问",
          buttonNegative: "取消",
          buttonPositive: "确定"
        }
      );
      setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } else {
      // iOS的权限请求
      const permitted = await global.AudioRecorder.requestPermission();
      setHasPermission(permitted);
      return permitted;
    }
  };

  // 开始监听
  const startListening = useCallback(async () => {
    if (!isInitialized || !hasPermission) return;
    
    try {
      await AudioRecorder.start({
        sampleRate: 44100,
        onData: async (buffer: Float32Array) => {
          // 尝试检测情感
          const emotion = await detectEmotion(buffer);
          if (emotion) {
            onEmotionDetected(emotion);
          }
        }
      });
      setIsListening(true);
    } catch (error) {
      console.error('Failed to start listening:', error);
    }
  }, [isInitialized, hasPermission, onEmotionDetected]);

  // 停止监听
  const stopListening = useCallback(async () => {
    try {
      await AudioRecorder.stop();
      setIsListening(false);
    } catch (error) {
      console.error('Failed to stop listening:', error);
    }
  }, []);

  // 组件挂载时请求权限并开始监听
  useEffect(() => {
    const init = async () => {
      const permitted = await requestPermission();
      if (permitted) {
        await startListening();
      }
    };
    
    init();

    // 组件卸载时停止监听
    return () => {
      stopListening();
    };
  }, []);

  return {
    isListening,
    hasPermission,
    startListening,
    stopListening,
  };
} 