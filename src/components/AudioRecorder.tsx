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
  const startTimeRef = useRef<number>(0);

  // Web平台的录音实现
  const startWebRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      // 先通知父组件开始录音
      await onRecordingStart?.();
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      startTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = async (e) => {
        const audioBlob = new Blob([e.data], { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        onAudioData?.({
          audioData: Array.from(uint8Array)
        });
      };

      mediaRecorder.start(100); // 每100ms触发一次数据
    } catch (error) {
      onLog?.(`启动录音失败: ${error}`);
    }
  };

  const stopWebRecording = () => {
    try {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      onRecordingStop?.();
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

      // 先通知父组件开始录音
      await onRecordingStart?.();

      await audioRecorderRef.current.startRecorder();
      audioRecorderRef.current.addRecordBackListener((data) => {
        onAudioData?.({
          audioData: data.currentMetering ? [data.currentMetering] : []
        });
      });
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
