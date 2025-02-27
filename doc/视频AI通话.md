# 音视频通话智能体集成
## Web使用指南
### 集成SDK
```bash
npm install aliyun-auikit-aicall --save
```
### 文档地址
```
https://help.aliyun.com/zh/ims/user-guide/ai-web-usage?spm=a2c4g.11186623.0.0.ffc35bc41GA9rl
```
对讲机模式
```https://help.aliyun.com/zh/ims/user-guide/intercom-mode-1?spm=a2c4g.11186623.help-menu-193643.d_2_5_5_0_2_4.479d2ea3XSGK9S#215ff0f347w25```

### Sample
```// 引入SDK
import ARTCAICallEngine, { ARTCAICallErrorCode, ARTCAICallAgentState, AICallSubtitleData } from 'aliyun-auikit-aicall';

// 创建engine实例
const engine = new ARTCAICallEngine();

// 其他功能调用示例，请参考API说明

// 回调处理（仅示例不分核心的回调操作）
engine.on('errorOccurred', (code: ARTCAICallErrorCode) => {
  // 发生了错误
  engine.handup();
});

engine.on('callBegin', () => {
  // 通话开始
});

engine.on('callEnd', () => {
  // 通话结束
});

engine.on('agentStateChanged', (state: ARTCAICallAgentState) => {
  // 智能体状态改变
});

engine.on('userSubtitleNotify', (subtitle: AICallSubtitleData) => {
  // 用户提问被智能体识别结果的通知
});

engine.on('agentSubtitleNotify', (subtitle: AICallSubtitleData) => {
  // 智能体回答结果通知
});

engine.on('voiceIdChanged', (voiceId: string) => {
  // 当前通话的音色发生了改变
});

engine.on('voiceInterruptChanged', (enable: boolean) => {
  // 当前通话的语音打断是否启用
});

const userId = '';

// 从服务端获取 agentInfo
const agentInfo = fetchAgentInfo();

try {
  // 启动智能体后，开始通话
  engine.call(userId, agentInfo);
} catch (error) {}

// 结束通话
engine.handup();```