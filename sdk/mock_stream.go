package main

import (
	"bytes"
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
)

// AudioProcessor 音频处理接口
type AudioProcessor interface {
	ProcessAudio(data []float64) ([]byte, error)
}

// MockAudioProcessor 模拟音频处理器
type MockAudioProcessor struct {
	sessions sync.Map
}

// MockResult 分析结果
type MockResult struct {
	Emotion    string             `json:"emotion"`
	Confidence float64            `json:"confidence"`
	Timestamp  time.Time          `json:"timestamp"`
	Features   map[string]float64 `json:"features"`
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // 允许所有来源，仅用于测试
	},
}

func (m *MockAudioProcessor) ProcessAudio(data []float64) ([]byte, error) {
	log.Println("MockAudioProcessor 开始处理音频数据")

	if len(data) == 0 {
		return nil, fmt.Errorf("音频数据为空")
	}

	// 1. 应用汉明窗
	windowedData := applyHammingWindow(data)

	// 2. 提取音频特征
	features := extractAudioFeatures(windowedData)

	// 3. 从样本库匹配情绪
	emotion, confidence := matchEmotionFromSampleLibrary(features)

	// 4. 如果匹配置信度低，尝试使用AI分析
	if confidence < 0.65 {
		aiEmotion, aiConfidence := analyzeEmotionWithAI(windowedData, features)

		// 如果AI分析的置信度更高，使用AI分析结果
		if aiConfidence > confidence {
			emotion = aiEmotion
			confidence = aiConfidence
			log.Printf("使用AI分析结果: %s (置信度: %.2f)\n", emotion, confidence)
		}
	}

	// 5. 构造结果
	// 将AudioFeature转换为map以避免类型冲突
	featureMap := map[string]float64{
		"zero_cross_rate":       features.ZeroCrossRate,
		"energy":                features.Energy,
		"rms":                   features.RootMeanSquare,
		"pitch":                 features.Pitch,
		"peak_frequency":        features.PeakFreq,
		"spectral_centroid":     features.SpectralCentroid,
		"spectral_rolloff":      features.SpectralRolloff,
		"fundamental_frequency": features.FundamentalFreq,
		"duration":              features.Duration,
	}

	result := MockResult{
		Emotion:    emotion,
		Confidence: confidence,
		Timestamp:  time.Now(),
		Features:   featureMap,
	}

	log.Printf("音频情绪分析结果: %s (置信度: %.2f)\n", emotion, confidence)
	return json.Marshal(result)
}

// extractAudioFeatures 提取音频特征
func extractAudioFeatures(data []float64) AudioFeature {
	// 初始化特征
	features := AudioFeature{}

	// 计算零交叉率(ZCR)
	zeroCrossingRate := 0.0
	for i := 1; i < len(data); i++ {
		if (data[i-1] >= 0 && data[i] < 0) || (data[i-1] < 0 && data[i] >= 0) {
			zeroCrossingRate++
		}
	}
	features.ZeroCrossRate = zeroCrossingRate / float64(len(data)-1)

	// 计算能量
	energy := 0.0
	for _, sample := range data {
		energy += sample * sample
	}
	features.Energy = energy / float64(len(data))

	// 计算均方根值
	rms := math.Sqrt(features.Energy)
	features.RootMeanSquare = rms

	// 设置持续时间 (假设采样率为44100Hz)
	features.Duration = float64(len(data)) / 44100.0

	// 计算音高 (简化估计)
	features.Pitch = estimatePitch(data, 44100)

	// 计算频域特征
	// 首先执行FFT预处理
	n := nextPowerOfTwo(len(data))
	if n > len(data) {
		padded := make([]float64, n)
		copy(padded, data)
		data = padded
	}

	// 应用汉明窗
	windowed := applyHammingWindow(data)

	// 执行FFT
	fft := performFFT(windowed)

	// 直接使用recording.go中的实现
	features.PeakFreq = calculatePeakFrequency(data, 44100)
	features.SpectralCentroid = calculateSpectralCentroid(fft)
	features.SpectralRolloff = calculateSpectralRolloff(fft)
	features.FundamentalFreq = estimateFundamentalFrequency(fft)

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

// performFFT 执行快速傅里叶变换 (使用recording.go中的实现)
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

// estimateFundamentalFrequency 估计基频
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

	if period == 0 {
		return 0
	}

	// 转换为频率
	sampleRate := 44100.0
	return sampleRate / float64(period)
}

