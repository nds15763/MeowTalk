import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { emotions, emotionCategories } from '../config/emotions';
import { Emotion, EmotionCategory } from '../types/emotion';
import AudioRecorder from './AudioRecorder';

const windowWidth = Dimensions.get('window').width;
const buttonWidth = (windowWidth - 40) / 3;

export default function TranslatePage() {
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<EmotionCategory>(emotionCategories[1]);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [detectedEmotion, setDetectedEmotion] = useState<any>(null);

  async function playSound(audioFile: any) {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      if (sound) {
        await sound.unloadAsync();
      }

      let audioSource = audioFile;
      if (Platform.OS !== 'web') {
        if (typeof audioFile === 'string') {
          if (audioFile.startsWith('http')) {
            audioSource = { uri: audioFile };
          } else {
            audioSource = audioFile;
          }
        }
      }

      const { sound: newSound } = await Audio.Sound.createAsync(audioSource);
      setSound(newSound);
      await newSound.playAsync();
    } catch (error) {
      console.error('Error playing sound:', error);
    }
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

  const handleEmotionDetected = (result: any) => {
    setDetectedEmotion(result);
    // TODO: 可以根据检测结果自动选择对应的情感类别
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>MeowTalk</Text>
        <Text style={styles.subHeaderText}>Select Emotion</Text>
      </View>

      {/* 添加录音组件 */}
      <AudioRecorder onEmotionDetected={handleEmotionDetected} />

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
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  selectedTab: {
    borderBottomColor: '#ff4081',
  },
  tabTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  emotionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
  },
  emotionButton: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginBottom: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
  },
  selectedEmotion: {
    backgroundColor: '#ffe0e9',
  },
  emotionIcon: {
    fontSize: 24,
    marginBottom: 5,
  },
  emotionTitle: {
    fontSize: 12,
  },
  descriptionContainer: {
    padding: 20,
    backgroundColor: '#f8f8f8',
  },
  descriptionText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  lastInRow: {
    marginRight: 0,
  },
});
