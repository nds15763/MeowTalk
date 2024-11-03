import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Image, Text, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ListeningPanel() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [isExpanded, setIsExpanded] = useState(false);
  const heightAnim = useRef(new Animated.Value(0)).current;

  const togglePanel = () => {
    console.log('Toggling panel, current state:', isExpanded);
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
          style={styles.pawButton}
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
        <View style={styles.microphoneCircle}>
          <Image
            source={require('../../assets/icons/paw.png')}
            style={styles.microphoneIcon}
          />
        </View>
        <Text style={styles.listeningText}>Listening...</Text>
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
}); 