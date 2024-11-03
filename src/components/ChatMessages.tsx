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
      text: '呼唤吃饭',
      type: 'cat',
      timestamp: Date.now() - 11000,
    },
    {
      id: '2',
      text: '系统提示：猫咪似乎在寻找食物',
      type: 'system',
      timestamp: Date.now() - 10000,
    }
  ]);

  return (
    <ScrollView 
      style={styles.container}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  contentContainer: {
    flexGrow: 1,
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