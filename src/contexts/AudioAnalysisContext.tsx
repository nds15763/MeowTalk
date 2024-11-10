import React, { createContext, useContext, useEffect, useState } from 'react';
import { Audio } from 'expo-av';
import { Emotion } from '../types/emotion';
import Meyda from 'meyda';
import { createVAD } from '../utils/vad-webrtc';

interface AudioAnalysisContextType {
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  isListening: boolean;
  currentEmotion: Emotion | null;
}

const AudioAnalysisContext = createContext<AudioAnalysisContextType | undefined>(undefined);

// 预定义的猫咪情感特征向量数据库
const emotionFeatureDB = {
  comfortable: {
    features: [/* ... 预训练的特征向量 ... */],
    emotion: {
      id: 'comfortable',
      icon: '😌',
      title: '舒适',
      description: '猫咪感到舒适和放松。',
      categoryId: 'friendly',
    },
  },
  // ... 其他情感特征
};

export function AudioAnalysisProvider({ children }: { children: React.ReactNode }) {
  const [isListening, setIsListening] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<Emotion | null>(null);
  const [vadModel, setVadModel] = useState<any>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);

  // VAD 检测到声音时的处理
  const startRecording = async () => {
    if (recording) return;
    const newRecording = new Audio.Recording();
    try {
      await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await newRecording.startAsync();
      setRecording(newRecording);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  // VAD 检测到声音结束时的处理
  const stopRecording = async () => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      // 这里可以处理录音文件，例如进行音频分析
      setRecording(null);
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  // 初始化 VAD 模型
  useEffect(() => {
    const initVAD = async () => {
      const vad = await createVAD({
        onSpeechStart: () => {
          console.log('Cat sound detected!');
          startRecording();
        },
        onSpeechEnd: () => {
          console.log('Cat sound ended');
          stopRecording();
        },
        threshold: -40, // 可以调整这个值来改变灵敏度
        silenceTimeout: 500
      });
      
      setVadModel(vad);
    };

    initVAD();
    return () => {
      if (vadModel) {
        vadModel.destroy();
      }
    };
  }, []);

  // 计算特征向量之间的余弦相似度
  const cosineSimilarity = (vec1: number[], vec2: number[]): number => {
    const dotProduct = vec1.reduce((acc, val, i) => acc + val * vec2[i], 0);
    const norm1 = Math.sqrt(vec1.reduce((acc, val) => acc + val * val, 0));
    const norm2 = Math.sqrt(vec2.reduce((acc, val) => acc + val * val, 0));
    return dotProduct / (norm1 * norm2);
  };

  // 分析音频特征
  const analyzeAudio = async (audioBuffer: AudioBuffer) => {
    // Convert AudioBuffer to Float32Array
    const audioData = audioBuffer.getChannelData(0);
    // Use Meyda to extract features
    const features = Meyda.extract(['mfcc', 'spectralCentroid'], audioData);
    
    // 找到最匹配的情感
    let bestMatch = null;
    let highestSimilarity = -1;

    Object.entries(emotionFeatureDB).forEach(([_, data]) => {
      const similarity = cosineSimilarity(features as any, data.features);
      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = data.emotion;
      }
    });

    if (bestMatch && highestSimilarity > 0.8) {
      setCurrentEmotion(bestMatch);
    }
  };

  const startListening = async () => {
    if (!vadModel) return;
    
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      
      await vadModel.start();
      setIsListening(true);
    } catch (error) {
      console.error('Failed to start listening:', error);
    }
  };

  const stopListening = async () => {
    if (!vadModel) return;
    
    try {
      await vadModel.stop();
      setIsListening(false);
    } catch (error) {
      console.error('Failed to stop listening:', error);
    }
  };

  return (
    <AudioAnalysisContext.Provider value={{
      startListening,
      stopListening,
      isListening,
      currentEmotion,
    }}>
      {children}
    </AudioAnalysisContext.Provider>
  );
}

export function useAudioAnalysis() {
  const context = useContext(AudioAnalysisContext);
  if (context === undefined) {
    throw new Error('useAudioAnalysis must be used within an AudioAnalysisProvider');
  }
  return context;
} 