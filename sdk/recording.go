package main

import (
	"encoding/json"
	"fmt"
	"math"
	"math/cmplx"
	"os"
	"path/filepath"

	"github.com/go-audio/audio"
	"github.com/go-audio/wav"
)

// NewSampleProcessor 创建新的样本处理器实例
func NewSampleProcessor(config AudioStreamConfig) *SampleProcessor {
	return &SampleProcessor{
		Library: &SampleLibrary{
			Samples:    make(map[string][]AudioSample),
			Statistics: make(map[string]EmotionStatistics),
		},
		SampleRate: func() int {
			if config.SampleRate == 0 {
				return 44100
			}
			return config.SampleRate
		}(), // 默认采样率
		WindowSize: func() int {
			if config.BufferSize == 0 {
				return 1024
			}
			return config.BufferSize
		}(), // 默认窗口大小
		FFTSize:     2048, // 默认FFT大小
		FrameLength: 25.0, // 默认帧长（毫秒）
	}
}

// 加载音频文件
func loadAudioFile(filePath string) ([]float64, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	decoder := wav.NewDecoder(file)
	if !decoder.IsValidFile() {
		return nil, fmt.Errorf("invalid WAV file")
	}

	audioData := make([]float64, 0)
	buf := &audio.IntBuffer{Data: make([]int, 1024), Format: &audio.Format{}}

	for {
		n, err := decoder.PCMBuffer(buf)
		if err != nil {
			break
		}
		if n == 0 {
			break
		}

		// 转换为float64
		for _, sample := range buf.Data[:n] {
			audioData = append(audioData, float64(sample)/32768.0) // 16-bit归一化
		}
	}

	return audioData, nil
}

// 预处理音频数据
func preprocess(audioData []float64) []float64 {
	// 1. 去直流分量
	mean := 0.0
	for _, sample := range audioData {
		mean += sample
	}
	mean /= float64(len(audioData))

	processed := make([]float64, len(audioData))
	for i, sample := range audioData {
		processed[i] = sample - mean
	}

	// 2. 应用汉明窗
	for i := range processed {
		multiplier := 0.54 - 0.46*math.Cos(2*math.Pi*float64(i)/float64(len(processed)-1))
		processed[i] *= multiplier
	}

	return processed
}

// 计算过零率
func calculateZeroCrossRate(data []float64) float64 {
	crossings := 0
	for i := 1; i < len(data); i++ {
		if (data[i-1] >= 0 && data[i] < 0) || (data[i-1] < 0 && data[i] >= 0) {
			crossings++
		}
	}
	return float64(crossings) / float64(len(data)-1)
}

// 计算能量
func calculateEnergy(data []float64) float64 {
	energy := 0.0
	for _, sample := range data {
		energy += sample * sample
	}
	return energy / float64(len(data))
}

// 计算RMS
func calculateRMS(data []float64) float64 {
	return math.Sqrt(calculateEnergy(data))
}

// 提取音频特征
func extractFeatures(processedAudio []float64) AudioFeature {
	// 基本特征计算
	zeroCrossRate := calculateZeroCrossRate(processedAudio)
	energy := calculateEnergy(processedAudio)
	rms := calculateRMS(processedAudio)

	// FFT计算
	fftData := performFFT(processedAudio)
	peakFreq := findPeakFrequency(fftData)
	spectralCentroid := calculateSpectralCentroid(fftData)
	spectralRolloff := calculateSpectralRolloff(fftData)
	fundamentalFreq := estimateFundamentalFrequency(fftData)

	return AudioFeature{
		ZeroCrossRate:    zeroCrossRate,
		Energy:           energy,
		RootMeanSquare:   rms,
		PeakFreq:         peakFreq,
		SpectralCentroid: spectralCentroid,
		SpectralRolloff:  spectralRolloff,
		FundamentalFreq:  fundamentalFreq,
		Duration:         float64(len(processedAudio)) / 44100.0, // 假设采样率44.1kHz
		Pitch:            fundamentalFreq,                        // 使用基频作为音高特征
	}
}

