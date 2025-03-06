package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"math"
	"math/cmplx"
	"os"
	"path/filepath"
	"strings"

	"github.com/youpy/go-wav"
	"github.com/hajimehoshi/go-mp3"
)

// 样本库结构
type SampleLibrary struct {
	TotalSamples int                 `json:"totalSamples"`
	Emotions     []string            `json:"emotions"`
	Samples      map[string][]Sample `json:"samples"`
}

// 样本结构
type Sample struct {
	FilePath string           `json:"FilePath"`
	Emotion  string           `json:"Emotion"`
	Features AudioFeature     `json:"Features"`
}

// AudioFeature 详细的音频特征
type AudioFeature struct {
	ZeroCrossRate    float64 `json:"ZeroCrossRate"`
	Energy           float64 `json:"Energy"`
	Pitch            float64 `json:"Pitch"`
	Duration         float64 `json:"Duration"`
	PeakFreq         float64 `json:"PeakFreq"`
	RootMeanSquare   float64 `json:"RootMeanSquare"`
	SpectralCentroid float64 `json:"SpectralCentroid"`
	SpectralRolloff  float64 `json:"SpectralRolloff"`
	FundamentalFreq  float64 `json:"FundamentalFreq"`
}

func main() {
	// 创建新的样本库
	library := SampleLibrary{
		Emotions: []string{},
		Samples:  make(map[string][]Sample),
	}

	// 设置目录路径
	audioDir := "d:\\uso_dev\\MeowTalk\\audios"
	outputPath := "d:\\uso_dev\\MeowTalk\\sdk\\new_sample_library.json"

	// 获取所有MP3文件
	files, err := filepath.Glob(filepath.Join(audioDir, "*.mp3"))
	if err != nil {
		log.Fatalf("无法获取音频文件: %v", err)
	}

	log.Printf("找到 %d 个音频文件", len(files))

	// 处理每个MP3文件
	for _, file := range files {
		// 从文件名中提取情感标签
		basename := filepath.Base(file)
		emotion := strings.Split(basename, "_")[0]
		emotion = strings.Split(emotion, ".")[0]  // 处理没有序号的文件
		emotion = strings.Replace(emotion, "-", "_", -1)  // 标准化emotion名称

		// 添加到情感列表（如果不存在）
		found := false
		for _, e := range library.Emotions {
			if e == emotion {
				found = true
				break
			}
		}
		if !found {
			library.Emotions = append(library.Emotions, emotion)
		}

		log.Printf("处理文件: %s, 情感: %s", basename, emotion)

		// 分析音频文件并提取特征
		features, err := extractFeaturesFromMP3(file)
		if err != nil {
			log.Printf("处理文件 %s 时出错: %v", file, err)
			continue
		}

		// 创建样本
		sample := Sample{
			FilePath: file,
			Emotion:  emotion,
			Features: features,
		}

		// 添加到样本库
		library.Samples[emotion] = append(library.Samples[emotion], sample)
		library.TotalSamples++
	}

	// 保存样本库到JSON文件
	jsonData, err := json.MarshalIndent(library, "", "  ")
	if err != nil {
		log.Fatalf("无法将样本库转换为JSON: %v", err)
	}

	err = ioutil.WriteFile(outputPath, jsonData, 0644)
	if err != nil {
		log.Fatalf("无法保存样本库到文件: %v", err)
	}

	log.Printf("样本库已保存到 %s，包含 %d 个样本，%d 种情感", 
		outputPath, library.TotalSamples, len(library.Emotions))
}

// 从MP3文件中提取音频特征
func extractFeaturesFromMP3(filepath string) (AudioFeature, error) {
	// 打开MP3文件
	file, err := os.Open(filepath)
	if err != nil {
		return AudioFeature{}, fmt.Errorf("无法打开MP3文件: %v", err)
	}
	defer file.Close()

	// 解码MP3
	decoder, err := mp3.NewDecoder(file)
	if err != nil {
		return AudioFeature{}, fmt.Errorf("无法解码MP3文件: %v", err)
	}

	// 获取音频参数
	sampleRate := decoder.SampleRate()
	log.Printf("MP3文件采样率: %d Hz", sampleRate)

	// 读取所有音频数据
	buffer := make([]byte, 1024*1024) // 假设最大1MB
	all := []byte{}
	for {
		n, err := decoder.Read(buffer)
		if err != nil || n == 0 {
			break
		}
		all = append(all, buffer[:n]...)
	}

	// 将字节数据转换为浮点数
	sampleCount := len(all) / 2 // 16位音频
	samples := make([]float64, sampleCount)

	for i := 0; i < sampleCount; i++ {
		// 将两个字节转换为16位整数
		sample := int16(all[i*2]) | (int16(all[i*2+1]) << 8)
		// 转换为float64并归一化到[-1, 1]范围
		samples[i] = float64(sample) / 32768.0
	}

	// 采样降频 (以10为因子)
	downsampledData := downsample(samples, 10)

	// 提取音频特征
	return calculateFeatures(downsampledData, sampleRate), nil
}

