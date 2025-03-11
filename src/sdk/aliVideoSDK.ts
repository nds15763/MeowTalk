/**
 * 阿里云智能视频服务SDK封装
 * 支持视频通话和对讲机模式
 */

/** 
 * 在全局Window接口中声明阿里云SDK类型
 */
declare global {
  interface Window {
    aliyunAuikitAicall?: any;
    AICallKit?: any;
  }
}

// 导入阿里云SDK
import { AICallTemplateConfig } from 'aliyun-auikit-aicall';

// 通话智能体类型，根据阿里云SDK文档定义
export enum AICallAgentTypeEnum {
  VoiceAgent = 'VoiceAgent',      // 语音智能体
  AvatarAgent = 'AvatarAgent',    // 虚拟人智能体
  VisionAgent = 'VisionAgent',    // 视觉智能体
}

// 聊天智能体类型
export enum AIChatAgentTypeEnum {
  MessageChat = 'MessageChat',     // 消息聊天
}

// SDK配置接口
export interface AliVideoSDKConfig {
  userId: string;           // 用户ID
  userToken: string;        // 用户Token
  agentId?: string;         // 智能体ID
  region?: string;          // 区域
  appServer?: string;       // 应用服务器
  shareToken?: string;      // 分享Token
  userData?: string;        // 用户数据
  templateConfig?: any;     // 模板配置
}

// 事件回调接口
export interface AliVideoEvents {
  onStateChange?: (state: any) => void;  // 状态变化
  onSubtitleUpdate?: (subtitle: any) => void;  // 字幕更新
  onAuthFail?: () => void;  // 认证失败
  onError?: (error: Error) => void;  // 错误
}

// 字幕数据接口
export interface AliSubtitleData {
  text: string;         // 字幕文本
  isFromUser: boolean;  // 是否来自用户
  sentenceId?: string;  // 句子ID
  isEnd?: boolean;      // 是否结束
}

/**
 * 阿里云视频SDK封装类
 * 根据阿里云智能视频服务的实际API封装
 */
export class AliVideoSDK {
  private agent: any = null;
  private config: AliVideoSDKConfig;
  private events: AliVideoEvents;
  private aliyunSDK: any = null;
  
  /**
   * 构造函数
   * @param config SDK配置
   * @param events 事件回调
   */
  constructor(config: AliVideoSDKConfig, events: AliVideoEvents = {}) {
    this.config = config;
    this.events = events;
    
    // 动态导入阿里云SDK
    try {
      this.aliyunSDK = require('aliyun-auikit-aicall');
    } catch (error) {
      console.warn('[AliVideoSDK] 动态导入阿里云SDK失败，将在运行时使用');
    }
  }

