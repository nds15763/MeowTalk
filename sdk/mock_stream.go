package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/cmplx"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"golang.org/x/exp/rand"
)

// AudioProcessor 音频处理接口
type AudioProcessor interface {
	ProcessAudio(streamID string, data []float64) ([]byte, error)
}

// MockAudioProcessor 模拟音频处理器
type MockAudioProcessor struct {
	sessions sync.Map
	// 音频处理相关参数
	audioBuffer       []float64    // 音频缓冲区
	buffer            []float64    // 兼容旧代码的缓冲区
	bufferMutex       sync.Mutex   // 缓冲区锁
	minSilenceTime    float64      // 最小静默时间（秒）
	silenceThreshold  float64      // 静默检测阈值
	minProcessTime    float64      // 最小处理时间（秒）
	maxBufferTime     float64      // 最大缓冲时间（秒）
	lastProcessTime   time.Time    // 上次处理时间
	sampleRate        int          // 采样率
	recentResults     []MockResult // 最近的分析结果
	continuousPattern bool         // 是否检测到连续模式
	mu                sync.Mutex   // 锁
}

// NewMockAudioProcessor 创建新的音频处理器
func NewMockAudioProcessor() *MockAudioProcessor {
	return &MockAudioProcessor{
		silenceThreshold: 0.02,  // 静默阈值，根据实际情况调整
		minSilenceTime:   0.3,   // 最小静默时间0.3秒
		maxBufferTime:    5.0,   // 最大缓冲5秒
		minProcessTime:   1.0,   // 最小处理时间1秒
		sampleRate:       44100, // 默认采样率
		recentResults:    make([]MockResult, 0, 5),
		lastProcessTime:  time.Now(),
	}
}

// MockResult 分析结果
type MockResult struct {
	Emotion    string             `json:"emotion"`
	Confidence float64            `json:"confidence"`
	Timestamp  time.Time          `json:"timestamp"`
	Features   map[string]float64 `json:"features"`
}

// AnalysisResult 音频分析结果
type AnalysisResult struct {
	Status     string  `json:"status"`
	Emotion    string  `json:"emotion"`
	Confidence float64 `json:"confidence"`
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // 允许所有来源，仅用于测试
	},
}

func (m *MockAudioProcessor) ProcessAudio(streamID string, data []float64) ([]byte, error) {
	log.Println("MockAudioProcessor 收到音频数据，长度:", len(data))

	if len(data) == 0 {
		return nil, fmt.Errorf("音频数据为空")
	}

	// 确保外部数据添加到缓冲区
	m.mu.Lock()
	m.audioBuffer = append(m.audioBuffer, data...)
	bufferDuration := float64(len(m.audioBuffer)) / float64(m.sampleRate)
	log.Printf("音频缓冲区：当前长度=%d 样本, 持续时间=%.2f秒", len(m.audioBuffer), bufferDuration)
	m.mu.Unlock()

	var processBuffer bool
	var processingData []float64

	// 检查是否有足够长的静默段
	segments, silenceDetected := m.detectSilence(m.audioBuffer)

	timeElapsed := time.Since(m.lastProcessTime).Seconds()

	// 改进处理策略:
	// 1. 检测到足够长的静默，表示叫声结束
	// 2. 缓冲区超过最大允许时间
	// 3. 缓冲区超过最小处理时间（1秒）且已过去超过0.5秒
	// 4. 会话结束前强制处理（由handleStop单独处理）

	if silenceDetected && bufferDuration >= 0.5 {
		log.Printf("检测到静默，处理前%d个音频样本", len(m.audioBuffer)-len(segments[len(segments)-1]))
		// 只处理到静默开始的部分（即所有非最后一个片段的数据）
		totalLength := len(m.audioBuffer) - len(segments[len(segments)-1])
		processingData = make([]float64, totalLength)
		copy(processingData, m.audioBuffer[:totalLength])
		// 保留静默后的部分到缓冲区
		m.audioBuffer = m.audioBuffer[totalLength:]
		processBuffer = true
	} else if bufferDuration >= m.maxBufferTime {
		// 缓冲区太长，需要处理
		log.Printf("缓冲区达到最大时间 (%.2f秒)，处理数据", bufferDuration)
		processingData = make([]float64, len(m.audioBuffer))
		copy(processingData, m.audioBuffer)
		m.audioBuffer = m.audioBuffer[:0]
		processBuffer = true
	} else if bufferDuration >= m.minProcessTime && timeElapsed >= 0.5 {
		// 超过最小处理时间，且自上次处理已经过去了足够长的时间
		log.Printf("达到最小处理时间 (%.2f秒) 且间隔足够长 (%.2f秒), 处理数据",
			bufferDuration, timeElapsed)
		processingData = make([]float64, len(m.audioBuffer))
		copy(processingData, m.audioBuffer)
		m.audioBuffer = m.audioBuffer[:0]
		processBuffer = true
	}

	m.mu.Lock()
	m.buffer = m.buffer[:0]
	m.lastProcessTime = time.Now()
	m.mu.Unlock()

	// 如果不需要处理，返回空结果
	if !processBuffer {
		log.Println("缓冲区不需要处理，跳过")
		return nil, nil
	}

	log.Printf("开始处理音频: 处理数据长度=%d", len(processingData))

	// 处理音频数据
	return m.processBuffer(streamID, processingData)
}

