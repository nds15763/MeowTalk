# MeowTalk Stream SDK 接入指南

## 1. 架构概览

### 1.1 核心组件
- **MeowTalkSDK**: SDK全局实例，管理所有音频流会话
- **AudioStreamSession**: 单个音频流会话，包含缓冲区和特征提取器
- **FeatureExtractor**: 音频特征提取器，从音频数据中提取特征
- **情感分类器**: 基于特征进行情感分类（待实现）

### 1.2 数据流
```
音频输入 -> 缓冲区 -> 特征提取 -> 情感分类 -> 回调结果
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

### 2.3 注册回调函数
```go
callback := func(result []byte) {
    // 处理JSON格式的识别结果
    // result 结构参考 AudioStreamResult
}
err := RegisterCallback(streamId, callback)
```

### 2.4 发送音频数据
```go
// chunk为PCM格式的音频数据
err := SendAudioChunk(streamId, chunk)
```

### 2.5 停止会话
```go
err := StopAudioStream(streamId)
```

### 2.6 释放SDK
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
        "additionalInfo": "Features: {...}"
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
- 总是检查返回的error
- 实现错误重试机制
- 监控会话状态

## 6. 性能优化

### 6.1 缓冲区管理
- 适当的缓冲区大小
- 及时处理音频数据
- 避免内存泄漏

### 6.2 并发处理
- 使用goroutine处理音频
- 注意线程安全
- 合理使用锁机制

## 7. 最佳实践

### 7.1 初始化
- 应用启动时初始化SDK
- 确保模型文件存在
- 验证配置参数

### 7.2 音频处理
- 固定大小的数据块
- 定期清理缓冲区
- 监控处理延迟

### 7.3 资源管理
- 及时关闭不用的会话
- 正确释放SDK资源
- 实现优雅关闭

## 8. 调试建议

### 8.1 日志
- 记录关键操作
- 监控处理时间
- 跟踪错误信息

### 8.2 监控
- 缓冲区使用情况
- 处理延迟
- 识别准确率

## 9. 示例代码

### 9.1 完整使用示例
```go
func main() {
    // 1. 初始化SDK
    config := AudioStreamConfig{
        ModelPath: "./model",
        SampleRate: 44100,
        BufferSize: 4096,
    }
    if !InitializeSDK(config) {
        log.Fatal("SDK初始化失败")
    }
    defer ReleaseSDK()

    // 2. 创建会话
    streamId := "session_001"
    if err := StartAudioStream(streamId); err != nil {
        log.Fatal(err)
    }

    // 3. 注册回调
    if err := RegisterCallback(streamId, func(result []byte) {
        var r AudioStreamResult
        json.Unmarshal(result, &r)
        fmt.Printf("识别结果: %+v\n", r)
    }); err != nil {
        log.Fatal(err)
    }

    // 4. 发送音频数据
    // 这里示例每次发送4096字节的数据
    buffer := make([]byte, 4096)
    for {
        // 从音频源读取数据
        if err := SendAudioChunk(streamId, buffer); err != nil {
            log.Printf("发送数据错误: %v", err)
            break
        }
    }

    // 5. 停止会话
    StopAudioStream(streamId)
}
```

## 10. 常见问题

### Q1: 如何选择合适的缓冲区大小？
A: 缓冲区大小影响延迟和准确率，建议在40-100ms之间，对应44100Hz采样率的1764-4410个采样点。

### Q2: 如何处理音频流中断？
A: 实现重连机制，保持会话状态，在恢复连接后继续处理。

### Q3: 如何优化识别准确率？
A: 调整缓冲区大小，使用降噪预处理，确保音频质量。 