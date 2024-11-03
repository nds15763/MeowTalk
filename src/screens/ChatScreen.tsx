import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import EmojiPanel from '../components/EmojiPanel';
import ListeningPanel from '../components/ListeningPanel';
import ChatMessages from '../components/ChatMessages';

export function ChatScreen() {
  const [isRecording, setIsRecording] = useState(false);

  return (
    <View style={styles.container}>
      <Image 
        source={require('../../assets/icons/back.png')} 
        style={[styles.backgroundImage, { opacity: 0.3 }]}
        resizeMode="cover"
      />

      <ListeningPanel />

      <View style={styles.contentContainer}>
        <ChatMessages />
      </View>

      <View style={styles.emojiPanelWrapper}>
        <EmojiPanel />
        <View style={styles.pawButtonWrapper}>
          <View style={styles.semiCircleBackground}>
            <TouchableOpacity
              style={styles.pawButton}
              onPressIn={() => setIsRecording(true)}
              onPressOut={() => setIsRecording(false)}
            >
              <Image
                source={require('../../assets/icons/paw.png')}
                style={styles.pawIcon}
              />
            </TouchableOpacity>
          </View>
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
  contentContainer: {
    flex: 1,
    marginTop: 60,
    marginBottom: '40%',
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