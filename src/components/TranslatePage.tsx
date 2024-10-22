import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { emotions } from '../config/emotions';
import { Emotion } from '../types/emotion';

export default function TranslatePage() {
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion | null>(null);
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
    playSound(emotion.audioFile);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>MeowTalk</Text>
        <Text style={styles.subHeaderText}>Select Emotion</Text>
      </View>
      <ScrollView contentContainerStyle={styles.emotionsContainer}>
        {emotions.map((emotion) => (
          <TouchableOpacity
            key={emotion.id}
            style={[
              styles.emotionButton,
              selectedEmotion?.id === emotion.id && styles.selectedEmotion,
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
      {/* <TouchableOpacity
        style={styles.translateButton}
        onPress={() => selectedEmotion && playSound(selectedEmotion.audioFile)}
      >
        <Text style={styles.translateButtonText}>Translate to Cat Language</Text>
      </TouchableOpacity> */}
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
  emotionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    padding: 10,
  },
  emotionButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FF69B4',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 10,
  },
  selectedEmotion: {
    backgroundColor: '#FF1493',
  },
  emotionIcon: {
    fontSize: 30,
  },
  emotionTitle: {
    marginTop: 5,
    color: '#fff',
    fontWeight: 'bold',
  },
  descriptionContainer: {
    padding: 20,
    alignItems: 'center',
  },
  descriptionText: {
    fontSize: 16,
    textAlign: 'center',
  },
  translateButton: {
    backgroundColor: '#FF69B4',
    padding: 15,
    margin: 20,
    borderRadius: 25,
    alignItems: 'center',
  },
  translateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
