// 模拟 SDK 实现
export const MockMeowTalkSDKModule = {
  initializeSDK: async (config: { model: string }) => {
    console.log('Mock SDK initialized with config:', config);
    return Promise.resolve();
  }
};

// 模拟事件系统
export const MockSDKEvents = {
  addListener: (event: string, callback: (result: any) => void) => {
    console.log(`Mock: Added listener for event "${event}"`);
    return {
      remove: () => {
        console.log(`Mock: Removed listener for event "${event}"`);
      }
    };
  }
};
