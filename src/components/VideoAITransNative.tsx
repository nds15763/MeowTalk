import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  ImageBackground,
  Animated,
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
  PermissionResponse,
} from "expo-camera";
import { Audio } from "expo-av";
import { create } from "zustand";
import { SafeAreaView } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system";
import MeowDetector, {
  MeowDetectorRef,
  MeowDetectorState,
} from "../sdk/meowDetector";
import { AudioFeatures, AudioAnalysisResult } from "../sdk/audioTypes";
import { MoonShotService } from "../sdk/MoonShot";
import { MeowDetectorModule } from "../sdk/MeowDetectorModule";
import { emotions, emotionCategories } from "../config/emotions";
import { Emotion, EmotionCategory } from "../types/emotion";
// 导入图片压缩工具
import { compressImage, imageToBase64 } from "../utils/imageProcessor";

// 定义视频状态枚举
export enum VideoState {
  None = 0,
  Capturing = 1,
  Processing = 2,
  Error = 3,
  PermissionRequired = 4,
}

// 定义AI分析状态枚举
export enum AIAnalysisState {
  Idle = 0,
  Analyzing = 1,
  Done = 2,
}

// 视频上下文类型
type VideoContext = {
  message: string;
  timestamp: number;
  frameDataUrl?: string;
  is_meow?: boolean;
  most_likely_meaning?: string;
  emotions?: MeowEmotion[];
  rawResponse?: string; // 存储原始的JSON响应字符串
};

// 定义大模型接口类型
export interface MeowEmotion {
  emotion: string; // 表示的情感
  confidence: number; // 置信度，0-1范围
}

// 抽象的大模型调用服务
export interface MeowAIModelResponse {
  text?: string; // 机器翻译
  is_meow?: boolean; // 是否有猫叫
  emotions?: MeowEmotion[]; // 表情列表
  most_likely_meaning?: string; // 最可能的意思
}

// 创建视频状态存储
interface VideoStore {
  // 视频状态
  videoState: VideoState;
  // 错误信息
  errorMessage?: string;
  // AI分析状态
  aiState: AIAnalysisState;
  // 当前分析结果
  currentAnalysis?: string;
  // 分析历史
  analysisHistory: VideoContext[];
  // 是否正在处理帧
  isProcessingFrame: boolean;
  // 是否正在等待响应
  isWaitingResponse: boolean;
  // 添加分析结果
  addAnalysisResult: (result: VideoContext) => void;
  // 设置当前分析结果
  setCurrentAnalysis: (analysis: string) => void;
  // 设置视频状态
  setVideoState: (state: VideoState, errorMsg?: string) => void;
  // 设置AI状态
  setAIState: (state: AIAnalysisState) => void;
  // 设置是否正在处理帧
  setIsProcessingFrame: (isProcessing: boolean) => void;
  // 设置是否正在等待响应
  setIsWaitingResponse: (isWaiting: boolean) => void;
  // 重置状态
  reset: () => void;
}

const initialState: Omit<
  VideoStore,
  | "addAnalysisResult"
  | "setCurrentAnalysis"
  | "setVideoState"
  | "setAIState"
  | "setIsProcessingFrame"
  | "setIsWaitingResponse"
  | "reset"
> = {
  videoState: VideoState.None,
  aiState: AIAnalysisState.Idle,
  analysisHistory: [],
  isProcessingFrame: false,
  isWaitingResponse: false,
};

// 使用zustand创建状态管理
export const useVideoStore = create<VideoStore>((set) => ({
  ...initialState,
  // 添加分析结果
  addAnalysisResult: (result: VideoContext) => {
    set((state) => {
      // 添加新的结果
      const newHistory = [...state.analysisHistory, result];
      
      // 按照时间戳降序排列（最新的结果在最上面）
      newHistory.sort((a, b) => b.timestamp - a.timestamp);
      
      return {
        analysisHistory: newHistory,
      };
    });
  },
  // 设置当前分析结果
  setCurrentAnalysis: (analysis: string) => {
    set({ currentAnalysis: analysis });
  },
  // 设置视频状态
  setVideoState: (state: VideoState, errorMsg?: string) => {
    set({
      videoState: state,
      errorMessage: errorMsg,
    });
  },
  // 设置AI状态
  setAIState: (state: AIAnalysisState) => {
    set({ aiState: state });
  },
  // 设置是否正在处理帧
  setIsProcessingFrame: (isProcessing: boolean) => {
    set({ isProcessingFrame: isProcessing });
  },
  // 设置是否正在等待响应
  setIsWaitingResponse: (isWaiting: boolean) => {
    set({ isWaitingResponse: isWaiting });
  },
  // 重置状态
  reset: () => {
    set(initialState);
  },
}));

