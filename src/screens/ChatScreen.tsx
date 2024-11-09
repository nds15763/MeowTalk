import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import EmojiPanel from '../components/EmojiPanel';
import ListeningPanel from '../components/ListeningPanel';
import ChatMessages from '../components/ChatMessages';
import { layout } from '../styles/layout';
import { Emotion } from '../types/emotion';

export function ChatScreen() {
  const [isRecording, setIsRecording] = useState(false);

  const handleEmotionDetected = (emotion: Emotion) => {
    // 处理检测到的情感
    console.log('Emotion detected:', emotion);
  };

  return (
    <View style={[layout.container, styles.container]}>
      <Image 
        source={require('../../assets/icons/back.png')} 
        style={[styles.backgroundImage, { opacity: 0.3 }]}
        resizeMode="cover"
      />

      <ListeningPanel onEmotionDetected={handleEmotionDetected} />

      <View style={styles.mainContainer}>
        <View style={styles.chatContainer}>
          <ChatMessages />
        </View>

        <View style={styles.emojiPanelWrapper}>
          <EmojiPanel />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  mainContainer: {
    flex: 1,
    paddingTop: 60,
  },
  chatContainer: {
    height: '60%',
    paddingBottom: 10,
  },
  chatArea: {
    flex: 1,
  },
  emojiPanelWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  pawButtonWrapper: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    zIndex: 1000,
  },
  semiCircleBackground: {
    width: 100,
    height: 100,
    backgroundColor: '#FF5722',
    borderTopRightRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [
      { translateX: -35 },
      { translateY: 35 },
    ],
  },
  pawButton: {
    position: 'absolute',
    right: 25,
    bottom: 25,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pawIcon: {
    width: 32,
    height: 32,
    tintColor: '#fff',
    transform: [{ translateY: -10 }],
  },
}); 