// detectSilence 检测缓冲区中的静默段
func (m *MockAudioProcessor) detectSilence(data []float64) ([][]float64, bool) {
	// 如果缓冲区太小，无法检测足够长的静默
	minSamples := int(m.minSilenceTime * float64(m.sampleRate))
	if len(data) < minSamples {
		return nil, false
	}

	// 使用均方根能量检测静默
	silenceWindow := int(0.02 * float64(m.sampleRate)) // 20ms窗口
	if silenceWindow < 100 {                           // 确保窗口至少有100个样本
		silenceWindow = 100
	}

	silenceCount := 0.0
	segments := [][]float64{}
	currentSegment := []float64{}
	inSilence := false

	for i := 0; i < len(data)-silenceWindow; i += silenceWindow / 2 { // 使用重叠窗口
		// 计算窗口内的均方根能量
		energy := 0.0
		for j := 0; j < silenceWindow; j++ {
			if i+j < len(data) {
				energy += data[i+j] * data[i+j]
			}
		}
		energy = math.Sqrt(energy / float64(silenceWindow))

		// 降低静默检测阈值，使其更敏感
		actualThreshold := m.silenceThreshold
		if silenceCount > 0 {
			// 如果已经开始检测到静默，稍微提高阈值以防止小噪声打断
			actualThreshold *= 1.2
		}

		if energy < actualThreshold {
			// 进入静默状态
			if !inSilence {
				inSilence = true
				// 如果当前片段长度足够，保存它
				if len(currentSegment) > int(0.1*float64(m.sampleRate)) {
					segments = append(segments, currentSegment)
				}
				currentSegment = []float64{}
			}

			silenceCount += float64(silenceWindow) / 2

			// 检查静默是否达到最小时间
			silenceDuration := float64(silenceCount) / float64(m.sampleRate)
			if silenceDuration >= m.minSilenceTime {
				log.Printf("检测到持续静默: %.2f秒 (阈值=%.3f, 能量=%.3f)",
					silenceDuration, actualThreshold, energy)
				// 如果当前有未保存的片段，保存它
				if len(currentSegment) > int(0.1*float64(m.sampleRate)) {
					segments = append(segments, currentSegment)
				}
				return segments, true
			}
		} else {
			// 不在静默状态
			if inSilence {
				inSilence = false
			}

			// 添加当前样本到当前片段
			endIdx := i + silenceWindow/2
			if endIdx > len(data) {
				endIdx = len(data)
			}
			currentSegment = append(currentSegment, data[i:endIdx]...)

			// 不要立即重置计数器，而是容忍一些短暂噪声
			if silenceCount > 0 && energy < actualThreshold*2 {
				// 噪声不是太大，继续累积静默
				silenceCount += float64(silenceWindow) / 2
			} else {
				silenceCount = 0
			}
		}
	}

	// 添加最后一个片段（如果有）
	if len(currentSegment) > int(0.1*float64(m.sampleRate)) {
		segments = append(segments, currentSegment)
	}

	return segments, false
}

