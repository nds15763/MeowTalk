import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, Dimensions, ActivityIndicator, ScrollView } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import { create } from 'zustand';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AliBaiLianSDK, BaiLianResponse } from '../sdk';
import MeowDetector from '../sdk/meowDetector';
import { AudioFeatures } from '../sdk/audioTypes';

// 定义视频状态枚举
export enum VideoState {
  None = 0,
  Capturing = 1,
  Processing = 2,
  Error = 3,
  PermissionRequired = 4
}

// 定义AI分析状态枚举
export enum AIAnalysisState {
  Idle = 0,
  Analyzing = 1,
  Done = 2
}

// 视频帧类型
type VideoFrame = {
  width: number;
  height: number;
  data: Uint8Array;
  timestamp: number;
};

// 视频上下文类型
type VideoContext = {
  message: string;
  timestamp: number;
  frameDataUrl?: string;
};

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

const initialState: Omit<VideoStore, 'addAnalysisResult' | 'setCurrentAnalysis' | 'setVideoState' | 'setAIState' | 'setIsProcessingFrame' | 'setIsWaitingResponse' | 'reset'> = {
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
    set((state) => ({
      analysisHistory: [...state.analysisHistory, result]
    }));
  },
  // 设置当前分析结果
  setCurrentAnalysis: (analysis: string) => {
    set({ currentAnalysis: analysis });
  },
  // 设置视频状态
  setVideoState: (state: VideoState, errorMsg?: string) => {
    set({
      videoState: state,
      errorMessage: errorMsg
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
const PermissionRequest: React.FC<{ onRequestPermission: () => void }> = ({ onRequestPermission }) => {
  return (
    <View style={styles.permissionContainer}>
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>需要访问权限</Text>
        <Text style={styles.permissionText}>为了更好的体验，我们需要访问您的摄像头和麦克风权限</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={onRequestPermission}>
          <Text style={styles.buttonText}>授权访问</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// 视频组件
const VideoView: React.FC = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      const cameraPermission = await requestPermission();
      setHasPermission(cameraPermission.granted);
    })();
  }, []);

  const handleCameraReady = () => {
    setCameraReady(true);
    setCameraLoading(false);
  };

  if (hasPermission === null) {
    return (
      <View style={styles.videoContainer}>
        <Text style={styles.loadingText}>请求摄像头权限...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.videoContainer}>
        <Text style={styles.loadingText}>没有摄像头权限</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.videoContainer}>
      {cameraLoading && (
        <View style={styles.cameraLoading}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>启动摄像头...</Text>
        </View>
      )}
      <View style={styles.cameraCircle}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
          onCameraReady={handleCameraReady}
        />
      </View>
    </View>
  );
};

// 主组件
interface VideoProps {
  onExit?: () => void;
}

