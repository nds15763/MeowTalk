import React, { useRef, useCallback } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import RNAudioRecorderPlayer from 'react-native-audio-recorder-player';

interface Props {
  onAudioData?: (data: any) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  onLog?: (message: string) => void;
}

const isWeb = Platform.OS === 'web';

export default function AudioRecorder({ onAudioData, onRecordingStart, onRecordingStop, onLog }: Props) {
  const audioRecorderRef = useRef<RNAudioRecorderPlayer>();
  const mediaRecorderRef = useRef<MediaRecorder>();
  const mediaStreamRef = useRef<MediaStream>();
  const audioContextRef = useRef<AudioContext>();
  const audioAnalyserRef = useRef<AnalyserNode>();
  const dataArrayRef = useRef<Uint8Array>();
  const animationFrameRef = useRef<number>();
  const startTimeRef = useRef<number>(0);

  // Web平台的录音实现
  const startWebRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      // 先通知父组件开始录音，等待完成
      await onRecordingStart?.();
      
      // 在300ms后再开始采集音频数据，确保状态已更新
      setTimeout(() => {
        // 创建AudioContext和分析器
        if (isWeb) {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioContextRef.current = audioContext;
          
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 2048;
          audioAnalyserRef.current = analyser;
          
          const source = audioContext.createMediaStreamSource(stream);
          source.connect(analyser);
          
          const bufferLength = analyser.frequencyBinCount;
          dataArrayRef.current = new Uint8Array(bufferLength);
          
          // 开始周期性获取音频数据
          const getAudioData = () => {
            if (!audioAnalyserRef.current || !dataArrayRef.current) return;
            
            // 获取音频频域数据
            audioAnalyserRef.current.getByteFrequencyData(dataArrayRef.current);
            
            // 将数据简化为数值，确保发送的是数字而不是Uint8Array
            const reducedData = Array.from(dataArrayRef.current)
              .filter((_, index) => index % 10 === 0)
              .map(val => Number(val)); // 确保是数字类型
            
            // 只有当存在有效数据时才发送
            if (reducedData.some(val => val > 0)) {
              console.log("AnalyserNode 捕获到音频数据:", reducedData.length, "个数据点", 
                        "样本:", reducedData.slice(0, 5));
              onLog?.(`捕获到音频数据: ${reducedData.length} 个采样点`);
              onAudioData?.({
                audioData: reducedData
              });
            } else {
              console.log("AnalyserNode 捕获数据但音量过低 (全为0)");
            }
            
            // 继续下一帧
            animationFrameRef.current = requestAnimationFrame(getAudioData);
          };
          
          // 开始获取数据
          animationFrameRef.current = requestAnimationFrame(getAudioData);
        }

        // 同时使用MediaRecorder作为备份
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        startTimeRef.current = Date.now();

        mediaRecorder.ondataavailable = async (e) => {
          // MediaRecorder数据主要用于录音保存，不作为实时显示
          const audioBlob = new Blob([e.data], { type: 'audio/webm' });
          console.log(`MediaRecorder 捕获到数据块: ${Math.round(audioBlob.size / 1024)}KB, 时间: ${(Date.now() - startTimeRef.current)/1000}秒`);
          onLog?.(`MediaRecorder捕获到数据块: ${Math.round(audioBlob.size / 1024)}KB`);

          try {
            const arrayBuffer = await audioBlob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            // 转换为数字数组，每100个采样点取一个，避免数据量太大
            const audioData = Array.from(uint8Array)
              .filter((_, index) => index % 100 === 0)
              .map(val => Number(val));
            
            if (audioData.length > 0) {
              console.log("MediaRecorder 处理后数据:", audioData.length, "个数据点", 
                         "样本:", audioData.slice(0, 5));
              onAudioData?.({
                audioData: audioData
              });
            } else {
              console.log("MediaRecorder 处理后没有有效数据");
            }
          } catch (error) {
            onLog?.(`处理MediaRecorder数据失败: ${error}`);
          }
        };

        mediaRecorder.start(1000); // 每1秒触发一次数据
        onLog?.('开始捕获音频数据...');
      }, 300);
    } catch (error) {
      onLog?.(`启动录音失败: ${error}`);
    }
  };

  const stopWebRecording = () => {
    try {
      // 停止动画帧
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
      
      // 关闭音频上下文
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = undefined;
      }
      
      // 停止MediaRecorder
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      
      // 停止媒体流
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      onRecordingStop?.();
      onLog?.('停止捕获音频数据');
    } catch (error) {
      onLog?.(`停止录音失败: ${error}`);
    }
  };

  // 原生平台的录音实现
  const startNativeRecording = async () => {
    try {
      if (!audioRecorderRef.current) {
        audioRecorderRef.current = new RNAudioRecorderPlayer();
      }

      // 先通知父组件开始录音，等待完成
      await onRecordingStart?.();

      // 在100ms后再开始录音，确保状态已更新
      setTimeout(async () => {
        // 再次检查 audioRecorderRef.current 是否存在
        if (!audioRecorderRef.current) {
          onLog?.('录音器初始化失败');
          return;
        }
        
        await audioRecorderRef.current.startRecorder();
        audioRecorderRef.current.addRecordBackListener((data) => {
          // 将音频数据发送给父组件
          const audioData = data.currentPosition ? [data.currentPosition] : [];
          if (data.currentMetering) {
            audioData.push(data.currentMetering);
          }
          
          onAudioData?.({
            audioData: audioData
          });
        });
        
        onLog?.('开始捕获音频数据...');
      }, 100);
    } catch (error) {
      onLog?.(`启动录音失败: ${error}`);
    }
  };

  const stopNativeRecording = async () => {
    try {
      if (audioRecorderRef.current) {
        await audioRecorderRef.current.stopRecorder();
        audioRecorderRef.current.removeRecordBackListener();
      }
      onRecordingStop?.();
      onLog?.('停止捕获音频数据');
    } catch (error) {
      onLog?.(`停止录音失败: ${error}`);
    }
  };

  const handlePressIn = useCallback(() => {
    if (isWeb) {
      startWebRecording();
    } else {
      startNativeRecording();
    }
  }, []);

  const handlePressOut = useCallback(() => {
    if (isWeb) {
      stopWebRecording();
    } else {
      stopNativeRecording();
    }
  }, []);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Text style={styles.buttonText}>按住说话</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
