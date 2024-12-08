package main

import (
	"encoding/binary"
	"encoding/json"
	"math"
	"os"
)

// AudioData 表示音频数据
type AudioData struct {
	Samples    []float64
	SampleRate int
}

// AudioFeature 存储提取的特征
type AudioFeature struct {
	ZeroCrossRate float64
	Energy        float64
	Pitch         float64
	Duration      float64
	PeakFreq      float64
}

// EmotionSamples 存储每种情感的样本集
type EmotionSamples struct {
	Emotion         string
	Features        []AudioFeature
	MeanFeature     AudioFeature
	StdDevFeature   AudioFeature
	UpdatedFeatures bool
}

// SampleLibrary 样本库
type SampleLibrary struct {
	emotions map[string]*EmotionSamples
}

// FeatureExtractor 特征提取器
type FeatureExtractor struct {
	sampleRate int
	frameSize  int
}

// 创建新的特征提取器
func NewFeatureExtractor(sampleRate int) *FeatureExtractor {
	return &FeatureExtractor{
		sampleRate: sampleRate,
		frameSize:  int(float64(sampleRate) * 0.025), // 25ms帧
	}
}

// LoadWavFile 加载WAV文件
func LoadWavFile(filename string) (*AudioData, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	// 跳过WAV头部
	header := make([]byte, 44)
	if _, err := file.Read(header); err != nil {
		return nil, err
	}

	// 读取采样率
	sampleRate := int(binary.LittleEndian.Uint32(header[24:28]))

	// 读取音频数据
	data := make([]byte, 0)
	buffer := make([]byte, 1024)
	for {
		n, err := file.Read(buffer)
		if err != nil {
			break
		}
		data = append(data, buffer[:n]...)
	}

	// 转换为float64
	samples := make([]float64, len(data)/2)
	for i := 0; i < len(samples); i++ {
		sample := float64(int16(binary.LittleEndian.Uint16(data[i*2 : (i+1)*2])))
		samples[i] = sample / 32768.0 // 归一化到 [-1,1]
	}

	return &AudioData{
		Samples:    samples,
		SampleRate: sampleRate,
	}, nil
}

// Extract 提取特征
func (fe *FeatureExtractor) Extract(audio *AudioData) AudioFeature {
	frames := fe.splitFrames(audio.Samples)

	feature := AudioFeature{
		ZeroCrossRate: fe.calculateZeroCrossRate(audio.Samples),
		Energy:        fe.calculateEnergy(audio.Samples),
		Pitch:         fe.estimatePitch(audio.Samples),
		Duration:      float64(len(audio.Samples)) / float64(audio.SampleRate),
		PeakFreq:      fe.calculatePeakFrequency(audio.Samples),
	}

	return feature
}

// splitFrames 将音频分帧
func (fe *FeatureExtractor) splitFrames(samples []float64) [][]float64 {
	frameCount := len(samples) / fe.frameSize
	frames := make([][]float64, frameCount)

	for i := 0; i < frameCount; i++ {
		start := i * fe.frameSize
		end := start + fe.frameSize
		if end > len(samples) {
			end = len(samples)
		}
		frames[i] = samples[start:end]
	}

	return frames
}

// calculateZeroCrossRate 计算过零率
func (fe *FeatureExtractor) calculateZeroCrossRate(samples []float64) float64 {
	crossings := 0
	for i := 1; i < len(samples); i++ {
		if (samples[i-1] >= 0 && samples[i] < 0) || (samples[i-1] < 0 && samples[i] >= 0) {
			crossings++
		}
	}
	return float64(crossings) / float64(len(samples))
}

// calculateEnergy 计算能量
func (fe *FeatureExtractor) calculateEnergy(samples []float64) float64 {
	var energy float64
	for _, sample := range samples {
		energy += sample * sample
	}
	return energy / float64(len(samples))
}

