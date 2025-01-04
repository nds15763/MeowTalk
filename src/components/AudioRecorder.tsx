import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform, PermissionsAndroid, NativeModules, NativeEventEmitter } from 'react-native';
import AudioRecorderPlayer, {
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
  AudioSourceAndroidType,
  OutputFormatAndroidType,
  AudioEncoderAndroidType,
  AudioSet
} from 'react-native-audio-recorder-player';

// 音频配置
const AUDIO_CONFIG: AudioSet = Platform.select({
  ios: {
    AVSampleRateKeyIOS: 44100,
    AVNumberOfChannelsKeyIOS: 1,
    AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
    AVEncoderBitRateKeyIOS: 128000,
    AVFormatIDKeyIOS: AVEncodingOption.aac
  },
  android: {
    AudioSourceAndroid: AudioSourceAndroidType.MIC,
    OutputFormatAndroid: OutputFormatAndroidType.MPEG_4,
    AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
    AudioEncodingBitRateAndroid: 128000,
    AudioSamplingRateAndroid: 44100,
    AudioChannelsAndroid: 1
  }
}) || {};

interface EmotionResult {
  emotion: string;
  confidence: number;
  features: any;
}

interface AudioRecorderProps {
  onEmotionDetected?: (result: EmotionResult) => void;
  onAudioData?: (data: any) => void;
  onRecordingState?: (recording: boolean) => void;
  onLog?: (message: string) => void;
}

// 在文件顶部添加 Web 平台检测
const isWeb = Platform.OS === 'web';

// 在文件顶部添加 SDK 引入
const { MeowTalkSDK } = NativeModules;
const sdkEvents = new NativeEventEmitter(MeowTalkSDK);