  /**
   * 初始化视频智能体
   * @param agentType 智能体类型
   * @param enablePushToTalk 是否启用对讲机模式
   */
  public async initialize(agentType: string = AICallAgentTypeEnum.VisionAgent, enablePushToTalk: boolean = false): Promise<boolean> {
    try {
      // 获取阿里云SDK
      const sdk = this.aliyunSDK || window.aliyunAuikitAicall || window.AICallKit;
      
      if (!sdk) {
        throw new Error('无法获取阿里云SDK，请确保已正确导入aliyun-auikit-aicall');
      }
      
      // 初始化SDK
      this.agent = new sdk.AICallWebAgent({
        userId: this.config.userId,
        userToken: this.config.userToken,
        agentType: agentType,
        agentId: this.config.agentId || '',
        region: this.config.region || 'cn-shanghai',
        appServer: this.config.appServer,
        shareToken: this.config.shareToken,
        userData: this.config.userData,
        templateConfig: this.config.templateConfig,
        
        // 配置对讲机模式
        communicationModel: {
          enablePushToTalk: enablePushToTalk
        },
        
        // 事件处理
        onStateChange: (state: any) => {
          this.events.onStateChange?.(state);
        },
        onSubtitleUpdate: (subtitle: any) => {
          this.events.onSubtitleUpdate?.(subtitle);
        },
        onError: (error: any) => {
          console.error('[AliVideoSDK] Error:', error);
          this.events.onError?.(new Error(error?.message || String(error)));
        },
        onAuthFail: () => {
          console.error('[AliVideoSDK] Authentication failed');
          this.events.onAuthFail?.();
        }
      });

      return true;
    } catch (error) {
      console.error('[AliVideoSDK] Initialization error:', error);
      this.events.onError?.(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * 开始通话
   */
  public async startCall(): Promise<boolean> {
    if (!this.agent) {
      console.error('[AliVideoSDK] Agent not initialized');
      return false;
    }

    try {
      // 根据阿里云SDK的实际方法调用
      if (typeof this.agent.call === 'function') {
        await this.agent.call();
      } else if (typeof this.agent.startCall === 'function') {
        await this.agent.startCall();
      } else {
        console.warn('[AliVideoSDK] 无法获取开始通话的方法');
      }
      return true;
    } catch (error) {
      console.error('[AliVideoSDK] Start call error:', error);
      this.events.onError?.(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * 结束通话
   */
  public async endCall(): Promise<boolean> {
    if (!this.agent) {
      console.error('[AliVideoSDK] Agent not initialized');
      return false;
    }

    try {
      // 根据阿里云SDK的实际方法调用
      if (typeof this.agent.hangup === 'function') {
        await this.agent.hangup();
      } else if (typeof this.agent.endCall === 'function') {
        await this.agent.endCall();
      } else {
        console.warn('[AliVideoSDK] 无法获取结束通话的方法');
      }
      return true;
    } catch (error) {
      console.error('[AliVideoSDK] End call error:', error);
      this.events.onError?.(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * 启用/禁用对讲机模式
   * @param enable 是否启用对讲机模式
   */
  public setPushToTalkMode(enable: boolean): boolean {
    if (!this.agent) {
      console.error('[AliVideoSDK] Agent not initialized');
      return false;
    }

    try {
      // 设置对讲机模式
      if (typeof this.agent.setEnablePushToTalk === 'function') {
        this.agent.setEnablePushToTalk(enable);
      } else if (typeof this.agent.enablePushToTalk === 'function') {
        this.agent.enablePushToTalk(enable);
      } else {
        console.warn('[AliVideoSDK] 无法获取设置对讲机模式的方法');
      }
      return true;
    } catch (error) {
      console.error('[AliVideoSDK] Set push-to-talk mode error:', error);
      this.events.onError?.(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * 对讲机模式：开始说话
   * 当用户按下对讲按钮时调用
   */
  public startSpeaking(): boolean {
    if (!this.agent) {
      console.error('[AliVideoSDK] Agent not initialized');
      return false;
    }

    try {
      // 开始说话
      if (typeof this.agent.startSpeaking === 'function') {
        this.agent.startSpeaking();
      } else {
        console.warn('[AliVideoSDK] 无法获取开始说话的方法');
      }
      return true;
    } catch (error) {
      console.error('[AliVideoSDK] Start speaking error:', error);
      this.events.onError?.(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * 对讲机模式：停止说话
   * 当用户松开对讲按钮时调用
   */
  public stopSpeaking(): boolean {
    if (!this.agent) {
      console.error('[AliVideoSDK] Agent not initialized');
      return false;
    }

    try {
      // 停止说话
      if (typeof this.agent.stopSpeaking === 'function') {
        this.agent.stopSpeaking();
      } else {
        console.warn('[AliVideoSDK] 无法获取停止说话的方法');
      }
      return true;
    } catch (error) {
      console.error('[AliVideoSDK] Stop speaking error:', error);
      this.events.onError?.(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * 静音/取消静音摄像头
   * @param mute 是否静音
   */
  public muteCamera(mute: boolean): boolean {
    if (!this.agent) {
      console.error('[AliVideoSDK] Agent not initialized');
      return false;
    }

    try {
      // 静音/取消静音摄像头
      if (mute) {
        if (typeof this.agent.muteLocalVideo === 'function') {
          this.agent.muteLocalVideo();
        } else if (typeof this.agent.muteLocalCamera === 'function') {
          this.agent.muteLocalCamera();
        } else {
          console.warn('[AliVideoSDK] 无法获取静音摄像头的方法');
        }
      } else {
        if (typeof this.agent.unmuteLocalVideo === 'function') {
          this.agent.unmuteLocalVideo();
        } else if (typeof this.agent.unmuteLocalCamera === 'function') {
          this.agent.unmuteLocalCamera();
        } else {
          console.warn('[AliVideoSDK] 无法获取取消静音摄像头的方法');
        }
      }
      return true;
    } catch (error) {
      console.error('[AliVideoSDK] Mute camera error:', error);
      this.events.onError?.(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * 静音/取消静音麦克风
   * @param mute 是否静音
   */
  public muteMicrophone(mute: boolean): boolean {
    if (!this.agent) {
      console.error('[AliVideoSDK] Agent not initialized');
      return false;
    }

    try {
      // 静音/取消静音麦克风
      if (mute) {
        if (typeof this.agent.muteLocalAudio === 'function') {
          this.agent.muteLocalAudio();
        } else if (typeof this.agent.muteLocalMicrophone === 'function') {
          this.agent.muteLocalMicrophone();
        } else {
          console.warn('[AliVideoSDK] 无法获取静音麦克风的方法');
        }
      } else {
        if (typeof this.agent.unmuteLocalAudio === 'function') {
          this.agent.unmuteLocalAudio();
        } else if (typeof this.agent.unmuteLocalMicrophone === 'function') {
          this.agent.unmuteLocalMicrophone();
        } else {
          console.warn('[AliVideoSDK] 无法获取取消静音麦克风的方法');
        }
      }
      return true;
    } catch (error) {
      console.error('[AliVideoSDK] Mute microphone error:', error);
      this.events.onError?.(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * 销毁实例，释放资源
   */
  public destroy(): void {
    if (this.agent) {
      try {
        if (typeof this.agent.destroy === 'function') {
          this.agent.destroy();
        }
      } catch (error) {
        console.error('[AliVideoSDK] Destroy error:', error);
      } finally {
        this.agent = null;
      }
    }
  }

  /**
   * 获取当前对讲机模式状态
   */
  public isPushToTalkEnabled(): boolean {
    if (!this.agent) {
      return false;
    }
    
    // 获取对讲机模式状态
    if (typeof this.agent.isPushToTalkEnabled === 'function') {
      return this.agent.isPushToTalkEnabled();
    } else if (typeof this.agent.getPushToTalkEnabled === 'function') {
      return this.agent.getPushToTalkEnabled();
    } else {
      console.warn('[AliVideoSDK] 无法获取对讲机模式状态的方法');
      return false;
    }
  }

  /**
   * 发送表情
   * @param emotionId 表情ID
   */
  public sendEmotion(emotionId: string): boolean {
    if (!this.agent) {
      console.error('[AliVideoSDK] Agent not initialized');
      return false;
    }

    try {
      // 发送自定义事件
      if (typeof this.agent.sendCustomEvent === 'function') {
        this.agent.sendCustomEvent({
          type: 'emotion',
          data: { emotionId }
        });
      } else {
        console.warn('[AliVideoSDK] 无法获取发送自定义事件的方法');
      }
      return true;
    } catch (error) {
      console.error('[AliVideoSDK] Send emotion error:', error);
      this.events.onError?.(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }
}

// 导出AliFace SDK中的类型
export { AICallTemplateConfig };

// 导出枚举类型
export { AICallAgentTypeEnum as AICallAgentType };
export { AIChatAgentTypeEnum as AIChatAgentType };