// processBuffer 处理缓冲区中的音频数据
func (m *MockAudioProcessor) processBuffer(streamID string, data []float64) ([]byte, error) {
	if len(data) == 0 {
		return []byte(`{"status":"empty"}`), nil
	}

	// 检测静默并处理音频
	segments, _ := m.detectSilence(data)
	if len(segments) == 0 {
		return []byte(`{"status":"no_cat_sound"}`), nil
	}

	// 处理最长的声音片段
	longestSegment := segments[0]
	maxLength := len(longestSegment)
	for i := 1; i < len(segments); i++ {
		if len(segments[i]) > maxLength {
			longestSegment = segments[i]
			maxLength = len(segments[i])
		}
	}

	log.Printf("处理音频片段: 片段长度=%d, 片段数量=%d, 最长片段长度=%d",
		len(data), len(segments), len(longestSegment))

	// 处理音频片段
	windowResults, result := m.processAudioSegment(streamID, longestSegment)

	// 打印分析结果
	log.Printf(" 分析结果: 情感=%s, 置信度=%.2f, 窗口数=%d",
		result.Emotion, result.Confidence, len(windowResults))

	// 保存处理音频数据
	if result.Confidence > 0.5 {
		m.saveProcessedAudio(streamID, longestSegment, result.Emotion, result.Confidence,
			extractFinalFeatures(windowResults))
	}

	return json.Marshal(result)
}

// AudioFeatures 简化的音频特征，用于情感识别
type AudioFeatures struct {
	Energy   float64
	Pitch    float64
	Duration float64
}

// 从窗口结果集中提取最终特征
func extractFinalFeatures(windowResults []AudioFeature) AudioFeatures {
	if len(windowResults) == 0 {
		return AudioFeatures{}
	}

	// 查找最大能量和平均音高
	maxEnergy := 0.0
	totalPitch := 0.0
	validPitchCount := 0
	totalDuration := 0.0

	for _, result := range windowResults {
		if result.Energy > maxEnergy {
			maxEnergy = result.Energy
		}

		if result.Pitch > 0 {
			totalPitch += result.Pitch
			validPitchCount++
		}

		totalDuration += result.Duration
	}

	// 计算平均音高
	avgPitch := 0.0
	if validPitchCount > 0 {
		avgPitch = totalPitch / float64(validPitchCount)
	}

	// 计算平均持续时间
	avgDuration := totalDuration / float64(len(windowResults))

	// 构建最终特征
	return AudioFeatures{
		Energy:   maxEnergy,
		Pitch:    avgPitch,
		Duration: avgDuration,
	}
}

