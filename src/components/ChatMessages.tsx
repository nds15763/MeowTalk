import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';

interface Message {
  id: string;
  text: string;
  type: 'cat' | 'system';
  timestamp: number;
}

export default function ChatMessages() {
  const [messages] = useState<Message[]>([
    {
      id: '1',
      text: '猫咪正在享受阳光！',
      type: 'cat',
      timestamp: Date.now() - 11000,
    },
    {
      id: '2',
      text: '系统提示：猫咪需要喝水。',
      type: 'system',
      timestamp: Date.now() - 10000,
    },
    {
      id: '3',
      text: '猫咪在追逐小虫子！',
      type: 'cat',
      timestamp: Date.now() - 9000,
    },
    {
      id: '4',
      text: '系统提示：猫咪似乎在打盹。',
      type: 'system',
      timestamp: Date.now() - 8000,
    },
    {
      id: '5',
      text: '猫咪发现了一个新玩具！',
      type: 'cat',
      timestamp: Date.now() - 7000,
    },
    {
      id: '6',
      text: '系统提示：猫咪需要更多的玩耍时间。',
      type: 'system',
      timestamp: Date.now() - 6000,
    },
    {
      id: '7',
      text: '猫咪正在清理自己的毛发。',
      type: 'cat',
      timestamp: Date.now() - 5000,
    },
    {
      id: '8',
      text: '系统提示：猫咪似乎有点无聊。',
      type: 'system',
      timestamp: Date.now() - 4000,
    },
    {
      id: '9',
      text: '猫咪在窗边观察小鸟。',
      type: 'cat',
      timestamp: Date.now() - 3000,
    },
    {
      id: '10',
      text: '系统提示：猫咪需要定期检查健康。',
      type: 'system',
      timestamp: Date.now() - 2000,
    }
  ]);

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageBubble,
              message.type === 'system' && styles.systemMessage,
              message.type === 'cat' && styles.catMessage,
            ]}
          >
            <Text style={[
              styles.messageText,
              message.type === 'system' && styles.systemMessageText
            ]}>
              {message.text}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    flexGrow: 0,
  },
  messageBubble: {
    backgroundColor: '#FFE0D6',
    borderRadius: 16,
    padding: 12,
    marginVertical: 6,
    maxWidth: '80%',
  },
  catMessage: {
    alignSelf: 'flex-end',
  },
  systemMessage: {
    backgroundColor: '#F0F0F0',
    alignSelf: 'center',
  },
  messageText: {
    fontSize: 16,
    color: '#333',
  },
  systemMessageText: {
    color: '#666',
    fontSize: 14,
  },
}); 