import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import HomePage from '../components/HomePage';
import TranslatePage from '../components/TranslatePage';
import { ChatScreen } from '../screens/ChatScreen';

const Stack = createStackNavigator();

function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="Home" 
        component={HomePage}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Translate" 
        component={TranslatePage}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Chat" 
        component={ChatScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

export default AppNavigator; 