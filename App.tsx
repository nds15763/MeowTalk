import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomePage from './src/components/HomePage';
import TranslatePage from './src/components/TranslatePage';
import TestAudioPage from './src/components/TestAudioPage';
import VideoAITrans from './src/components/VideoAITrans';
import VideoAITransNative from './src/components/VideoAITransNative';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={HomePage} />
          <Stack.Screen name="Translate" component={TranslatePage} />
          <Stack.Screen name="TestAudio" component={TestAudioPage} />
          <Stack.Screen name="VideoAITrans" component={VideoAITrans} />
          <Stack.Screen name="VideoAITransNative" component={VideoAITransNative} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
