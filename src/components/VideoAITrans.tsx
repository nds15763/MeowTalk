import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, Dimensions, ActivityIndicator } from 'react-native';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import { create } from 'zustand';
import { SafeAreaView } from 'react-native-safe-area-context';

// 定义视频通话状态枚举
export enum VideoCallState {
  None = 0,
  Connecting = 1,
  Connected = 2,
  Error = 3,
  PermissionRequired = 4, // 新增权限检查状态
}

// 定义智能体状态枚举
export enum VideoAgentState {
  Listening = 0,
  Speaking = 1,
}

// 字幕项类型
type SubtitleItem = {
  text: string;
  source: 'agent' | 'user';
  sentenceId?: string;
  end?: boolean;
};

// 表情类型
type EmotionType = {
  id: string;
  name: string;
  icon: string;
};

// 创建视频通话状态存储
interface VideoStore {
  // 通话状态
  callState: VideoCallState;
  // 错误信息
  errorMessage?: string;
  // 智能体状态
  agentState: VideoAgentState;
  // 是否正在说话
  isSpeaking: boolean;
  // 当前字幕
  currentSubtitle?: SubtitleItem;
  // 字幕列表
  subtitleList: SubtitleItem[];
  // 设置当前字幕
  setCurrentSubtitle: (subtitle: SubtitleItem) => void;
  // 摄像头是否静音
  cameraMuted: boolean;
  // 麦克风是否静音
  microphoneMuted: boolean;
  // 是否启用对讲机模式
  enablePushToTalk: boolean;
  // 对讲机模式状态更新中
  updatingPushToTalk: boolean;
  // 正在按住说话
  pushingToTalk: boolean;
  // 设置对讲机模式
  setPushToTalk: (enabled: boolean) => void;
  // 表情面板是否显示
  emotionPanelVisible: boolean;
  // 显示/隐藏表情面板
  toggleEmotionPanel: () => void;
  // 重置状态
  reset: () => void;
}

const initialState: Omit<VideoStore, 'setCurrentSubtitle' | 'setPushToTalk' | 'toggleEmotionPanel' | 'reset'> = {
  callState: VideoCallState.None,
  agentState: VideoAgentState.Listening,
  isSpeaking: false,
  subtitleList: [],
  cameraMuted: false,
  microphoneMuted: false,
  enablePushToTalk: false,
  updatingPushToTalk: false,
  pushingToTalk: false,
  emotionPanelVisible: false,
};

// 模拟表情数据
const emotions: EmotionType[] = [
  { id: '1', name: '开心', icon: '😺' },
  { id: '2', name: '生气', icon: '😾' },
  { id: '3', name: '伤心', icon: '😿' },
  { id: '4', name: '害怕', icon: '🙀' },
  { id: '5', name: '撒娇', icon: '😻' },
  { id: '6', name: '不满', icon: '😼' },
];

const useVideoStore = create<VideoStore>((set) => ({
  ...initialState,
  setCurrentSubtitle: (subtitle: SubtitleItem) =>
    set((state: VideoStore) => {
      const newSubtitle = subtitle;
      // 添加到字幕列表
      if (newSubtitle.text) {
        const existSubtitle = state.subtitleList.find(
          (sub) => sub.source === newSubtitle.source && sub.sentenceId === newSubtitle.sentenceId
        );
        // 如果已经存在则更新，否则添加
        if (existSubtitle) {
          existSubtitle.text = newSubtitle.text;
          return { 
            currentSubtitle: newSubtitle, 
            subtitleList: [...state.subtitleList] 
          };
        } else {
          return { 
            currentSubtitle: newSubtitle, 
            subtitleList: [...state.subtitleList, newSubtitle] 
          };
        }
      }
      return { currentSubtitle: newSubtitle };
    }),
  setPushToTalk: (enabled: boolean) =>
    set((state: VideoStore) => {
      // 退出对讲机模式时恢复麦克风状态
      if (!enabled && state.enablePushToTalk) {
        return {
          enablePushToTalk: enabled,
          pushingToTalk: false,
        };
      }
      return {
        enablePushToTalk: enabled,
        pushingToTalk: false,
      };
    }),
  toggleEmotionPanel: () =>
    set((state: VideoStore) => ({
      emotionPanelVisible: !state.emotionPanelVisible
    })),
  reset: () => {
    set(initialState);
  },
}));

