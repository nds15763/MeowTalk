import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { emotions, emotionCategories } from '../config/emotions';
import { Emotion, EmotionCategory } from '../types/emotion';

const windowWidth = Dimensions.get('window').width;
const buttonWidth = (windowWidth - 40) / 3; // 40 是左右边距和按钮之间的间隔

export default function TranslatePage() {
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<EmotionCategory>(emotionCategories[1]);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  async function playSound(audioFile: any) {
    if (sound) {
      await sound.unloadAsync();
    }
    const { sound: newSound } = await Audio.Sound.createAsync(audioFile);
    setSound(newSound);
    await newSound.playAsync();
  }

  const handleEmotionSelect = (emotion: Emotion) => {
    setSelectedEmotion(emotion);
    if (emotion.audioFile) {
      playSound(emotion.audioFile);
    }
  };

  const handleCategorySelect = (category: EmotionCategory) => {
    setSelectedCategory(category);
    setSelectedEmotion(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>MeowTalk</Text>
        <Text style={styles.subHeaderText}>选择情绪</Text>
      </View>
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
      <ScrollView contentContainerStyle={styles.emotionsContainer}>
        {emotions
          .filter((emotion) => emotion.categoryId === selectedCategory.id)
          .map((emotion, index) => (
            <TouchableOpacity
              key={emotion.id}
              style={[
                styles.emotionButton,
                selectedEmotion?.id === emotion.id && styles.selectedEmotion,
                { width: buttonWidth, height: buttonWidth },
                (index + 1) % 3 === 0 ? styles.lastInRow : null,
              ]}
              onPress={() => handleEmotionSelect(emotion)}
            >
              <Text style={styles.emotionIcon}>{emotion.icon}</Text>
              <Text style={styles.emotionTitle}>{emotion.title}</Text>
            </TouchableOpacity>
          ))}
      </ScrollView>
      {selectedEmotion && (
        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionText}>{selectedEmotion.description}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    alignItems: 'center',
    padding: 20,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subHeaderText: {
    fontSize: 18,
    color: '#666',
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  selectedTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#FF69B4',
  },
  tabTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emotionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    padding: 10,
  },
  emotionButton: {
    borderRadius: 10,
    backgroundColor: '#FF69B4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    marginRight: 10,
  },
  selectedEmotion: {
    backgroundColor: '#FF1493',
  },
  emotionIcon: {
    fontSize: 24,
  },
  emotionTitle: {
    marginTop: 5,
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
  },
  descriptionContainer: {
    padding: 20,
    alignItems: 'center',
  },
  descriptionText: {
    fontSize: 16,
    textAlign: 'center',
  },
  lastInRow: {
    marginRight: 0,
  },
});
