import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, Dimensions, ActivityIndicator, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions, PermissionResponse } from 'expo-camera';
import { Audio } from 'expo-av';
import { create } from 'zustand';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import MeowDetector, { MeowDetectorRef, MeowDetectorState } from '../sdk/meowDetector';
import { AudioFeatures } from '../sdk/audioTypes';
import { MoonShotService } from '../sdk/MoonShot';

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

// 定义大模型接口类型
export interface MeowAIModelResponse {
  text: string;
}

// 抽象的大模型调用服务
class MeowAIService {
  async analyzeImageWithContext(imageBase64: string, audioFeatures: AudioFeatures): Promise<MeowAIModelResponse> {
    // 这里是大模型调用的抽象实现，未来会被真实实现替换
    console.log('调用大模型分析图像和音频特征，图像大小:', imageBase64.length, '音频特征:', JSON.stringify(audioFeatures));
    
    // 模拟大模型分析结果
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          text: `分析结果: 这只猫咪可能在表达${Math.random() < 0.5 ? '饥饿' : '想要关注'}。它的音频特征显示声音频率为${audioFeatures.FundamentalFreq.toFixed(1)}Hz，持续时间为${audioFeatures.Duration.toFixed(2)}秒。`
        });
      }, 1000);
    });
  }
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
const VideoView: React.FC<{cameraRef: React.RefObject<CameraView>, hasPermission: boolean}> = ({ cameraRef, hasPermission }) => {
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(true);
  
  // 监听摄像头状态
  const handleCameraReady = useCallback(() => {
    console.log('摄像头已就绪');
    setCameraReady(true);
    setCameraLoading(false);
  }, []);

  // 监听权限变化
  useEffect(() => {
    if (hasPermission) {
      console.log('VideoView: 已获得摄像头权限');
    } else {
      console.log('VideoView: 未获得摄像头权限');
    }
  }, [hasPermission]);

  if (!hasPermission) {
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
          <ActivityIndicator size="large" color="#333" />
          <Text style={styles.loadingText}>相机启动中...</Text>
        </View>
      )}
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={{ width: '100%', height: '100%' }}
          facing="back"
          onCameraReady={() => {
            console.log('相机已就绪');
            setCameraReady(true);
            setCameraLoading(false);
            handleCameraReady();
          }}
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
  
  // 相机权限钩子 - 在组件顶层使用
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  
  // 用于存储猫叫检测的音频特征
  const [meowFeatures, setMeowFeatures] = useState<AudioFeatures | null>(null);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  
  // 保留原有的变量引用
  const cameraRef = useRef<CameraView | null>(null);
  const frameTimerRef = useRef<NodeJS.Timeout | null>(null);
  const meowDetectorRef = useRef<MeowDetectorRef | null>(null);
  const meowAIServiceRef = useRef<MoonShotService | null>(null);
  
  // 初始化AI服务
  useEffect(() => {
    meowAIServiceRef.current = new MoonShotService();
  }, []);
  
  // 处理猫叫检测结果的回调函数
  const handleMeowDetected = useCallback(async (isMeow: boolean, features?: AudioFeatures, confidence?: number) => {
    console.log('未检测到猫叫声');
    if (isMeow && features) {
      console.log('检测到猫叫声，特征数据:', features, '可信度:', confidence);
      setMeowFeatures(features);
      
      // 在检测到猫叫时立即捕获一张图片
      await captureImage(features);
    }
  }, []);

  // 捕获图像并与音频特征一起发送到AI分析
  const captureImage = async (audioFeatures: AudioFeatures) => {
    if (!cameraRef.current) {
      console.error('相机未就绪');
      return;
    }
    
    try {
      useVideoStore.getState().setIsProcessingFrame(true);
      
      // 捕获图像
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5, // 降低质量以减小文件大小
        base64: true, // 获取base64编码
        exif: false, // 不需要exif数据
        skipProcessing: true // 跳过额外处理以加快速度
      });
      
      if (photo) {
        setCapturedImageUri(photo.uri);
        console.log('照片已捕获，URI:', photo.uri, '大小:', photo.base64?.length || 0);
        
        // 如果有base64数据，发送到AI分析
        if (photo.base64 && meowAIServiceRef.current) {
          setAIState(AIAnalysisState.Analyzing);
          setIsWaitingResponse(true);
          
          try {
            // 调用AI服务分析图像和音频特征
            const response = await meowAIServiceRef.current.analyzeImageWithAudio(
              photo.base64,
              audioFeatures
            );
            
            // 处理返回结果
            if (response && response.text) {
              // 添加分析结果
              addAnalysisResult({
                message: response.text,
                timestamp: Date.now(),
                frameDataUrl: `data:image/jpeg;base64,${photo.base64}`
              });
            }
            
            setIsWaitingResponse(false);
            setAIState(AIAnalysisState.Done);
          } catch (error: any) {
            console.error('AI分析调用失败:', error);
            setIsWaitingResponse(false);
            setAIState(AIAnalysisState.Idle);
          }
        }
      }
    } catch (error: any) {
      console.error('捕获图像失败:', error);
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
      await new Promise<void>(resolve => setTimeout(resolve, 500));
      
      // 检查相机权限状态
      const cameraStatus = cameraPermission?.granted ? 'granted' : 'denied';
      console.log('相机权限状态:', cameraStatus);
      
      // 请求麦克风权限
      const { status: audioStatus } = await Audio.requestPermissionsAsync();
      console.log('麦克风权限状态:', audioStatus);
      
      // 如果相机和麦克风权限已获得，则可以继续
      if (cameraStatus === 'granted' && audioStatus === 'granted') {
        setHasPermissions(true);
        return true;
      } else {
        console.error('未获取到必要权限，相机:', cameraStatus, '麦克风:', audioStatus);
        useVideoStore.getState().setVideoState(VideoState.Error, '需要相机和麦克风权限才能继续');
        return false;
      }
    } catch (error: any) {
      console.error('请求权限失败:', error);
      useVideoStore.getState().setVideoState(VideoState.Error, '权限请求失败');
      return false;
    }
  };
  
  // 开始通话/录制
  const handleStartCall = async () => {
    // 检查权限
    if (!hasPermissions) {
      // 请求权限
      const hasAllPermissions = await requestPermissions();
      if (!hasAllPermissions) {
        useVideoStore.getState().setVideoState(VideoState.PermissionRequired);
        return;
      }
    }
    
    // 更新状态为录制中
    useVideoStore.getState().setVideoState(VideoState.Capturing);
    
    // 启动猫叫检测器
    if (meowDetectorRef.current) {
      meowDetectorRef.current.startListening();
    }
  };
  
  // 结束通话/录制
  const handleEndCall = async () => {
    // 停止猫叫检测器
    if (meowDetectorRef.current) {
      meowDetectorRef.current.stopListening();
    }
    
    // 重置状态
    useVideoStore.getState().reset();
    
    // 退出
    if (onExit) {
      onExit();
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
            <VideoView cameraRef={cameraRef} hasPermission={hasPermissions} />
            
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
                    {item.frameDataUrl && (
                      <Image 
                        source={{uri: item.frameDataUrl}} 
                        style={styles.analysisImage} 
                        resizeMode="cover"
                      />
                    )}
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
        <TouchableOpacity 
          style={[styles.callButton, videoState === VideoState.Capturing ? styles.endCallButton : {}]} 
          onPress={videoState === VideoState.Capturing ? handleEndCall : handleStartCall}
        >
          <Text style={{fontSize: 20, color: '#FFF'}}>
            {videoState === VideoState.Capturing ? '结束录制' : '开始录制'}
          </Text>
        </TouchableOpacity>
        
        {/* 隐藏猫叫检测器UI，只保留功能 */}
        <MeowDetector 
          ref={meowDetectorRef}
          showUI={false}
          onMeowDetected={handleMeowDetected}
        />
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
  cameraContainer: {
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
  endCallButton: {
    backgroundColor: '#FF3737',
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
  analysisImage: {
    width: '100%',
    height: 150,
    borderRadius: 10,
    marginBottom: 10,
  },
  noResultText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default VideoAITransNative;
