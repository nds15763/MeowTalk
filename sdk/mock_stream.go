package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/cmplx"
	"net/http"
	"os"
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
	windowSize        int          // 滑动窗口大小（样本数）
	stepSize          int          // 滑动窗口步进（样本数）
	maxBufferSize     int          // 最大缓冲区大小（样本数）
	currentStreamID   string       // 当前流ID
}

// NewMockAudioProcessor 创建新的音频处理器
func NewMockAudioProcessor() *MockAudioProcessor {
	// 尝试加载样本库
	err := loadSampleLibrary("sdk/new_sample_library.json")
	if err != nil {
		log.Printf("加载样本库失败: %v，将使用传统方法进行情感识别", err)
	}

	return &MockAudioProcessor{
		silenceThreshold: 0.02,  // 静默阈值，根据实际情况调整
		minSilenceTime:   0.3,   // 最小静默时间0.3秒
		maxBufferTime:    5.0,   // 最大缓冲5秒
		minProcessTime:   1.0,   // 最小处理时间1秒
		sampleRate:       44100, // 默认采样率
		recentResults:    make([]MockResult, 0, 5),
		lastProcessTime:  time.Now(),
		windowSize:       44100,  // 滑动窗口大小1秒(44100样本)
		stepSize:         22050,  // 滑动窗口步进0.5秒(22050样本)（50%重叠）
		maxBufferSize:    132300, // 最大缓冲区大小3秒(3*44100样本)
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

	m.mu.Lock()
	defer m.mu.Unlock()

	// 检查streamID是否已更改，如果是，则清空缓冲区
	if m.currentStreamID != streamID && m.currentStreamID != "" {
		log.Printf("检测到新的流ID: %s (之前的流ID: %s)，清空缓冲区", streamID, m.currentStreamID)
		m.audioBuffer = []float64{}
	}

	// 更新当前流ID
	m.currentStreamID = streamID

	// 将新数据追加到缓冲区
	m.audioBuffer = append(m.audioBuffer, data...)

	// 检查缓冲区大小是否超过最大限制
	if len(m.audioBuffer) > m.maxBufferSize {
		// 保留最后maxBufferSize个样本，丢弃前面的数据
		m.audioBuffer = m.audioBuffer[len(m.audioBuffer)-m.maxBufferSize:]
		log.Printf("缓冲区超过最大限制 %d 样本，已截断", m.maxBufferSize)
	}

	// 注意：前端发送的是频域数据，而不是时域数据
	// 这里暂时按照时域数据处理，但计算持续时间时需要考虑前端降采样因素
	// 前端使用filter((_, index) => index % 10 === 0)进行了10倍降采样
	// 因此实际时间应该是样本数 * 10 / 采样率
	actualSampleCount := len(m.audioBuffer) * 10
	bufferDuration := float64(actualSampleCount) / float64(m.sampleRate)
	log.Printf("音频缓冲区：当前长度=%d 样本, 持续时间=%.2f秒", len(m.audioBuffer), bufferDuration)

	// 确定是否需要处理音频
	shouldProcess := false

	// 检查是否有足够的窗口数量
	windowCount := 0
	if len(m.audioBuffer) >= m.windowSize/10 { // 考虑降采样因素调整窗口大小比较
		windowCount = 1 + (len(m.audioBuffer)-(m.windowSize/10))/(m.stepSize/10)
	}

	// 条件1：至少形成3个完整窗口
	if windowCount >= 3 {
		shouldProcess = true
		log.Printf("处理条件：已形成 %d 个滑动窗口", windowCount)
	}

	// 检查是否有足够长的静默段
	segments, silenceDetected := m.detectSilence(m.audioBuffer)

	// 条件2：检测到静默，表示叫声可能结束
	if silenceDetected && len(segments) > 0 {
		shouldProcess = true
		log.Printf("处理条件：检测到静默，得到 %d 个分段", len(segments))
	}

	// 条件3：缓冲区超过最大缓冲时间
	if bufferDuration >= m.maxBufferTime {
		shouldProcess = true
		log.Printf("缓冲区达到最大时间 (%.2f秒)，处理数据", bufferDuration)
	}

	// 条件4：超过最小处理时间，且自上次处理已经过去了足够长的时间
	timeSinceLastProcess := time.Since(m.lastProcessTime).Seconds()
	if bufferDuration >= m.minProcessTime && timeSinceLastProcess >= 0.5 {
		shouldProcess = true
		log.Printf("达到最小处理时间 (%.2f秒) 且间隔足够长 (%.2f秒), 处理数据",
			bufferDuration, timeSinceLastProcess)
	}

	// 如果不需要处理，返回等待状态
	if !shouldProcess {
		log.Println("缓冲区不需要处理，等待更多数据")
		return json.Marshal(AnalysisResult{
			Status: "waiting",
		})
	}

	log.Printf("开始处理音频缓冲区: 长度=%d样本, 时长=%.2f秒", len(m.audioBuffer), bufferDuration)

	// 处理音频数据
	result, err := m.processBuffer(streamID, m.audioBuffer)

	// 保留最后1个窗口大小的数据以保持连续性 (考虑降采样因素)
	retainSamples := m.windowSize / 10
	if len(m.audioBuffer) > retainSamples {
		m.audioBuffer = m.audioBuffer[len(m.audioBuffer)-retainSamples:]
		log.Printf("保留 %d 个样本以确保处理连续性", retainSamples)
	}

	m.lastProcessTime = time.Now()

	return result, err
}

// processBuffer 处理缓冲区中的音频数据
func (m *MockAudioProcessor) processBuffer(streamID string, data []float64) ([]byte, error) {
	if len(data) == 0 {
		return []byte(`{"status":"empty"}`), nil
	}

	// 创建滑动窗口
	windows := m.createSlidingWindows(data)
	log.Printf("创建了 %d 个滑动窗口", len(windows))

	// 检测静默并处理音频
	segments, hasSilence := m.detectSilence(data)

	// 如果检测到静默，则处理每个段落
	var result []byte
	var err error

	if hasSilence && len(segments) > 0 {
		// 处理每个分段
		var combinedResults []AnalysisResult

		for i, segment := range segments {
			if len(segment) >= m.windowSize/10 { // 考虑降采样因素调整窗口大小比较
				// 处理足够长的段落
				segWindows := m.createSlidingWindows(segment)
				if len(segWindows) > 0 {
					_, segResult := m.processAudioSegment(streamID, segment)
					segResult.Status = fmt.Sprintf("segment_%d", i+1)
					combinedResults = append(combinedResults, segResult)
				}
			}
		}

		if len(combinedResults) > 0 {
			// 找到置信度最高的结果
			bestResult := combinedResults[0]
			for _, res := range combinedResults {
				if res.Confidence > bestResult.Confidence {
					bestResult = res
				}
			}

			result, err = json.Marshal(bestResult)
			return result, err
		}
	}

	// 如果没有检测到静默或处理静默段落失败，处理整个缓冲区
	if len(windows) > 0 {
		log.Printf("开始音频片段处理: 长度=%d", len(data))
		// 处理整个音频片段
		_, analysisResult := m.processAudioSegment(streamID, data)
		analysisResult.Status = "processed"

		result, err = json.Marshal(analysisResult)
		return result, err
	}

	// 没有足够的数据进行处理
	return []byte(`{"status":"insufficient_data"}`), nil
}

// AudioFeatures 简化的音频特征，用于情感识别
type AudioFeatures struct {
	Energy           float64
	Pitch            float64
	Duration         float64
	ZeroCrossRate    float64
	RootMeanSquare   float64
	PeakFreq         float64
	SpectralCentroid float64
	SpectralRolloff  float64
	FundamentalFreq  float64
}

// 从窗口结果集中提取最终特征
func extractFinalFeatures(windowResults []AudioFeature) AudioFeatures {
	if len(windowResults) == 0 {
		return AudioFeatures{} // 返回空特征
	}

	// 找出具有最高能量的窗口
	maxEnergy := 0.0
	maxEnergyIndex := 0

	for i, feature := range windowResults {
		// 跟踪最高能量
		if feature.Energy > maxEnergy {
			maxEnergy = feature.Energy
			maxEnergyIndex = i
		}
	}

	// 获取最高能量窗口的所有特征
	bestFeature := windowResults[maxEnergyIndex]

	log.Printf("使用最高能量窗口的特征: 窗口#%d，能量=%.6f", maxEnergyIndex, maxEnergy)

	// 构建最终特征，主要使用最高能量窗口的特征值
	finalFeatures := AudioFeatures{
		Energy:           maxEnergy,
		Pitch:            bestFeature.Pitch,            // 使用最高能量窗口的音高，确保与其它特征一致
		Duration:         bestFeature.Duration,         // 使用最高能量窗口的持续时间
		ZeroCrossRate:    bestFeature.ZeroCrossRate,    // 使用最高能量窗口的过零率
		RootMeanSquare:   bestFeature.RootMeanSquare,   // 使用最高能量窗口的均方根
		PeakFreq:         bestFeature.PeakFreq,         // 使用最高能量窗口的峰值频率
		SpectralCentroid: bestFeature.SpectralCentroid, // 使用最高能量窗口的频谱质心
		SpectralRolloff:  bestFeature.SpectralRolloff,  // 使用最高能量窗口的频谱滚降点
		FundamentalFreq:  bestFeature.FundamentalFreq,  // 使用最高能量窗口的基频
	}

	log.Printf("最终提取的关键特征 - 音高: %.2f Hz, 基频: %.2f Hz, RMS: %.6f, ZCR: %.6f, 峰值频率: %.2f Hz",
		finalFeatures.Pitch, finalFeatures.FundamentalFreq, finalFeatures.RootMeanSquare,
		finalFeatures.ZeroCrossRate, finalFeatures.PeakFreq)

	return finalFeatures
}

// AudioFeature 详细的音频特征
type AudioFeature struct {
	WindowIndex      int     // 窗口索引
	StartTime        float64 // 窗口开始时间（秒）
	EndTime          float64 // 窗口结束时间（秒）
	Energy           float64 // 音频能量
	ZeroCrossRate    float64 // 过零率
	RootMeanSquare   float64 // 均方根值
	PeakFreq         float64 // 峰值频率
	SpectralCentroid float64 // 频谱质心
	SpectralRolloff  float64 // 频谱滚降点
	FundamentalFreq  float64 // 基频
	Pitch            float64 // 音高
	Duration         float64 // 持续时间
}

// 从窗口数据中提取音频特征
func extractAudioFeatures(data []float64, sampleRate int, windowIndex int, startTime float64, endTime float64) AudioFeature {
	var features AudioFeature

	// 设置窗口信息
	features.WindowIndex = windowIndex
	features.StartTime = startTime
	features.EndTime = endTime

	// 计算持续时间（秒），考虑降采样因子
	features.Duration = float64(len(data)*10) / float64(sampleRate)
	log.Printf("持续时间计算: 数据点数=%d, 有效采样率=%d, 计算结果=%.3f秒",
		len(data), sampleRate/10, features.Duration)

	// 计算过零率
	features.ZeroCrossRate = calculateZeroCrossRate(data)

	// 计算能量
	features.Energy = calculateEnergy(data)
	log.Printf("能量计算: 总能量=%.6f, 数据点数=%d", features.Energy, len(data))

	// 计算均方根值
	features.RootMeanSquare = math.Sqrt(features.Energy / float64(len(data)))
	log.Printf("均方根计算: 能量=%.6f, 数据点数=%d, RMS=%.6f",
		features.Energy, len(data), features.RootMeanSquare)

	// 应用窗函数并进行频域分析 - 使用预处理后的数据进行频域分析
	windowedData := applyHammingWindow(data)

	// 计算峰值频率 - 使用窗函数处理后的数据
	features.PeakFreq = calculatePeakFrequency(windowedData, sampleRate)

	// 计算频谱
	spectrum := performFFT(windowedData)

	// 计算频谱质心
	features.SpectralCentroid = calculateSpectralCentroid(spectrum)

	// 计算频谱滚降点
	features.SpectralRolloff = calculateSpectralRolloff(spectrum)

	// 计算基频 - 使用预处理后的数据
	features.FundamentalFreq = estimateFundamentalFrequency(windowedData)

	// 估计音高
	features.Pitch = estimatePitch(windowedData, sampleRate)

	// 进行特征验证 - 确保所有特征在合理范围内
	validateFeatures(&features)

	// 记录提取的特征数据
	log.Printf("窗口 #%d (%.2f-%.2f秒) 特征: 能量=%.2f, RMS=%.6f, 音高=%.2f Hz, 基频=%.2f Hz, 峰值频率=%.2f Hz, 谱质心=%.2f, 过零率=%.4f, 持续时间=%.3fs",
		features.WindowIndex, features.StartTime, features.EndTime,
		features.Energy, features.RootMeanSquare, features.Pitch, features.FundamentalFreq,
		features.PeakFreq, features.SpectralCentroid, features.ZeroCrossRate, features.Duration)

	return features
}

// validateFeatures 验证计算的特征是否合理
func validateFeatures(features *AudioFeature) {
	// 检查特征的有效性，确保没有不合理的值

	// 1. 检查能量和RMS
	if features.Energy < 0 {
		log.Printf("警告: 能量值异常 (%.6f)", features.Energy)
		features.Energy = 0
	}

	if features.RootMeanSquare < 0 {
		log.Printf("警告: RMS值异常 (%.6f)", features.RootMeanSquare)
		features.RootMeanSquare = 0
	}

	// 2. 检查频率相关特征
	if features.Pitch > 0 && (features.Pitch < 70 || features.Pitch > 1500) {
		log.Printf("警告: 音高值超出猫咪声音合理范围 (%.2f Hz)", features.Pitch)
		features.Pitch = 0
	}

	if features.PeakFreq > 0 && (features.PeakFreq < 70 || features.PeakFreq > 2000) {
		log.Printf("警告: 峰值频率超出合理范围 (%.2f Hz)", features.PeakFreq)
		features.PeakFreq = 0
	}

	// 3. 确保基频和音高一致性
	if features.FundamentalFreq > 0 && features.Pitch > 0 {
		// 检查两者差异
		diff := math.Abs(features.FundamentalFreq - features.Pitch)
		if diff > 1.0 {
			log.Printf("警告: 基频(%.2f Hz)与音高(%.2f Hz)不一致", features.FundamentalFreq, features.Pitch)
			// 使用基频作为准确值
			features.Pitch = features.FundamentalFreq
		}
	}
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
	if len(data) == 0 {
		return 0.0
	}

	// 执行FFT
	fft := performFFT(data)

	// 考虑降采样因子，使用有效采样率
	effectiveSampleRate := sampleRate / 10 // 考虑降采样因子
	minFreq := 70.0                        // 最小频率为70Hz（猫咪声音的下限）
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
	threshold := 0.05 * float64(len(data)) // 提高阈值以过滤噪声
	if maxMagnitude < threshold || peakBin == 0 {
		log.Printf("峰值频率计算: 未找到显著峰值，幅值(%.6f)低于阈值(%.6f)", maxMagnitude, threshold)
		return 0.0 // 如果峰值不显著，返回0
	}

	// 转换为频率，使用有效采样率
	frequency := float64(peakBin) * float64(effectiveSampleRate) / float64(len(fft))
	log.Printf("峰值频率计算: bin=%d, 幅值=%.6f, 频率=%.2f Hz (有效采样率=%d Hz)", peakBin, maxMagnitude, frequency, effectiveSampleRate)
	return frequency
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
		log.Printf("基频计算失败: 数据长度(%d)不足或单个周期时间范围无效[最小=%d, 最大=%d]",
			len(data), minLag, maxLag)
		return 0.0
	}

	// 步骤1: 预处理 - 中心化数据（移除直流分量）
	mean := 0.0
	for _, v := range data {
		mean += v
	}
	mean /= float64(len(data))

	centeredData := make([]float64, len(data))
	for i, v := range data {
		centeredData[i] = v - mean
	}

	// 步骤2: 归一化
	dataMax := 0.0
	for _, v := range centeredData {
		if math.Abs(v) > dataMax {
			dataMax = math.Abs(v)
		}
	}

	normalizedData := make([]float64, len(data))
	if dataMax > 0 {
		for i, v := range centeredData {
			normalizedData[i] = v / dataMax
		}
	} else {
		log.Printf("基频计算警告: 信号强度过低")
		return 0.0 // 信号强度太低，无法可靠检测
	}

	// 步骤3: 应用汉宁窗函数减少频谱泄漏
	for i := range normalizedData {
		// 汉宁窗: 0.5 * (1 - cos(2π*n/(N-1)))
		window := 0.5 * (1.0 - math.Cos(2.0*math.Pi*float64(i)/float64(len(normalizedData)-1)))
		normalizedData[i] *= window
	}

	// 步骤4: 计算自相关
	maxCorr := 0.0
	bestLag := 0
	secondBestLag := 0
	secondCorr := 0.0

	// 先计算自相关的基准值（lag=0时的值）
	baseCorr := 0.0
	for i := 0; i < len(normalizedData); i++ {
		baseCorr += normalizedData[i] * normalizedData[i]
	}
	baseCorr /= float64(len(normalizedData))

	if baseCorr <= 0 {
		log.Printf("基频计算警告: 基准相关值无效 (%.6f)", baseCorr)
		return 0.0
	}

	for lag := minLag; lag <= maxLag; lag++ {
		corr := 0.0
		for i := 0; i < len(normalizedData)-lag; i++ {
			corr += normalizedData[i] * normalizedData[i+lag]
		}

		// 归一化相关系数
		corr = corr / float64(len(normalizedData)-lag) / baseCorr

		if corr > maxCorr {
			secondCorr = maxCorr
			secondBestLag = bestLag
			maxCorr = corr
			bestLag = lag
		} else if corr > secondCorr {
			secondCorr = corr
			secondBestLag = lag
		}
	}

	// 步骤5: 结果验证
	// 提高相关性阈值要求
	minCorrThreshold := 0.25 // 相关性阈值调高
	if maxCorr < minCorrThreshold {
		log.Printf("基频计算: 相关性太低(%.4f < %.4f)，可能不存在明显的周期性信号", maxCorr, minCorrThreshold)
		return 0.0
	}

	// 计算最终的频率值
	fundamentalFreq := float64(effectiveSampleRate) / float64(bestLag)
	log.Printf("基频计算: 最佳周期=%d点, 相关性=%.4f, 基频=%.2f Hz", bestLag, maxCorr, fundamentalFreq)

	// 检查频率范围是否合理
	if fundamentalFreq < 70.0 || fundamentalFreq > 1000.0 {
		// 如果结果超出合理范围，看看次优结果是否更合理
		if secondBestLag > 0 {
			secondFreq := float64(effectiveSampleRate) / float64(secondBestLag)
			if secondFreq >= 70.0 && secondFreq <= 1000.0 && secondCorr > minCorrThreshold {
				log.Printf("基频调整: 选择次优周期=%d点, 相关性=%.4f, 频率=%.2f Hz (替代范围外值 %.2f Hz)",
					secondBestLag, secondCorr, secondFreq, fundamentalFreq)
				return secondFreq
			}
		}
		log.Printf("基频计算警告: 结果超出合理范围 (%.2f Hz, 期望70-1000Hz)", fundamentalFreq)
		return 0.0
	}

	return fundamentalFreq
}

