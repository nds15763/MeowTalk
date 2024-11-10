import { Platform } from 'react-native';

// 创建一个统一的获取媒体流的函数
async function getMediaStream() {
  if (Platform.OS === 'web') {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } else {
    const { mediaDevices } = require('react-native-webrtc');
    return await mediaDevices.getUserMedia({ audio: true });
  }
}

export const createVAD = async (options: {
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  threshold?: number;
  silenceTimeout?: number;
}) => {
  const stream = await getMediaStream();
  const audioContext = new AudioContext();
  // 使用类型断言来处理跨平台类型差异
  const source = audioContext.createMediaStreamSource(stream as unknown as MediaStream);
  const analyser = audioContext.createAnalyser();
  
  source.connect(analyser);
  analyser.fftSize = 2048;
  
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  let isSpeaking = false;
  let silenceTimer: NodeJS.Timeout | null = null;
  const threshold = options.threshold || -50; // dB
  const silenceTimeout = options.silenceTimeout || 500; // ms

  const checkAudioLevel = () => {
    analyser.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((a, b) => a + b) / bufferLength;
    const dB = 20 * Math.log10(average / 255);

    if (dB > threshold && !isSpeaking) {
      isSpeaking = true;
      options.onSpeechStart?.();
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }
    } else if (dB <= threshold && isSpeaking) {
      silenceTimer = setTimeout(() => {
        isSpeaking = false;
        options.onSpeechEnd?.();
      }, silenceTimeout);
    }
  };

  let animationFrame: number;
  
  return {
    start: async () => {
      const check = () => {
        checkAudioLevel();
        animationFrame = requestAnimationFrame(check);
      };
      check();
    },
    
    stop: async () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      if (silenceTimer) {
        clearTimeout(silenceTimer);
      }
      stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      await audioContext.close();
    },
    
    destroy: () => {
      // 清理资源
    }
  };
}; 