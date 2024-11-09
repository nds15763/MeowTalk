import React from 'react';
import { 
  TouchableOpacity, 
  StyleSheet, 
  Animated, 
  View 
} from 'react-native';

interface Props {
  isRecording: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
}

export default function RecordButton({ isRecording, onPressIn, onPressOut }: Props) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={0.7}
    >
      <View style={[
        styles.button,
        isRecording && styles.recording
      ]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF6B6B',
    borderWidth: 4,
    borderColor: '#FFF',
  },
  recording: {
    backgroundColor: '#FF4444',
    transform: [{ scale: 1.1 }],
  },
}); 