// estimatePitch 估计音高
func estimatePitch(data []float64, sampleRate int) float64 {
	// 在MeowTalk中，音高与基频应当是相同的概念
	// 直接使用基频计算结果作为音高
	pitch := estimateFundamentalFrequency(data)
	log.Printf("音高估计: 使用基频值 %.2f Hz", pitch)
	return pitch
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
	windowedData := applyHammingWindow(data)

	// 初始化FFT数据
	fft := make([]complex128, n)
	for i, val := range windowedData {
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

	// 如果没有找到过零点，尝试使用原始数据
	if crossCount == 0 {
		for i := 1; i < len(data); i++ {
			if (data[i-1] >= 0 && data[i] < 0) || (data[i-1] < 0 && data[i] >= 0) {
				crossCount++
			}
		}
	}

	zcr := crossCount / float64(len(data)-1)
	log.Printf("过零率计算: 找到 %.1f 个过零点, 过零率=%.6f", crossCount, zcr)

	return zcr
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

	return energy
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
	log.Printf("开始情感识别: 详细特征信息如下:")
	log.Printf("  能量(Energy)=%.6f", features.Energy)
	log.Printf("  音高(Pitch)=%.2f Hz", features.Pitch)
	log.Printf("  持续时间(Duration)=%.2f秒", features.Duration)
	log.Printf("  其他参考特征:")
	log.Printf("  ZeroCrossRate=%.6f", features.ZeroCrossRate)
	log.Printf("  RootMeanSquare=%.6f", features.RootMeanSquare)
	log.Printf("  PeakFreq=%.2f Hz", features.PeakFreq)
	log.Printf("  SpectralCentroid=%.2f Hz", features.SpectralCentroid)
	log.Printf("  SpectralRolloff=%.2f Hz", features.SpectralRolloff)
	log.Printf("  FundamentalFreq=%.2f Hz", features.FundamentalFreq)

	// 如果持续时间太短，认为是噪声
	if features.Duration < 0.1 {
		return "unknown", 0.0
	}

	// 标准化特征
	normEnergy := min(features.Energy/1.0, 1.0)
	normPitch := min(features.Pitch/1000.0, 1.0)
	normDuration := min(features.Duration/2.0, 1.0)

	normalizedFeatures := AudioFeatures{
		Energy:           normEnergy,
		Pitch:            normPitch,
		Duration:         normDuration,
		ZeroCrossRate:    features.ZeroCrossRate,
		RootMeanSquare:   features.RootMeanSquare,
		PeakFreq:         features.PeakFreq,
		SpectralCentroid: features.SpectralCentroid,
		SpectralRolloff:  features.SpectralRolloff,
		FundamentalFreq:  features.FundamentalFreq,
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

// recognizeEmotionWithSamples 使用样本库进行情感识别
func recognizeEmotionWithSamples(features AudioFeatures) (string, float64) {
	log.Printf("基于样本库进行情感识别: 详细特征信息如下:")
	log.Printf("  能量(Energy)=%.6f", features.Energy)
	log.Printf("  音高(Pitch)=%.2f Hz", features.Pitch)
	log.Printf("  持续时间(Duration)=%.2f秒", features.Duration)
	log.Printf("  过零率(ZeroCrossRate)=%.6f", features.ZeroCrossRate)
	log.Printf("  峰值频率(PeakFreq)=%.2f Hz", features.PeakFreq)
	log.Printf("  基频(FundamentalFreq)=%.2f Hz", features.FundamentalFreq)

	// 如果样本库未加载，返回传统方法结果
	if sampleLibrary == nil {
		log.Printf("样本库未加载，使用传统方法识别情感")
		return recognizeEmotion(features)
	}

	// 如果持续时间太短，认为是噪声
	if features.Duration < 0.1 {
		return "unknown", 0.0
	}

	bestEmotion := ""
	bestMatch := 0.0
	allConfidences := make(map[string]float64)
	emotionCounts := make(map[string]int)

	// 遍历样本库中的每个情感类别
	for emotion, samples := range sampleLibrary.Samples {
		if len(samples) == 0 {
			continue
		}

		// 计算与当前情感类别所有样本的匹配度
		totalMatch := 0.0
		matchCount := 0

		for _, sample := range samples {
			// 计算特征距离
			pitchDiff := 0.0
			if features.Pitch > 0 && sample.Features.Pitch > 0 {
				pitchDiff = math.Abs(features.Pitch-sample.Features.Pitch) / math.Max(features.Pitch, sample.Features.Pitch)
			} else {
				pitchDiff = 1.0 // 如果任一方没有音高，则差异最大
			}

			zeroCrossDiff := math.Abs(features.ZeroCrossRate - sample.Features.ZeroCrossRate)
			rmsDiff := math.Abs(features.RootMeanSquare-sample.Features.RootMeanSquare) /
				math.Max(0.001, math.Max(features.RootMeanSquare, sample.Features.RootMeanSquare))

			peakFreqDiff := 0.0
			if features.PeakFreq > 0 && sample.Features.PeakFreq > 0 {
				peakFreqDiff = math.Abs(features.PeakFreq-sample.Features.PeakFreq) /
					math.Max(features.PeakFreq, sample.Features.PeakFreq)
			} else {
				peakFreqDiff = 1.0
			}

			fundFreqDiff := 0.0
			if features.FundamentalFreq > 0 && sample.Features.FundamentalFreq > 0 {
				fundFreqDiff = math.Abs(features.FundamentalFreq-sample.Features.FundamentalFreq) /
					math.Max(features.FundamentalFreq, sample.Features.FundamentalFreq)
			} else {
				fundFreqDiff = 1.0
			}

			// 计算综合匹配度（权重可调整）
			// 把各项差异归一化到0-1范围，0表示完全匹配
			totalDiff := pitchDiff*0.3 + zeroCrossDiff*0.15 + rmsDiff*0.15 +
				peakFreqDiff*0.2 + fundFreqDiff*0.2

			match := 1.0 - min(totalDiff, 1.0) // 转换为匹配度，1为完全匹配

			if match > 0.1 { // 只考虑最低匹配度以上的样本
				totalMatch += match
				matchCount++
			}
		}

		// 计算平均匹配度
		if matchCount > 0 {
			averageMatch := totalMatch / float64(matchCount)
			allConfidences[emotion] = averageMatch
			emotionCounts[emotion] = matchCount

			log.Printf("情感[%s]平均匹配度: %.4f (基于%d个样本)",
				emotion, averageMatch, matchCount)

			// 更新最佳匹配
			if averageMatch > bestMatch {
				bestMatch = averageMatch
				bestEmotion = emotion
			}
		}
	}

	// 转换情感类别为前端定义的ID（如果需要）
	if bestEmotion != "" {
		// 对比前端emotions.ts中定义的情感ID
		// 这里进行情感ID的映射，确保与前端定义一致
		switch bestEmotion {
		// 处理需要特殊映射的情感ID
		case "ask-for-play", "ask-for-hunting", "for-food", "for-fight":
			// 将带连字符的ID转换为下划线形式
			bestEmotion = strings.ReplaceAll(bestEmotion, "-", "_")
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

	log.Printf("样本库识别结果: 情感=%s, 置信度=%.4f", bestEmotion, bestMatch)
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

	// 如果有结果，保存到会话
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
	// 解析请求参数
	decoder := json.NewDecoder(r.Body)
	var request struct {
		StreamID string `json:"streamId"`
	}
	err := decoder.Decode(&request)
	if err != nil {
		http.Error(w, "解析请求参数失败: "+err.Error(), http.StatusBadRequest)
		return
	}

	// 检查 StreamID 是否存在
	if request.StreamID == "" {
		http.Error(w, "缺少 StreamID", http.StatusBadRequest)
		return
	}

	// 清理任何与此streamID相关的缓冲区数据
	m.mu.Lock()
	if m.currentStreamID == request.StreamID {
		log.Printf("停止会话 %s, 清空缓冲区", request.StreamID)
		m.audioBuffer = []float64{}
		m.currentStreamID = ""
	}
	m.mu.Unlock()

	// 返回成功响应
	w.Header().Set("Content-Type", "application/json")
	response := struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}{
		Success: true,
		Message: "成功停止会话 " + request.StreamID,
	}

	jsonResponse, err := json.Marshal(response)
	if err != nil {
		http.Error(w, "生成响应失败: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(jsonResponse)
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

// createSlidingWindows 创建滑动窗口
func (m *MockAudioProcessor) createSlidingWindows(data []float64) [][]float64 {
	var windows [][]float64

	// 如果数据少于窗口大小，返回空
	if len(data) < m.windowSize/10 { // 考虑降采样因素调整窗口大小比较
		return windows
	}

	// 创建滑动窗口
	for i := 0; i <= len(data)-m.windowSize/10; i += m.stepSize / 10 { // 考虑降采样因素调整步进
		window := data[i : i+m.windowSize/10]
		windows = append(windows, window)
	}

	return windows
}

// detectSilence 检测缓冲区中的静默段
func (m *MockAudioProcessor) detectSilence(data []float64) ([][]float64, bool) {
	// 考虑前端降采样因素（10倍）
	scaleFactor := 10

	// 如果缓冲区太小，无法检测足够长的静默
	minSamples := int(m.minSilenceTime*float64(m.sampleRate)) / scaleFactor
	if len(data) < minSamples {
		return nil, false
	}

	// 使用均方根能量检测静默
	silenceWindow := int(0.02*float64(m.sampleRate)) / scaleFactor // 20ms窗口，考虑降采样
	if silenceWindow < 10 {                                        // 确保窗口至少有10个样本（考虑降采样后）
		silenceWindow = 10
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
				if len(currentSegment) > int(0.1*float64(m.sampleRate))/scaleFactor {
					segments = append(segments, currentSegment)
				}
				currentSegment = []float64{}
			}

			silenceCount += float64(silenceWindow) / 2

			// 检查静默是否达到最小时间
			// 考虑降采样因素，静默持续时间需要乘以scaleFactor
			silenceDuration := float64(silenceCount*float64(scaleFactor)) / float64(m.sampleRate)
			if silenceDuration >= m.minSilenceTime {
				log.Printf("检测到持续静默: %.2f秒 (阈值=%.3f, 能量=%.3f)",
					silenceDuration, actualThreshold, energy)
				// 如果当前有未保存的片段，保存它
				if len(currentSegment) > int(0.1*float64(m.sampleRate))/scaleFactor {
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
	if len(currentSegment) > int(0.1*float64(m.sampleRate))/scaleFactor {
		segments = append(segments, currentSegment)
	}

	return segments, false
}

// processAudioSegment 处理单个音频片段
func (m *MockAudioProcessor) processAudioSegment(streamID string, data []float64) ([]AudioFeature, AnalysisResult) {
	log.Printf("开始音频片段处理: 长度=%d", len(data))

	if len(data) == 0 {
		return nil, AnalysisResult{Status: "empty"}
	}

	// 考虑前端降采样因素（10倍）
	scaleFactor := 10

	// 窗口大小和滑动大小需要考虑降采样因素
	windowSize := m.windowSize / scaleFactor // 原始窗口大小除以降采样因子
	stepSize := m.stepSize / scaleFactor     // 原始步进大小除以降采样因子

	if windowSize > len(data) {
		windowSize = len(data)
	}

	// 计算将创建多少个窗口
	windowCount := 0
	if len(data) > windowSize {
		windowCount = 1 + (len(data)-windowSize)/stepSize
	} else {
		windowCount = 1
	}

	// 记录窗口分析，计算实际时间需要考虑降采样因素
	actualDataLength := float64(len(data)*scaleFactor) / float64(m.sampleRate)
	log.Printf("音频分析 [%s]: 总长度 %.2f秒, 使用 %d 个 %d毫秒窗口, 重叠率 50%%",
		streamID, actualDataLength, windowCount, windowSize*scaleFactor*1000/m.sampleRate)

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

		// 计算实际时间需要考虑降采样因素
		startTime := float64(i*scaleFactor) / float64(m.sampleRate)
		endTime := float64((i+windowSize)*scaleFactor) / float64(m.sampleRate)

		// 提取特征
		features := extractAudioFeatures(windowedData, m.sampleRate, windowIndex, startTime, endTime)

		// 记录每个窗口的关键特征
		log.Printf("窗口 #%d [%s] (%.2f-%.2f秒): 能量=%.2f, 音高=%.2f Hz",
			windowIndex+1,
			streamID,
			startTime,
			endTime,
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
			Status: "no_features",
		}
	}

	// 从多窗口分析结果中提取最终特征
	finalFeatures := extractFinalFeatures(windowResults)

	// 从样本库匹配情感
	emotion, confidence := recognizeEmotionWithSamples(finalFeatures)

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

// max 返回两个整数中较大的一个
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// SampleLibrary 样本库结构
type JsonSampleLibrary struct {
	TotalSamples int                      `json:"totalSamples"`
	Emotions     []string                 `json:"emotions"`
	Samples      map[string][]SampleEntry `json:"samples"`
}

// SampleEntry 样本条目
type SampleEntry struct {
	FilePath string        `json:"FilePath"`
	Emotion  string        `json:"Emotion"`
	Features AudioFeatures `json:"Features"`
}

var sampleLibrary *JsonSampleLibrary

// loadSampleLibrary 加载样本库
func loadSampleLibrary(filePath string) error {
	log.Printf("加载样本库: %s", filePath)

	// 读取JSON文件
	fileData, err := os.ReadFile(filePath)
	if err != nil {
		log.Printf("无法读取样本库文件: %v", err)
		return err
	}

	// 解析JSON
	var library JsonSampleLibrary
	err = json.Unmarshal(fileData, &library)
	if err != nil {
		log.Printf("解析样本库文件失败: %v", err)
		return err
	}

	sampleLibrary = &library
	log.Printf("样本库加载成功, 共 %d 个样本, %d 种情感类别",
		library.TotalSamples, len(library.Emotions))

	return nil
}
