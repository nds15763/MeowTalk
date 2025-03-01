package main

import (
	"encoding/json"
	"math"
	"os"
)

// NewSampleLibrary 创建新的样本库
func NewSampleLibrary() *SampleLibrary {
	return &SampleLibrary{
		Samples:    make(map[string][]AudioSample),
		Statistics: make(map[string]EmotionStatistics),
		NeedUpdate: false,
	}
}

// AddSample 添加样本
func (sl *SampleLibrary) AddSample(sample AudioSample) {
	emotion := sample.Emotion
	if _, exists := sl.Samples[emotion]; !exists {
		sl.Samples[emotion] = make([]AudioSample, 0)
	}
	sl.Samples[emotion] = append(sl.Samples[emotion], sample)
	sl.NeedUpdate = true
}

// updateStatistics 更新统计信息
func (sl *SampleLibrary) updateStatistics() {
	if !sl.NeedUpdate {
		return
	}

	for emotion, samples := range sl.Samples {
		if len(samples) == 0 {
			continue
		}

		// 初始化统计数据
		stats := EmotionStatistics{
			SampleCount: len(samples),
		}

		// 计算平均值
		for _, sample := range samples {
			stats.MeanFeature.ZeroCrossRate += sample.Features.ZeroCrossRate
			stats.MeanFeature.Energy += sample.Features.Energy
			stats.MeanFeature.Pitch += sample.Features.Pitch
			stats.MeanFeature.Duration += sample.Features.Duration
			stats.MeanFeature.PeakFreq += sample.Features.PeakFreq
			stats.MeanFeature.RootMeanSquare += sample.Features.RootMeanSquare
			stats.MeanFeature.SpectralCentroid += sample.Features.SpectralCentroid
			stats.MeanFeature.SpectralRolloff += sample.Features.SpectralRolloff
			stats.MeanFeature.FundamentalFreq += sample.Features.FundamentalFreq
		}

		count := float64(len(samples))
		stats.MeanFeature.ZeroCrossRate /= count
		stats.MeanFeature.Energy /= count
		stats.MeanFeature.Pitch /= count
		stats.MeanFeature.Duration /= count
		stats.MeanFeature.PeakFreq /= count
		stats.MeanFeature.RootMeanSquare /= count
		stats.MeanFeature.SpectralCentroid /= count
		stats.MeanFeature.SpectralRolloff /= count
		stats.MeanFeature.FundamentalFreq /= count

		// 计算标准差
		for _, sample := range samples {
			stats.StdDevFeature.ZeroCrossRate += math.Pow(sample.Features.ZeroCrossRate-stats.MeanFeature.ZeroCrossRate, 2)
			stats.StdDevFeature.Energy += math.Pow(sample.Features.Energy-stats.MeanFeature.Energy, 2)
			stats.StdDevFeature.Pitch += math.Pow(sample.Features.Pitch-stats.MeanFeature.Pitch, 2)
			stats.StdDevFeature.Duration += math.Pow(sample.Features.Duration-stats.MeanFeature.Duration, 2)
			stats.StdDevFeature.PeakFreq += math.Pow(sample.Features.PeakFreq-stats.MeanFeature.PeakFreq, 2)
			stats.StdDevFeature.RootMeanSquare += math.Pow(sample.Features.RootMeanSquare-stats.MeanFeature.RootMeanSquare, 2)
			stats.StdDevFeature.SpectralCentroid += math.Pow(sample.Features.SpectralCentroid-stats.MeanFeature.SpectralCentroid, 2)
			stats.StdDevFeature.SpectralRolloff += math.Pow(sample.Features.SpectralRolloff-stats.MeanFeature.SpectralRolloff, 2)
			stats.StdDevFeature.FundamentalFreq += math.Pow(sample.Features.FundamentalFreq-stats.MeanFeature.FundamentalFreq, 2)
		}

		stats.StdDevFeature.ZeroCrossRate = math.Sqrt(stats.StdDevFeature.ZeroCrossRate / count)
		stats.StdDevFeature.Energy = math.Sqrt(stats.StdDevFeature.Energy / count)
		stats.StdDevFeature.Pitch = math.Sqrt(stats.StdDevFeature.Pitch / count)
		stats.StdDevFeature.Duration = math.Sqrt(stats.StdDevFeature.Duration / count)
		stats.StdDevFeature.PeakFreq = math.Sqrt(stats.StdDevFeature.PeakFreq / count)
		stats.StdDevFeature.RootMeanSquare = math.Sqrt(stats.StdDevFeature.RootMeanSquare / count)
		stats.StdDevFeature.SpectralCentroid = math.Sqrt(stats.StdDevFeature.SpectralCentroid / count)
		stats.StdDevFeature.SpectralRolloff = math.Sqrt(stats.StdDevFeature.SpectralRolloff / count)
		stats.StdDevFeature.FundamentalFreq = math.Sqrt(stats.StdDevFeature.FundamentalFreq / count)

		sl.Statistics[emotion] = stats
	}

	sl.NeedUpdate = false
}