// 降采样
func downsample(data []float64, factor int) []float64 {
	result := make([]float64, len(data)/factor)
	for i := 0; i < len(result); i++ {
		result[i] = data[i*factor]
	}
	return result
}

// 计算音频特征
func calculateFeatures(data []float64, sampleRate int) AudioFeature {
	var features AudioFeature

	// 应用窗函数进行预处理
	windowedData := applyHammingWindow(data)

	// 计算持续时间（秒），考虑降采样因子
	features.Duration = float64(len(data)*10) / float64(sampleRate)

	// 计算能量
	features.Energy = calculateEnergy(data)

	// 计算均方根值
	features.RootMeanSquare = math.Sqrt(features.Energy / float64(len(data)))

	// 计算过零率
	features.ZeroCrossRate = calculateZeroCrossRate(data)

	// 计算峰值频率
	features.PeakFreq = calculatePeakFrequency(windowedData, sampleRate)

	// 计算基频
	features.FundamentalFreq = estimateFundamentalFrequency(windowedData)

	// 估计音高 (使用基频)
	features.Pitch = features.FundamentalFreq

	// 计算频谱
	spectrum := performFFT(windowedData)

	// 计算频谱质心和滚降点
	features.SpectralCentroid = calculateSpectralCentroid(spectrum, sampleRate/10)
	features.SpectralRolloff = calculateSpectralRolloff(spectrum, sampleRate/10)

	// 验证特征有效性
	if features.Pitch < 70 || features.Pitch > 1500 {
		features.Pitch = 0
	}
	
	return features
}

// applyHammingWindow 应用汉明窗函数
func applyHammingWindow(data []float64) []float64 {
	windowedData := make([]float64, len(data))
	for i := 0; i < len(data); i++ {
		// 汉明窗函数: 0.54 - 0.46 * cos(2πn/(N-1))
		windowMultiplier := 0.54 - 0.46*math.Cos(2*math.Pi*float64(i)/float64(len(data)-1))
		windowedData[i] = data[i] * windowMultiplier
	}
	return windowedData
}

// calculateZeroCrossRate 计算过零率
func calculateZeroCrossRate(data []float64) float64 {
	if len(data) <= 1 {
		return 0.0
	}

	// 预处理数据，移除直流分量
	mean := 0.0
	for _, sample := range data {
		mean += sample
	}
	mean /= float64(len(data))

	centeredData := make([]float64, len(data))
	for i, sample := range data {
		centeredData[i] = sample - mean
	}

	crossCount := 0.0
	for i := 1; i < len(centeredData); i++ {
		if (centeredData[i-1] >= 0 && centeredData[i] < 0) || (centeredData[i-1] < 0 && centeredData[i] >= 0) {
			crossCount++
		}
	}

	return crossCount / float64(len(data)-1)
}

// calculateEnergy 计算音频能量
func calculateEnergy(data []float64) float64 {
	var energy float64
	for _, v := range data {
		energy += v * v
	}
	return energy
}

// performFFT 执行快速傅里叶变换
func performFFT(data []float64) []complex128 {
	// 确保数据长度是2的幂
	n := nextPowerOf2(len(data))
	padded := make([]float64, n)
	copy(padded, data)

	// 创建复数数组
	complex := make([]complex128, n)
	for i, v := range padded {
		complex[i] = complex(v, 0)
	}

	// 执行FFT
	fft := recursiveFFT(complex)
	return fft
}

// nextPowerOf2 计算大于等于n的最小2的幂
func nextPowerOf2(n int) int {
	p := 1
	for p < n {
		p *= 2
	}
	return p
}

// recursiveFFT 递归实现FFT
func recursiveFFT(x []complex128) []complex128 {
	n := len(x)
	if n <= 1 {
		return x
	}

	// 分为偶数和奇数部分
	even := make([]complex128, n/2)
	odd := make([]complex128, n/2)
	for i := 0; i < n/2; i++ {
		even[i] = x[2*i]
		odd[i] = x[2*i+1]
	}

	// 递归计算
	even = recursiveFFT(even)
	odd = recursiveFFT(odd)

	// 合并结果
	y := make([]complex128, n)
	for k := 0; k < n/2; k++ {
		omega := cmplx.Rect(1, -2*math.Pi*float64(k)/float64(n))
		y[k] = even[k] + omega*odd[k]
		y[k+n/2] = even[k] - omega*odd[k]
	}

	return y
}

