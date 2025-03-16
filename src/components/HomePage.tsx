import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, ImageBackground, Dimensions, Platform } from 'react-native';
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

            <TouchableOpacity
              style={[styles.button, styles.aiTalkNativeButton]}
              onPress={() => navigation.navigate('VideoAITransNative' as never)}
            >
              <Text style={styles.buttonText}>AI视频助手</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.testButton]}
              onPress={() => navigation.navigate('TestAudio' as never)}
            >
              <Text style={styles.buttonText}>Test Audio</Text>
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
    padding: Platform.OS === 'android' ? 15 : 20,
    backgroundColor: 'transparent',
  },
  logo: {
    width: Platform.OS === 'android' ? 180 : 200,
    height: Platform.OS === 'android' ? 180 : 200,
    marginBottom: Platform.OS === 'android' ? 40 : 50,
  },
  title: {
    fontSize: Platform.OS === 'android' ? 24 : 27,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: Platform.OS === 'android' ? 8 : 10,
    textAlign: Platform.OS === 'android' ? 'center' : 'left',
  },
  subtitle: {
    fontSize: Platform.OS === 'android' ? 16 : 19,
    color: '#fff',
    textAlign: 'center',
    marginBottom: Platform.OS === 'android' ? 25 : 30,
  },
  button: {
    backgroundColor: '#A864AF',
    paddingHorizontal: Platform.OS === 'android' ? 35 : 40,
    paddingVertical: Platform.OS === 'android' ? 12 : 15,
    borderRadius: 25,
    marginVertical: 5,
  },
  testButton: {
    backgroundColor: '#7B6CF6',  // 使用不同的颜色区分测试按钮
  },
  aiTalkButton: {
    backgroundColor: '#FF9A8B',  // 使用暖色调为AI语音助手按钮
  },
  aiTalkNativeButton: {
    backgroundColor: '#34C759',  // 使用绿色调为AI视频助手（优化版）按钮
  },
  buttonText: {
    color: '#fff',
    fontSize: Platform.OS === 'android' ? 16 : 18,
    fontWeight: 'bold',
    textAlign: Platform.OS === 'android' ? 'center' : 'left',
  },
});
