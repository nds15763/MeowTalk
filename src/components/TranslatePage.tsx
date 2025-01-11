/**
 * TranslatePage 组件
 * 
 * 这是一个猫咪情绪翻译页面的主要组件。功能包括：
 * 1. 展示不同类别的猫咪情绪（通过顶部标签页切换）
 * 2. 以网格形式展示每个类别下的具体情绪选项
 * 3. 点击情绪按钮可以播放对应的猫叫声音
 * 4. 选中情绪后会显示该情绪的详细描述
 * 
 * 使用了 React Native 的基础组件和 Expo 的音频功能
 */

import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Dimensions, AppState, AppStateStatus, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { emotions, emotionCategories } from '../config/emotions';
import { Emotion, EmotionCategory } from '../types/emotion';

const windowWidth = Dimensions.get('window').width;
const buttonWidth = (windowWidth - 80) / 3; // 80 是左右边距和按钮之间的间隔

export default function TranslatePage() {
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<EmotionCategory>(emotionCategories[1]);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // 初始化音频配置
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      } catch (error) {
        console.error('音频初始化失败:', error);
      }
    };
    setupAudio();

    // 监听应用状态变化
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // 组件卸载时清理
    return () => {
      subscription.remove();
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (
      appState.current.match(/active/) && 
      (nextAppState === 'background' || nextAppState === 'inactive')
    ) {
      // 应用进入后台，停止音频
      if (sound) {
        try {
          await sound.stopAsync();
        } catch (error) {
          console.error('停止音频失败:', error);
        }
      }
    }
    appState.current = nextAppState;
  };

  async function playSound(audioFile: any) {
    try {
      // 如果有正在播放的音频，先停止并卸载
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(audioFile, {
        shouldPlay: true,
        volume: 1.0,
      });
      setSound(newSound);
    } catch (error) {
      console.error('播放音频失败:', error);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.pageContainer}>
        <ImageBackground 
          source={require('../../images/transback.png')}
          style={styles.backgroundImage}
          imageStyle={styles.backgroundImageStyle}
        >
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.headerText}>MeowTalk</Text>
              <Text style={styles.subHeaderText}>Select emotion</Text>
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
            <View style={styles.scrollViewContainer}>
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
            </View>
            {selectedEmotion && (
              <View style={styles.descriptionContainer}>
                <Text style={styles.descriptionText}>{selectedEmotion.description}</Text>
              </View>
            )}
          </View>
        </ImageBackground>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    overflow: 'hidden',
  },
  pageContainer: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
    overflow: 'hidden',
  },
  backgroundImage: {
    height: Dimensions.get('window').height,
    width: Dimensions.get('window').height * (1350/2400),
  },
  backgroundImageStyle: {
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
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
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingHorizontal: 20,
    width: '100%',
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 30,
    width: '33%',
    alignItems: 'center',
  },
  selectedTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#EF7C8E',
  },
  tabTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollViewContainer: {
    alignItems: 'center',
    width: '100%',
  },
  emotionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    padding: 20,
    paddingHorizontal: 40,
    gap: 10,
    width: windowWidth - 80,
  },
  emotionButton: {
    borderRadius: 10,
    backgroundColor: '#EF7C8E',
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
