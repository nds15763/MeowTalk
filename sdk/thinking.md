# MeowTalk SDK 设计思路

## 核心架构
### 1. 数据结构
- `AudioFeature`: 音频特征向量
  - 时域特征
    - 过零率 (ZeroCrossRate): 信号穿过零点的频率，反映音频的频率特性
    - 能量 (Energy): 信号的平方和，反映音量大小
    - 均方根值 (RootMeanSquare): 能量的平方根，反映有效振幅
  - 频域特征
    - 峰值频率 (PeakFreq): FFT频谱中最大幅度对应的频率
    - 频谱质心 (SpectralCentroid): 频谱的"重心"，反映音色的明亮度
    - 频谱衰减点 (SpectralRolloff): 85%能量对应的频率点
    - 基频 (FundamentalFreq): 使用自相关法估计的基频
  - 统计特征
    - 音高 (Pitch): 使用基频作为音高特征
    - 持续时间 (Duration): 音频片段的长度，单位秒

- `EmotionStatistics`: 情感统计信息
  - 样本数量 (SampleCount): 用于评估统计可靠性
  - 平均特征 (MeanFeature): 特征向量的均值，用于特征匹配
  - 标准差特征 (StdDevFeature): 特征向量的标准差，用于马氏距离计算

- `SampleLibrary`: 样本管理
  - 样本存储 (Samples): map[string][]AudioSample，按情感类型存储
  - 统计信息 (Statistics): map[string]EmotionStatistics，特征统计
  - 更新标记 (NeedUpdate): bool，标记是否需要重新计算统计信息

### 2. 处理流程
1. 音频预处理 (preprocess)
   ```
   输入 -> 去直流分量 -> 加窗(Hamming) -> 归一化
   ```
   - 去直流: 减去信号平均值
   - 加窗: 0.54 - 0.46*cos(2πn/N)
   - 归一化: 信号幅度缩放到[-1,1]

2. 特征提取 (extractFeatures)
   ```
   预处理数据 -> 时域特征计算 -> FFT变换 -> 频域特征计算 -> 特征向量
   ```
   - 时域分析: 直接在波形上计算
   - FFT分析: 2048点FFT变换
   - 频域分析: 在频谱上计算特征

3. 统计计算 (calculateStatistics)
   ```
   样本集合 -> 样本数统计 -> 均值计算 -> 标准差计算 -> 统计特征
   ```
   - 样本统计: 记录每种情感的样本数
   - 均值计算: 一次遍历计算所有特征均值
   - 标准差: 二次遍历计算所有特征标准差

4. 特征匹配 (Match)
   ```
   输入特征 -> 欧氏距离 -> 马氏距离 -> 综合评分 -> 最佳匹配
   ```
   - 欧氏距离: 与每个样本计算，取最小值
   - 马氏距离: 与统计特征计算，考虑分布
   - 综合评分: 0.6*欧氏 + 0.4*马氏

## 算法实现
### 1. 特征计算
```go
// 1. 时域特征
// 过零率: 相邻样本符号变化的比率
zcr = sum(sign(x[n]) != sign(x[n-1])) / (N-1)

// 能量: 样本平方和的平均值
energy = sum(x[n]^2) / N

// 均方根: 能量的平方根
rms = sqrt(energy)

// 2. 频域特征
// FFT变换
X = FFT(x * window)  // 2048点FFT

// 峰值频率: 最大幅度对应的频率
peak_freq = findFreq(argmax(|X|))

// 频谱质心: 频率的加权平均值
centroid = sum(f * |X|) / sum(|X|)

// 频谱衰减: 85%能量点
rolloff = findFreq(cumsum(|X|^2) >= 0.85 * sum(|X|^2))

// 基频估计: 自相关法
f0 = sampleRate / argmax(autocorr(x))
```

### 2. 统计计算
```go
// 1. 样本统计
stats.SampleCount = len(samples)

// 2. 平均值计算
for each sample in samples {
    stats.MeanFeature += sample.Features
}
stats.MeanFeature /= float64(len(samples))

// 3. 标准差计算
for each sample in samples {
    diff = sample.Features - stats.MeanFeature
    stats.StdDevFeature += diff * diff
}
stats.StdDevFeature = sqrt(stats.StdDevFeature / float64(len(samples)))
```

### 3. 特征匹配
```go
// 1. 欧氏距离（样本相似度）
for each sample in emotion_samples {
    d = sqrt(sum((x - sample.Features)^2))
    min_d = min(min_d, d)
}

// 2. 马氏距离（分布相似度）
stats = emotion_statistics
d = sqrt((x - stats.Mean)^T * (1/stats.Std^2) * (x - stats.Mean))

// 3. 综合评分（加权平均）
score = 0.6/(1+min_d) + 0.4/(1+d)
```

## 性能优化
### 1. 计算优化
- FFT优化
  - 使用2的幂次大小 (2048点)
  - 仅计算前半部分频谱
  - 频率索引复用

- 特征计算
  - 向量化计算
  - 避免重复计算
  - 复用中间结果

- 统计更新
  - 懒惰更新策略
  - 增量计算支持
  - 缓存统计结果

### 2. 内存优化
- 音频处理
  - 分帧处理
  - 原地FFT计算
  - 复用计算缓冲区

- 样本管理
  - 哈希映射存储
  - 延迟加载
  - 定期清理

### 3. 并行处理
- 特征提取
  - 文件并行处理
  - 分帧并行计算
  - FFT并行优化

- 样本匹配
  - 多情感并行匹配
  - 批量特征计算
  - 异步统计更新

## 实现状态
### 1. 已实现功能
- 基础功能
  - WAV文件读取和预处理
  - 完整的特征提取流程
  - 基于统计的特征匹配

- 优化特性
  - 增量统计更新
  - 特征归一化
  - 加权距离计算

### 2. 待优化项
- 性能优化
  - FFT计算优化
  - 内存使用优化
  - 并行处理支持

- 功能增强
  - 实时处理支持
  - 噪声抑制
  - 自适应阈值

### 3. 后续规划
- 短期目标
  - 完善错误处理
  - 提高匹配准确率
  - 优化内存使用

- 长期目标
  - 实时处理支持
  - 自适应特征权重
  - 深度学习集成