const VideoAITransNative: React.FC<VideoProps> = ({ onExit }) => {
  const [hasPermissions, setHasPermissions] = useState(false);
  const videoState = useVideoStore((state: VideoStore) => state.videoState);
  const aiState = useVideoStore((state: VideoStore) => state.aiState);
  const currentAnalysis = useVideoStore((state: VideoStore) => state.currentAnalysis);
  const isProcessingFrame = useVideoStore((state: VideoStore) => state.isProcessingFrame);
  const isWaitingResponse = useVideoStore((state: VideoStore) => state.isWaitingResponse);
  const analysisHistory = useVideoStore((state: VideoStore) => state.analysisHistory);
  const setVideoState = useVideoStore((state: VideoStore) => state.setVideoState);
  const setAIState = useVideoStore((state: VideoStore) => state.setAIState);
  const setIsWaitingResponse = useVideoStore((state: VideoStore) => state.setIsWaitingResponse);
  const addAnalysisResult = useVideoStore((state: VideoStore) => state.addAnalysisResult);
  const reset = useVideoStore((state: VideoStore) => state.reset);
  
  // 用于存储猫叫检测的音频特征
  const [meowFeatures, setMeowFeatures] = useState<AudioFeatures | null>(null);
  
  // 保留原有的变量引用
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const frameTimerRef = useRef<NodeJS.Timeout | null>(null);
  const baiLianSDKRef = useRef<AliBaiLianSDK | null>(null);
  
  // 初始化百炼SDK
  useEffect(() => {
    baiLianSDKRef.current = new AliBaiLianSDK({
      appId: '你的百炼AppID',
      apiKey: '你的百炼ApiKey',
    });
  }, []);
  
  // 处理猫叫检测结果的回调函数
  const handleMeowDetected = useCallback((isMeow: boolean, features?: AudioFeatures) => {
    if (isMeow && features) {
      console.log('检测到猫叫声，特征数据:', features);
      setMeowFeatures(features);
      
      // 将特征数据转换为字符串，以便在提示词中使用
      const featuresStr = JSON.stringify(features, null, 2);
      
      // 构建提示词并调用百炼SDK
      const promptText = `检测到猫叫声，音频特征分析结果如下：${featuresStr}\n请分析这只猫咪可能在表达什么？`;
      
      // 设置为分析状态
      setAIState(AIAnalysisState.Analyzing);
      setIsWaitingResponse(true);
      
      // 调用百炼SDK
      if (baiLianSDKRef.current) {
        baiLianSDKRef.current.sendTextMessage(promptText)
          .then((response: BaiLianResponse) => {
            // 处理返回结果
            if (response && response.output && response.output.text) {
              // 添加分析结果
              addAnalysisResult({
                message: response.output.text,
                timestamp: Date.now()
              });
            }
            setIsWaitingResponse(false);
            setAIState(AIAnalysisState.Done);
          })
          .catch((error) => {
            console.error('百炼API调用失败:', error);
            setIsWaitingResponse(false);
            setAIState(AIAnalysisState.Idle);
          });
      }
    }
  }, [addAnalysisResult, setAIState, setIsWaitingResponse]);

  // 请求相机和麦克风权限
  const requestPermissions = async () => {
    try {
      const cameraResult = await requestCameraPermission();
      const audioResult = await Audio.requestPermissionsAsync();
      
      if (cameraResult.granted && audioResult.status === 'granted') {
        setHasPermissions(true);
      } else {
        // 权限被拒绝
        useVideoStore.getState().setVideoState(VideoState.Error, '需要摄像头和麦克风权限才能继续');
      }
    } catch (error) {
      console.error('权限请求错误:', error);
      useVideoStore.getState().setVideoState(VideoState.Error, '权限请求失败');
    }
  };

  // 开始视频分析
  const startVideoAnalysis = useCallback(() => {
    // 清除旧的定时器
    if (frameTimerRef.current) {
      clearInterval(frameTimerRef.current);
    }
    
    // 设置新的定时器，每3秒捕获一帧
    frameTimerRef.current = setInterval(() => {
      if (!isProcessingFrame && !isWaitingResponse) {
        // 设置正在处理帧
        useVideoStore.getState().setIsProcessingFrame(true);
        // 捕获视频帧
        captureFrame();
      }
    }, 3000); // 3秒捕获一次
  }, [isProcessingFrame, isWaitingResponse]);
  
  // 停止视频分析
  const stopVideoAnalysis = useCallback(() => {
    if (frameTimerRef.current) {
      clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
  }, []);
  
  // 当组件挂载或通话连接状态改变时，启动视频分析
  useEffect(() => {
    if (videoState === VideoState.Capturing && hasPermissions) {
      startVideoAnalysis();
    } else {
      stopVideoAnalysis();
    }
    
    return () => {
      stopVideoAnalysis();
    };
  }, [videoState, hasPermissions, startVideoAnalysis, stopVideoAnalysis]);
  
  // 开始通话
  const handleStartCall = async () => {
    // 检查权限
    if (!hasPermissions) {
      useVideoStore.getState().setVideoState(VideoState.PermissionRequired);
      return;
    }
    
    // 更新状态为连接中
    useVideoStore.getState().setVideoState(VideoState.Capturing);
  };
  
  // 结束通话
  const handleEndCall = async () => {
    // 重置状态
    useVideoStore.getState().reset();
    
    // 退出
    if (onExit) {
      onExit();
    }
  };
  
  // 视频帧捕获
  const captureFrame = async () => {
    if (!cameraRef.current) return;
    
    try {
      const frame = await cameraRef.current.takePictureAsync();
      
      if (frame) {
        const base64Image = await convertImageToBase64(frame);
        
        if (base64Image) {
          // 发送视频帧到AI分析
          sendFrameToAI(base64Image);
        }
      }
    } catch (error) {
      console.error('视频帧捕获错误:', error);
    }
  };
  
  // 转换图片为base64
  const convertImageToBase64 = async (image: any) => {
    try {
      const base64Image = await image.base64;
      
      return base64Image;
    } catch (error) {
      console.error('图片转换错误:', error);
      return null;
    }
  };
  
  // 发送视频帧到AI分析
  const sendFrameToAI = async (base64Image: string) => {
    if (!baiLianSDKRef.current) return;
    
    try {
      // 构建提示词，描述当前画面
      const prompt = `这是一个来自摄像头的视频帧图像。请分析这个图像中是否有猫咪，如果有，请描述猫咪的外貌、姿态和可能的情绪状态。如果没有猫咪，请简单描述图像中的内容。`;
      
      // 创建图片URL列表
      const imageUrls = [`data:image/jpeg;base64,${base64Image}`];
      
      // 使用百度链SDK发送图片消息
      const response = await baiLianSDKRef.current.sendImageMessage(prompt, imageUrls);
      
      if (response) {
        // 处理AI分析响应
        handleAIResponse(response);
      }
    } catch (error) {
      console.error('发送视频帧错误:', error);
    } finally {
      useVideoStore.getState().setIsProcessingFrame(false);
    }
  };
  
  // 处理AI分析响应
  const handleAIResponse = (response: BaiLianResponse) => {
    try {
      // 获取响应文本
      const responseText = response.output?.text || '无法获取分析结果';
      
      // 更新视频上下文
      const videoContext: VideoContext = {
        message: responseText,
        timestamp: Date.now(),
        // 我们没有frameDataUrl，因为响应中不包含这个
      };
      
      useVideoStore.getState().addAnalysisResult(videoContext);
      
      // 更新当前分析结果
      useVideoStore.getState().setCurrentAnalysis(responseText);
      
      // 更新是否正在等待响应
      useVideoStore.getState().setIsWaitingResponse(false);
    } catch (error) {
      console.error('处理AI分析响应错误:', error);
    }
  };
  
  // 根据权限和通话状态渲染不同内容
  const renderContent = () => {
    // 需要请求权限
    if (videoState === VideoState.PermissionRequired || !hasPermissions) {
      return <PermissionRequest onRequestPermission={requestPermissions} />
    }
    
    // 已连接状态显示视频界面
    if (videoState === VideoState.Capturing) {
      return (
        <View style={styles.contentContainer}>
          <View style={styles.cameraSection}>
            <VideoView />
            
            {/* 猫叫检测器组件 */}
            <View style={styles.meowDetectorContainer}>
              <MeowDetector 
                onMeowDetected={handleMeowDetected}
                baiLianConfig={{
                  appId: '你的百炼AppID',
                  apiKey: '你的百炼ApiKey'
                }}
              />
            </View>
            
            {/* AI分析状态区域 */}
            <View style={styles.aiStatusSection}>
              {aiState === AIAnalysisState.Analyzing && (
                <View style={styles.aiAnalyzing}>
                  <ActivityIndicator size="small" color="#FF6B95" />
                  <Text style={styles.aiStatusText}>小猫咪在说什么呢...</Text>
                </View>
              )}
              
              {isWaitingResponse && (
                <ActivityIndicator size="small" color="#FF6B95" />
              )}
            </View>
          </View>

          <View style={styles.resultSection}>
            <Text style={styles.sectionTitle}>分析结果</Text>
            <ScrollView style={styles.analysisScroll}>
              {analysisHistory.length === 0 ? (
                <Text style={styles.noResultText}>等待检测到猫叫声...</Text>
              ) : (
                analysisHistory.map((item, index) => (
                  <View key={index} style={styles.analysisItem}>
                    <View style={styles.analysisHeader}>
                      <Text style={styles.analysisTime}>
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </Text>
                    </View>
                    <Text style={styles.analysisText}>{item.message}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      );
    }
    
    // 其他状态显示连接界面
    return <View />;
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>喵语翻译</Text>
        <TouchableOpacity style={styles.closeButton} onPress={handleEndCall}>
          <Text style={styles.closeIcon}>×</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        {renderContent()}
      </View>
      
      <View style={styles.controlsContainer}>
        <TouchableOpacity style={styles.callButton} onPress={handleStartCall}>
          <Text style={{fontSize: 20, color: '#FFF'}}>开始通话</Text>
        </TouchableOpacity>
        
        {/* 猫叫检测器组件 */}
        <View style={styles.meowDetectorContainer}>
          <MeowDetector 
            onMeowDetected={handleMeowDetected}
            baiLianConfig={{
              appId: '你的百炼AppID',
              apiKey: '你的百炼ApiKey'
            }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

// 样式定义
const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    height: 60,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF6B95',
    position: 'relative',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  closeButton: {
    position: 'absolute',
    right: 15,
    top: 15,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    position: 'relative',
  },
  cameraSection: {
    height: windowHeight * 0.4,
    justifyContent: 'center',
    alignItems: 'center', 
    backgroundColor: '#F0F0F0',
    paddingVertical: 10,
  },
  videoContainer: {
    width: windowWidth * 0.5, 
    height: windowWidth * 0.5, 
    borderRadius: windowWidth * 0.25, 
    overflow: 'hidden', 
    backgroundColor: '#333', 
    alignSelf: 'center', 
    marginVertical: 20, 
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraCircle: {
    width: '100%',
    height: '100%',
    borderRadius: windowWidth * 0.25, 
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FF6B95', 
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  cameraLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1,
    borderRadius: windowWidth * 0.25, 
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 10,
  },
  meowDetectorContainer: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: '#FF6B95',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    position: 'relative',
  },
  callButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF6B95',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiResponseOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 15,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  aiResponseTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  aiResponseScroll: {
    maxHeight: 200,
  },
  aiResponseText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  processingIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 10,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
  },
  aiStatusSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 10,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  aiAnalyzing: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiStatusText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
  },
  resultSection: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  analysisScroll: {
    maxHeight: windowHeight * 0.3,
  },
  analysisItem: {
    marginBottom: 20,
  },
  analysisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  analysisTime: {
    fontSize: 14,
    color: '#666',
  },
  analysisText: {
    fontSize: 16,
    color: '#333',
  },
  noResultText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default VideoAITransNative;