// ProcessAudioFile处理单个音频文件
func (p *SampleProcessor) ProcessAudioFile(filePath string, emotion string) error {
	// 1. 加载音频文件
	audioData, err := loadAudioFile(filePath)
	if err != nil {
		return fmt.Errorf("加载音频失败: %v", err)
	}

	// 2. 预处理
	processedAudio := preprocess(audioData)

	// 3. 提取特征
	features := extractFeatures(processedAudio)

	// 4. 创建样本
	sample := AudioSample{
		FilePath: filePath,
		Emotion:  emotion,
		Features: features,
	}

	// 5. 添加到样本库
	p.Library.Samples[emotion] = append(p.Library.Samples[emotion], sample)

	return nil
}

// performFFT 实现快速傅里叶变换
func performFFT(data []float64) []complex128 {
	n := len(data)
	// 确保输入长度是2的幂
	if n&(n-1) != 0 {
		// 如果不是2的幂，补零到最近的2的幂
		nextPow2 := 1
		for nextPow2 < n {
			nextPow2 <<= 1
		}
		paddedData := make([]float64, nextPow2)
		copy(paddedData, data)
		data = paddedData
		n = nextPow2
	}

	// 初始化FFT数据
	fft := make([]complex128, n)
	for i, val := range data {
		fft[i] = complex(val, 0)
	}

	// 位反转排序
	for i := 0; i < n; i++ {
		j := bitReverse(i, n)
		if i < j {
			fft[i], fft[j] = fft[j], fft[i]
		}
	}

	// FFT蝶形运算
	for size := 2; size <= n; size *= 2 {
		halfSize := size / 2
		omega := -2 * math.Pi / float64(size)

		for i := 0; i < n; i += size {
			for j := 0; j < halfSize; j++ {
				k := i + j
				l := k + halfSize
				twiddle := cmplx.Rect(1, omega*float64(j))
				temp := fft[l] * twiddle
				fft[l] = fft[k] - temp
				fft[k] = fft[k] + temp
			}
		}
	}

	return fft
}

// bitReverse 实现位反转
func bitReverse(x, n int) int {
	result := 0
	for i := 0; i < int(math.Log2(float64(n))); i++ {
		result = (result << 1) | (x & 1)
		x >>= 1
	}
	return result
}

// findPeakFrequency 查找频谱中的峰值频率
func findPeakFrequency(fftData []complex128) float64 {
	if len(fftData) == 0 {
		return 0
	}

	// 计算幅度谱
	maxMagnitude := 0.0
	peakIndex := 0

	// 只考虑前半部分（由于FFT的对称性）
	for i := 0; i < len(fftData)/2; i++ {
		magnitude := cmplx.Abs(fftData[i])
		if magnitude > maxMagnitude {
			maxMagnitude = magnitude
			peakIndex = i
		}
	}

	// 将索引转换为频率（假设采样率为44100Hz）
	sampleRate := 44100.0
	frequency := float64(peakIndex) * sampleRate / float64(len(fftData))

	return frequency
}

// calculateSpectralCentroid 计算频谱质心
func calculateSpectralCentroid(fftData []complex128) float64 {
	if len(fftData) == 0 {
		return 0
	}

	var weightedSum float64
	var magnitudeSum float64
	sampleRate := 44100.0

	// 只使用前半部分频谱
	for i := 0; i < len(fftData)/2; i++ {
		magnitude := cmplx.Abs(fftData[i])
		frequency := float64(i) * sampleRate / float64(len(fftData))

		weightedSum += magnitude * frequency
		magnitudeSum += magnitude
	}

	if magnitudeSum == 0 {
		return 0
	}

	return weightedSum / magnitudeSum
}

