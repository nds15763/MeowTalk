import React, { useState, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Image, Text, Animated, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { Emotion } from '../types/emotion';
import { typography } from '../styles/typography';
import { layout } from '../styles/layout';

interface Props {
  onEmotionDetected: (emotion: Emotion) => void;
}

export default function ListeningPanel({ onEmotionDetected }: Props) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const heightAnim = useRef(new Animated.Value(0)).current;
  const recording = useRef<Audio.Recording | null>(null);

  // 请求录音权限
  const requestPermission = async () => {
    const { granted } = await Audio.requestPermissionsAsync();
    setHasPermission(granted);
    return granted;
  };

  // 开始录音
  const startRecording = async () => {
    try {
      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted) return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      recording.current = newRecording;
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  // 停止录音
  const stopRecording = async () => {
    if (!recording.current) return;

    try {
      await recording.current.stopAndUnloadAsync();
      const uri = recording.current.getURI();
      recording.current = null;
      setIsRecording(false);

      if (uri) {
        // 这里可以理录音文件，比如上传或分析
        console.log('Recording saved to:', uri);
        
        // TODO: 这里需要实现音频分析逻辑
        

        // 模拟检测到情感
        const mockEmotion = {
          id: 'comfortable',
          icon: '😌',
          title: '舒适',
          description: '您的猫咪感到舒适和放松。',
          audioFile: uri,
          categoryId: 'friendly',
        };
        onEmotionDetected(mockEmotion);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  // 切换面板展开/收起状态
  const togglePanel = () => {
    Animated.spring(heightAnim, {
      toValue: isExpanded ? 0 : 1,
      useNativeDriver: false,
      friction: 8,
      tension: 40,
    }).start();
    setIsExpanded(!isExpanded);
  };

  const containerHeight = heightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [60 + insets.top, 250 + insets.top],
  });

  const contentOpacity = heightAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <Animated.View style={[
      layout.container,
      styles.container, 
      { 
        height: containerHeight,
        paddingTop: insets.top 
      }
    ]}>
      {/* 工具栏 */}
      <View style={styles.toolbar}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* 录音猫咪按钮 */}
      <TouchableOpacity 
        style={styles.recordingCatContainer}
        onPressIn={startRecording}
        onPressOut={stopRecording}
        activeOpacity={0.7}
      >
        <Image
          source={require('../../images/recording_cat.png')}
          style={[
            styles.recordingCat,
            isRecording && styles.recordingCatActive
          ]}
          resizeMode="contain"
        />
        {isRecording && (
          <Text style={styles.recordingText}>正在录音...</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#19191a',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
    zIndex: 1000,
  },
  toolbar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingCatContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 20,
  },
  recordingCat: {
    width: '100%',
    height: 120,
    transform: [{ translateY: 60 }], // 让猫咪只露出上半部分
  },
  recordingCatActive: {
    transform: [
      { translateY: 60 },
      { scale: 1.05 }
    ],
  },
  recordingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: -40, // 调整文字位置，使其显示在猫咪上方
    fontWeight: '500',
  },
}); 