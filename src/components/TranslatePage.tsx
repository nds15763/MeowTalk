import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Emotion } from '../types/emotion';
import EmojiPopup from './EmojiPopup';
import ChatMessageList from './ChatMessageList';
import ListeningPanel from './ListeningPanel';

interface ChatMessage {
  emotion: Emotion;
  timestamp: number;
}

export default function TranslatePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentEmotion, setCurrentEmotion] = useState<Emotion | null>(null);
  
  // 处理情感检测
  const handleEmotionDetected = (emotion: Emotion) => {
    // 添加新消息
    setMessages(prev => [...prev, {
      emotion,
      timestamp: Date.now()
    }]);
    
    // 显示弹出框
    setCurrentEmotion(emotion);
  };

  // 处理弹出框完成
  const handlePopupComplete = () => {
    setCurrentEmotion(null);
  };

  return (
    <View style={styles.container}>
      {/* 聊天消息列表 */}
      <ChatMessageList messages={messages} />
      
      {/* 监听面板 */}
      <ListeningPanel onEmotionDetected={handleEmotionDetected} />
      
      {/* 情感弹出框 */}
      {currentEmotion && (
        <EmojiPopup
          emotion={currentEmotion}
          duration={3000}
          onComplete={handlePopupComplete}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