// estimatePitch 估计音高
func estimatePitch(data []float64, sampleRate int) float64 {
	// 使用自相关法估计基频
	minLag := sampleRate / 2000 // 最高2000Hz
	maxLag := sampleRate / 70   // 最低70Hz

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
		return float64(sampleRate) / float64(bestLag)
	}
	return 0
}

// calculatePeakFrequency 计算峰值频率
func calculatePeakFrequency(data []float64, sampleRate int) float64 {
	// 执行FFT
	n := nextPowerOfTwo(len(data))
	if n > len(data) {
		padded := make([]float64, n)
		copy(padded, data)
		data = padded
	}

	// 应用汉明窗
	windowed := applyHammingWindow(data)

	// 执行FFT
	fft := performFFT(windowed)

	// 寻找峰值频率
	maxMagnitude := 0.0
	peakBin := 0
	for i := 0; i < n/2; i++ {
		magnitude := cmplx.Abs(fft[i])
		if magnitude > maxMagnitude {
			maxMagnitude = magnitude
			peakBin = i
		}
	}

	// 转换为频率
	return float64(peakBin) * float64(sampleRate) / float64(n)
}

// nextPowerOfTwo 计算下一个2的幂
func nextPowerOfTwo(n int) int {
	p := 1
	for p < n {
		p *= 2
	}
	return p
}

// matchEmotionFromSampleLibrary 根据特征从样本库匹配情绪
func matchEmotionFromSampleLibrary(feature AudioFeature) (string, float64) {
	// 创建样本库
	sampleLib := NewSampleLibrary()

	// 尝试从JSON文件加载样本库
	err := sampleLib.LoadFromFile("sample_library.json")
	if err != nil {
		log.Printf("加载样本库失败: %v, 使用默认情绪分析\n", err)
		return defaultEmotionAnalysis(feature)
	}

	// 匹配情绪
	// 注意：需要将当前的AudioFeature类型转换为SampleLibrary.Match接受的类型
	mainFeature := convertToLibraryFeature(feature)
	emotion, confidence := sampleLib.Match(mainFeature)

	if emotion == "" {
		// 如果没有匹配到情绪，使用默认分析
		return defaultEmotionAnalysis(feature)
	}

	return emotion, confidence
}

// convertToLibraryFeature 将我们的AudioFeature转换为库函数接受的格式
func convertToLibraryFeature(feature AudioFeature) AudioFeature {
	// 这里直接返回，因为我们使用了同一个结构体
	return feature
}

// defaultEmotionAnalysis 默认情绪分析
func defaultEmotionAnalysis(feature AudioFeature) (string, float64) {
	emotion := "neutral"
	confidence := 0.5

	// 分析能量和音高等特征来估计情绪
	energy := feature.Energy
	pitch := feature.Pitch
	zcr := feature.ZeroCrossRate

	// 按特征值范围分类情绪
	if energy > 0.7 {
		if pitch > 600 {
			emotion = "angry"
			confidence = 0.7 + energy*0.2
		} else if pitch > 400 {
			emotion = "happy"
			confidence = 0.6 + energy*0.3
		} else {
			emotion = "excited"
			confidence = 0.6 + energy*0.2
		}
	} else if energy > 0.4 {
		if zcr > 0.3 {
			emotion = "curious"
			confidence = 0.5 + zcr*0.2
		} else {
			emotion = "contented"
			confidence = 0.6 + (1-zcr)*0.2
		}
	} else {
		if zcr > 0.2 {
			emotion = "sad"
			confidence = 0.5 + (1-energy)*0.3
		} else {
			emotion = "sleepy"
			confidence = 0.7 + (1-energy)*0.2
		}
	}

	// 确保置信度在0-1范围内
	if confidence > 1.0 {
		confidence = 1.0
	} else if confidence < 0.0 {
		confidence = 0.0
	}

	return emotion, confidence
}