// Match 匹配音频特征
func (sl *SampleLibrary) Match(feature AudioFeature) (string, float64) {
	sl.updateStatistics()

	var bestMatch string
	var maxScore float64 = -1

	for emotion, samples := range sl.Samples {
		if len(samples) == 0 {
			continue
		}

		// 计算与该情感所有样本的最小欧氏距离
		minEuclideanDistance := math.MaxFloat64
		for _, sample := range samples {
			distance := calculateEuclideanDistance(feature, sample.Features)
			if distance < minEuclideanDistance {
				minEuclideanDistance = distance
			}
		}

		// 计算马氏距离
		stats := sl.Statistics[emotion]
		mahalanobisDistance := calculateMahalanobisDistance(feature, stats.MeanFeature, stats.StdDevFeature)

		// 综合评分（结合欧氏距离和马氏距离）
		score := 0.6*(1.0/(1.0+minEuclideanDistance)) + 0.4*(1.0/(1.0+mahalanobisDistance))

		if score > maxScore {
			maxScore = score
			bestMatch = emotion
		}
	}

	return bestMatch, maxScore
}

// SaveToFile 保存样本库到文件
func (sl *SampleLibrary) SaveToFile(filename string) error {
	sl.updateStatistics() // 确保统计信息是最新的

	file, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	return encoder.Encode(sl)
}

// LoadFromFile 从文件加载样本库
func (sl *SampleLibrary) LoadFromFile(filename string) error {
	file, err := os.Open(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	decoder := json.NewDecoder(file)
	return decoder.Decode(sl)
}

// calculateEuclideanDistance 计算欧氏距离
func calculateEuclideanDistance(f1, f2 AudioFeature) float64 {
	return math.Sqrt(
		math.Pow(f1.ZeroCrossRate-f2.ZeroCrossRate, 2) +
			math.Pow(f1.Energy-f2.Energy, 2) +
			math.Pow(f1.Pitch-f2.Pitch, 2) +
			math.Pow(f1.Duration-f2.Duration, 2) +
			math.Pow(f1.PeakFreq-f2.PeakFreq, 2) +
			math.Pow(f1.RootMeanSquare-f2.RootMeanSquare, 2) +
			math.Pow(f1.SpectralCentroid-f2.SpectralCentroid, 2) +
			math.Pow(f1.SpectralRolloff-f2.SpectralRolloff, 2) +
			math.Pow(f1.FundamentalFreq-f2.FundamentalFreq, 2),
	)
}

// calculateMahalanobisDistance 计算马氏距离
func calculateMahalanobisDistance(feature, mean, stdDev AudioFeature) float64 {
	const epsilon = 1e-10 // 避免除以零

	return math.Sqrt(
		math.Pow((feature.ZeroCrossRate-mean.ZeroCrossRate)/(stdDev.ZeroCrossRate+epsilon), 2) +
			math.Pow((feature.Energy-mean.Energy)/(stdDev.Energy+epsilon), 2) +
			math.Pow((feature.Pitch-mean.Pitch)/(stdDev.Pitch+epsilon), 2) +
			math.Pow((feature.Duration-mean.Duration)/(stdDev.Duration+epsilon), 2) +
			math.Pow((feature.PeakFreq-mean.PeakFreq)/(stdDev.PeakFreq+epsilon), 2) +
			math.Pow((feature.RootMeanSquare-mean.RootMeanSquare)/(stdDev.RootMeanSquare+epsilon), 2) +
			math.Pow((feature.SpectralCentroid-mean.SpectralCentroid)/(stdDev.SpectralCentroid+epsilon), 2) +
			math.Pow((feature.SpectralRolloff-mean.SpectralRolloff)/(stdDev.SpectralRolloff+epsilon), 2) +
			math.Pow((feature.FundamentalFreq-mean.FundamentalFreq)/(stdDev.FundamentalFreq+epsilon), 2),
	)
}
