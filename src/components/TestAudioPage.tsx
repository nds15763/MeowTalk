import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import AudioRecorder from './AudioRecorder';

const TestAudioPage: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioData, setAudioData] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // 添加日志
  const addLog = (message: string) => {
    setLogs(prev => [`[${new Date().toISOString()}] ${message}`, ...prev]);
  };

  // 处理录音数据
  const handleAudioData = (data: any) => {
    console.log('收到音频数据:', data);
    setAudioData(data);
    addLog(`音频状态: ${JSON.stringify({
      音量: data.metering?.toFixed(2) || 0,
      时长: data.durationMillis + 'ms',
      录制中: data.isRecording,
      已完成: data.isDoneRecording
    }, null, 2)}`);
  };

  // 处理录音状态变化
  const handleRecordingStateChange = (recording: boolean) => {
    console.log('录音状态变化:', recording);
    setIsRecording(recording);
    addLog(`录音状态: ${recording ? '开始' : '停止'}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>音频测试页面</Text>
      </View>

      <View style={styles.content}>
        <AudioRecorder
          onAudioData={handleAudioData}
          onRecordingState={handleRecordingStateChange}
        />

        <View style={styles.dataDisplay}>
          <Text style={styles.subtitle}>音频数据信息:</Text>
          {audioData && (
            <Text>
              音量: {audioData.metering?.toFixed(2) || 0}{'\n'}
              录音时长: {audioData.durationMillis}ms{'\n'}
              录制状态: {audioData.isRecording ? '录制中' : '已停止'}{'\n'}
              完成状态: {audioData.isDoneRecording ? '已完成' : '未完成'}
            </Text>
          )}
        </View>

        <View style={styles.logContainer}>
          <Text style={styles.subtitle}>调试日志:</Text>
          {logs.map((log, index) => (
            <Text key={index} style={styles.logText}>
              {log}
            </Text>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  dataDisplay: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  logContainer: {
    marginTop: 20,
    flex: 1,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  logText: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
});

export default TestAudioPage;
