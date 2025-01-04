import React, { useState, useEffect, useRef } from 'react';
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
  const lastLogTime = useRef<number>(0);

  // 添加日志
  const addLog = (message: string) => {
    if (!isRecording) return;
    // 限制日志数量，只保留最近的 50 条
    setLogs(prev => {
      const newLogs = [`[${new Date().toISOString()}] ${message}`, ...prev];
      return newLogs.slice(0, 50); // 只保留最近的 50 条日志
    });
  };

  // 处理录音数据
  const handleAudioData = (data: any) => {
    // 先判断录音状态，如果不在录音就直接返回
    if (!isRecording) return;

    setAudioData(data);
    // 只在音量变化显著时才记录日志
    if (data.metering !== undefined) {
      const now = Date.now();
      if (!lastLogTime.current || now - lastLogTime.current >= 500) {
        addLog(`音频状态: 音量=${(data.metering || 0).toFixed(2)}, 时长=${data.durationMillis}ms`);
        lastLogTime.current = now;
      }
    }
  };

  // 处理录音状态变化
  const handleRecordingStateChange = (recording: boolean) => {
    console.log('录音状态变化:', recording);
    setIsRecording(recording);
    
    if (!recording) {
      // 在录音停止时清除音频数据
      setAudioData(null);
      addLog('录音已停止');
    } else {
      addLog('录音已开始');
    }
  };

  // 在录音状态改变时清理
  useEffect(() => {
    if (!isRecording) {
      setAudioData(null);
    }
  }, [isRecording]);

  // 在组件卸载时清理日志
  useEffect(() => {
    return () => {
      setLogs([]);
      lastLogTime.current = 0;
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>音频测试页面</Text>
      </View>

      <View style={styles.content}>
        <AudioRecorder
          onAudioData={handleAudioData}
          onRecordingState={handleRecordingStateChange}
          onLog={addLog}
        />

        <View style={styles.dataDisplay}>
          <Text style={styles.subtitle}>音频数据信息:</Text>
          {audioData && isRecording && (
            <Text>
              音量: {audioData.metering?.toFixed(2) || 0}{'\n'}
              录音时长: {audioData.durationMillis}ms{'\n'}
              录制状态: {isRecording ? '录制中' : '已停止'}{'\n'}
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

