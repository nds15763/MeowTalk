import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import AudioRecorder from './AudioRecorder';
import { MOCK_CONFIG } from '../config/mock';

const isWeb = Platform.OS === 'web';

export default function TestAudioPage() {
  const [audioData, setAudioData] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [emotion, setEmotion] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>([]);
  const lastLogTime = useRef<number>(0);
  const streamIdRef = useRef<string>(`stream_${Date.now()}`);
  const logsEndRef = useRef<View>(null);
  const retryCount = useRef<number>(0);
  const MAX_RETRIES = 3;

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    
    // 自动滚动到最新日志
    // setTimeout(() => {
    //   logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    // }, 100);
  }, []);

  // 发送音频数据到mock服务器
  const sendAudioData = useCallback(async (streamId: string, audioData: any) => {
    if (!audioData) return;

    try {
      addLog(`正在发送音频数据到Mock服务器 (StreamID: ${streamId})`);
      const response = await fetch(`${MOCK_CONFIG.SERVER.URL}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          streamId,
          data: Array.from(audioData),
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status}`);
      }

      addLog('音频数据发送成功');
      retryCount.current = 0; // 重置重试计数
      
      // 获取处理结果
      const resultResponse = await fetch(`${MOCK_CONFIG.SERVER.URL}/recv?streamId=${streamId}`);
      if (!resultResponse.ok) {
        throw new Error(`获取结果失败: ${resultResponse.status}`);
      }
      
      const result = await resultResponse.json();
      if (result.emotion) {
        setEmotion(result.emotion);
        setConfidence(result.confidence);
        addLog(`检测到情绪: ${result.emotion} (置信度: ${(result.confidence * 100).toFixed(1)}%)`);
      }
    } catch (err: any) {
      console.error('Mock服务器请求失败:', err);
      addLog(`Mock服务器错误: ${err.message}`);
      
      // 重试逻辑
      if (retryCount.current < MAX_RETRIES) {
        retryCount.current++;
        const delay = Math.min(1000 * Math.pow(2, retryCount.current), 5000); // 指数退避，最大5秒
        addLog(`将在 ${delay/1000} 秒后重试 (第 ${retryCount.current} 次)`);
        setTimeout(() => sendAudioData(streamId, audioData), delay);
      } else {
        addLog(`已达到最大重试次数 (${MAX_RETRIES}次), 放弃重试`);
        retryCount.current = 0;
      }
    }
  }, [addLog]);

  const handleAudioData = useCallback((data: any) => {
    setAudioData(data);
    
    // 每500ms记录一次音频状态
    const now = Date.now();
    if (now - lastLogTime.current >= 500) {
      const audioSamples = data.audioData?.slice(0, 5).map((v: number) => v.toFixed(2)).join(', ') || '';
      addLog(`音频数据: [${audioSamples}...] 音量: ${(data.metering * 100).toFixed(0)}% 时长: ${data.durationMillis}ms`);
      lastLogTime.current = now;
    }

    // 只在web端的mock模式下发送数据到mock服务器
    if (isWeb && MOCK_CONFIG.ENABLE_MOCK && isRecording && data.audioData) {
      sendAudioData(streamIdRef.current, data.audioData);
    }
  }, [addLog, isRecording, sendAudioData]);

  const handleEmotionDetected = useCallback((result: any) => {
    setEmotion(result.emotion);
    setConfidence(result.confidence);
    addLog(`检测到情绪: ${result.emotion} (置信度: ${(result.confidence * 100).toFixed(1)}%)`);
  }, [addLog]);

  const handleRecordingState = useCallback((recording: boolean) => {
    setIsRecording(recording);
    if (recording) {
      streamIdRef.current = `stream_${Date.now()}`; // 每次开始录音生成新的streamId
      addLog(`开始新录音会话 (StreamID: ${streamIdRef.current})`);
    } else {
      addLog('录音会话结束');
    }
  }, [addLog]);

  return (
    <View style={styles.container}>
      <AudioRecorder
        onAudioData={handleAudioData}
        onEmotionDetected={handleEmotionDetected}
        onRecordingState={handleRecordingState}
        onLog={addLog}
      />
      
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>录音状态: {isRecording ? '录音中' : '已停止'}</Text>
        <Text style={styles.infoText}>检测情绪: {emotion || '无'}</Text>
        <Text style={styles.infoText}>置信度: {(confidence * 100).toFixed(1)}%</Text>
      </View>

      <View style={styles.logsContainer}>
        <Text style={styles.title}>录音日志:</Text>
        <ScrollView style={styles.logs}>
          {logs.map((log, index) => (
            <Text key={index} style={styles.logText}>{log}</Text>
          ))}
          <View ref={logsEndRef} />
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
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
  logsContainer: {
    flex: 1,
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 10,
  },
  title: {
    fontSize: 18,
    marginBottom: 10,
  },
  logs: {
    flex: 1,
  },
  logText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
});