// extractAudioFeatures 提取音频特征
func extractAudioFeatures(data []float64) AudioFeature {
	var features AudioFeature

	// 计算持续时间（秒）
	features.Duration = float64(len(data)) / 44100.0 // 假设采样率为44.1kHz

	// 计算过零率
	features.ZeroCrossRate = calculateZeroCrossRate(data)

	// 计算能量
	features.Energy = calculateEnergy(data)

	// 计算均方根值
	features.RootMeanSquare = math.Sqrt(features.Energy)

	// 计算峰值频率
	features.PeakFreq = calculatePeakFrequency(data, 44100)

	// 计算频谱
	spectrum := performFFT(data)

	// 计算频谱质心
	features.SpectralCentroid = calculateSpectralCentroid(spectrum)

	// 计算频谱滚降点
	features.SpectralRolloff = calculateSpectralRolloff(spectrum)

	// 计算基频
	features.FundamentalFreq = estimateFundamentalFrequency(data)

	// 估计音高
	features.Pitch = estimatePitch(data, 44100)

	// 记录提取的特征数据
	log.Printf("音频特征: 能量=%.2f, 音高=%.2f Hz, 持续时间=%.2fs, ZCR=%.2f, 峰值频率=%.2f, 频谱质心=%.2f",
		features.Energy, features.Pitch, features.Duration, features.ZeroCrossRate,
		features.PeakFreq, features.SpectralCentroid)

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

// calculatePeakFrequency 计算峰值频率
func calculatePeakFrequency(data []float64, sampleRate int) float64 {
	// 执行FFT
	fft := performFFT(data)

	// 寻找峰值频率
	maxMagnitude := 0.0
	peakBin := 0
	for i := 0; i < len(fft)/2; i++ {
		magnitude := cmplx.Abs(fft[i])
		if magnitude > maxMagnitude {
			maxMagnitude = magnitude
			peakBin = i
		}
	}

	// 转换为频率
	return float64(peakBin) * float64(sampleRate) / float64(len(fft))
}

// estimateFundamentalFrequency 估计基频
func estimateFundamentalFrequency(data []float64) float64 {
	// 使用自相关法
	minLag := 44100 / 2000 // 最高2000Hz
	maxLag := 44100 / 70   // 最低70Hz

	if len(data) < maxLag {
		return 0
	}

	maxCorr := 0.0
	bestLag := 0

	// 计算自相关
	for lag := minLag; lag <= maxLag; lag++ {
		corr := 0.0
		for i := 0; i < len(data)-lag; i++ {
			corr += data[i] * data[i+lag]
		}
		corr = corr / float64(len(data)-lag)

		if corr > maxCorr {
			maxCorr = corr
			bestLag = lag
		}
	}

	if bestLag > 0 {
		return float64(44100) / float64(bestLag)
	}
	return 0
}

// estimatePitch 估计音高
func estimatePitch(data []float64, sampleRate int) float64 {
	// 同样使用自相关法
	return estimateFundamentalFrequency(data)
}

// performFFT 执行FFT
func performFFT(data []float64) []complex128 {
	n := nextPowerOfTwo(len(data))
	if n > len(data) {
		padded := make([]float64, n)
		copy(padded, data)
		data = padded
	}

	// 应用汉明窗
	windowed := applyHammingWindow(data)

	// 初始化FFT数据
	fft := make([]complex128, n)
	for i, val := range windowed {
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

// bitReverse 位反转函数
func bitReverse(x, n int) int {
	result := 0
	for i := 0; i < int(math.Log2(float64(n))); i++ {
		result = (result << 1) | (x & 1)
		x >>= 1
	}
	return result
}

// nextPowerOfTwo 下一个2的幂
func nextPowerOfTwo(n int) int {
	p := 1
	for p < n {
		p *= 2
	}
	return p
}

// calculateZeroCrossRate 计算过零率
func calculateZeroCrossRate(data []float64) float64 {
	if len(data) <= 1 {
		return 0.0
	}

	crossCount := 0.0
	for i := 1; i < len(data); i++ {
		if (data[i-1] >= 0 && data[i] < 0) || (data[i-1] < 0 && data[i] >= 0) {
			crossCount++
		}
	}

	return crossCount / float64(len(data)-1)
}

// calculateEnergy 计算音频能量
func calculateEnergy(data []float64) float64 {
	if len(data) == 0 {
		return 0.0
	}

	energy := 0.0
	for _, sample := range data {
		energy += sample * sample
	}

	return energy / float64(len(data))
}

// calculateSpectrum 计算频谱
func calculateSpectrum(data []float64) []complex128 {
	return performFFT(data)
}

// calculateSpectralCentroid 计算频谱质心
func calculateSpectralCentroid(spectrum []complex128) float64 {
	if len(spectrum) == 0 {
		return 0.0
	}

	weightedSum := 0.0
	magnitudeSum := 0.0

	for i := 0; i < len(spectrum)/2; i++ {
		magnitude := cmplx.Abs(spectrum[i])
		weightedSum += float64(i) * magnitude
		magnitudeSum += magnitude
	}

	if magnitudeSum == 0 {
		return 0.0
	}

	return weightedSum / magnitudeSum
}

// calculateSpectralRolloff 计算频谱滚降点 (85%能量点)
func calculateSpectralRolloff(spectrum []complex128) float64 {
	if len(spectrum) == 0 {
		return 0.0
	}

	totalEnergy := 0.0
	for i := 0; i < len(spectrum)/2; i++ {
		magnitude := cmplx.Abs(spectrum[i])
		totalEnergy += magnitude
	}

	if totalEnergy == 0 {
		return 0.0
	}

	threshold := totalEnergy * 0.85
	cumulativeEnergy := 0.0

	for i := 0; i < len(spectrum)/2; i++ {
		magnitude := cmplx.Abs(spectrum[i])
		cumulativeEnergy += magnitude

		if cumulativeEnergy >= threshold {
			return float64(i) * 44100.0 / float64(len(spectrum))
		}
	}

	return 0.0
}

// 情感与特征匹配表（在实际应用中可能需要通过机器学习调整）
var emotionProfiles = map[string]AudioFeatures{
	"angry":        {Energy: 0.9, Pitch: 0.85, Duration: 0.5},
	"happy":        {Energy: 0.7, Pitch: 0.7, Duration: 0.5},
	"excited":      {Energy: 0.8, Pitch: 0.9, Duration: 0.6},
	"curious":      {Energy: 0.5, Pitch: 0.6, Duration: 0.3},
	"contented":    {Energy: 0.4, Pitch: 0.3, Duration: 0.7},
	"sad":          {Energy: 0.3, Pitch: 0.4, Duration: 0.8},
	"sleepy":       {Energy: 0.2, Pitch: 0.2, Duration: 0.4},
	"affectionate": {Energy: 0.6, Pitch: 0.5, Duration: 0.6},
}

// recognizeEmotion 情感识别算法
func recognizeEmotion(features AudioFeatures) (string, float64) {
	log.Printf("开始情感识别: 能量=%.2f, 音高=%.2f Hz, 持续时间=%.2f",
		features.Energy, features.Pitch, features.Duration)

	// 标准化特征
	normEnergy := min(features.Energy/1.0, 1.0)
	normPitch := min(features.Pitch/1000.0, 1.0)
	normDuration := min(features.Duration/2.0, 1.0)

	normalizedFeatures := AudioFeatures{
		Energy:   normEnergy,
		Pitch:    normPitch,
		Duration: normDuration,
	}

	bestEmotion := ""
	bestMatch := 0.0
	allConfidences := make(map[string]float64)

	// 计算与每种情感的匹配度
	for emotion, profile := range emotionProfiles {
		// 简单的特征距离计算（可以使用更复杂的算法）
		energyDiff := math.Abs(normalizedFeatures.Energy - profile.Energy)
		pitchDiff := math.Abs(normalizedFeatures.Pitch - profile.Pitch)
		durationDiff := math.Abs(normalizedFeatures.Duration - profile.Duration)

		// 计算匹配度（1为完全匹配，0为完全不匹配）
		match := 1.0 - (energyDiff*0.4 + pitchDiff*0.4 + durationDiff*0.2)
		allConfidences[emotion] = match

		log.Printf("情感[%s]匹配度: %.2f (能量差=%.2f, 音高差=%.2f, 持续时间差=%.2f)",
			emotion, match, energyDiff, pitchDiff, durationDiff)

		if match > bestMatch {
			bestMatch = match
			bestEmotion = emotion
		}
	}

	// 记录所有情感的置信度
	var confidenceInfo strings.Builder
	confidenceInfo.WriteString("所有情感置信度: ")
	for emotion, confidence := range allConfidences {
		confidenceInfo.WriteString(fmt.Sprintf("%s=%.2f ", emotion, confidence))
	}
	log.Println(confidenceInfo.String())

	// 如果最佳匹配的置信度太低，返回"unknown"
	if bestMatch < 0.5 {
		log.Printf("置信度过低(%.2f)，无法确定情感类型", bestMatch)
		return "unknown", bestMatch
	}

	log.Printf("识别结果: 情感=%s, 置信度=%.2f", bestEmotion, bestMatch)
	return bestEmotion, bestMatch
}

// min 最小值函数
func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

// analyzeEmotionWithAI 使用AI分析猫咪的情感
func (m *MockAudioProcessor) analyzeEmotionWithAI(features []AudioFeature) (string, float64) {
	if len(features) == 0 {
		return "unknown", 0.0
	}

	// 使用golang.org/x/exp/rand代替math/rand
	emotions := []string{"happy", "sad", "angry", "friendly", "scared", "territorial"}

	// 计算加权平均特征
	avgEnergy := 0.0
	avgPitch := 0.0
	avgZCR := 0.0
	avgDuration := 0.0

	for _, f := range features {
		avgEnergy += f.Energy
		avgPitch += f.Pitch
		avgZCR += f.ZeroCrossRate
		avgDuration += f.Duration
	}

	avgEnergy /= float64(len(features))
	avgPitch /= float64(len(features))
	avgZCR /= float64(len(features))
	avgDuration /= float64(len(features))

	// 打印数据用于调试
	log.Printf("AI分析: 平均能量=%.2f, 平均音高=%.2f Hz, 平均过零率=%.2f, 平均持续时间=%.2fs",
		avgEnergy, avgPitch, avgZCR, avgDuration)

	// 生成种子
	seed := int64(avgEnergy*1000 + avgPitch + avgZCR*100)
	src := rand.NewSource(uint64(seed))
	rng := rand.New(src)

	// 生成随机情感
	aiEmotion := emotions[rng.Intn(len(emotions))]
	aiConfidence := 0.7 + 0.2*rng.Float64()

	log.Printf("AI分析结果: 情感=%s, 置信度=%.2f", aiEmotion, aiConfidence)

	return aiEmotion, aiConfidence
}

// saveProcessedAudio 保存处理后的音频和分析数据，用于后续研究
func (m *MockAudioProcessor) saveProcessedAudio(streamID string, data []float64, emotion string, confidence float64, features AudioFeatures) {
	// 这个函数在生产环境中可以实现持久化存储
	// 目前仅记录日志，如有需要可扩展为写入文件或数据库

	// 生成唯一的音频片段ID
	timestamp := time.Now().UnixNano()
	audioID := fmt.Sprintf("%s_%d", streamID, timestamp)

	// 记录音频元数据
	duration := float64(len(data)) / 44100.0
	log.Printf("音频片段[%s]: 长度=%.2f秒, 情感=%s, 置信度=%.2f",
		audioID, duration, emotion, confidence)

	// 记录关键特征
	log.Printf("音频特征[%s]: 能量=%.2f, 音高=%.2f Hz, 持续时间=%.2f秒",
		audioID, features.Energy, features.Pitch, features.Duration)

	// 这里可以扩展为:
	// 1. 保存音频数据到WAV文件
	// 2. 将分析结果写入数据库
	// 3. 上传到云端存储
	// 4. 将结果用于训练模型
}

// SendAudioRequest 发送音频数据的请求
type SendAudioRequest struct {
	StreamID string      `json:"streamId"`
	Data     interface{} `json:"data"` // 使用interface{}以支持多种格式
}

// StartMockServer 启动模拟服务器
func (m *MockAudioProcessor) StartMockServer(port int) error {
	// 初始化处理器
	http.HandleFunc("/init", m.handleInit)
	http.HandleFunc("/start", m.handleStart)
	http.HandleFunc("/send", m.handleSend)
	http.HandleFunc("/recv", m.handleReceive)
	http.HandleFunc("/stop", m.handleStop)

	// 添加WebSocket支持
	http.HandleFunc("/ws", m.handleWebSocket)

	// 启动服务器
	addr := fmt.Sprintf(":%d", port)
	log.Printf("猫咪声音情感分析服务启动在 http://localhost%s\n", addr)
	return http.ListenAndServe(addr, corsMiddleware(http.DefaultServeMux))
}

// CORS中间件
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 设置CORS头
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")

		// 处理预检请求
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		// 继续处理实际请求
		next.ServeHTTP(w, r)
	})
}