// analyzeEmotionWithAI 使用DeepSeek AI分析情绪
func analyzeEmotionWithAI(audioData []float64, features AudioFeature) (string, float64) {
	// 创建DeepSeek API请求内容
	requestBody := map[string]interface{}{
		"model": "deepseek-audio-analyzer",
		"audio_features": map[string]interface{}{
			"zero_crossing_rate":    features.ZeroCrossRate,
			"energy":                features.Energy,
			"rms":                   features.RootMeanSquare,
			"pitch":                 features.Pitch,
			"peak_frequency":        features.PeakFreq,
			"spectral_centroid":     features.SpectralCentroid,
			"spectral_rolloff":      features.SpectralRolloff,
			"fundamental_frequency": features.FundamentalFreq,
		},
		"possible_emotions": []string{
			"contented", "angry", "happy", "sad",
			"excited", "curious", "sleepy", "affectionate",
			"feels very tasty",
		},
		"max_tokens": 150,
	}

	// 将请求体转换为JSON
	requestJSON, err := json.Marshal(requestBody)
	if err != nil {
		log.Printf("创建AI请求失败: %v\n", err)
		return "", 0
	}

	// 创建HTTP请求
	// 注意：这里的URL和API密钥应该从配置中获取
	apiKey := "YOUR_DEEPSEEK_API_KEY" // 生产环境中应从安全存储获取
	req, err := http.NewRequest("POST", "https://api.deepseek.com/v1/chat/completions", bytes.NewBuffer(requestJSON))
	if err != nil {
		log.Printf("创建HTTP请求失败: %v\n", err)
		return "", 0
	}

	// 设置请求头
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	// 发送请求
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("发送AI请求失败: %v\n", err)
		return "", 0
	}
	defer resp.Body.Close()

	// 处理响应
	if resp.StatusCode != http.StatusOK {
		log.Printf("AI请求返回非200状态码: %d\n", resp.StatusCode)
		return "", 0
	}

	// 解析响应
	var responseData map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&responseData); err != nil {
		log.Printf("解析AI响应失败: %v\n", err)
		return "", 0
	}

	// 模拟响应处理 (实际实现应解析真实的DeepSeek API响应)
	// 从响应中提取情绪和置信度
	emotion := "neutral"
	confidence := 0.0

	// 这里应提取DeepSeek API返回的实际情绪和置信度
	// 由于我们没有真实的API访问，这里模拟一个响应处理
	if choices, ok := responseData["choices"].([]interface{}); ok && len(choices) > 0 {
		if firstChoice, ok := choices[0].(map[string]interface{}); ok {
			if message, ok := firstChoice["message"].(map[string]interface{}); ok {
				if content, ok := message["content"].(string); ok {
					// 解析内容获取情绪和置信度
					// 简单示例: "emotion: excited, confidence: 0.85"
					parts := strings.Split(content, ",")
					if len(parts) >= 2 {
						emotionPart := strings.TrimSpace(parts[0])
						confidencePart := strings.TrimSpace(parts[1])

						if emotionValue := strings.Split(emotionPart, ":"); len(emotionValue) >= 2 {
							emotion = strings.TrimSpace(emotionValue[1])
						}

						if confidenceValue := strings.Split(confidencePart, ":"); len(confidenceValue) >= 2 {
							confStr := strings.TrimSpace(confidenceValue[1])
							if conf, err := strconv.ParseFloat(confStr, 64); err == nil {
								confidence = conf
							}
						}
					}
				}
			}
		}
	}

	log.Printf("AI分析结果: %s (置信度: %.2f)\n", emotion, confidence)
	return emotion, confidence
}