// calculatePeakFrequency 计算峰值频率
func calculatePeakFrequency(data []float64, sampleRate int) float64 {
	if len(data) == 0 {
		return 0.0
	}

	// 执行FFT
	fft := performFFT(data)

	// 考虑降采样因子，使用有效采样率
	effectiveSampleRate := sampleRate / 10
	minFreq := 70.0 // 最小频率为70Hz
	minBin := int(minFreq * float64(len(fft)) / float64(effectiveSampleRate))

	// 查找峰值
	maxMagnitude := 0.0
	peakBin := 0
	
	// 从FFT结果中查找，忽略过低频率
	for i := max(1, minBin); i < len(fft)/2; i++ {
		// 计算当前bin对应的频率
		freq := float64(i) * float64(effectiveSampleRate) / float64(len(fft))
		
		magnitude := cmplx.Abs(fft[i])
		// 只考虑特定频率范围内的峰值，猫咪声音主要在70Hz-2000Hz之间
		if freq >= 70.0 && freq <= 2000.0 && magnitude > maxMagnitude {
			maxMagnitude = magnitude
			peakBin = i
		}
	}

	// 检查峰值是否显著
	threshold := 0.05 * float64(len(data))
	if maxMagnitude < threshold || peakBin == 0 {
		return 0.0 // 如果峰值不显著，返回0
	}

	// 转换为频率，使用有效采样率
	return float64(peakBin) * float64(effectiveSampleRate) / float64(len(fft))
}

// estimateFundamentalFrequency 估计基频
func estimateFundamentalFrequency(data []float64) float64 {
	// 使用自相关法
	effectiveSampleRate := 44100 / 10 // 采用实际降采样率 4410Hz
	
	// 定义频率范围：70Hz-1000Hz (猫咪主要声音范围)
	minLag := effectiveSampleRate / 1000 // 最高频率限制
	maxLag := effectiveSampleRate / 70   // 最低频率限制

	// 检查数据有效性
	if len(data) < maxLag || maxLag <= minLag {
		return 0.0
	}

	// 使用简化的自相关方法
	maxCorr := 0.0
	bestLag := 0

	for lag := minLag; lag <= maxLag; lag++ {
		corr := 0.0
		for i := 0; i < len(data)-lag; i++ {
			corr += data[i] * data[i+lag]
		}
		
		// 归一化相关系数
		corr = corr / float64(len(data)-lag)

		if corr > maxCorr {
			maxCorr = corr
			bestLag = lag
		}
	}

	// 如果未找到显著的相关性
	if maxCorr < 0.2 || bestLag == 0 {
		return 0.0
	}

	// 转换为频率
	return float64(effectiveSampleRate) / float64(bestLag)
}

// calculateSpectralCentroid 计算频谱质心
func calculateSpectralCentroid(spectrum []complex128, sampleRate int) float64 {
	if len(spectrum) <= 1 {
		return 0.0
	}

	var weightedSum float64
	var magnitudeSum float64

	for i := 1; i < len(spectrum)/2; i++ {
		freq := float64(i) * float64(sampleRate) / float64(len(spectrum))
		magnitude := cmplx.Abs(spectrum[i])
		
		weightedSum += freq * magnitude
		magnitudeSum += magnitude
	}

	if magnitudeSum > 0 {
		return weightedSum / magnitudeSum
	}
	return 0.0
}

// calculateSpectralRolloff 计算频谱滚降点
func calculateSpectralRolloff(spectrum []complex128, sampleRate int) float64 {
	if len(spectrum) <= 1 {
		return 0.0
	}

	// 计算频谱能量总和
	totalEnergy := 0.0
	for i := 1; i < len(spectrum)/2; i++ {
		totalEnergy += cmplx.Abs(spectrum[i])
	}

	if totalEnergy <= 0 {
		return 0.0
	}

	// 计算85%能量对应的频率
	threshold := 0.85 * totalEnergy
	accumulatedEnergy := 0.0

	for i := 1; i < len(spectrum)/2; i++ {
		accumulatedEnergy += cmplx.Abs(spectrum[i])
		if accumulatedEnergy >= threshold {
			return float64(i) * float64(sampleRate) / float64(len(spectrum))
		}
	}

	return 0.0
}

// max 返回两个整数中较大的一个
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