// 权限请求组件
const PermissionRequest: React.FC<{ onRequestPermission: () => void }> = ({
  onRequestPermission,
}) => {
  return (
    <View style={styles.permissionContainer}>
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>需要访问权限</Text>
        <Text style={styles.permissionText}>
          为了更好的体验，我们需要访问您的摄像头和麦克风权限
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={onRequestPermission}>
          <Text style={styles.buttonText}>授权访问</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// 视频组件
const VideoView: React.FC<{
  cameraRef: React.RefObject<CameraView>;
  hasPermission: boolean;
  onReady?: () => void; // 添加相机就绪回调
}> = ({ cameraRef, hasPermission, onReady }) => {
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [cameraReady, setCameraReady] = useState<boolean>(false);

  const handleCameraReady = useCallback(() => {
    console.log("摄像头已就绪");
    setCameraReady(true);
    setCameraLoading(false);
    // 调用onReady回调通知父组件
    if (onReady) {
      onReady();
    }
  }, [onReady]);

  // 监听权限变化
  useEffect(() => {
    if (hasPermission) {
      console.log("VideoView: 已获得摄像头权限");
    } else {
      console.log("VideoView: 未获得摄像头权限");
    }
  }, [hasPermission]);

  return (
    <View style={styles.cameraContainer}>
      {cameraLoading && (
        <View style={styles.cameraLoading}>
          <ActivityIndicator size="large" color="#333" />
          <Text style={styles.loadingText}>相机启动中...</Text>
        </View>
      )}
      <View style={styles.camera}>
        {hasPermission ? (
          <CameraView
            ref={cameraRef}
            style={{ width: "100%", height: "100%" }}
            facing="back"
            onCameraReady={handleCameraReady}
          />
        ) : (
          <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: "#000"}}>
            <Text style={{color: '#FFF', fontSize: 16, textAlign: 'center', padding: 10}}>
              需要摄像头权限才能预览
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

// 主组件
interface VideoProps {
  onExit?: () => void;
  navigation?: any; // 添加导航属性
}

const VideoAITransNative: React.FC<VideoProps> = ({ onExit, navigation }) => {
  // 现有状态
  const {
    videoState,
    aiState,
    analysisHistory,
    isProcessingFrame,
    isWaitingResponse,
    currentAnalysis,
    setVideoState,
    setAIState,
    setIsProcessingFrame,
    setIsWaitingResponse,
    setCurrentAnalysis,
    addAnalysisResult,
  } = useVideoStore();

  // 新增状态管理面板显示
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<EmotionCategory>(
    emotionCategories[0]
  );
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const panelAnimation = useRef(new Animated.Value(0)).current;

  // 相机相关状态
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] =
    useCameraPermissions();
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [cameraReady, setCameraReady] = useState<boolean>(false);
  const [cameraStarted, setCameraStarted] = useState<boolean>(false);

  // 用于存储猫叫检测的音频特征
  const [meowFeatures, setMeowFeatures] = useState<AudioFeatures | null>(null);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);

  // 保留原有的变量引用
  const cameraRef = useRef<CameraView | null>(null);
  const frameTimerRef = useRef<NodeJS.Timeout | null>(null);
  const meowDetectorRef = useRef<MeowDetectorRef | null>(null);
  const meowAIServiceRef = useRef<MoonShotService | null>(null);
  const meowDetectorModuleRef = useRef<MeowDetectorModule | null>(null);

  // 初始化AI服务
  useEffect(() => {
    meowAIServiceRef.current = new MoonShotService();

    // 初始化猫叫检测模块
    meowDetectorModuleRef.current = new MeowDetectorModule({
      audioProcessorConfig: {
        sampleRate: 44100,
        silenceThreshold: 0.02,
        minSilenceTime: 0.3,
        minProcessTime: 1.0,
        maxBufferTime: 5.0,
      },
      onStateChange: (state) => {
        console.log("猫叫检测模块状态改变:", state);
      },
      onMeowDetected: (result) => {
        console.log("猫叫检测回调触发，结果:", JSON.stringify(result));
        if (result.isMeow && result.features) {
          console.log(
            "检测到猫叫，特征数据:",
            result.features,
            "情感:",
            result.emotion
          );
          setMeowFeatures(result.features);

          // 在检测到猫叫时立即捕获一张图片
          console.log("准备捕获图片进行分析...");
          captureFrame(result.features);
        } else {
          console.log("未检测到猫叫或特征数据不完整");
        }
      },
      onError: (error) => {
        console.error("猫叫检测模块错误:", error);
      },
    });

    // 组件卸载时停止猫叫检测
    return () => {
      if (meowDetectorModuleRef.current) {
        meowDetectorModuleRef.current.stopListening();
      }
    };
  }, []);

  // 捕获图像并与音频特征一起发送到AI分析
  const captureFrame = async (audioFeatures: AudioFeatures) => {
    if (!cameraRef.current || !meowAIServiceRef.current) {
      console.error("相机或AI服务没有准备好");
      return;
    }

    try {
      useVideoStore.getState().setIsProcessingFrame(true);
      console.log("开始捕获图像...");

      // 捕获图像
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5, // 降低质量以减小文件大小
        base64: true, // 获取base64编码
        exif: false, // 不需要exif数据
        skipProcessing: true, // 跳过额外处理以加快速度
      });

      if (photo) {
        setCapturedImageUri(photo.uri);
        console.log(
          "照片已捕获，URI:",
          photo.uri,
          "大小:",
          photo.base64?.length || 0
        );

        // // 压缩图像
        // console.log("开始压缩图像...");
        // const compressedImageUri = await compressImage(photo.uri, 200, 200, 0.6);
        // console.log("图像压缩完成，URI:", compressedImageUri);

        // // 转换压缩后的图像为base64
        // const compressedBase64 = await imageToBase64(compressedImageUri);
        
        // if (!compressedBase64) {
        //   console.error("压缩图像转base64失败，将使用原始图像");
        // }
        
        // 使用压缩后的base64或原始base64
        const imageBase64 =  photo.base64;
        console.log("处理后图像大小:", imageBase64?.length || 0);

        // 如果有base64数据，发送到AI分析
        if (imageBase64 && meowAIServiceRef.current) {
          setAIState(AIAnalysisState.Analyzing);
          setIsWaitingResponse(true);
          console.log("开始发送图像到AI服务进行分析...");

          try {
            // 调用AI服务分析图像和音频特征
            const response =
              await meowAIServiceRef.current.analyzeImageWithAudio(
                imageBase64,
                audioFeatures
              );

            console.log("AI分析完成，返回结果:", JSON.stringify(response));
            
            // 处理返回结果
            if (response && response.text) {
              // 添加分析结果
              const analysisResult = {
                message: response.text,
                timestamp: Date.now(),
                frameDataUrl: `data:image/jpeg;base64,${imageBase64}`,
                is_meow: response.is_meow,
                most_likely_meaning: response.most_likely_meaning,
              };
              console.log("添加分析结果到历史记录:", JSON.stringify(analysisResult));
              
              // 只有当检测到猫叫时才添加到历史记录
              if (response.is_meow) {
                addAnalysisResult(analysisResult);
              } else {
                console.log("未检测到猫叫，不添加到历史记录");
              }
            } else {
              console.warn("AI服务返回结果不完整:", response);
            }
          } catch (error: any) {
            console.error("AI分析调用失败:", error);
          } finally {
            setIsWaitingResponse(false);
            setAIState(AIAnalysisState.Done);
          }
        }
      }
    } catch (error: any) {
      console.error("捕获图像失败:", error);
    } finally {
      useVideoStore.getState().setIsProcessingFrame(false);
    }
  };

  // 请求所有需要的权限
  const requestPermissions = async () => {
    try {
      // 请求相机权限
      await requestCameraPermission();
      // 需要等待相机权限状态更新
      await new Promise<void>((resolve) => setTimeout(resolve, 500));

      // 检查相机权限状态
      const cameraStatus = cameraPermission?.granted ? "granted" : "denied";
      console.log("相机权限状态:", cameraStatus);

      // 请求麦克风权限
      const { status: audioStatus } = await Audio.requestPermissionsAsync();
      console.log("麦克风权限状态:", audioStatus);

      // 如果相机和麦克风权限已获得，则可以继续
      if (cameraStatus === "granted" && audioStatus === "granted") {
        return true;
      } else {
        console.error(
          "未获取到必要权限，相机:",
          cameraStatus,
          "麦克风:",
          audioStatus
        );
        useVideoStore
          .getState()
          .setVideoState(VideoState.Error, "需要相机和麦克风权限才能继续");
        return false;
      }
    } catch (error: any) {
      console.error("请求权限失败:", error);
      useVideoStore.getState().setVideoState(VideoState.Error, "权限请求失败");
      return false;
    }
  };

  // 开始通话/录制
  const handleStartCall = async () => {
    // 检查权限
    if (!cameraPermission?.granted) {
     // 没权限就返回报错 TODO
     return;
    }
    
    // 更新状态为录制中
    useVideoStore.getState().setVideoState(VideoState.Capturing);
    
    // 启动猫叫检测模块
    if (meowDetectorModuleRef.current) {
      meowDetectorModuleRef.current.startListening();
    }
  };

  // 结束通话/录制
  const handleEndCall = async () => {
    // 停止猫叫检测模块
    if (meowDetectorModuleRef.current) {
      meowDetectorModuleRef.current.stopListening();
    }

    // 重置状态
    useVideoStore.getState().reset();

    // 如果有导航对象，导航回首页
    if (navigation) {
      navigation.navigate("Home");
    }
    // 否则使用onExit回调
    else if (onExit) {
      onExit();
    }
  };


  // 启动相机处理函数
  const handleStartCamera = async () => {
    console.log('请求授权摄像头和录音权限...');
    
    // 如果已经有权限，直接启动相机
    if (cameraPermission?.granted && !cameraStarted) {
      console.log('权限已获取，正在启动相机...');
      setCameraLoading(true);
      setCameraStarted(true);
      
      // 超时处理，5秒后自动结束相机启动
      setTimeout(() => {
        if (cameraLoading) {
          console.log('相机启动超时，自动结束启动');
          setCameraReady(true);
          setCameraLoading(false);
          // 相机就绪事件会在VideoView组件中处理启动猫叫检测
        }
      }, 5000); // 5秒超时
    } else if (!cameraPermission?.granted) {
      // 没有权限，先请求权限
      console.log('没有权限，请求授权...');
      const hasAllPermissions = await requestPermissions();
      
      // 如果获得了权限，自动启动相机
      if (hasAllPermissions && !cameraStarted) {
        console.log('权限获取成功，正在启动相机...');
        setCameraLoading(true);
        setCameraStarted(true);
        
        // 超时处理
        setTimeout(() => {
          if (cameraLoading) {
            console.log('相机启动超时，自动结束启动');
            setCameraReady(true);
            setCameraLoading(false);
            // 相机就绪事件会在VideoView组件中处理启动猫叫检测
          }
        }, 5000);
      } else {
        console.log('权限获取失败');
      }
    }
  };
  // 渲染相机内容的函数
  const renderCameraContent = () => {
    // 相机未启动，显示占位符
    if (!cameraStarted) {
      // 不管有没有权限，都显示相机区域（无权限时用黑色遮盖）
      return (
        <TouchableOpacity
          style={styles.cameraPlaceholder}
          onPress={handleStartCamera}
        >
          <View style={styles.cameraIconContainer}>
            <Text style={styles.cameraIcon}>📷</Text>
            {cameraPermission?.granted && microphonePermission?.granted ? (
              <Text style={styles.cameraPlaceholderText}>点击开启摄像和录音</Text>
            ) : (
              <>
                <Text style={styles.cameraPlaceholderText}>需要摄像和录音权限</Text>
                <Text style={styles.loadingText}>点击请求权限</Text>
              </>
            )}
          </View>
        </TouchableOpacity>
      );
    }

    // 相机已启动，使用 VideoView 组件渲染相机
    return (
      <View style={{ flex: 1 }}>
        <VideoView
          cameraRef={cameraRef}
          hasPermission={cameraPermission?.granted || false}
          onReady={() => {
            console.log("相机已就绪，准备启动猫叫检测");
            setCameraReady(true);
            
            // 启动猫叫检测
            if (meowDetectorModuleRef.current) {
              console.log('启动猫叫声检测...');
              meowDetectorModuleRef.current.startListening();
            }
          }}
        />
      </View>
    );
  };

  // 面板切换函数
  const togglePanel = () => {
    if (isPanelVisible) {
      // 收起面板
      Animated.timing(panelAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start(() => setIsPanelVisible(false));
    } else {
      // 显示面板
      setIsPanelVisible(true);
      Animated.timing(panelAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  };

  // 处理点击面板外部区域
  const handleOutsidePress = () => {
    if (isPanelVisible) {
      togglePanel();
    }
  };

  // 播放猫叫声音函数
  async function playSound(audioFile: any) {
    try {
      // 如果有正在播放的音频，先停止并卸载
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(audioFile, {
        shouldPlay: true,
        volume: 1.0,
      });

      // 监听播放完成事件
      newSound.setOnPlaybackStatusUpdate(async (status: any) => {
        if (status.didJustFinish) {
          // 播放结束后自动卸载
          await newSound.unloadAsync();
          setSound(null);
        }
      });

      setSound(newSound);
    } catch (error) {
      console.error("播放音频失败:", error);
    }
  }

  // 选择情感类别处理函数
  const handleCategorySelect = (category: EmotionCategory) => {
    setSelectedCategory(category);
    setSelectedEmotion(null);
  };

  // 选择情感处理函数
  const handleEmotionSelect = (emotion: Emotion) => {
    setSelectedEmotion(emotion);
    if (emotion.audioFiles && emotion.audioFiles.length > 0) {
      // 随机选择一个音频文件播放
      const randomIndex = Math.floor(Math.random() * emotion.audioFiles.length);
      playSound(emotion.audioFiles[randomIndex]);
    }
  };

  // 获取面板高度
  const panelHeight = panelAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, windowHeight * 0.6], // 面板高度为屏幕的60%
  });

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (analysisHistory.length > 0 && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }, 100);
    }
  }, [analysisHistory.length]);

  return (
    <View style={styles.rootContainer}>
      <SafeAreaView style={styles.container}>
        <ImageBackground
          source={require("../../images/homeback.png")}
          style={styles.backgroundImage}
          imageStyle={styles.backgroundImageStyle}
          onError={(e) =>
            console.error("背景图片加载错误:", e.nativeEvent.error)
          }
        >
          <View style={styles.videoContainer}>{renderCameraContent()}</View>
          
          {/* 分析结果显示 */}
          {/* {analysisHistory.length > 0 ? (
            <View style={styles.resultContainer}>
              <Text style={styles.resultTitle}>分析结果</Text>
              <Text style={styles.resultText}>
                {analysisHistory[analysisHistory.length - 1].most_likely_meaning || '正在分析猫叫的意义...'}
              </Text>
            </View>
          ) : (
            <View style={styles.noResultContainer}>
              <Text style={styles.noResultText}>等待猫叫...</Text>
            </View>
          )} */}
          
          {/* 聊天对话框 */}
          <ScrollView 
            ref={scrollViewRef}
            style={styles.chatBubbleContainer}
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={true}
          >
            {analysisHistory.length > 0 ? (
              [...analysisHistory].map((result, index) => {
                // 根据索引决定背景色，最新的应该是索引0
                let backgroundColor = 'white';
                if (index === 0) {
                  backgroundColor = '#A864af'; // 最新的一条使用指定颜色
                } else if (index === 1) {
                  backgroundColor = '#C08BC7'; // 第二条消息颜色淡一些
                } else if (index === 2) {
                  backgroundColor = '#D7B2DF'; // 第三条消息颜色更淡
                }
                
                return (
                  <View key={index} style={[styles.chatBubble, { backgroundColor }]}>
                    <Text style={styles.bubbleTitle}>
                      分析结果{index === 1 ? ' Latest' : ''}
                    </Text>
                    <Text style={styles.bubbleText}>
                      {result.most_likely_meaning || '正在分析猫叫的意义...'}
                    </Text>
                  </View>
                );
              })
            ) : (
              <View style={styles.noChatContainer}>
                <Text style={styles.noChatText}>等待猫叫...</Text>
              </View>
            )}
          </ScrollView>
          
          {/* 情感选择面板触发按钮，始终显示在右下角 */}
          <TouchableOpacity
            style={styles.emotionPanelButton}
            onPress={togglePanel}
          >
            <Text style={styles.emotionPanelButtonText}>😺</Text>
          </TouchableOpacity>
          
          {/* 情感选择滑动面板 */}
          {isPanelVisible && (
            <>
              <TouchableOpacity
                style={styles.panelOverlay}
                activeOpacity={1}
                onPress={handleOutsidePress}
              />
              <Animated.View
                style={[styles.emotionPanel, { height: panelHeight }]}
              >
                <View style={styles.tabContainer}>
                  {emotionCategories.map((category) => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.tabButton,
                        selectedCategory.id === category.id &&
                          styles.selectedTab,
                      ]}
                      onPress={() => handleCategorySelect(category)}
                    >
                      <Text style={styles.tabTitle}>{category.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.scrollViewContainer}>
                  <ScrollView contentContainerStyle={styles.emotionsContainer}>
                    <View style={styles.gridContainer}>
                      {emotions
                        .filter(
                          (emotion) =>
                            emotion.categoryId === selectedCategory.id
                        )
                        .map((emotion) => (
                          <TouchableOpacity
                            key={emotion.id}
                            style={[
                              styles.emotionButton,
                              selectedEmotion?.id === emotion.id &&
                                styles.selectedEmotion,
                            ]}
                            onPress={() => handleEmotionSelect(emotion)}
                          >
                            <View style={styles.emotionContent}>
                              <Text style={styles.emotionIcon}>
                                {emotion.icon}
                              </Text>
                              <Text style={styles.emotionTitle}>
                                {emotion.title}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                    </View>
                  </ScrollView>
                </View>

                {selectedEmotion && (
                  <View style={styles.descriptionContainer}>
                    <Text style={styles.descriptionText}>
                      {selectedEmotion.description}
                    </Text>
                  </View>
                )}
              </Animated.View>
            </>
          )}
        </ImageBackground>
      </SafeAreaView>
    </View>
  );
};

// 样式定义
const windowWidth = Dimensions.get("window").width;
const windowHeight = Dimensions.get("window").height;

// 共享样式
const baseResultContainerStyle = {
  position: "absolute" as "absolute",
  bottom: 0,
  left: 0,
  right: 0,
  padding: 15,
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: -3 },
  shadowOpacity: 0.1,
  shadowRadius: 5,
  elevation: 5,
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: "#ef7c8e", // 背景色
  },
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%", // 背景图片大小
  },
  backgroundImageStyle: {
    width: "100%",
    height: "100%",
    resizeMode: "cover", // 背景图片缩放模式
    opacity: 0.5, // 背景图片透明度
  },
  container: {
    flex: 1,
    backgroundColor: "#ef7c8e",
  },
  header: {
    height: 50,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 18,
  },
  closeButton: {
    position: "absolute",
    right: 15,
    top: 15,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: -1,
  },
  closeIcon: {
    color: "#FFFFFF",
    fontSize: 18,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    position: "relative",
  },
  cameraArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    height: windowHeight * 0.7,
  },
  cameraSection: {
    height: windowHeight * 0.5,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
  },
  videoContainer: {
    width: windowWidth * 0.85,
    height: windowWidth * 0.85,
    borderRadius: windowWidth * 0.25,
    overflow: "hidden",
    backgroundColor: "#333",
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    top: windowHeight * 0.04,
    borderWidth: 3,
    borderColor: "#FF6B95",
  },
  cameraContainer: {
    width: windowWidth * 0.85,
    height: windowWidth * 0.85,
    borderRadius: windowWidth * 0.25,
    overflow: "hidden",
    backgroundColor: "#333",
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FF6B95",
  },
  camera: {
    width: "100%",
    height: "100%",
  },
  cameraLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    zIndex: 1,
    borderRadius: windowWidth * 0.25,
  },
  loadingText: {
    color: "#FFFFFF",
    fontSize: 16,
    marginTop: 10,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 20,
    textAlign: "center",
  },
  permissionText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 30,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: "#FF6B95",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  buttonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  controlsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 25,
    paddingHorizontal: 20,
    position: "relative",
    zIndex: 10,
    backgroundColor: "transparent",
    marginBottom: 0,
  },
  peakContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    overflow: "hidden",
    zIndex: 5,
    backgroundColor: "#FFF",
  },
  peakContent: {
    height: 40,
    overflow: "hidden",
  },
  peakShape: {
    position: "absolute",
    top: -35,
    left: windowWidth / 2 - 35,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#000",
  },
  callButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#FF6B95",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 15,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    marginBottom: 5,
  },
  endCallButton: {
    backgroundColor: "#FF3737",
  },
  aiResponseOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    padding: 15,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  aiResponseTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  aiResponseScroll: {
    maxHeight: 200,
  },
  aiResponseText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  processingIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    padding: 10,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  processingText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 10,
  },
  aiStatusSection: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    padding: 10,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  aiAnalyzing: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  aiStatusText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 10,
  },
  resultSection: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  analysisScroll: {
    maxHeight: windowHeight * 0.3,
  },
  analysisItem: {
    marginBottom: 20,
  },
  analysisHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  analysisTime: {
    fontSize: 14,
    color: "#666",
  },
  analysisText: {
    fontSize: 16,
    color: "#333",
  },
  analysisImage: {
    width: "100%",
    height: 150,
    borderRadius: 10,
    marginBottom: 10,
  },
  noResultText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  crossImage: {
    width: windowWidth,
    height: windowHeight,
    resizeMode: "contain",
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 0, // 背景图片在其他元素的下面
    opacity: 0.8, // 背景图片透明度
  },
  /* 聊天对话框样式 */
  chatBubbleContainer: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    maxHeight: windowHeight * 0.5,
    overflow: 'scroll',
  },
  chatBubble: {
    maxWidth: '70%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 15,
    marginBottom: 10,
    elevation: 3,  // Android阴影
    shadowColor: '#000',  // iOS阴影
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  bubbleTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  bubbleText: {
    fontSize: 16,
    color: '#333',
    flexWrap: 'wrap',
  },
  noChatContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    marginTop: 10,
  },
  noChatText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  /* 情感选择面板触发按钮样式 */
  emotionPanelButton: {
    position: "absolute",
    bottom: 30,
    right: 30,
    width: 65,
    height: 65,
    borderRadius: 37.5,
    backgroundColor: "#A864AF",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  emotionPanelButtonText: {
    fontSize: 24,
  },
  /* 情感选择滑动面板样式 */
  emotionPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFF",
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    paddingTop: 10,
    paddingBottom: 20,
    zIndex: 25,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  tabContainer: {
    flexDirection: "row",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    paddingHorizontal: 10,
    width: "100%",
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: "25%",
    alignItems: "center",
  },
  selectedTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#EF7C8E",
  },
  tabTitle: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
  },
  scrollViewContainer: {
    flex: 1,
    width: "100%",
  },
  emotionsContainer: {
    flexGrow: 1,
    width: "100%",
    paddingVertical: 8,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: 8,
    paddingHorizontal: 16,
  },
  emotionButton: {
    width: (windowWidth - 32 - 16) / 3, // 每个情感按钮的宽度
    aspectRatio: 1,
    backgroundColor: "#FFE8E8",
    borderRadius: 12,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  emotionContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedEmotion: {
    backgroundColor: "#A864AF",
    transform: [{ scale: 1.05 }],
  },
  emotionIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  emotionTitle: {
    color: "#333",
    fontSize: 12,
    textAlign: "center",
    fontWeight: "500",
  },
  descriptionContainer: {
    padding: 15,
    alignItems: "center",
  },
  descriptionText: {
    fontSize: 14,
    textAlign: "center",
  },
  panelOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
    zIndex: 20,
  },
  cameraPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 15,
  },
  cameraIconContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  cameraIcon: {
    fontSize: 50,
    marginBottom: 15,
    color: "#666",
  },
  cameraPlaceholderText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  selectedEmotionContainer: {
    padding: 15,
    alignItems: "center",
  },
  selectedEmotionTitle: {
    fontSize: 16,
    color: "#333",
    marginBottom: 10,
  },
  playButton: {
    backgroundColor: "#FF6B95",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 15,
  },
  playButtonText: {
    fontSize: 14,
    color: "#FFF",
  },
  baseResultContainer: baseResultContainerStyle,
  resultContainer: {
    ...baseResultContainerStyle,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  resultText: {
    fontSize: 16,
    color: "#333",
  },
  noResultContainer: {
    ...baseResultContainerStyle,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
  },
  debugInfo: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    marginBottom: 5,
  },
});

export default VideoAITransNative;