// 权限请求组件
const PermissionRequest: React.FC<{
  onRequestPermission: () => void;
}> = ({ onRequestPermission }) => {
  return (
    <View style={styles.permissionContainer}>
      <View style={styles.permissionContent}>
        <Text style={styles.permissionTitle}>需要允许摄像头和麦克风权限</Text>
        <Text style={styles.permissionSubtitle}>请允许摄像头和麦克风权限以继续使用</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={onRequestPermission}>
          <Text style={styles.buttonText}>允许</Text>
        </TouchableOpacity>
        <Image 
          source={require('../../images/pinkcat.png')} 
          style={styles.pinkCatImage}
          resizeMode="contain"
        />
      </View>
    </View>
  );
};

// 表情面板组件
const EmotionPanel: React.FC = () => {
  const handleEmotionSelect = (emotion: EmotionType) => {
    console.log('选择表情:', emotion.name);
    // 这里可以添加选择表情后的处理逻辑
  };

  return (
    <View style={styles.emotionPanel}>
      <View style={styles.emotionGrid}>
        {emotions.map((emotion) => (
          <TouchableOpacity 
            key={emotion.id} 
            style={styles.emotionItem} 
            onPress={() => handleEmotionSelect(emotion)}
          >
            <Text style={styles.emotionIcon}>{emotion.icon}</Text>
            <Text style={styles.emotionName}>{emotion.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// 字幕组件
const Subtitle: React.FC = () => {
  const subtitleList = useVideoStore((state: VideoStore) => state.subtitleList);
  
  // 获取最新的两条字幕用于显示
  const latestSubtitles = subtitleList.slice(-2);

  if (latestSubtitles.length === 0) {
    return null;
  }

  return (
    <View style={styles.subtitleContainer}>
      {latestSubtitles.map((subtitle, index) => (
        <View key={index} style={[
          styles.subtitleItem, 
          subtitle.source === 'agent' ? styles.agentSubtitle : styles.userSubtitle
        ]}>
          <Text style={[
            styles.subtitleText,
            subtitle.source === 'agent' ? styles.agentText : styles.userText
          ]}>
            {subtitle.text}
          </Text>
        </View>
      ))}
    </View>
  );
};

// 连接组件
const Connecting: React.FC = () => {
  const callState = useVideoStore((state: VideoStore) => state.callState);

  return (
    <View style={styles.connectingContainer}>
      {callState === VideoCallState.None && (
        <View style={styles.connectTip}>
          <View style={styles.catImageCircle}>
            <Image 
              source={require('../../images/pinkcat.png')} 
              style={styles.catFaceImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.buttonsContainer}>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionButtonText}>开始通话</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionButtonText}>开始通话</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.coolCatCorner}>
            <Text style={styles.cornerText}>点击这里</Text>
          </View>
        </View>
      )}

      {callState === VideoCallState.Connecting && (
        <View style={styles.loadingIndicator}>
          <ActivityIndicator size="large" color="#FF6B95" />
          <Text style={styles.loadingText}>正在连接...</Text>
        </View>
      )}
    </View>
  );
};

// 视频组件
const VideoView: React.FC = () => {
  const [hasCamera, setHasCamera] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const cameraMuted = useVideoStore((state: VideoStore) => state.cameraMuted);
  const cameraRef = useRef<any>(null);

  useEffect(() => {
    // 在组件加载时检查相机权限
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasCamera(status === 'granted');
      if (status === 'granted') {
        setCameraLoading(true);
        // 模拟相机加载
        setTimeout(() => {
          setCameraLoading(false);
        }, 1000);
      }
    })();
  }, []);

  if (cameraMuted) {
    return (
      <View style={styles.videoContainer}>
        <View style={styles.cameraMutedContainer}>
          <Text style={styles.cameraMutedText}>摄像头已关闭</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.videoContainer}>
      {cameraLoading && (
        <View style={styles.cameraLoading}>
          <ActivityIndicator size="large" color="#FF6B95" />
          <Text style={styles.loadingText}>正在启动摄像头...</Text>
        </View>
      )}
      
      {hasCamera && !cameraLoading && (
        <View style={styles.camera}>
          <Text style={styles.cameraText}>摄像头视图</Text>
          {/* 相机组件在当前环境下有兼容性问题，使用占位符替代 */}
        </View>
      )}
    </View>
  );
};

// 控制栏组件
const Controls: React.FC<{
  onStop: () => void;
  onCall: () => void;
}> = ({ onStop, onCall }) => {
  const callState = useVideoStore((state: VideoStore) => state.callState);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraMuted, setCameraMuted] = useState(false);
  const enablePushToTalk = useVideoStore((state: VideoStore) => state.enablePushToTalk);
  const pushingToTalk = useVideoStore((state: VideoStore) => state.pushingToTalk);
  const emotionPanelVisible = useVideoStore((state: VideoStore) => state.emotionPanelVisible);

  const toggleMic = () => {
    if (enablePushToTalk) return;
    setMicMuted(!micMuted);
    useVideoStore.setState({ microphoneMuted: !micMuted });
  };

  const toggleCamera = () => {
    setCameraMuted(!cameraMuted);
    useVideoStore.setState({ cameraMuted: !cameraMuted });
  };

  const toggleEmotionPanel = () => {
    useVideoStore.getState().toggleEmotionPanel();
  };

  const startPushToTalk = () => {
    if (!enablePushToTalk) return;
    console.log('开始对讲');
    useVideoStore.setState({ pushingToTalk: true });
  };

  const stopPushToTalk = () => {
    if (!enablePushToTalk) return;
    console.log('结束对讲');
    useVideoStore.setState({ pushingToTalk: false });
  };

  return (
    <View style={styles.controlsContainer}>
      {callState === VideoCallState.Connected && (
        <View style={styles.connectedControls}>
          <TouchableOpacity
            style={[
              styles.micButton, 
              micMuted && styles.buttonMuted,
              enablePushToTalk && styles.pushToTalkButton,
              pushingToTalk && styles.pushingButton
            ]}
            onPress={toggleMic}
            onPressIn={enablePushToTalk ? startPushToTalk : undefined}
            onPressOut={enablePushToTalk ? stopPushToTalk : undefined}
          >
            <Text style={styles.buttonText}>
              {enablePushToTalk 
                ? (pushingToTalk ? '松开发送' : '按住讲话') 
                : (micMuted ? '麦克风关闭' : '麦克风开启')}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.callButton, styles.hangupButton]}
            onPress={onStop}
          >
            <Text style={styles.buttonText}>挂断</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.cameraButton, cameraMuted && styles.buttonMuted]}
            onPress={toggleCamera}
          >
            <Text style={styles.buttonText}>
              {cameraMuted ? '摄像头关闭' : '摄像头开启'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.emotionButton, emotionPanelVisible && styles.buttonActive]}
            onPress={toggleEmotionPanel}
          >
            <Text style={styles.emotionButtonIcon}>😺</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {callState !== VideoCallState.Connected && (
        <TouchableOpacity
          style={styles.callButton}
          onPress={onCall}
          disabled={callState === VideoCallState.Connecting}
        >
          <Text style={styles.buttonText}>拨打</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// 主组件
interface VideoAITransProps {
  onExit?: () => void;
}

const VideoAITrans: React.FC<VideoAITransProps> = ({ onExit }) => {
  const callState = useVideoStore((state: VideoStore) => state.callState);
  const errorMessage = useVideoStore((state: VideoStore) => state.errorMessage);
  const emotionPanelVisible = useVideoStore((state: VideoStore) => state.emotionPanelVisible);
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);

  // 检查权限
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        // 检查摄像头和麦克风权限
        const cameraPermission = await Camera.requestCameraPermissionsAsync();
        const audioPermission = await Audio.requestPermissionsAsync();
        
        if (cameraPermission.status === 'granted' && audioPermission.status === 'granted') {
          setHasPermissions(true);
          useVideoStore.setState({ callState: VideoCallState.None });
        } else {
          setHasPermissions(false);
          useVideoStore.setState({ callState: VideoCallState.PermissionRequired });
        }
      } catch (error) {
        console.error('权限检查失败:', error);
        setHasPermissions(false);
        useVideoStore.setState({ callState: VideoCallState.PermissionRequired });
      }
    };
    
    checkPermissions();
  }, []);

  // 请求权限
  const requestPermissions = async () => {
    try {
      const cameraPermission = await Camera.requestCameraPermissionsAsync();
      const audioPermission = await Audio.requestPermissionsAsync();
      
      if (cameraPermission.status === 'granted' && audioPermission.status === 'granted') {
        setHasPermissions(true);
        useVideoStore.setState({ callState: VideoCallState.None });
      } else {
        alert('请允许访问摄像头和麦克风以使用此功能');
      }
    } catch (error) {
      console.error('请求权限失败:', error);
      alert('请允许访问摄像头和麦克风以使用此功能');
    }
  };

  // 开始通话
  const startCall = async () => {
    // 设置连接中状态
    useVideoStore.setState({ callState: VideoCallState.Connecting });
    
    // 模拟连接过程
    setTimeout(() => {
      useVideoStore.setState({ callState: VideoCallState.Connected });
      // 添加模拟字幕
      setTimeout(() => {
        useVideoStore.getState().setCurrentSubtitle({
          text: '你好，我是AI助手，能帮你翻译猫咪的声音',
          source: 'agent'
        });
      }, 1000);
    }, 2000);
  };

  // 结束通话
  const stopCall = () => {
    useVideoStore.setState({ callState: VideoCallState.None });
    useVideoStore.getState().reset();
    if (onExit) {
      onExit();
    }
  };

  // 判断是否需要请求权限
  if (callState === VideoCallState.PermissionRequired) {
    return <PermissionRequest onRequestPermission={requestPermissions} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.mainContainer, callState === VideoCallState.Connected && styles.hasVideo]}>
        {callState === VideoCallState.Connected ? <VideoView /> : <Connecting />}
        <Subtitle />
        <Controls onStop={stopCall} onCall={startCall} />
      </View>
      
      {emotionPanelVisible && <EmotionPanel />}
      
      {callState === VideoCallState.Error && (
        <View style={styles.errorDialog}>
          <Text style={styles.errorMessage}>{errorMessage || '发生未知错误'}</Text>
          <TouchableOpacity 
            style={styles.errorButton}
            onPress={() => useVideoStore.setState({ callState: VideoCallState.None })}
          >
            <Text style={styles.buttonText}>关闭</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

// 样式定义
const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF0F5',
  },
  mainContainer: {
    flex: 1,
    position: 'relative',
  },
  hasVideo: {
    backgroundColor: '#000',
  },
  // 权限请求样式
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF0F5',
    padding: 20,
  },
  permissionContent: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#FF6B95',
    textAlign: 'center',
  },
  permissionSubtitle: {
    fontSize: 16,
    marginBottom: 24,
    color: '#666',
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: '#FF6B95',
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 24,
    marginBottom: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  pinkCatImage: {
    width: 150,
    height: 150,
    marginTop: 20,
  },
  // 连接组件样式
  connectingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF0F5',
  },
  connectTip: {
    alignItems: 'center',
    padding: 20,
  },
  catImageCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#FFDFEA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  catFaceImage: {
    width: 100,
    height: 100,
  },
  buttonsContainer: {
    width: '100%',
    alignItems: 'center',
  },
  actionButton: {
    backgroundColor: '#FF6B95',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 24,
    marginVertical: 10,
    width: '80%',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  coolCatCorner: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    padding: 10,
  },
  cornerText: {
    color: '#FF6B95',
    fontWeight: 'bold',
  },
  loadingIndicator: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#FF6B95',
    fontSize: 16,
  },
  // 视频组件样式
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 12,
    margin: 10,
  },
  camera: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraText: {
    fontSize: 24,
    color: 'white',
  },
  cameraLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  cameraMutedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#222',
  },
  cameraMutedText: {
    color: 'white',
    fontSize: 18,
  },
  // 字幕样式
  subtitleContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    padding: 10,
  },
  subtitleItem: {
    marginVertical: 5,
    padding: 10,
    borderRadius: 12,
    maxWidth: '80%',
  },
  agentSubtitle: {
    backgroundColor: '#FF6B95',
    alignSelf: 'flex-start',
  },
  userSubtitle: {
    backgroundColor: '#4A86E8',
    alignSelf: 'flex-end',
  },
  subtitleText: {
    fontSize: 16,
  },
  agentText: {
    color: 'white',
  },
  userText: {
    color: 'white',
  },
  // 控制按钮样式
  controlsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  connectedControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
  },
  micButton: {
    backgroundColor: '#FF6B95',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callButton: {
    backgroundColor: '#FF6B95',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hangupButton: {
    backgroundColor: '#E63946',
  },
  cameraButton: {
    backgroundColor: '#FF6B95',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emotionButton: {
    backgroundColor: '#FF6B95',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonMuted: {
    backgroundColor: '#888',
  },
  buttonActive: {
    backgroundColor: '#FF8DB2',
  },
  pushToTalkButton: {
    width: 120,
    height: 50,
    borderRadius: 25,
  },
  pushingButton: {
    backgroundColor: '#4A86E8',
  },
  emotionButtonIcon: {
    fontSize: 24,
  },
  // 表情面板样式
  emotionPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: windowHeight * 0.4, // 占屏幕高度的40%
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  emotionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  emotionItem: {
    width: (windowWidth - 60) / 3,
    height: (windowWidth - 60) / 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: '#FFF0F5',
    borderRadius: 12,
  },
  emotionIcon: {
    fontSize: 40,
    marginBottom: 5,
  },
  emotionName: {
    fontSize: 14,
    color: '#666',
  },
  // 错误对话框样式
  errorDialog: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorMessage: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorButton: {
    backgroundColor: '#FF6B95',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 24,
  },
});

export default VideoAITrans;