import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  TextInput,
  ImageBackground,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function HomePage() {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [isEmailValid, setIsEmailValid] = useState(true);
  const [logoClicks, setLogoClicks] = useState(0);

  const handleLogoClick = () => {
    setLogoClicks(prev => prev + 1);
  };

  // 验证邮箱格式
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 处理邮箱输入变化
  const handleEmailChange = (text: string) => {
    setEmail(text);
    setIsEmailValid(true); // 输入时重置验证状态
  };

  // 处理注册
  const handleSignUp = () => {
    if (!email || !validateEmail(email)) {
      setIsEmailValid(false);
      return;
    }
    // 后续可以添加更多注册逻辑
    // 注册成功后跳转到VideoAITransNative页面
    navigation.navigate('VideoAITransNative' as never);
  };

  // 处理登录
  const handleSignIn = () => {
    if (!email || !validateEmail(email)) {
      setIsEmailValid(false);
      return;
    }
    // 后续可以添加更多登录逻辑
    // 登录成功后跳转到VideoAITransNative页面
    navigation.navigate('VideoAITransNative' as never);
  };

  // 使用Google登录
  const handleGoogleSignIn = () => {
    // 后续可以添加Google登录逻辑
    // 登录成功后跳转到VideoAITransNative页面
    navigation.navigate('VideoAITransNative' as never);
  };

  // 处理Terms of Service链接
  const handleTermsPress = () => {
    // 这里可以跳转到服务条款页面或打开网页
    Linking.openURL('https://www.example.com/terms');
  };

  // 处理Privacy Policy链接
  const handlePrivacyPress = () => {
    // 这里可以跳转到隐私政策页面或打开网页
    Linking.openURL('https://www.example.com/privacy');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.pageContainer}>
          <View style={styles.container}>
            <TouchableOpacity onPress={handleLogoClick}>
            <Image
                source={logoClicks >= 5 ? require('../../images/cat_logo_2.png') : require('../../images/cat_logo.png')}
              style={styles.logo}
            />
            </TouchableOpacity>
            <Text style={styles.title}>Sign up on MeowTalker</Text>
            <Text style={styles.subtitle}>Translate your cats meows into emotions!</Text>
            
            {/* 邮箱输入框 */}
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, !isEmailValid && styles.inputError]}
                placeholder="Email"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={handleEmailChange}
              />
              {!isEmailValid && (
                <Text style={styles.errorText}>请输入有效的邮箱地址</Text>
              )}
            </View>
            
            {/* 登录注册按钮 */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.signInButton]}
                onPress={handleSignIn}
              >
                <Text style={styles.buttonText}>登录</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.signUpButton]}
                onPress={handleSignUp}
              >
                <Text style={styles.buttonText}>注册</Text>
              </TouchableOpacity>
            </View>
            
            {/* Google登录按钮 */}
            <TouchableOpacity
              style={[styles.button, styles.googleButton]}
              onPress={handleGoogleSignIn}
            >
              <Text style={styles.buttonText}>Sign in with Google</Text>
            </TouchableOpacity>
            
            {/* 底部链接 */}
            <View style={styles.footerLinks}>
              <TouchableOpacity onPress={handleTermsPress}>
                <Text style={styles.linkText}>Terms of Service</Text>
              </TouchableOpacity>
              <Text style={styles.linkSeparator}>|</Text>
              <TouchableOpacity onPress={handlePrivacyPress}>
                <Text style={styles.linkText}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>
          </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  pageContainer: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    justifyContent: 'center',
  },
  backgroundImageStyle: {
    opacity: 0.9,
  },
  container: {
    alignItems: 'center',
    padding: 20,
  },
  logo: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 30,
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 15,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    width: '100%',
  },
  inputError: {
    borderColor: 'red',
    borderWidth: 1,
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginTop: 5,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 15,
  },
  button: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  signInButton: {
    backgroundColor: '#3498db',
    flex: 1,
    marginRight: 5,
  },
  signUpButton: {
    backgroundColor: '#2ecc71',
    flex: 1,
    marginLeft: 5,
  },
  googleButton: {
    backgroundColor: '#fff',
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footerLinks: {
    flexDirection: 'row',
    marginTop: 30,
  },
  linkText: {
    color: '#fff',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  linkSeparator: {
    color: '#fff',
    marginHorizontal: 10,
  },
});
