# MeowTalk SDK 文档

## 简介

MeowTalk SDK 是一个用于实时识别猫咪情感的 CGO 库。SDK 支持实时音频流处理，能够从猫咪的叫声中提取特征并识别其情感状态。

## 主要功能

1. 音频流实时处理：支持连续的音频数据输入
2. 特征提取：从音频中提取关键特征（频谱、能量等）
3. 情感分类：基于预训练模型进行实时情感识别
4. 多会话支持：可同时处理多个音频流

## 编译说明

```bash
# Windows
go build -buildmode=c-shared -o meowsdk.dll

# Linux
go build -buildmode=c-shared -o meowsdk.so

# macOS
go build -buildmode=c-shared -o meowsdk.dylib
```

## CGO 接口说明

### 1. 初始化 SDK
```c
typedef struct {
    const char* model_path;  // 模型文件路径
    int sample_rate;         // 采样率 (8kHz-48kHz)
    int buffer_size;         // 缓冲区大小 (建议4096)
} AudioConfig;

ErrorCode InitSDK(AudioConfig* config);
```

### 2. 开始音频流
```c
ErrorCode StartStream(const char* streamId);
```

### 3. 发送音频数据
```c
bool SendAudio(const char* streamId, const unsigned char* data, int length);
```

### 4. 接收处理结果
```c
char* RecvMessage(const char* streamId);
```

### 5. 停止音频流
```c
ErrorCode StopStream(const char* streamId);
```

### 6. 释放 SDK
```c
void ReleaseSDK(void);
```

## 参数配置指南

### 音频格式要求
- 采样格式：16位 PCM
- 采样率范围：8kHz - 48kHz
- 推荐采样率：44.1kHz
- 建议缓冲区：4096 samples

### 性能优化建议
- 缓冲区大小：根据实际延迟需求调整，较大的缓冲区可以减少处理开销
- 采样率：一般情况下44.1kHz即可满足需求
- 会话管理：及时释放不再使用的音频流会话

## 错误码说明

| 错误码 | 宏定义 | 说明 |
|--------|--------|------|
| 0 | ERR_SUCCESS | 操作成功 |
| 1 | ERR_NOT_INITIALIZED | SDK未初始化 |
| 2 | ERR_INVALID_PARAM | 参数无效 |
| 3 | ERR_SESSION_NOT_FOUND | 会话不存在 |
| 4 | ERR_MEMORY_ALLOC | 内存分配失败 |
| 5 | ERR_AUDIO_PROCESS | 音频处理错误 |

## 返回结果格式

```json
{
  "streamId": "stream_123",     // 会话ID
  "timestamp": 1633072800,      // 时间戳
  "emotion": {
    "type": "happy",            // 情感类型
    "confidence": 0.92          // 置信度
  },
  "audio": {
    "sampleRate": 44100,        // 采样率
    "duration": 1000,           // 持续时间(ms)
    "features": {
      "energy": 0.75,           // 能量值
      "pitch": 440.0,           // 音高
      "zeroCrossRate": 0.15     // 过零率
    }
  }
}
```

## 调用示例

### React Native 示例
```typescript
import { NativeModules } from 'react-native';

const { MeowTalkSDK } = NativeModules;

class CatEmotionRecognizer {
  async initialize() {
    const config = {
      modelPath: 'models/cat_emotion.model',
      sampleRate: 44100,
      bufferSize: 4096
    };
    return await MeowTalkSDK.initSDK(config);
  }

  async startStream(streamId: string) {
    return await MeowTalkSDK.startStream(streamId);
  }

  async sendAudio(streamId: string, audioData: Uint8Array) {
    return await MeowTalkSDK.sendAudio(streamId, audioData);
  }

  async receiveMessage(streamId: string) {
    return await MeowTalkSDK.receiveMessage(streamId);
  }

  async stopStream(streamId: string) {
    return await MeowTalkSDK.stopStream(streamId);
  }

  release() {
    MeowTalkSDK.releaseSDK();
  }
}
```

### Flutter 示例
```dart
import 'package:flutter/services.dart';

class MeowTalkSDK {
  static const MethodChannel _channel = MethodChannel('meowtalk_sdk');

  static Future<bool> initialize({
    required String modelPath,
    required int sampleRate,
    required int bufferSize,
  }) async {
    final config = {
      'modelPath': modelPath,
      'sampleRate': sampleRate,
      'bufferSize': bufferSize,
    };
    return await _channel.invokeMethod('initSDK', config);
  }

  static Future<void> startStream(String streamId) async {
    await _channel.invokeMethod('startStream', streamId);
  }

  static Future<bool> sendAudio(String streamId, Uint8List audioData) async {
    return await _channel.invokeMethod('sendAudio', {
      'streamId': streamId,
      'audioData': audioData,
    });
  }

  static Future<String?> receiveMessage(String streamId) async {
    return await _channel.invokeMethod('receiveMessage', streamId);
  }

  static Future<void> stopStream(String streamId) async {
    await _channel.invokeMethod('stopStream', streamId);
  }

  static Future<void> release() async {
    await _channel.invokeMethod('releaseSDK');
  }
}
```

## 常见用例说明

### 1. 实时识别
```cpp
// 初始化SDK
AudioConfig config = {...};
InitSDK(&config);

// 开始音频流
StartStream("stream1");

// 循环发送音频数据
while (hasAudioData) {
    SendAudio("stream1", audioChunk, chunkSize);
    char* result = RecvMessage("stream1");
    if (result) {
        // 处理识别结果
        free(result);
    }
}

// 停止并清理
StopStream("stream1");
ReleaseSDK();
```

### 2. 批量处理
```cpp
// 初始化SDK
AudioConfig config = {...};
InitSDK(&config);

// 处理多个音频文件
for (const auto& file : audioFiles) {
    string streamId = "stream_" + file.name;
    StartStream(streamId);
    
    // 读取并发送音频数据
    while (file.hasData()) {
        SendAudio(streamId, file.readChunk(), chunkSize);
    }
    
    // 获取最终结果
    char* result = RecvMessage(streamId);
    processResult(result);
    free(result);
    
    StopStream(streamId);
}

ReleaseSDK();
```

### 3. 多流并行处理
```cpp
// 初始化SDK
AudioConfig config = {...};
InitSDK(&config);

// 创建多个音频流
vector<string> streams = {"stream1", "stream2", "stream3"};
for (const auto& streamId : streams) {
    StartStream(streamId);
}

// 并行处理多个音频流
while (hasData) {
    for (const auto& streamId : streams) {
        if (hasDataForStream(streamId)) {
            SendAudio(streamId, getAudioData(streamId), dataSize);
            char* result = RecvMessage(streamId);
            if (result) {
                processResult(streamId, result);
                free(result);
            }
        }
    }
}

// 清理所有流
for (const auto& streamId : streams) {
    StopStream(streamId);
}
ReleaseSDK();
```