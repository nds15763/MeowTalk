import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, ImageBackground, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

export default function HomePage() {
  const navigation = useNavigation();
  const [logoClicks, setLogoClicks] = React.useState(0);

  const handleLogoClick = () => {
    setLogoClicks(prev => prev + 1);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.pageContainer}>
        <ImageBackground 
          source={require('../../images/homeback.png')}
          style={styles.backgroundImage}
          imageStyle={styles.backgroundImageStyle}
        >
          <View style={styles.container}>
            <TouchableOpacity onPress={handleLogoClick}>
              <Image
                source={logoClicks >= 5 ? require('../../images/cat_logo_2.png') : require('../../images/cat_logo.png')}
                style={styles.logo}
              />
            </TouchableOpacity>
            <Text style={styles.title}>Welcome to MeowTalk</Text>
            <Text style={styles.subtitle}>Translate your cat's meows into emotions!</Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => navigation.navigate('Translate' as never)}
            >
              <Text style={styles.buttonText}>Translate</Text>
            </TouchableOpacity>
          </View>
        </ImageBackground>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EF7C8E',
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'transparent',
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 50,
  },
  title: {
    fontSize: 27,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 19,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#A864AF',
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
