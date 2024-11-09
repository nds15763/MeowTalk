import { useEffect, useState } from 'react';
import { NativeModules } from 'react-native';
import { Emotion } from '../../types/emotion';
import { emotions } from '../../config/emotions';

const { MeowDetector } = NativeModules;

interface DetectionResult {
  emotionId: string;
  similarity: number;
}

export function useMeowDetector() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<Emotion | null>(null);
  
  useEffect(() => {
    const init = async () => {
      try {
        await MeowDetector.initialize();
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize MeowDetector:', error);
      }
    };
    
    init();
  }, []);
  
  const detectEmotion = async (audioData: Float32Array): Promise<Emotion | null> => {
    if (!isInitialized) {
      throw new Error('MeowDetector not initialized');
    }
    
    try {
      const result: DetectionResult = await MeowDetector.detectEmotion(audioData);
      
      if (result.similarity > 0.8) { // 设置相似度阈值
        const detectedEmotion = emotions.find(e => e.id === result.emotionId);
        if (detectedEmotion) {
          setCurrentEmotion(detectedEmotion);
          return detectedEmotion;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error detecting emotion:', error);
      return null;
    }
  };
  
  return {
    isInitialized,
    currentEmotion,
    detectEmotion,
  };
} 