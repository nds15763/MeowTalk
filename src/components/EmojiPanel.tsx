import React, { useState, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Dimensions } from 'react-native';
import { Audio } from 'expo-av';
import { emotions, emotionCategories } from '../config/emotions';
import { Emotion, EmotionCategory } from '../types/emotion';
import ChatMessages from './ChatMessages';

const windowWidth = Dimensions.get('window').width;
const buttonWidth = (windowWidth - 80) / 4;

export default function EmojiPanel() {
  const [selectedCategory, setSelectedCategory] = useState<EmotionCategory>(emotionCategories[1]);
  const [sound, setSound] = useState<Audio.Sound | null>(null);


  const handleCategorySelect = (category: EmotionCategory) => {
    setSelectedCategory(category);
  };

  async function playSound(audioFile: any) {
    if (sound) {
      await sound.unloadAsync();
    }
    const { sound: newSound } = await Audio.Sound.createAsync(audioFile);
    setSound(newSound);
    await newSound.playAsync();
  }

  const handleEmotionSelect = async (emotion: Emotion) => {
    // 播放声音
    if (emotion.audioFile) {
      await playSound(emotion.audioFile);
    }
    
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        {emotionCategories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.tabButton,
              selectedCategory.id === category.id && styles.selectedTab,
            ]}
            onPress={() => handleCategorySelect(category)}
          >
            <Text style={styles.tabTitle}>{category.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.emojiContainer}>
        <View style={styles.emojiContent}>
          {emotions
            .filter((emotion) => emotion.categoryId === selectedCategory.id)
            .map((emotion) => (
              <TouchableOpacity
                key={emotion.id}
                style={styles.emojiButton}
                onPress={() => handleEmotionSelect(emotion)}
              >
                <Text style={styles.emojiIcon}>{emotion.icon}</Text>
                <Text style={styles.emojiTitle}>{emotion.title}</Text>
              </TouchableOpacity>
            ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  tabButton: {
    paddingHorizontal: 15,
    paddingVertical: 5,
  },
  selectedTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#FF5722',
  },
  tabTitle: {
    fontSize: 14,
    color: '#333',
  },
  emojiContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emojiContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: 10,
  },
  emojiButton: {
    width: buttonWidth,
    alignItems: 'center',
    marginVertical: 5,
  },
  emojiIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  emojiTitle: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
}); 