# MeowTalk Golang音频识别SDK文档

## 1. 系统架构

### 1.1 核心组件
- **MeowTalkSDK**: SDK全局实例，管理所有音频流会话
- **AudioStreamSession**: 单个音频流会话，包含缓冲区和特征提取器
- **FeatureExtractor**: 音频特征提取器，负责从音频数据中提取特征
- **SampleLibrary**: 样本库管理，存储和统计音频特征
- **情感分类器**: 基于特征进行情感分类

### 1.2 数据流
```
音频输入 -> 预处理 -> 特征提取 -> 特征匹配 -> 情感分类 -> 回调结果
```

## 2. 核心数据结构

### 2.1 音频特征 (AudioFeature)
- **时域特征**
  - 过零率 (ZeroCrossRate)
  - 能量 (Energy)
  - 均方根值 (RootMeanSquare)
- **频域特征**
  - 峰值频率 (PeakFreq)
  - 频谱质心 (SpectralCentroid)
  - 频谱衰减点 (SpectralRolloff)
  - 基频 (FundamentalFreq)
- **统计特征**
  - 音高 (Pitch)
  - 持续时间 (Duration)

### 2.2 情感统计 (EmotionStatistics)
- 样本数量 (SampleCount)
- 平均特征 (MeanFeature)
- 标准差特征 (StdDevFeature)

## 3. 核心算法实现

### 3.1 音频预处理
```go
// 预处理流程
1. 去直流分量: signal -= mean(signal)
2. Hamming窗: window = 0.54 - 0.46*cos(2πn/N)
3. 信号归一化: signal = signal / max(abs(signal))
```

### 3.2 特征提取
```go
// 时域特征计算
zcr = sum(sign(x[n]) != sign(x[n-1])) / (N-1)
energy = sum(x[n]^2) / N
rms = sqrt(energy)

// 频域特征计算
X = FFT(x * window)  // 2048点FFT
peak_freq = findFreq(argmax(|X|))
centroid = sum(f * |X|) / sum(|X|)
rolloff = findFreq(cumsum(|X|^2) >= 0.85 * sum(|X|^2))
```

### 3.3 特征匹配
```go
// 综合评分计算
euclidean_distance = calculateEuclideanDistance(input, sample)
mahalanobis_distance = calculateMahalanobisDistance(input, statistics)
score = 0.6/(1+euclidean_distance) + 0.4/(1+mahalanobis_distance)
```

## 4. SDK使用指南

### 4.1 初始化
```go
config := AudioStreamConfig{
    ModelPath: "./model",
    SampleRate: 44100,
    BufferSize: 4096,
}
success := InitializeSDK(config)
```

### 4.2 音频流处理
```go
// 创建会话
streamId := "session_001"
err := StartAudioStream(streamId)

// 注册回调
callback := func(result []byte) {
    // 处理识别结果
}
err := RegisterCallback(streamId, callback)

// 发送音频数据
err := SendAudioChunk(streamId, audioData)
```

## 5. 性能优化

### 5.1 计算优化
- FFT计算优化
  - 使用2的幂次点数
  - 仅计算前半部分频谱
  - 频率索引复用
- 特征计算向量化
- 统计信息懒惰更新

### 5.2 内存优化
- 分帧处理音频
- 原地FFT计算
- 复用计算缓冲区
- 样本库延迟加载

### 5.3 并行处理
- 多goroutine并行处理音频帧
- 特征提取并行化
- 异步统计更新

## 6. 最佳实践

### 6.1 音频处理建议
- 使用合适的缓冲区大小(40-100ms)
- 实现音频流中断重连机制
- 进行音频质量检测和预处理

### 6.2 错误处理
- 实现错误重试机制
- 保持会话状态一致性
- 资源正确释放

### 6.3 性能监控
- 监控处理延迟
- 跟踪内存使用
- 记录识别准确率

## 7. 开发计划

### 7.1 短期优化
- 完善错误处理机制
- 提高特征匹配准确率
- 优化内存使用效率

### 7.2 长期规划
- 实现实时处理能力
- 引入自适应特征权重
- 集成深度学习模型

## 8. 示例代码

```go
func main() {
    // 初始化SDK
    config := AudioStreamConfig{
        ModelPath: "./model",
        SampleRate: 44100,
        BufferSize: 4096,
    }
    if !InitializeSDK(config) {
        log.Fatal("SDK初始化失败")
    }
    defer ReleaseSDK()

    // 创建音频流会话
    streamId := "session_001"
    if err := StartAudioStream(streamId); err != nil {
        log.Fatal(err)
    }

    // 注册结果回调
    if err := RegisterCallback(streamId, func(result []byte) {
        var r AudioStreamResult
        json.Unmarshal(result, &r)
        fmt.Printf("识别结果: %+v\n", r)
    }); err != nil {
        log.Fatal(err)
    }

    // 音频处理循环
    buffer := make([]byte, 4096)
    for {
        // 处理音频数据
        if err := SendAudioChunk(streamId, buffer); err != nil {
            log.Printf("发送数据错误: %v", err)
            break
        }
    }

    // 停止会话
    StopAudioStream(streamId)
}
``` 