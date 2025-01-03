import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform, PermissionsAndroid } from 'react-native';
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

export default function AudioRecorder({ onEmotionDetected, onAudioData, onRecordingState, onLog }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [currentVolume, setCurrentVolume] = useState(0);
  const [emotionResult, setEmotionResult] = useState<EmotionResult | null>(null);
  const [audioRecorderPlayer] = useState(new AudioRecorderPlayer());
  const [recordingPath, setRecordingPath] = useState<string>('');
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  // 将 monitorVolume 移到组件顶层
  const monitorVolume = useCallback((startTime: number) => {
    console.log('monitorVolume 被调用，初始状态:', {
      isRecording,
      hasAnalyser: !!analyser,
      analyserState: analyser ? 'active' : 'null'
    });

    if (analyser && isRecording) {
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      
      const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
      const volume = average / 255;
      
      console.log('音频数据:', {
        frequencyBinCount: analyser.frequencyBinCount,
        average,
        volume,
        dataArrayLength: dataArray.length,
        someValues: dataArray.slice(0, 5)
      });
      
      setCurrentVolume(volume);
      onAudioData?.({
        metering: volume,
        isRecording: true,
        durationMillis: Date.now() - startTime,
        isDoneRecording: false
      });

      requestAnimationFrame(() => monitorVolume(startTime));
    } else {
      console.log('monitorVolume 条件检查失败:', {
        isRecording,
        hasAnalyser: !!analyser,
        analyserState: analyser ? 'active' : 'null'
      });
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
        onRecordingState?.(false);
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
    console.log('停止录音，当前状态:', { isRecording, hasMediaRecorder: !!mediaRecorder });
    
    if (mediaRecorder && isRecording) {
      try {
        // 1. 首先更新状态
        setIsRecording(false);
        
        // 2. 停止所有音频轨道
        mediaRecorder.stream.getTracks().forEach(track => {
          console.log('停止音频轨道:', track.kind);
          track.stop();
        });
        
        // 3. 停止 MediaRecorder
        mediaRecorder.stop();
        
        // 4. 清理音频上下文
        if (audioContext) {
          audioContext.close().then(() => {
            console.log('音频上下文已关闭');
          }).catch(err => {
            console.error('关闭音频上下文失败:', err);
          });
        }
        
        // 5. 重置所有状态
        setAudioContext(null);
        setAnalyser(null);
        setMediaRecorder(null);
        
        console.log('所有音频资源已清理');
      } catch (error) {
        console.error('停止录音时出错:', error);
      }
    }
  };

  // 修改开始录音函数
  const startRecording = async () => {
    if (isWeb) {
      await startWebRecording();
    } else {
      // 原有的移动端录音逻辑
      // ...
    }
  };

  // 修改停止录音函数
  const stopRecording = async () => {
    if (isWeb) {
      stopWebRecording();
    } else {
      // 原有的移动端录音逻辑
      // ...
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
    let isActive = true; // 添加一个标志来控制动画循环
    
    if (isRecording && analyser) {
      const startTime = Date.now();
      const doMonitor = () => {
        if (!isActive) return; // 如果不再活跃，停止循环
        
        monitorVolume(startTime);
        frameId = requestAnimationFrame(doMonitor);
      };
      doMonitor();
    }

    return () => {
      isActive = false; // 标记为非活跃
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [isRecording, analyser]);

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
