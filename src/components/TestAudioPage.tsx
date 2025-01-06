import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import AudioRecorder from './AudioRecorder';
import { MOCK_CONFIG } from '../config/mock';

const isWeb = Platform.OS === 'web';

export default function TestAudioPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [audioData, setAudioData] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [emotion, setEmotion] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(0);
  const lastLogTime = useRef<number | null>(null);
  const streamIdRef = useRef<string>(`stream_${Date.now()}`);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleAudioData = async (data: any) => {
    setAudioData(data);
    
    // 只在音量变化显著时才记录日志
    if (data.metering !== undefined) {
      const now = Date.now();
      if (!lastLogTime.current || now - lastLogTime.current >= 500) {
        addLog(`音频状态: 音量=${(data.metering || 0).toFixed(2)}, 时长=${data.durationMillis}ms`);
        lastLogTime.current = now;
      }
    }

    if (isWeb && MOCK_CONFIG.ENABLE_MOCK && isRecording) {
      try {
        // 发送音频数据到mock服务器
        const response = await fetch(`${MOCK_CONFIG.SERVER.URL}/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            streamId: streamIdRef.current,
            data: Array.from(new Float32Array(data.audioData || [])),
          }),
        });
        
        if (!response.ok) {
          throw new Error(`发送音频失败: ${response.status}`);
        }
        
        // 获取处理结果
        const resultResponse = await fetch(`${MOCK_CONFIG.SERVER.URL}/recv?streamId=${streamIdRef.current}`);
        if (!resultResponse.ok) {
          throw new Error(`接收结果失败: ${resultResponse.status}`);
        }
        
        const result = await resultResponse.json();
        if (result.emotion) {
          setEmotion(result.emotion);
          setConfidence(result.confidence);
          addLog(`检测到情绪: ${result.emotion} (置信度: ${result.confidence})`);
        }
      } catch (err: any) {
        console.warn('Mock处理警告:', err);
        addLog(`Mock处理警告: ${err.message}`);
      }
    }
  };

  const handleEmotionDetected = (result: any) => {
    setEmotion(result.emotion);
    setConfidence(result.confidence);
    addLog(`检测到情绪: ${result.emotion} (置信度: ${result.confidence})`);
  };

  const handleRecordingState = (recording: boolean) => {
    setIsRecording(recording);
    addLog(recording ? '开始录音' : '停止录音');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AudioRecorder
          onEmotionDetected={handleEmotionDetected}
          onAudioData={handleAudioData}
          onRecordingState={handleRecordingState}
          onLog={addLog}
        />
      </View>
      
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>录音状态: {isRecording ? '录音中' : '已停止'}</Text>
        <Text style={styles.infoText}>当前音量: {audioData?.metering?.toFixed(2) || 0}</Text>
        <Text style={styles.infoText}>情绪: {emotion || '未检测'}</Text>
        <Text style={styles.infoText}>置信度: {(confidence * 100).toFixed(1)}%</Text>
      </View>

      <ScrollView style={styles.logContainer}>
        {logs.map((log, index) => (
          <Text key={index} style={styles.logText}>{log}</Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  header: {
    marginBottom: 20,
  },
  infoContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 16,
    marginBottom: 8,
  },
  logContainer: {
    flex: 1,
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 10,
  },
  logText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
});