// estimatePitch 估计基音频率
func (fe *FeatureExtractor) estimatePitch(samples []float64) float64 {
	minLag := fe.sampleRate / 1000 // 1000 Hz
	maxLag := fe.sampleRate / 50   // 50 Hz

	var maxCorr float64
	var bestLag int

	for lag := minLag; lag <= maxLag; lag++ {
		var corr float64
		for i := 0; i < len(samples)-lag; i++ {
			corr += samples[i] * samples[i+lag]
		}
		if corr > maxCorr {
			maxCorr = corr
			bestLag = lag
		}
	}

	if bestLag == 0 {
		return 0
	}
	return float64(fe.sampleRate) / float64(bestLag)
}

// calculatePeakFrequency 计算峰值频率
func (fe *FeatureExtractor) calculatePeakFrequency(samples []float64) float64 {
	// 简单FFT实现
	n := len(samples)
	fft := make([]complex128, n)
	for i, sample := range samples {
		fft[i] = complex(sample, 0)
	}

	// Cooley-Tukey FFT
	for step := 2; step <= n; step *= 2 {
		for i := 0; i < n; i += step {
			for j := i; j < i+step/2; j++ {
				t := cmplxFromAngle(-2 * math.Pi * float64(j-i) / float64(step))
				t = cmplxMul(t, fft[j+step/2])

				fft[j+step/2] = cmplxSub(fft[j], t)
				fft[j] = cmplxAdd(fft[j], t)
			}
		}
	}

	// 找出幅度最大的频率
	maxMagnitude := 0.0
	peakIndex := 0
	for i := 0; i < n/2; i++ {
		magnitude := cmplxAbs(fft[i])
		if magnitude > maxMagnitude {
			maxMagnitude = magnitude
			peakIndex = i
		}
	}

	return float64(peakIndex) * float64(fe.sampleRate) / float64(n)
}

// 复数运算辅助函数
func cmplxFromAngle(angle float64) complex128 {
	return complex(math.Cos(angle), math.Sin(angle))
}

func cmplxMul(a, b complex128) complex128 {
	return complex(
		real(a)*real(b)-imag(a)*imag(b),
		real(a)*imag(b)+imag(a)*real(b),
	)
}

func cmplxAdd(a, b complex128) complex128 {
	return complex(real(a)+real(b), imag(a)+imag(b))
}

func cmplxSub(a, b complex128) complex128 {
	return complex(real(a)-real(b), imag(a)-imag(b))
}

func cmplxAbs(a complex128) float64 {
	return math.Sqrt(real(a)*real(a) + imag(a)*imag(a))
}

// NewSampleLibrary 创建新的样本库
func NewSampleLibrary() *SampleLibrary {
	return &SampleLibrary{
		emotions: make(map[string]*EmotionSamples),
	}
}

// AddSample 添加样本
func (sl *SampleLibrary) AddSample(emotion string, feature AudioFeature) {
	if _, exists := sl.emotions[emotion]; !exists {
		sl.emotions[emotion] = &EmotionSamples{
			Emotion:  emotion,
			Features: make([]AudioFeature, 0),
		}
	}
	sl.emotions[emotion].Features = append(sl.emotions[emotion].Features, feature)
	sl.emotions[emotion].UpdatedFeatures = true
}

// SaveToFile 保存样本库到文件
func (sl *SampleLibrary) SaveToFile(filename string) error {
	file, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	return encoder.Encode(sl.emotions)
}