// calculateSpectralRolloff 计算频谱衰减点（85%能量点）
func calculateSpectralRolloff(fftData []complex128) float64 {
	if len(fftData) == 0 {
		return 0
	}

	// 计算总能量
	totalEnergy := 0.0
	energies := make([]float64, len(fftData)/2)

	for i := 0; i < len(fftData)/2; i++ {
		energy := cmplx.Abs(fftData[i])
		energies[i] = energy
		totalEnergy += energy
	}

	// 寻找85%能量点
	threshold := totalEnergy * 0.85
	currentEnergy := 0.0
	rolloffIndex := 0

	for i, energy := range energies {
		currentEnergy += energy
		if currentEnergy >= threshold {
			rolloffIndex = i
			break
		}
	}

	// 转换为频率
	sampleRate := 44100.0
	frequency := float64(rolloffIndex) * sampleRate / float64(len(fftData))

	return frequency
}

// estimateFundamentalFrequency 估计基频（使用自相关法）
func estimateFundamentalFrequency(fftData []complex128) float64 {
	if len(fftData) == 0 {
		return 0
	}

	// 转换回时域
	signal := make([]float64, len(fftData))
	for i := 0; i < len(fftData); i++ {
		signal[i] = real(fftData[i])
	}

	// 计算自相关
	maxLag := len(signal) / 2
	maxCorrelation := 0.0
	period := 0

	for lag := 1; lag < maxLag; lag++ {
		correlation := 0.0
		for i := 0; i < len(signal)-lag; i++ {
			correlation += signal[i] * signal[i+lag]
		}
		correlation /= float64(len(signal) - lag)

		if correlation > maxCorrelation {
			maxCorrelation = correlation
			period = lag
		}
	}

	// 转换为频率
	if period == 0 {
		return 0
	}

	sampleRate := 44100.0
	return sampleRate / float64(period)
}

