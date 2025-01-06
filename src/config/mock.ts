// 环境变量控制，如果没有设置则默认为开发环境
const isDev = process.env.NODE_ENV !== 'production';

// Mock 配置
export const MOCK_CONFIG = {
  // 全局 mock 开关，生产环境自动关闭
  ENABLE_MOCK: isDev,
  
  // Mock 服务器配置
  SERVER: {
    URL: 'http://localhost:8080',
    ENDPOINTS: {
      INIT: '/init',
      START: '/start',
      SEND: '/send',
      RECV: '/recv',
      STOP: '/stop'
    }
  },

  // SDK Mock 配置
  SDK: {
    // 模拟初始化延迟 (ms)
    INIT_DELAY: 100,
    // 模拟音频采样率
    SAMPLE_RATE: 44100,
    // 模拟音频块大小
    CHUNK_SIZE: 4096,
    // 模拟处理延迟 (ms)
    PROCESS_DELAY: 100
  }
};

// 创建一个符合 NativeEventEmitter 接口的 mock
export const mockEventEmitter = {
  listeners: new Map<string, Set<(...args: any[]) => void>>(),

  addListener(eventType: string, handler: (...args: any[]) => void) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)?.add(handler);
    console.log(`Mock: 添加事件监听 ${eventType}`);
    
    return {
      remove: () => this.removeListener(eventType, handler)
    };
  },

  removeListener(eventType: string, handler: (...args: any[]) => void) {
    console.log(`Mock: 移除事件监听 ${eventType}`);
    this.listeners.get(eventType)?.delete(handler);
  },

  removeAllListeners(eventType: string) {
    console.log(`Mock: 移除所有监听器 ${eventType}`);
    if (eventType) {
      this.listeners.delete(eventType);
    } else {
      this.listeners.clear();
    }
  },

  removeSubscription(subscription: { remove: () => void }) {
    if (subscription && typeof subscription.remove === 'function') {
      subscription.remove();
    }
  },

  emit(eventType: string, ...args: any[]) {
    console.log(`Mock: 触发事件 ${eventType}`, args);
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (err) {
          console.error(`Error in ${eventType} handler:`, err);
        }
      });
    }
  }
};

// Mock SDK 接口
export const MockSDK = {
  async initializeSDK(config: any) {
    if (!MOCK_CONFIG.ENABLE_MOCK) {
      throw new Error('Mock is disabled');
    }
    
    try {
      console.log('Mock: 初始化 SDK');
      const response = await fetch(`${MOCK_CONFIG.SERVER.URL}/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Mock server error: ${response.status}`);
      }
      
      return { success: true };
    } catch (err) {
      console.error('Mock server connection failed:', err);
      throw new Error('Mock server connection failed');
    }
  },

  async startAudioStream(streamId: string) {
    try {
      console.log('Mock: 开始音频流', streamId);
      const response = await fetch(`${MOCK_CONFIG.SERVER.URL}/start`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`Start stream failed: ${response.status}`);
      }
      
      const result = await response.json();
      return result;
    } catch (err) {
      console.error('Start stream failed:', err);
      throw err;
    }
  },

  async stopAudioStream(streamId: string) {
    try {
      console.log('Mock: 停止音频流', streamId);
      const response = await fetch(`${MOCK_CONFIG.SERVER.URL}/stop?streamId=${streamId}`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`Stop stream failed: ${response.status}`);
      }
      
      return { success: true };
    } catch (err) {
      console.error('Stop stream failed:', err);
      throw err;
    }
  }
};
