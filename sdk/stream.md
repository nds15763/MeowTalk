# MeowTalk Stream SDK 接入指南

## 1. 架构概览

### 1.1 核心组件
- **MeowTalkSDK**: SDK全局实例，管理所有音频流会话
- **AudioStreamSession**: 单个音频流会话，包含缓冲区和特征提取器
- **FeatureExtractor**: 音频特征提取器，从音频数据中提取特征
- **情感分类器**: 基于特征进行情感分类

### 1.2 数据流
```
音频输入 -> 特征提取 -> 情感分类 -> 返回结果
```

## 2. 接入流程

### 2.1 初始化SDK
```go
config := AudioStreamConfig{
    ModelPath: "./model",
    SampleRate: 44100,
    BufferSize: 4096,
}
success := InitializeSDK(config)
```

### 2.2 创建音频流会话
```go
streamId := "session_001"
err := StartAudioStream(streamId)
```

### 2.3 发送音频数据并获取结果
```go
// chunk为PCM格式的音频数据
result := SendAudioChunk(streamId, chunk)
// result 为 JSON 格式的识别结果
```

### 2.4 停止会话
```go
err := StopAudioStream(streamId)
```

### 2.5 释放SDK
```go
ReleaseSDK()
```

## 3. 音频要求

### 3.1 音频格式
- 格式：PCM
- 采样率：44100Hz（可配置）
- 位深：16bit
- 通道：单通道

### 3.2 缓冲区大小
- 默认4096个采样点
- 约93ms@44100Hz
- 可通过配置调整

## 4. 结果格式

### 4.1 JSON结构
```json
{
    "streamId": "session_001",
    "timestamp": 1633072800,
    "emotion": "happy",
    "confidence": 0.92,
    "metadata": {
        "audioLength": 4096,
        "features": {
            "zeroCrossRate": 0.15,
            "energy": 0.85,
            "pitch": 220.0
        }
    }
}
```

## 5. 错误处理

### 5.1 常见错误
- SDK未初始化
- 会话不存在
- 音频格式错误
- 缓冲区溢出

### 5.2 错误处理建议
- 检查返回的错误码
- 实现错误重试机制
- 监控会话状态

## 6. 性能优化

### 6.1 音频数据处理
- 合理设置缓冲区大小
- 避免频繁的小数据块处理
- 控制采样率和位深度

### 6.2 资源管理
- 及时释放不用的会话
- 控制并发会话数量
- 定期清理过期会话