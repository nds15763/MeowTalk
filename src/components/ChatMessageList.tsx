import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Emotion } from '../types/emotion';
import { typography } from '../styles/typography';
import { layout } from '../styles/layout';
import { colors } from '../styles/colors';

interface ChatMessage {
  emotion: Emotion;
  timestamp: number;
}

interface Props {
  messages: ChatMessage[];
}

export default function ChatMessageList({ messages }: Props) {
  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View style={styles.messageContainer}>
      <Text style={styles.emoji}>{item.emotion.icon}</Text>
      <View style={styles.messageContent}>
        <Text style={typography.h1}>{item.emotion.title}</Text>
        <Text style={typography.text}>{item.emotion.description}</Text>
      </View>
    </View>
  );

  return (
    <FlatList
      data={messages}
      renderItem={renderMessage}
      keyExtractor={(item) => `${item.timestamp}`}
      contentContainerStyle={[layout.container, styles.container]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 10,
  },
  messageContainer: {
    flexDirection: 'row',
    padding: 10,
    marginBottom: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  emoji: {
    fontSize: 24,
    marginRight: 10,
    color: colors.text,
  },
  messageContent: {
    flex: 1,
  },
}); 