export default function AudioRecorder({ onEmotionDetected, onAudioData, onRecordingState, onLog }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [currentVolume, setCurrentVolume] = useState(0);
  const [emotionResult, setEmotionResult] = useState<EmotionResult | null>(null);
  const [audioRecorderPlayer] = useState(new AudioRecorderPlayer());
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const timestamp = (new Date()).valueOf();
  const [streamId] = useState(`stream_${timestamp}`);

  // 将 monitorVolume 移到组件顶层
  const monitorVolume = useCallback((startTime: number) => {
    if (!isRecording || !analyser) {
      console.log('停止音量监控:', { isRecording, hasAnalyser: !!analyser });
      return;
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
    const volume = average / 255;
    
    setCurrentVolume(volume);
    onAudioData?.({
      metering: volume,
      isRecording,
      durationMillis: Date.now() - startTime,
      isDoneRecording: false
    });

    if (isRecording) {
      requestAnimationFrame(() => monitorVolume(startTime));
    }
  }, [isRecording, analyser, onAudioData]);

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
          console.error('未获得所需权限');
          return false;
        }
        return true;
      } catch (err) {
        console.error('权限请求错误:', err);
        return false;
      }
    }
    return true;
  };

  // Web 平台的录音实现
  const startWebRecording = async () => {
    try {
      // 检查 API 是否可用
      console.log('检查 mediaDevices API:', {
        hasMediaDevices: !!navigator.mediaDevices,
        hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia
      });

      // 尝试获取媒体流
      console.log('正在请求音频权限...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      console.log('获取到音频流:', stream);
      const recorder = new MediaRecorder(stream);
      setMediaRecorder(recorder);
      setAudioChunks([]);

      // 创建音频分析器
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyserNode = context.createAnalyser();
      source.connect(analyserNode);
      setAudioContext(context);
      setAnalyser(analyserNode);

      
      // 开始音量监测
      const startTime = Date.now();
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setAudioChunks(chunks => [...chunks, event.data]);
        }
      };

      recorder.onstart = () => {
        console.log('录音开始事件触发');
        setIsRecording(true);
        onRecordingState?.(true);
        onLog?.('Web 录音开始');
      };

      recorder.onstop = () => {
        console.log('录音停止事件触发');
        onLog?.('Web 录音停止');
        
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        onAudioData?.({
          url: audioUrl,
          blob: audioBlob,
          isRecording: false,
          isDoneRecording: true,
          durationMillis: Date.now() - startTime
        });

        // 清理音频上下文
        if (audioContext) {
          audioContext.close();
          setAudioContext(null);
          setAnalyser(null);
        }
      };

      recorder.start(100); // 每100ms触发一次ondataavailable
    } catch (error: any) {
      console.error('Web 录音失败:', error);
      onLog?.(`Web 录音失败: ${error.message}`);
    }
  };

  const stopWebRecording = () => {
    if (mediaRecorder && isRecording) {
      try {
        // 1. 先停止所有音轨
        const tracks = mediaRecorder.stream.getTracks();
        tracks.forEach(track => {
          track.stop();
          console.log(`音轨 ${track.kind} 已停止`);
        });

        // 2. 停止 MediaRecorder
        mediaRecorder.stop();
        
        // 3. 清理音频上下文
        if (audioContext) {
          audioContext.close().then(() => {
            console.log('音频上下文已关闭');
          });
        }

        // 4. 重置所有状态
        setAudioContext(null);
        setAnalyser(null);
        setMediaRecorder(null);
        setIsRecording(false); // 确保在这里更新录音状态
        onRecordingState?.(false); // 通知父组件录音已停止
        
        console.log('所有音频资源已清理');
      } catch (error) {
        console.error('停止录音时出错:', error);
        // 即使出错也要确保状态被重置
        setIsRecording(false);
        onRecordingState?.(false);
      }
    }
  };

  // 修改开始录音函数
  const startRecording = async () => {
    if (isWeb) {
      await startWebRecording();
    } else {
      try {
        await MeowTalkSDK.startAudioStream(streamId);
        // 保留原有录音逻辑...
      } catch (err: any) {
        onLog?.(`Failed to start audio stream: ${err.message}`);
        console.error('Failed to start audio stream:', err);
      }
    }
  };

  // 修改停止录音函数
  const stopRecording = async () => {
    if (isWeb) {
      stopWebRecording();
    } else {
      try {
        await MeowTalkSDK.stopAudioStream(streamId);
        // 保留原有停止录音逻辑...
      } catch (err: any) {
        onLog?.(`Failed to stop audio stream: ${err.message}`);
        console.error('Failed to stop audio stream:', err);
      }
    }
  };

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (isRecording) {
        audioRecorderPlayer.stopRecorder();
        audioRecorderPlayer.removeRecordBackListener();
      }
    };
  }, [isRecording, audioRecorderPlayer]);

  // 在组件顶层添加新的 useEffect
  useEffect(() => {
    let frameId: number;

    if (isRecording && analyser) {
      const startTime = Date.now();
      console.log('开始音频监控:', { isRecording, hasAnalyser: !!analyser });
      
      const doMonitor = () => {
        if (!isRecording) {
          console.log('停止音频监控');
          return;
        }
        monitorVolume(startTime);
        frameId = requestAnimationFrame(doMonitor);
      };
      
      doMonitor();
    }

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [isRecording, analyser, monitorVolume]);

  // 在 useEffect 中初始化 SDK
  useEffect(() => {
    // 初始化 SDK
    MeowTalkSDK.initializeSDK({ model: 'default' })
      .then(() => {
        onLog?.('SDK initialized');
        
        // 注册结果回调
        const subscription = sdkEvents.addListener('onResult', (result) => {
          onLog?.(`收到分析结果: ${JSON.stringify(result)}`);
          if(result.emotion) {
            onEmotionDetected?.({
              emotion: result.emotion,
              confidence: result.confidence,
              features: result.metadata
            });
          }
        });

        return () => {
          subscription.remove();
          MeowTalkSDK.releaseSDK();
        };
      })
      .catch((err: any) => {
        onLog?.(`SDK init failed: ${err.message}`);
        console.error('SDK init failed:', err);
      });
  }, []);

  return (
    <View style={styles.container}>
      {/* 录音控制区域 */}
      <View style={styles.recordingSection}>
        <TouchableOpacity
          onPressIn={startRecording}
          onPressOut={stopRecording}
          style={[styles.recordButton, isRecording && styles.recording]}
        >
          <Text style={styles.recordButtonText}>
            {isRecording ? '松开结束' : '按住说话'}
          </Text>
        </TouchableOpacity>
        {isRecording && (
          <View style={styles.recordingIndicator}>
            <Text>正在录音...</Text>
            <View style={[styles.volumeBar, { width: `${Math.min(100, currentVolume * 100)}%` }]} />
          </View>
        )}
      </View>

      {/* 情感识别结果 */}
      {emotionResult && (
        <View style={styles.resultSection}>
          <Text style={styles.emotionText}>{emotionResult.emotion}</Text>
          <Text style={styles.confidenceText}>
            置信度: {(emotionResult.confidence * 100).toFixed(1)}%
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: 10,
  },
  recordingSection: {
    padding: 20,
    alignItems: 'center',
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  recording: {
    backgroundColor: '#ff4081',
  },
  recordButtonText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  recordingIndicator: {
    marginTop: 10,
    alignItems: 'center',
    width: '100%',
  },
  volumeBar: {
    height: 4,
    backgroundColor: '#ff4081',
    borderRadius: 2,
    marginTop: 5,
  },
  resultSection: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    margin: 10,
  },
  emotionText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  confidenceText: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  }
});