// calculateStatistics 计算每种情感的特征统计值
func (p *SampleProcessor) calculateStatistics() {
	// 对每种情感分别计算统计特征
	for emotion, samples := range p.Library.Samples {
		if len(samples) == 0 {
			continue
		}

		stats := EmotionStatistics{
			SampleCount:   len(samples),
			MeanFeature:   AudioFeature{},
			StdDevFeature: AudioFeature{},
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

		// 存储统计结果
		p.Library.Statistics[emotion] = stats

		// 打印统计信息
		fmt.Printf("情感 %s 的统计特征:\n", emotion)
		fmt.Printf("  样本数量: %d\n", stats.SampleCount)
		fmt.Printf("  平均过零率: %.4f (std: %.4f)\n", stats.MeanFeature.ZeroCrossRate, stats.StdDevFeature.ZeroCrossRate)
		fmt.Printf("  平均均方根: %.4f (std: %.4f)\n", stats.MeanFeature.RootMeanSquare, stats.StdDevFeature.RootMeanSquare)
		fmt.Printf("  平均频谱质心: %.4f (std: %.4f)\n", stats.MeanFeature.SpectralCentroid, stats.StdDevFeature.SpectralCentroid)
		fmt.Printf("  平均频谱衰减: %.4f (std: %.4f)\n", stats.MeanFeature.SpectralRolloff, stats.StdDevFeature.SpectralRolloff)
		fmt.Printf("  平均基频: %.4f (std: %.4f)\n", stats.MeanFeature.FundamentalFreq, stats.StdDevFeature.FundamentalFreq)
		fmt.Printf("  平均持续时间: %.4f秒 (std: %.4f)\n", stats.MeanFeature.Duration, stats.StdDevFeature.Duration)
	}
}

// ProcessDirectory 处理指定目录下的所有音频文件
func (p *SampleProcessor) ProcessDirectory(dirPath string) error {
	// 确保目录存在
	if _, err := os.Stat(dirPath); os.IsNotExist(err) {
		return fmt.Errorf("目录不存在: %s", dirPath)
	}

	// 遍历目录结构：dirPath/emotion/audio_files
	emotions, err := os.ReadDir(dirPath)
	if err != nil {
		return fmt.Errorf("读取目录失败: %v", err)
	}

	for _, emotion := range emotions {
		if !emotion.IsDir() {
			continue
		}

		emotionPath := filepath.Join(dirPath, emotion.Name())
		audioFiles, err := os.ReadDir(emotionPath)
		if err != nil {
			fmt.Printf("警告: 无法读取情感目录 %s: %v\n", emotionPath, err)
			continue
		}

		// 处理每个音频文件
		for _, audioFile := range audioFiles {
			if audioFile.IsDir() {
				continue
			}

			// 只处理.wav文件
			if filepath.Ext(audioFile.Name()) != ".WAV" {
				continue
			}

			filePath := filepath.Join(emotionPath, audioFile.Name())
			fmt.Printf("处理文件: %s\n", filePath)

			err = p.ProcessAudioFile(filePath, emotion.Name())
			if err != nil {
				fmt.Printf("警告: 处理文件失败 %s: %v\n", filePath, err)
				continue
			}
		}
	}

	// 处理完所有文件后计算统计特征
	fmt.Println("计算统计特征...")
	p.calculateStatistics()

	return nil
}

// ExportLibrary 将样本库导出到JSON文件
func (p *SampleProcessor) ExportLibrary(outputPath string) error {
	// 检查是否有样本数据
	if len(p.Library.Samples) == 0 {
		return fmt.Errorf("样本库为空，无法导出")
	}

	// 创建输出目录（如果不存在）
	outputDir := filepath.Dir(outputPath)
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return fmt.Errorf("创建输出目录失败: %v", err)
	}

	// 准备导出数据
	type ExportData struct {
		TotalSamples int                          `json:"totalSamples"`
		Emotions     []string                     `json:"emotions"`
		Samples      map[string][]AudioSample     `json:"samples"`
		Statistics   map[string]EmotionStatistics `json:"statistics"`
	}

	exportData := ExportData{
		Samples:    p.Library.Samples,
		Statistics: p.Library.Statistics,
	}

	// 计算总样本数和情感列表
	emotions := make([]string, 0, len(p.Library.Samples))
	totalSamples := 0
	for emotion, samples := range p.Library.Samples {
		emotions = append(emotions, emotion)
		totalSamples += len(samples)
	}
	exportData.TotalSamples = totalSamples
	exportData.Emotions = emotions

	// 格式化JSON并写入文件
	data, err := json.MarshalIndent(exportData, "", "  ")
	if err != nil {
		return fmt.Errorf("JSON编码失败: %v", err)
	}

	if err := os.WriteFile(outputPath, data, 0644); err != nil {
		return fmt.Errorf("写入文件失败: %v", err)
	}

	fmt.Printf("样本库已导出到: %s\n", outputPath)
	fmt.Printf("总样本数: %d\n", totalSamples)
	fmt.Printf("情感类别: %v\n", emotions)

	return nil
}

func main() {
	// 创建样本处理器
	processor := NewSampleProcessor(AudioStreamConfig{
		ModelPath:  "./model",
		SampleRate: 44100,
		BufferSize: 1024,
	})

	// 设置输入目录和输出文件
	inputDir := "./emotion_samples"
	outputFile := "sample_library.json"

	// 处理音频文件
	fmt.Printf("开始处理目录: %s\n", inputDir)
	if err := processor.ProcessDirectory(inputDir); err != nil {
		fmt.Printf("处理样本失败: %v\n", err)
		return
	}

	// 导出样本库
	fmt.Printf("导出样本库到: %s\n", outputFile)
	if err := processor.ExportLibrary(outputFile); err != nil {
		fmt.Printf("导出样本库失败: %v\n", err)
		return
	}

	fmt.Println("处理完成!")
}