func (m *MockAudioProcessor) StartMockServer(port int) error {
	// 初始化处理器
	http.HandleFunc("/init", m.handleInit)
	http.HandleFunc("/start", m.handleStart)
	http.HandleFunc("/send", m.handleSend)
	http.HandleFunc("/recv", m.handleReceive)
	http.HandleFunc("/stop", m.handleStop)

	// 添加CORS中间件
	handler := corsMiddleware(http.DefaultServeMux)

	// 启动服务器
	addr := fmt.Sprintf(":%d", port)
	log.Printf("Mock服务器启动在 http://localhost%s\n", addr)
	return http.ListenAndServe(addr, handler)
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

// HTTP处理函数
func (m *MockAudioProcessor) handleInit(w http.ResponseWriter, r *http.Request) {
	// 处理OPTIONS预检请求
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		log.Printf("错误的请求方法: %s\n", r.Method)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func (m *MockAudioProcessor) handleStart(w http.ResponseWriter, r *http.Request) {
	// 处理OPTIONS预检请求
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		log.Printf("错误的请求方法: %s\n", r.Method)
		return
	}

	// 解析请求体
	var req struct {
		StreamID string `json:"streamId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		log.Printf("解析请求失败: %v\n", err)
		return
	}

	// 使用客户端提供的 streamId
	if req.StreamID == "" {
		http.Error(w, "StreamID is required", http.StatusBadRequest)
		log.Printf("StreamID 不能为空\n")
		return
	}

	// 存储会话
	m.sessions.Store(req.StreamID, &sync.Map{})
	log.Printf("创建新会话 - StreamID: %s\n", req.StreamID)

	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func (m *MockAudioProcessor) handleSend(w http.ResponseWriter, r *http.Request) {
	log.Println("收到请求 - StreamID: ", r)
	// 处理OPTIONS预检请求
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		log.Printf("错误的请求方法: %s\n", r.Method)
		return
	}

	var req SendAudioRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		log.Printf("解析请求体失败: %v\n", err)
		return
	}
	fmt.Println("收到请求 - StreamID: ", req.StreamID)
	// 记录原始请求内容
	log.Printf("收到请求 - StreamID: %s\n", req.StreamID)
	log.Printf("音频数据原始类型: %T\n", req.Data)

	// 处理不同类型的音频数据
	var audioData []float64

	switch data := req.Data.(type) {
	case []interface{}:
		// 将 []interface{} 转换为 []float64
		log.Printf("数据类型为 []interface{}, 长度: %d\n", len(data))
		audioData = make([]float64, len(data))
		for i, v := range data {
			log.Printf("  第 %d 个元素, 类型: %T, 值: %v\n", i, v, v)
			switch val := v.(type) {
			case float64:
				audioData[i] = val
			case json.Number:
				if f, err := val.Float64(); err == nil {
					audioData[i] = f
				}
			case int:
				audioData[i] = float64(val)
			case float32:
				audioData[i] = float64(val)
			case string:
				if f, err := strconv.ParseFloat(val, 64); err == nil {
					audioData[i] = f
				}
			default:
				// 对于无法转换的值，使用0
				audioData[i] = 0
				log.Printf("    无法处理的类型: %T\n", v)
			}
		}
	case []float64:
		// 已经是正确类型
		log.Printf("数据类型为 []float64, 长度: %d\n", len(data))
		audioData = data
	default:
		log.Printf("未知的数据类型: %T\n", req.Data)
		// 尝试以JSON方式转换
		if jsonData, err := json.Marshal(req.Data); err == nil {
			log.Printf("数据JSON表示: %s\n", string(jsonData))
		}
	}

	// 记录处理后的音频数据统计信息
	if len(audioData) > 0 {
		maxVal := audioData[0]
		minVal := audioData[0]
		sumVal := 0.0

		for _, v := range audioData {
			if v > maxVal {
				maxVal = v
			}
			if v < minVal {
				minVal = v
			}
			sumVal += v
		}

		avgVal := sumVal / float64(len(audioData))
		log.Printf("音频数据统计 - 长度: %d, 最小值: %.2f, 最大值: %.2f, 平均值: %.2f\n",
			len(audioData), minVal, maxVal, avgVal)
	} else {
		log.Printf("警告: 处理后的音频数据为空\n")
	}

	// 处理音频数据
	result, err := m.ProcessAudio(audioData)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Printf("处理音频失败: %v\n", err)
		return
	}

	// 存储结果
	if session, ok := m.sessions.Load(req.StreamID); ok {
		session.(*sync.Map).Store(time.Now().UnixNano(), result)
	}

	w.Write(result)
}

func (m *MockAudioProcessor) handleReceive(w http.ResponseWriter, r *http.Request) {
	// 处理OPTIONS预检请求
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 获取streamId
	streamID := r.URL.Query().Get("streamId")
	if streamID == "" {
		http.Error(w, "StreamID is required", http.StatusBadRequest)
		return
	}

	// 获取会话
	sessionInterface, ok := m.sessions.Load(streamID)
	if !ok {
		http.Error(w, "No session found", http.StatusNotFound)
		return
	}

	// 转换类型
	session := sessionInterface.(*sync.Map)

	// 查找最新的结果
	var latestResult []byte
	var latestTime int64 = 0

	session.Range(func(key, value interface{}) bool {
		timestamp := key.(int64)
		if timestamp > latestTime {
			latestTime = timestamp
			latestResult = value.([]byte)
		}
		return true
	})

	if latestResult == nil {
		// 返回空结果
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("{}"))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(latestResult)
}

func (m *MockAudioProcessor) handleStop(w http.ResponseWriter, r *http.Request) {
	log.Println("收到停止请求")
	// 处理OPTIONS预检请求
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		StreamID string `json:"streamId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	log.Printf("结束会话 - StreamID: %s\n", req.StreamID)
	m.sessions.Delete(req.StreamID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

type SendAudioRequest struct {
	StreamID string      `json:"streamId"`
	Data     interface{} `json:"data"` // 使用 interface{} 支持多种类型的数据
}

func main() {
	processor := &MockAudioProcessor{}
	processor.StartMockServer(8080)
}
