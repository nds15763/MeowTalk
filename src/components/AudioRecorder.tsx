import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import { Audio } from 'expo-av';

// 音频配置
const AUDIO_CONFIG = {
  sampleRate: 44100,
  channels: 1,
  bitsPerSample: 16,
  bufferSize: 4096
};

interface EmotionResult {
  emotion: string;
  confidence: number;
  features: any;
}

interface AudioRecorderProps {
  onEmotionDetected?: (result: EmotionResult) => void;
}

export default function AudioRecorder({ onEmotionDetected }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [currentVolume, setCurrentVolume] = useState(0);
  const [emotionResult, setEmotionResult] = useState<EmotionResult | null>(null);

  // 开始录音
  const startRecording = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync({
        android: {
          ...AUDIO_CONFIG,
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
        },
        ios: {
          ...AUDIO_CONFIG,
          extension: '.wav',
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          numberOfChannels: AUDIO_CONFIG.channels,
          bitRate: 16 * 44100,
        },
        web: {
          ...AUDIO_CONFIG,
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });

      newRecording.setOnRecordingStatusUpdate(status => {
        if (status.isRecording) {
          setCurrentVolume(status.metering || 0);
          // TODO: 处理音频数据
          // processAudioData(status.metering || 0);
        }
      });

      await newRecording.startAsync();
      setRecording(newRecording);
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording', error);
    }
  };

  // 停止录音
  const stopRecording = async () => {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setIsRecording(false);

      // TODO: 发送录音文件到 Native Bridge 处理
      // const result = await MeowTalkBridge.processAudioFile(uri);
      // if (result && onEmotionDetected) {
      //   setEmotionResult(result);
      //   onEmotionDetected(result);
      // }
    } catch (error) {
      console.error('Failed to stop recording', error);
    }
  };

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
