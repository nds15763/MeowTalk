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
        // 这里可以处理录音文件，比如上传或分析
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
      {/* 工具栏 - 始终显示 */}
      <View style={styles.toolbar}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={28} color="#333" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.pawButton,
            isRecording && styles.pawButtonActive
          ]}
          onPressIn={startRecording}
          onPressOut={stopRecording}
          onPress={togglePanel}
          activeOpacity={0.7}
        >
          <Image
            source={require('../../assets/icons/paw.png')}
            style={styles.pawIcon}
          />
        </TouchableOpacity>
      </View>

      {/* 展开的内容 */}
      <Animated.View style={[
        styles.expandedContent, 
        { opacity: contentOpacity }
      ]}>
        <View style={[
          styles.microphoneCircle,
          isRecording && styles.microphoneCircleActive
        ]}>
          <Image
            source={require('../../assets/icons/paw.png')}
            style={styles.microphoneIcon}
          />
        </View>
        <Text style={[typography.text, styles.listeningText]}>
          {isRecording ? '正在录音...' : '按住爪子开始录音'}
        </Text>
        {!hasPermission && (
          <Text style={[typography.text, styles.permissionText]}>
            需要录音权限来识别猫咪的声音
          </Text>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    overflow: 'hidden',
    zIndex: 1000,
  },
  toolbar: {
    height: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pawButton: {
    width: 40,
    height: 40,
    backgroundColor: '#FF5722',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pawButtonActive: {
    backgroundColor: '#E64A19',
  },
  pawIcon: {
    width: 24,
    height: 24,
    tintColor: '#fff',
  },
  expandedContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 20,
  },
  microphoneCircle: {
    width: 80,
    height: 80,
    backgroundColor: '#FF5722',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  microphoneCircleActive: {
    backgroundColor: '#E64A19',
    transform: [{ scale: 1.1 }],
  },
  microphoneIcon: {
    width: 40,
    height: 40,
    tintColor: '#fff',
  },
  listeningText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '500',
  },
  permissionText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
}); 