<important dont_remove_this_line refresh="when new content"，doc_type="markdown">这是本工作区的思考文件，请在代码更改后刷新此文档</important>

# MeowTalk 项目文档

## 项目结构

```
MeowTalk/
├── src/                    # 源代码目录
│   ├── components/         # 组件目录 (2个组件)
│   ├── config/            # 配置文件目录
│   └── types/             # 类型定义目录
├── public/                # 公共资源目录
│   ├── audios/           # 音频资源
│   └── images/           # 图片资源
├── audios/                # 猫叫声音频库
│   ├── alert.mp3         # 警惕声
│   ├── anxious.mp3       # 焦虑声
│   ├── ask_for_hunting.mp3  # 寻求狩猎
│   ├── ask_for_play.mp3    # 寻求玩耍
│   └── ... (更多音频文件)
└── sdk/                   # 流式声音识别SDK 请阅读@thinking.md <impotant>请不要主动修改sdk里面的内容</important>
    ├── sound_identify.go  # 声音识别核心功能
    ├── recording.go       # 录音相关功能
    ├── types.go          # 类型定义
    └── sample_library.json # 样本库配置
```

## 核心功能

### 声音识别系统 (sound_identify.go)

该模块实现了猫叫声的分析和识别功能，主要特性包括：

1. **音频数据处理**
   - WAV 文件加载和解析
   - 音频数据帧分割（25ms 帧长）

2. **声音特征提取**
   - 过零率计算
   - 能量特征分析
   - 基音频率估计
   - 峰值频率计算

### 音频资源库

项目包含丰富的猫叫声音频样本，覆盖多种情绪和行为状态：

- 情绪类：焦虑、舒适、好奇、不适、满意、不开心
- 交互类：打招呼、求食、求玩、求狩猎
- 警示类：警告、警惕
- 社交类：求偶、寻母、驱赶

## 技术特点

1. 采用帧级别的音频分析（25ms）
2. 使用多维特征向量进行声音特征提取
3. 支持实时音频处理和分析
4. 包含完整的音频样本库

### 当前开发目标

#### 1. 功能需求
- 在 React Native 项目中实现实时音频流识别
- 将音频流实时传输给 SDK 进行情感分析
- 展示识别出的猫咪情感状态

#### 2. 技术方案
1. **音频采集**
   - 使用 RN 的音频录制模块（如 react-native-audio-record）
   - 配置音频参数：
     ```json
     {
       "sampleRate": 44100,
       "channels": 1,
       "bitsPerSample": 16,
       "audioSource": "MIC",
       "bufferSize": 4096
     }
     ```

2. **数据流处理**
   - 实现音频数据缓冲区
   - 按照 25ms 帧长分割音频流
   - 使用 AudioBuffer 进行数据转换

3. **SDK 集成**
   - 创建 Native Module 桥接 SDK
   - 实现数据流转换接口
   - 处理实时返回的识别结果

4. **状态展示**
   - 实时显示识别到的情感状态
   - 显示置信度和相关特征值
   - 提供录音控制界面

#### 3. 实现步骤
1. **音频模块配置**
   ```typescript
   // 音频配置
   const audioConfig = {
     sampleRate: 44100,
     channels: 1,
     bitsPerSample: 16,
     bufferSize: 4096
   };
   ```

2. **Native Bridge 接口**
   ```typescript
   interface MeowTalkBridge {
     startRecording(): Promise<void>;
     stopRecording(): Promise<void>;
     processAudioBuffer(buffer: ArrayBuffer): Promise<EmotionResult>;
   }
   ```

3. **情感识别回调**
   ```typescript
   interface EmotionResult {
     emotion: string;
     confidence: number;
     features: AudioFeatures;
   }
   ```

#### 4. 注意事项
1. **性能优化**
   - 使用 Worker 进行音频数据预处理
   - 实现数据缓冲以平滑处理流程
   - 优化 Native Bridge 通信效率

2. **资源管理**
   - 正确管理音频录制生命周期
   - 及时释放不需要的音频缓冲
   - 处理应用切换到后台的情况

3. **用户体验**
   - 添加录音状态指示
   - 显示音量级别反馈
   - 提供情感识别的可视化展示

### 开发计划
1. 搭建 RN 音频录制基础框架
2. 实现 Native Bridge 接口
3. 集成 SDK 音频处理流程
4. 开发用户界面和交互功能
5. 进行性能优化和测试
