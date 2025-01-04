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

//---------------Stream SDK---------------
// AudioStreamConfig SDK配置
type AudioStreamConfig struct {
	ModelPath  string `json:"model"`
	SampleRate int    `json:"sampleRate"`
	BufferSize int    `json:"bufferSize"`
}

// AudioStreamResult 实时识别结果
type AudioStreamResult struct {
	StreamID   string          `json:"streamId"`
	Timestamp  int64           `json:"timestamp"`
	Emotion    string          `json:"emotion"`
	Confidence float64         `json:"confidence"`
	Metadata   AudioStreamMeta `json:"metadata"`
}

// AudioStreamMeta 元数据
type AudioStreamMeta struct {
	AudioLength    int    `json:"audioLength"`
	AdditionalInfo string `json:"additionalInfo"`
}

// AudioStreamSession 音频流会话
type AudioStreamSession struct {
	ID               string
	FeatureExtractor *FeatureExtractor
	Buffer           []float64
	Callback         func([]byte)
	Active           bool
}

// MeowTalkSDK SDK实例
type MeowTalkSDK struct {
	Config    AudioStreamConfig
	Sessions  map[string]*AudioStreamSession
	Processor *SampleProcessor
}
