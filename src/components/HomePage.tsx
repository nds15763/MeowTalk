import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

export default function HomePage() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <Image
        source={require('../../images/cat_logo.png')}
        style={styles.logo}
      />
      <Text style={styles.title}>Welcome to MeowTalk</Text>
      <Text style={styles.subtitle}>Translate your cat's meows into emotions!</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('Chat' as never)}
      >
        <Text style={styles.buttonText}>Go to Chat</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('Translate' as never)}
      >
        <Text style={styles.buttonText}>Translate</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#FF69B4',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
