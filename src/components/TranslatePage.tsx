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
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, 
  Dimensions, AppState, AppStateStatus, ImageBackground, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { emotions, emotionCategories } from '../config/emotions';
import { Emotion, EmotionCategory } from '../types/emotion';

const windowWidth = Dimensions.get('window').width;
const GRID_SPACING = 10;
const GRID_PADDING = 14;
const TOTAL_SPACING = (GRID_SPACING * 2) + (GRID_PADDING * 2); // 间距总和
const buttonWidth = (windowWidth - TOTAL_SPACING) / 3; // 确保一行三个按钮

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

      // 监听播放完成事件
      newSound.setOnPlaybackStatusUpdate(async (status: any) => {
        if (status.didJustFinish) {
          // 播放结束后自动卸载
          await newSound.unloadAsync();
          setSound(null);
        }
      });

      setSound(newSound);
    } catch (error) {
      console.error('播放音频失败:', error);
    }
  }

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (
      appState.current.match(/active/) && 
      (nextAppState === 'background' || nextAppState === 'inactive')
    ) {
      // 应用进入后台，停止并卸载音频
      if (sound) {
        try {
          await sound.stopAsync();
          await sound.unloadAsync();
          setSound(null);
        } catch (error) {
          console.error('停止音频失败:', error);
        }
      }
    }
    appState.current = nextAppState;
  };

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
            <Image 
              source={require('../../images/banner.png')}
              style={styles.headerLogo}
            />
              <Text style={styles.subHeaderText}>Click the emotion card to play</Text>
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
                <View style={styles.gridContainer}>
                  {emotions
                    .filter((emotion) => emotion.categoryId === selectedCategory.id)
                    .map((emotion, index) => (
                      <TouchableOpacity
                        key={emotion.id}
                        style={[
                          styles.emotionButton,
                          selectedEmotion?.id === emotion.id && styles.selectedEmotion,
                        ]}
                        onPress={() => handleEmotionSelect(emotion)}
                      >
                        <View style={styles.emotionContent}>
                          <Text style={styles.emotionIcon}>{emotion.icon}</Text>
                          <Text style={styles.emotionTitle}>{emotion.title}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                </View>
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
  headerLogo: {
    width: 200,  
    height: 45,
    resizeMode: 'contain',
  },
  safeArea: {
    flex: 1,
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
    padding: 15,
  },
  subHeaderText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingHorizontal: 10,
    width: '100%',
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: '25%',
    alignItems: 'center',
  },
  selectedTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#EF7C8E',
  },
  tabTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  scrollViewContainer: {
    flex: 1,
    width: '100%',
  },
  emotionsContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  gridContainer: {
    width: '100%',
    maxWidth: 400,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: GRID_SPACING,
  },
  emotionButton: {
    width: `${100/3 - 6}%`,
    aspectRatio: 1,
    marginBottom: GRID_SPACING,
    backgroundColor: '#FFE8E8',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emotionContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedEmotion: {
    backgroundColor: '#A864AF',
    transform: [{ scale: 1.05 }],
  },
  emotionIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  emotionTitle: {
    color: '#333',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  descriptionContainer: {
    padding: 15,
    alignItems: 'center',
  },
  descriptionText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
