import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { MOCK_CONFIG } from '../config/mock';
import { emotions } from '../config/emotions';
import { Emotion } from '../types/emotion';

interface AITranslaterProps {
  audioFeatures?: {
    zeroCrossRate?: number;
    energy?: number;
    pitch?: number;
    duration?: number;
    peakFreq?: number;
    rootMeanSquare?: number;
    spectralCentroid?: number;
    spectralRolloff?: number;
    fundamentalFreq?: number;
  };
  onTranslationResult?: (result: {
    emotion: Emotion;
    confidence: number;
    translation: string;
  }) => void;
}

export default function AITranslater({ audioFeatures, onTranslationResult }: AITranslaterProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastResult, setLastResult] = useState<{
    emotion: Emotion;
    confidence: number;
    translation: string;
  } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // 初始化WebSocket连接
  useEffect(() => {
    wsRef.current = new WebSocket(MOCK_CONFIG.SERVER.WS_URL);
    
    wsRef.current.onopen = () => {
      console.log('AI翻译服务已连接');
    };
    
    wsRef.current.onmessage = (event) => {
      try {
        const result = JSON.parse(event.data);
        if (result.emotion && result.confidence && result.translation) {
          const emotion = emotions.find(e => e.id === result.emotion) || emotions[0];
          const translationResult = {
            emotion,
            confidence: result.confidence,
            translation: result.translation
          };
          setLastResult(translationResult);
          onTranslationResult?.(translationResult);
          setIsAnalyzing(false);
        }
      } catch (error) {
        console.error('解析AI翻译结果失败:', error);
        setIsAnalyzing(false);
      }
    };
    
    wsRef.current.onerror = (error) => {
      console.error('AI翻译服务错误:', error);
      setIsAnalyzing(false);
    };
    
    return () => {
      wsRef.current?.close();
    };
  }, []);

  // 当收到新的音频特征时，发送给AI服务
  useEffect(() => {
    if (audioFeatures && wsRef.current?.readyState === WebSocket.OPEN) {
      setIsAnalyzing(true);
      wsRef.current.send(JSON.stringify({
        type: 'analyze',
        features: audioFeatures
      }));
    }
  }, [audioFeatures]);

  return (
    <View style={styles.container}>
      {isAnalyzing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>正在分析猫咪的情感...</Text>
        </View>
      ) : lastResult ? (
        <View style={styles.resultContainer}>
          <View style={styles.emotionContainer}>
            <Text style={styles.emoji}>{lastResult.emotion.icon}</Text>
            <Text style={styles.emotionTitle}>{lastResult.emotion.title}</Text>
          </View>
          <Text style={styles.translation}>{lastResult.translation}</Text>
          <Text style={styles.confidence}>
            置信度: {(lastResult.confidence * 100).toFixed(1)}%
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    margin: 10,
    minHeight: 100,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  resultContainer: {
    alignItems: 'center',
  },
  emotionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  emoji: {
    fontSize: 24,
    marginRight: 8,
  },
  emotionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  translation: {
    fontSize: 16,
    color: '#444',
    textAlign: 'center',
    marginVertical: 10,
    lineHeight: 24,
  },
  confidence: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
});
