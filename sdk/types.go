package main

// AudioFeature 存储提取的特征
type AudioFeature struct {
	// 时域特征
	ZeroCrossRate  float64 // 过零率
	Energy         float64 // 能量
	RootMeanSquare float64 // 均方根值
	Duration       float64 // 持续时间

	// 频域特征
	Pitch            float64 // 音高
	PeakFreq         float64 // 峰值频率
	SpectralCentroid float64 // 频谱质心
	SpectralRolloff  float64 // 频谱衰减点
	FundamentalFreq  float64 // 基频
}

// AudioSample 音频样本
type AudioSample struct {
	FilePath string       // 音频文件路径
	Emotion  string       // 情感类型
	Features AudioFeature // 提取的特征
}

// EmotionStatistics 情感统计信息
type EmotionStatistics struct {
	SampleCount   int          // 样本数量
	MeanFeature   AudioFeature // 平均特征值
	StdDevFeature AudioFeature // 标准差
}

// FeatureStatistics 特征统计
type FeatureStatistics struct {
	ZeroCrossRateAvg    float64 // 过零率平均值
	RootMeanSquareAvg   float64 // 均方根平均值
	SpectralCentroidAvg float64 // 频谱质心平均值
	SpectralRolloffAvg  float64 // 频谱衰减点平均值
	FundamentalFreqAvg  float64 // 基频平均值
	DurationAvg         float64 // 持续时间平均值
}

// SampleLibrary 样本库
type SampleLibrary struct {
	Samples    map[string][]AudioSample     // 按情感类型存储的原始样本
	Statistics map[string]EmotionStatistics // 每种情感的统计信息
	NeedUpdate bool                         // 是否需要更新统计信息
}

// SampleProcessor 样本处理器
type SampleProcessor struct {
	Library     *SampleLibrary // 样本库
	SampleRate  int            // 采样率
	WindowSize  int            // 窗口大小
	FFTSize     int            // FFT大小
	FrameLength float64        // 帧长（毫秒）
}
