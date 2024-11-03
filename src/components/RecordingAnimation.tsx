import React, { useEffect } from 'react';
import { StyleSheet, Animated } from 'react-native';

interface RecordingAnimationProps {
  isRecording: boolean;
}

export function RecordingAnimation({ isRecording }: RecordingAnimationProps) {
  const scaleValue = new Animated.Value(1);

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleValue, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(scaleValue, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scaleValue.setValue(1);
    }
  }, [isRecording]);

  return (
    <Animated.Image
      source={require('../assets/icons/paw.png')}
      style={[
        styles.pawIcon,
        {
          transform: [{ scale: scaleValue }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  pawIcon: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
}); 