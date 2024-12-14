# MeowTalk 项目文档

## 1. 项目概述

MeowTalk 是一个基于 React Native 的猫叫声识别应用，能够实时分析和识别猫咪的情感状态。

## 2. 项目结构

```
MeowTalk/
├── src/                    # 源代码目录
│   ├── components/         # React 组件
│   │   ├── TranslatePage.tsx  # 主页面组件
│   │   └── AudioRecorder.tsx  # 录音处理组件
│   ├── config/            # 配置文件
│   │   └── emotions.ts    # 情感配置
│   └── types/             # TypeScript 类型定义
│       └── emotion.ts     # 情感相关类型
├── public/                # 静态资源
│   ├── audios/           # 音频资源
│   └── images/           # 图片资源
├── audios/                # 猫叫声音频库
└── sdk/                   # 声音识别SDK
    ├── emotion_samples/   # 情感样本库
    ├── recording.go       # 录音处理
    ├── sound_identify.go  # 声音识别
    ├── sample_library.go  # 样本库管理
    └── types.go          # 类型定义

```

## 3. 核心功能模块

### 3.1 音频录制与处理流程
1. **音频采集 (AudioRecorder)**
   - 配置高质量音频参数
   ```typescript
   const AUDIO_CONFIG = {
     sampleRate: 44100,    // 采样率
     channels: 1,          // 单声道
     bitsPerSample: 16,    // 位深度
     bufferSize: 4096      // 缓冲区大小
   };
   ```
   - 音频格式支持
     - Android: WAV/AAC (MPEG_4)
     - iOS: WAV (LINEARPCM)
     - Web: WebM
   - 实时音量监控
   - 录音状态管理

2. **数据流处理**
   - 音频数据预处理
     - 数据格式转换
     - 采样率调整
     - 质量优化
   - 实时音频数据缓冲
   - Native Bridge 数据传输

3. **情感识别 (SDK)**
   - 音频特征提取
   - 情感模型分析
   - 结果置信度计算

### 3.2 组件通信流程
1. **TranslatePage (上层组件)**
   - 管理全局状态
   - 处理情感识别结果
   - 控制UI展示

2. **AudioRecorder (功能组件)**
   - 录音控制与状态管理
   - 音频数据预处理
   - 回调结果通知

### 3.3 声音识别 SDK
1. **编译目标**
   - Linux/Android: meowsdk.so
   - iOS: meowsdk.dylib
   - 头文件: meowsdk.h

2. **核心功能**
   - 声音特征提取
   - 情感模式匹配
   - 实时分析处理
   - 样本库管理

3. **接口定义**
   ```go
   type EmotionResult struct {
       Emotion    string  // 情感类型
       Confidence float64 // 置信度
       Features   map[string]float64 // 特征值
   }

   // 主要函数
   func AnalyzeAudio(data []byte, config *AudioConfig) (*EmotionResult, error)
   func LoadSampleLibrary(path string) error
   func UpdateModel(samples []Sample) error
   ```

### 3.4 音频资源库
- **情绪类别**
  - 基础情绪：焦虑、舒适、好奇、不适、满意、不开心
  - 交互行为：打招呼、求食、求玩、求狩猎
  - 警示行为：警告、警惕
  - 社交行为：求偶、寻母、驱赶

## 4. 技术实现

### 4.1 音频配置
```typescript
interface AudioConfig {
  android: {
    extension: '.wav',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
  },
  ios: {
    extension: '.wav',
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.HIGH,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  }
}
```

### 4.2 核心接口
```typescript
interface EmotionResult {
  emotion: string;
  confidence: number;
  features: AudioFeatures;
}

interface AudioRecorderProps {
  onEmotionDetected?: (result: EmotionResult) => void;
}
```

## 5. 开发注意事项

### 5.1 SDK 编译
1. 环境要求
   - Go 1.16+
   - gcc/clang
   - NDK (Android)
   - Xcode (iOS)

2. 编译命令
   ```bash
   # Linux/Android
   go build -o meowsdk.so -buildmode=c-shared

   # iOS
   go build -o meowsdk.dylib -buildmode=c-shared
   ```

3. 测试验证
   - 单元测试覆盖
   - 跨平台兼容性
   - 性能基准测试

### 5.2 性能优化要点
- Worker 线程处理音频数据
- 数据缓冲机制
- Native Bridge 通信优化
- 内存资源管理
- 后台运行处理

### 5.3 用户体验要点
- 录音状态实时反馈
- 音量级别可视化
- 情感识别结果展示
- 错误处理和重试机制
- 界面动画效果

### 5.4 跨平台兼容性
- Android/iOS音频格式处理
- 设备权限管理
- 资源释放机制
- 后台运行状态处理
