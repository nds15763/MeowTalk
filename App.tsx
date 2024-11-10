import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { AudioAnalysisProvider } from './src/contexts/AudioAnalysisContext';

export default function App() {
  return (
    <AudioAnalysisProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </AudioAnalysisProvider>
  );
}