// handleInit 初始化处理
func (m *MockAudioProcessor) handleInit(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "方法不允许", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// handleStart 开始会话
func (m *MockAudioProcessor) handleStart(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "方法不允许", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		StreamID string `json:"streamId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "无效请求格式", http.StatusBadRequest)
		return
	}

	if req.StreamID == "" {
		http.Error(w, "StreamID不能为空", http.StatusBadRequest)
		return
	}

	// 创建新会话
	m.sessions.Store(req.StreamID, &sync.Map{})
	log.Printf("创建新会话: StreamID=%s", req.StreamID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// handleSend 处理发送音频数据
func (m *MockAudioProcessor) handleSend(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "方法不允许", http.StatusMethodNotAllowed)
		return
	}

	var req SendAudioRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "无效请求格式", http.StatusBadRequest)
		return
	}

	log.Printf("收到音频数据: StreamID=%s, 数据类型=%T", req.StreamID, req.Data)

	// 转换音频数据
	var audioData []float64
	switch data := req.Data.(type) {
	case []interface{}:
		audioData = make([]float64, len(data))
		for i, v := range data {
			switch val := v.(type) {
			case float64:
				audioData[i] = val
			case json.Number:
				f, _ := val.Float64()
				audioData[i] = f
			case int:
				audioData[i] = float64(val)
			case float32:
				audioData[i] = float64(val)
			case string:
				f, _ := strconv.ParseFloat(val, 64)
				audioData[i] = f
			default:
				audioData[i] = 0
			}
		}
	case []float64:
		audioData = data
	default:
		http.Error(w, "不支持的音频数据格式", http.StatusBadRequest)
		return
	}

	// 处理音频
	result, err := m.ProcessAudio(req.StreamID, audioData)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// 保存结果到会话
	if result != nil && len(result) > 0 {
		if session, ok := m.sessions.Load(req.StreamID); ok {
			session.(*sync.Map).Store(time.Now().UnixNano(), result)
		}
	}

	// 返回处理结果和状态信息
	w.Header().Set("Content-Type", "application/json")
	if result != nil {
		// 有结果时返回结果
		w.Write(result)
	} else {
		// 还没有结果，返回状态信息
		m.bufferMutex.Lock()
		bufferDuration := float64(len(m.audioBuffer)) / float64(m.sampleRate)
		m.bufferMutex.Unlock()

		// 返回当前缓冲状态
		status := map[string]interface{}{
			"success":       true,
			"buffered":      bufferDuration,
			"samplesCount":  len(audioData),
			"bufferedTime":  fmt.Sprintf("%.2f秒", bufferDuration),
			"minProcessing": m.minProcessTime,
			"message":       "数据已添加到缓冲区，尚未处理",
		}
		json.NewEncoder(w).Encode(status)
	}
}

// handleReceive 获取处理结果
func (m *MockAudioProcessor) handleReceive(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodGet {
		http.Error(w, "方法不允许", http.StatusMethodNotAllowed)
		return
	}

	streamID := r.URL.Query().Get("streamId")
	if streamID == "" {
		http.Error(w, "StreamID参数缺失", http.StatusBadRequest)
		return
	}

	// 获取会话
	sessionInterface, ok := m.sessions.Load(streamID)
	if !ok {
		http.Error(w, "会话不存在", http.StatusNotFound)
		return
	}

	session := sessionInterface.(*sync.Map)

	// 查找最新结果
	var latestResult []byte
	var latestTime int64

	session.Range(func(key, value interface{}) bool {
		timestamp := key.(int64)
		if timestamp > latestTime {
			latestTime = timestamp
			latestResult = value.([]byte)
		}
		return true
	})

	w.Header().Set("Content-Type", "application/json")
	if latestResult != nil {
		w.Write(latestResult)
	} else {
		w.Write([]byte("{}"))
	}
}

// handleStop 停止会话
func (m *MockAudioProcessor) handleStop(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "方法不允许", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		StreamID string `json:"streamId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "无效请求格式", http.StatusBadRequest)
		return
	}

	if req.StreamID == "" {
		http.Error(w, "StreamID不能为空", http.StatusBadRequest)
		return
	}

	// 在停止会话前，强制处理剩余的缓冲区数据
	var finalResult []byte
	m.bufferMutex.Lock()
	if len(m.audioBuffer) > 0 {
		log.Printf("会话结束前处理剩余音频数据: %d个样本", len(m.audioBuffer))
		audioData := make([]float64, len(m.audioBuffer))
		copy(audioData, m.audioBuffer)
		m.audioBuffer = nil
		m.bufferMutex.Unlock()

		// 处理最后的音频数据
		finalResult, _ = m.processBuffer(req.StreamID, audioData)

		// 存储最终结果
		if finalResult != nil && len(finalResult) > 0 {
			if session, ok := m.sessions.Load(req.StreamID); ok {
				session.(*sync.Map).Store(time.Now().UnixNano(), finalResult)
			}
		}
	} else {
		m.bufferMutex.Unlock()
	}

	// 删除会话
	m.sessions.Delete(req.StreamID)
	log.Printf("结束会话: StreamID=%s", req.StreamID)

	// 返回最终结果或成功状态
	w.Header().Set("Content-Type", "application/json")
	if finalResult != nil && len(finalResult) > 0 {
		w.Write(finalResult)
	} else {
		json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}
}