// LoadFromFile 从文件加载样本库
func (sl *SampleLibrary) LoadFromFile(filename string) error {
	file, err := os.Open(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	decoder := json.NewDecoder(file)
	return decoder.Decode(&sl.emotions)
}

// updateEmotionStats 更新情感统计信息
func (sl *SampleLibrary) updateEmotionStats(emotion string) {
	samples := sl.emotions[emotion]
	if !samples.UpdatedFeatures {
		return
	}

	var sumFeature AudioFeature
	count := float64(len(samples.Features))

	// 计算平均值
	for _, f := range samples.Features {
		sumFeature.ZeroCrossRate += f.ZeroCrossRate
		sumFeature.Energy += f.Energy
		sumFeature.Pitch += f.Pitch
		sumFeature.Duration += f.Duration
		sumFeature.PeakFreq += f.PeakFreq
	}

	samples.MeanFeature = AudioFeature{
		ZeroCrossRate: sumFeature.ZeroCrossRate / count,
		Energy:        sumFeature.Energy / count,
		Pitch:         sumFeature.Pitch / count,
		Duration:      sumFeature.Duration / count,
		PeakFreq:      sumFeature.PeakFreq / count,
	}

	// 计算标准差
	var sumSquareDiff AudioFeature
	for _, f := range samples.Features {
		sumSquareDiff.ZeroCrossRate += math.Pow(f.ZeroCrossRate-samples.MeanFeature.ZeroCrossRate, 2)
		sumSquareDiff.Energy += math.Pow(f.Energy-samples.MeanFeature.Energy, 2)
		sumSquareDiff.Pitch += math.Pow(f.Pitch-samples.MeanFeature.Pitch, 2)
		sumSquareDiff.Duration += math.Pow(f.Duration-samples.MeanFeature.Duration, 2)
		sumSquareDiff.PeakFreq += math.Pow(f.PeakFreq-samples.MeanFeature.PeakFreq, 2)
	}

	samples.StdDevFeature = AudioFeature{
		ZeroCrossRate: math.Sqrt(sumSquareDiff.ZeroCrossRate / count),
		Energy:        math.Sqrt(sumSquareDiff.Energy / count),
		Pitch:         math.Sqrt(sumSquareDiff.Pitch / count),
		Duration:      math.Sqrt(sumSquareDiff.Duration / count),
		PeakFreq:      math.Sqrt(sumSquareDiff.PeakFreq / count),
	}

	samples.UpdatedFeatures = false
}

// Match 匹配音频特征
func (sl *SampleLibrary) Match(feature AudioFeature) (string, float64) {
	var bestMatch string
	var maxScore float64 = -1

	for emotion, samples := range sl.emotions {
		sl.updateEmotionStats(emotion)

		// 计算与该情感所有样本的最小距离
		minDistance := math.MaxFloat64
		for _, sampleFeature := range samples.Features {
			distance := calculateEuclideanDistance(feature, sampleFeature)
			if distance < minDistance {
				minDistance = distance
			}
		}

		// 计算马氏距离
		mahalanobisDistance := calculateMahalanobisDistance(
			feature,
			samples.MeanFeature,
			samples.StdDevFeature,
		)

		// 综合评分
		score := 0.6*(1.0/(1.0+minDistance)) + 0.4*(1.0/(1.0+mahalanobisDistance))

		if score > maxScore {
			maxScore = score
			bestMatch = emotion
		}
	}

	return bestMatch, maxScore
}

// calculateEuclideanDistance 计算欧氏距离
func calculateEuclideanDistance(f1, f2 AudioFeature) float64 {
	return math.Sqrt(
		math.Pow(f1.ZeroCrossRate-f2.ZeroCrossRate, 2) +
			math.Pow(f1.Energy-f2.Energy, 2) +
			math.Pow(f1.Pitch-f2.Pitch, 2) +
			math.Pow(f1.Duration-f2.Duration, 2) +
			math.Pow(f1.PeakFreq-f2.PeakFreq, 2),
	)
}

// calculateMahalanobisDistance 计算马氏距离
func calculateMahalanobisDistance(feature, mean, stdDev AudioFeature) float64 {
	const epsilon = 1e-10

	return math.Sqrt(
		math.Pow((feature.ZeroCrossRate-mean.ZeroCrossRate)/(stdDev.ZeroCrossRate+epsilon), 2) +
			math.Pow((feature.Energy-mean.Energy)/(stdDev.Energy+epsilon), 2) +
			math.Pow((feature.Pitch-mean.Pitch)/(stdDev.Pitch+epsilon), 2) +
			math.Pow((feature.Duration-mean.Duration)/(stdDev.Duration+epsilon), 2) +
			math.Pow((feature.PeakFreq-mean.PeakFreq)/(stdDev.PeakFreq+epsilon), 2),
	)
}
