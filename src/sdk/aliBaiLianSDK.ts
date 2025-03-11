/**
 * 阿里云百炼智能体SDK封装
 * 提供与阿里云百炼智能体的交互能力
 */

import axios from 'axios';

// 百炼API请求参数接口
export interface BaiLianRequestParams {
  prompt?: string;          // 当前指令
  session_id?: string;      // 历史对话的唯一标识
  messages?: BaiLianMessage[]; // 历史对话消息列表
  image_list?: string[];    // 图片链接列表
  parameters?: any;         // 其他参数
  debug?: any;             // 调试信息
}

// 百炼消息类型
export interface BaiLianMessage {
  role: 'user' | 'assistant'; // 消息角色
  content: string;           // 消息内容
}

// 百炼响应接口
export interface BaiLianResponse {
  output: {
    text: string;          // 模型生成的回复内容
    finish_reason: string; // 完成原因
    session_id: string;    // 会话ID
    thoughts?: any;        // 插件调用、知识检索过程
    doc_references?: any[]; // 知识库引用
  };
  usage: {
    models: any[];
  };
  request_id: string;
}

// 百炼SDK配置接口
export interface BaiLianSDKConfig {
  appId: string;      // 应用ID
  apiKey: string;     // API密钥
  baseUrl?: string;   // API基础URL
  workspace?: string; // 业务空间标识
}

/**
 * 阿里云百炼智能体SDK
 */
export class AliBaiLianSDK {
  private config: BaiLianSDKConfig;
  private sessionId: string | null = null;
  private messageHistory: BaiLianMessage[] = [];
  
  /**
   * 构造函数
   * @param config SDK配置
   */
  constructor(config: BaiLianSDKConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl || 'https://dashscope.aliyuncs.com/api/v1'
    };
  }
  
  /**
   * 发送请求到百炼API
   * @param params 请求参数
   * @returns 响应结果
   */
  public async sendRequest(params: BaiLianRequestParams): Promise<BaiLianResponse> {
    const { appId, apiKey, baseUrl, workspace } = this.config;
    const url = `${baseUrl}/apps/${appId}/completion`;
    
    // 构建请求体
    const requestBody = {
      input: {
        ...params,
        // 如果有sessionId并且没有传递messages，则使用sessionId
        session_id: params.messages ? undefined : (params.session_id || this.sessionId)
      },
      parameters: params.parameters || {},
      debug: params.debug || {}
    };
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
    
    if (workspace) {
      headers['X-DashScope-WorkSpace'] = workspace;
    }
    
    try {
      const response = await axios.post(url, requestBody, { headers });
      
      if (response.status === 200) {
        // 保存sessionId用于后续对话
        this.sessionId = response.data.output.session_id;
        
        // 如果使用了messages模式，更新历史消息
        if (params.messages) {
          this.messageHistory = [...params.messages, {
            role: 'assistant',
            content: response.data.output.text
          }];
        }
        
        return response.data;
      } else {
        throw new Error(`API调用失败: ${response.status} ${response.data.message || '未知错误'}`);
      }
    } catch (error: any) {
      console.error('百炼API调用错误:', error.message);
      if (error.response) {
        console.error('响应状态:', error.response.status);
        console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }
  
  /**
   * 发送文本消息到智能体
   * @param prompt 提示文本
   * @param useMessages 是否使用messages模式管理会话历史
   * @returns 响应结果
   */
  public async sendTextMessage(prompt: string, useMessages: boolean = false): Promise<BaiLianResponse> {
    const params: BaiLianRequestParams = useMessages 
      ? {
          messages: [...this.messageHistory, { role: 'user', content: prompt }]
        }
      : {
          prompt: prompt
        };
    
    return this.sendRequest(params);
  }
  
  /**
   * 发送图片消息到智能体
   * @param prompt 提示文本
   * @param imageUrls 图片URL列表
   * @returns 响应结果
   */
  public async sendImageMessage(prompt: string, imageUrls: string[]): Promise<BaiLianResponse> {
    const params: BaiLianRequestParams = {
      prompt: prompt,
      image_list: imageUrls
    };
    
    return this.sendRequest(params);
  }
  
  /**
   * 清除当前会话
   */
  public clearSession(): void {
    this.sessionId = null;
    this.messageHistory = [];
  }
  
  /**
   * 获取当前会话ID
   */
  public getSessionId(): string | null {
    return this.sessionId;
  }
  
  /**
   * 获取当前消息历史
   */
  public getMessageHistory(): BaiLianMessage[] {
    return [...this.messageHistory];
  }
}