// handleWebSocket 处理WebSocket连接
func (m *MockAudioProcessor) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	// 升级HTTP连接为WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket升级失败: %v", err)
		return
	}
	defer conn.Close()

	// 生成唯一的StreamID
	streamID := fmt.Sprintf("ws-%d", time.Now().UnixNano())
	log.Printf("WebSocket连接建立: StreamID=%s", streamID)

	// 创建新会话
	m.sessions.Store(streamID, &sync.Map{})

	// 发送初始化消息
	initMsg := map[string]interface{}{
		"type":     "init",
		"streamId": streamID,
	}
	if err := conn.WriteJSON(initMsg); err != nil {
		log.Printf("发送初始化消息失败: %v", err)
		return
	}

	// 处理接收的消息
	for {
		// 读取消息
		_, message, err := conn.ReadMessage()
		if err != nil {
			log.Printf("读取WebSocket消息失败: %v", err)
			break
		}

		// 解析音频数据
		var audioData []float64
		if err := json.Unmarshal(message, &audioData); err != nil {
			// 尝试其他格式
			var dataMap map[string]interface{}
			if err := json.Unmarshal(message, &dataMap); err != nil {
				log.Printf("解析WebSocket消息失败: %v", err)
				continue
			}

			// 从map中提取音频数据
			if data, ok := dataMap["data"].([]interface{}); ok {
				audioData = make([]float64, len(data))
				for i, v := range data {
					if f, ok := v.(float64); ok {
						audioData[i] = f
					}
				}
			}
		}

		if len(audioData) == 0 {
			continue
		}

		// 处理音频数据
		result, err := m.ProcessAudio(streamID, audioData)
		if err != nil {
			log.Printf("处理WebSocket音频失败: %v", err)
			continue
		}

		// 如果有结果，发送回客户端
		if result != nil {
			var resultObj interface{}
			json.Unmarshal(result, &resultObj)

			response := map[string]interface{}{
				"type":   "result",
				"result": resultObj,
			}

			if err := conn.WriteJSON(response); err != nil {
				log.Printf("发送WebSocket结果失败: %v", err)
			}
		}
	}

	// 移除会话
	m.sessions.Delete(streamID)
	log.Printf("WebSocket连接关闭: StreamID=%s", streamID)
}

