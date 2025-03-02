import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import AudioRecorder from './AudioRecorder';
import { MOCK_CONFIG } from '../config/mock';

const isWeb = Platform.OS === 'web';

export default function TestAudioPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [emotion, setEmotion] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(0);
  const streamIdRef = useRef<string>('');
  const logsEndRef = useRef<ScrollView>(null);
  const pollIntervalRef = useRef<any>(null);

  // 添加日志
  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    
    // 自动滚动到最新日志
    setTimeout(() => {
      if (isWeb) {
        // Web平台使用div
        const element = logsEndRef.current as unknown as HTMLDivElement;
        element?.scrollIntoView?.({ behavior: 'smooth' });
      } else {
        // React Native平台使用ScrollView
        logsEndRef.current?.scrollToEnd?.({ animated: true });
      }
    }, 100);
  }, []);

  // 发送音频数据到服务器
  const sendAudioData = useCallback(async (audioData: any) => {
    console.log("sendAudioData 被调用，StreamID:", streamIdRef.current, "录音状态:", isRecording);
    
    if (!streamIdRef.current) {
      console.log("未发送音频数据: streamId 为空或未在录音");
      return;
    }

    try {
      const requestBody = {
        streamId: streamIdRef.current,
        data: audioData
      };
      console.log(`准备向 ${MOCK_CONFIG.SERVER.URL}/send 发送请求`, 
                 `数据长度: ${audioData.length}`, 
                 `数据示例: [${audioData.slice(0, 3).join(', ')}...]`);
      
      const response = await fetch(`${MOCK_CONFIG.SERVER.URL}/api/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`发送失败: HTTP ${response.status}`, errorText);
        throw new Error(`发送失败: ${errorText}`);
      }
      
      console.log("发送成功，HTTP状态码:", response.status);
      // 尝试读取响应内容
      const responseText = await response.text();
      if (responseText) {
        console.log("服务器响应:", responseText);
      }
    } catch (error) {
      console.error("发送音频数据错误:", error);
      addLog(`发送音频数据失败: ${error}`);
    }
  }, [isRecording, addLog]);

  // 轮询获取服务器结果
  const pollResult = useCallback(async () => {
    if (!streamIdRef.current || !isRecording) return;

    try {
      const response = await fetch(`${MOCK_CONFIG.SERVER.URL}/recv?streamId=${streamIdRef.current}`);
      if (!response.ok) {
        throw new Error(`获取结果失败: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.emotion) {
        setEmotion(result.emotion);
        setConfidence(result.confidence);
        addLog(`检测到情绪: ${result.emotion} (置信度: ${(result.confidence * 100).toFixed(1)}%)`);
      }
    } catch (error) {
      console.error('获取结果失败:', error);
    }
  }, [isRecording, addLog]);

  // 开始录音
  const handleRecordingStart = useCallback(async () => {
    try {
      streamIdRef.current = `stream_${Date.now()}`;
      
      // 调用服务器start接口
      const response = await fetch(`${MOCK_CONFIG.SERVER.URL}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          streamId: streamIdRef.current,
        }),
      });

      if (!response.ok) {
        throw new Error(`开始录音失败: ${await response.text()}`);
      }

      setIsRecording(true);
      addLog('开始录音');

      // 开始轮询结果
      pollIntervalRef.current = setInterval(pollResult, 1000);
    } catch (error) {
      addLog(`启动录音失败: ${error}`);
    }
  }, [addLog, pollResult]);

  // 结束录音
  const handleRecordingStop = useCallback(async () => {
    if (!streamIdRef.current) return;

    try {
      // 调用服务器stop接口
      const response = await fetch(`${MOCK_CONFIG.SERVER.URL}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          streamId: streamIdRef.current,
        }),
      });

      if (!response.ok) {
        throw new Error(`停止录音失败: ${await response.text()}`);
      }

      setIsRecording(false);
      addLog('停止录音');

      // 停止轮询
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    } catch (error) {
      addLog(`停止录音失败: ${error}`);
    }
  }, [addLog]);

  // 处理音频数据
  const handleAudioData = useCallback((data: any) => {
    // 添加调试信息
    console.log("handleAudioData 被调用，录音状态:", isRecording, "StreamID:", streamIdRef.current);
    

    if (!streamIdRef.current) {
      console.log("音频数据未处理: streamId 为空");
      return;
    }
    
    // 确保音频数据存在且有效
    if (data && data.audioData && Array.isArray(data.audioData) && data.audioData.length > 0) {
      // 尝试找出无效数据
      const invalidValues = data.audioData.filter((x: any) => 
          typeof x !== 'number' || isNaN(x) || !isFinite(x));
      
      if (invalidValues.length > 0) {
        console.log(`检测到 ${invalidValues.length}/${data.audioData.length} 个无效值，将被过滤`);
      }
      
      // 过滤无效数据
      const validData = data.audioData.filter((x: any) => 
          typeof x === 'number' && !isNaN(x) && isFinite(x));
      
      if (validData.length === 0) {
        console.log("所有音频数据都无效，不处理");
        return;
      }
      
      // 计算一些简单的统计信息
      const maxValue = Math.max(...validData);
      const minValue = Math.min(...validData);
      const avgValue = validData.reduce((a: number, b: number) => a + b, 0) / validData.length;
      
      // 添加日志 - 打印音频数据统计信息
      const logMessage = `音频数据: [样本数=${validData.length}, 最小值=${minValue.toFixed(2)}, 最大值=${maxValue.toFixed(2)}, 平均值=${avgValue.toFixed(2)}]`;
      console.log(logMessage);
      addLog(logMessage);
      
      // 发送到服务器
      console.log("准备发送的数据:", validData.slice(0, 5), "...(共", validData.length, "个采样点)");
      sendAudioData(validData);
    } else {
      console.log("音频数据无效: ", data);
    }
  }, [isRecording, sendAudioData, addLog]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      <AudioRecorder
        onAudioData={handleAudioData}
        onRecordingStart={handleRecordingStart}
        onRecordingStop={handleRecordingStop}
        onLog={addLog}
      />
      
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>录音状态: {isRecording ? '录音中' : '已停止'}</Text>
        <Text style={styles.infoText}>检测情绪: {emotion || '无'}</Text>
        <Text style={styles.infoText}>置信度: {(confidence * 100).toFixed(1)}%</Text>
      </View>

      <View style={styles.logsContainer}>
        <Text style={styles.title}>录音日志:</Text>
        {isWeb ? (
          // Web平台使用div
          <div 
            ref={logsEndRef as any} 
            style={{ 
              flex: 1, 
              overflowY: 'auto',
              height: '100%',
              padding: '10px'
            }}
          >
            {logs.map((log, index) => (
              <Text key={index} style={styles.logText}>{log}</Text>
            ))}
          </div>
        ) : (
          // React Native平台使用ScrollView
          <ScrollView 
            ref={logsEndRef}
            style={styles.logs}
          >
            {logs.map((log, index) => (
              <Text key={index} style={styles.logText}>{log}</Text>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  infoContainer: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
  },
  infoText: {
    fontSize: 16,
    marginBottom: 5,
  },
  logsContainer: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  logs: {
    flex: 1,
  },
  logText: {
    fontSize: 14,
    marginBottom: 2,
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'courier',
  },
});