// processAudioSegment 处理单个音频片段
func (m *MockAudioProcessor) processAudioSegment(streamID string, data []float64) ([]AudioFeature, AnalysisResult) {
	log.Printf("开始音频片段处理: 长度=%d", len(data))

	if len(data) == 0 {
		return nil, AnalysisResult{Status: "empty"}
	}

	// 窗口大小（250毫秒）和滑动大小（125毫秒，50%重叠）
	windowSize := int(0.25 * float64(m.sampleRate)) // 250毫秒
	// slideSize := windowSize / 2                     // 50%重叠
	if windowSize > len(data) {
		windowSize = len(data)
	}
	stepSize := windowSize / 2 // 50%重叠

	// 计算将创建多少个窗口
	windowCount := 0
	if len(data) > windowSize {
		windowCount = 1 + (len(data)-windowSize)/stepSize
	} else {
		windowCount = 1
	}

	// 记录窗口分析
	log.Printf("音频分析 [%s]: 总长度 %.2f秒, 使用 %d 个 %d毫秒窗口, 重叠率 50%%",
		streamID, float64(len(data))/float64(m.sampleRate), windowCount, windowSize*1000/m.sampleRate)

	// 对多个窗口进行分析
	energyMax := 0.0
	pitchSum := 0.0
	pitchCount := 0

	var windowResults []AudioFeature

	for i := 0; i < len(data)-windowSize+1; i += stepSize {
		windowIndex := i / stepSize
		// 提取窗口数据
		windowData := data[i : i+windowSize]
		// 应用汉明窗
		windowedData := applyHammingWindow(windowData)
		// 提取特征
		features := extractAudioFeatures(windowedData)

		// 记录每个窗口的关键特征
		log.Printf("窗口 #%d [%s] (%.2f-%.2f秒): 能量=%.2f, 音高=%.2f Hz",
			windowIndex+1,
			streamID,
			float64(i)/float64(m.sampleRate),
			float64(i+windowSize)/float64(m.sampleRate),
			features.Energy,
			features.Pitch)

		// 添加到结果集
		windowResults = append(windowResults, features)

		// 跟踪最大能量和有效音高
		if features.Energy > energyMax {
			energyMax = features.Energy
		}

		if features.Pitch > 0 {
			pitchSum += features.Pitch
			pitchCount++
		}
	}

	// 如果没有窗口结果，返回未知
	if len(windowResults) == 0 {
		return nil, AnalysisResult{
			Status:     "no_features",
			Emotion:    "unknown",
			Confidence: 0,
		}
	}

	// 从多窗口分析结果中提取最终特征
	finalFeatures := extractFinalFeatures(windowResults)

	// 从样本库匹配情感
	emotion, confidence := recognizeEmotion(finalFeatures)

	// 如果匹配置信度低，尝试使用AI分析
	if confidence < 0.65 {
		log.Printf("[%s] 情感匹配置信度较低(%.2f)，尝试使用AI分析", streamID, confidence)

		// 获取原始音频数据
		audioData := data
		if len(audioData) > 0 {
			aiEmotion, aiConfidence := m.analyzeEmotionWithAI(windowResults)

			// 如果AI分析置信度更高，则采用AI结果
			if aiConfidence > confidence {
				log.Printf("[%s] 采用AI分析结果: %s (置信度: %.2f)", streamID, aiEmotion, aiConfidence)
				emotion = aiEmotion
				confidence = aiConfidence
			}
		}
	}

	log.Printf("[%s] 情感分析结果: %s (置信度: %.2f)\n", streamID, emotion, confidence)

	return windowResults, AnalysisResult{
		Status:     "success",
		Emotion:    emotion,
		Confidence: confidence,
	}
}
