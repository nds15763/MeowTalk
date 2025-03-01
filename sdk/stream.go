/*
Package main 实现了 MeowTalk 的核心音频流处理功能。

SDK 内部流程
应用端 ─────────────────────────────────────────────> 应用端
        │                                           ↑
        │ SendAudio                                │
        │                                          │
        ↓                                          │
    音频数据 -> 特征提取 -> 情感分类 -> JSON结果 ────┘

主要功能：
1. 音频流管理：创建、处理和销毁音频流会话
2. 特征提取：从音频数据中提取关键特征
3. 情感分类：基于预训练模型进行实时情感识别

处理流程：
1. 接收PCM格式的音频数据
2. 缓冲并分帧处理
3. 提取音频特征（频谱、能量等）
4. 使用样本库进行情感匹配
5. 直接返回识别结果

注意事项：
- 所有音频数据必须是16位PCM格式
- 支持的采样率：8kHz-48kHz
- 建议缓冲区大小：4096 samples
*/

package main

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

// 全局SDK实例
var (
	sdk           *MeowTalkSDK // from types.go
	mu            sync.RWMutex
	debugMode     bool // 调试模式标志
	mockProcessor *MockAudioProcessor
)

// InitializeSDK 初始化SDK
func InitializeSDK(config AudioStreamConfig) bool {
	mu.Lock()
	defer mu.Unlock()

	// 验证配置参数
	if config.SampleRate < MinSampleRate || config.SampleRate > MaxSampleRate {
		fmt.Println("Error: Invalid sample rate")
		return false
	}

	if config.BufferSize <= 0 {
		fmt.Println("Error: Invalid buffer size")
		return false
	}

	if config.SampleLibraryPath == "" {
		fmt.Println("Error: Sample library path not specified")
		return false
	}

	// 创建样本库
	sampleLib := NewSampleLibrary()

	// 加载样本库文件
	err := sampleLib.LoadFromFile(config.SampleLibraryPath)
	if err != nil {
		fmt.Printf("Failed to load sample library: %v\n", err)
		return false
	}

	// 创建样本处理器
	processor := &SampleProcessor{
		Library:     sampleLib,
		SampleRate:  config.SampleRate,
		WindowSize:  config.BufferSize,
		FFTSize:     2048, // 标准FFT大小
		FrameLength: 20.0, // 20ms的帧长
	}

	// 初始化SDK实例
	sdk = &MeowTalkSDK{
		Config:    config,
		Sessions:  make(map[string]*AudioStreamSession),
		Processor: processor,
	}

	// 验证初始化
	if len(sdk.Processor.Library.Samples) == 0 {
		fmt.Println("Warning: Sample library is empty")
		return false
	}

	fmt.Printf("SDK initialized with sample rate: %d Hz, buffer size: %d\n",
		config.SampleRate, config.BufferSize)
	return true
}

// SetDebugMode 设置调试模式
func SetDebugMode(enabled bool) {
	mu.Lock()
	defer mu.Unlock()
	debugMode = enabled
	if enabled {
		mockProcessor = &MockAudioProcessor{}
	}
}

// StartAudioStream 开始音频流会话
func StartAudioStream(streamId string) error {
	mu.Lock()
	defer mu.Unlock()

	// 检查SDK是否已初始化
	if sdk == nil {
		return fmt.Errorf("SDK not initialized")
	}

	// 检查流ID是否为空
	if streamId == "" {
		return fmt.Errorf("stream ID cannot be empty")
	}

	// 创建新的音频流会话
	session := &AudioStreamSession{
		ID:               streamId,
		FeatureExtractor: NewFeatureExtractor(sdk.Config.SampleRate),
		Buffer:           make([]float64, 0),
		ResultChan:       make(chan []byte, 10),
		Active:           true,
	}

	// 添加到会话映射
	sdk.Sessions[streamId] = session

	return nil
}

// SendAudioChunk 发送音频数据块
func SendAudioChunk(streamId string, chunk []byte) error {
	mu.RLock()
	session, exists := sdk.Sessions[streamId]
	mu.RUnlock()

	if !exists {
		return fmt.Errorf("session not found")
	}

	// 1. 检查数据有效性
	if len(chunk) == 0 {
		return ErrEmptyData
	}
	if len(chunk)%2 != 0 {
		return ErrInvalidDataLength
	}

	// 2. 转换音频数据为float64并检查范围
	samples := make([]float64, len(chunk)/2)
	for i := 0; i < len(samples); i++ {
		sample := int16(binary.LittleEndian.Uint16(chunk[i*2 : (i+1)*2]))
		if sample > MaxSampleValue || sample < MinSampleValue {
			return ErrSampleOutOfRange
		}
		samples[i] = float64(sample) / 32768.0
	}

	// 3. 检查缓冲区溢出
	if len(session.Buffer)+len(samples) > MaxBufferSize {
		return ErrBufferOverflow
	}

	// 4. 添加到缓冲区
	session.Buffer = append(session.Buffer, samples...)

	// 5. 当缓冲区达到处理窗口大小时进行处理
	if len(session.Buffer) >= sdk.Config.BufferSize {
		go func() {
			result, err := processBuffer(session)
			if err == nil && result != nil {
				select {
				case session.ResultChan <- result:
				default:
					// 通道已满，丢弃结果
				}
			}
		}()
	}

	return nil
}

// RecvMessage 接收处理结果
func RecvMessage(streamId string) ([]byte, error) {
	mu.RLock()
	session, exists := sdk.Sessions[streamId]
	mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("session not found")
	}

	select {
	case result := <-session.ResultChan:
		return result, nil
	default:
		return nil, nil
	}
}

// processBuffer 处理音频缓冲区并返回结果
func processBuffer(session *AudioStreamSession) ([]byte, error) {
	if debugMode && mockProcessor != nil {
		// 在调试模式下使用mock处理器
		return mockProcessor.ProcessAudio(session.ID, session.Buffer)
	}

	if len(session.Buffer) < sdk.Config.BufferSize {
		return nil, fmt.Errorf("buffer size too small: %d < %d", len(session.Buffer), sdk.Config.BufferSize)
	}

	// 1. 应用汉明窗
	windowedSamples := applyHammingWindow(session.Buffer[:sdk.Config.BufferSize])

	// 2. 提取特征
	rawFeatures := session.FeatureExtractor.Extract(&AudioData{
		Samples:    windowedSamples,
		SampleRate: sdk.Config.SampleRate,
	})

	// 3. 转换为AudioFeature结构
	feature := MapToAudioFeature(rawFeatures)

	// 4. 使用样本库进行匹配
	emotion, confidence := sdk.Processor.Library.Match(feature)

	// 5. 构造结果
	result := AudioStreamResult{
		StreamID:   session.ID,
		Timestamp:  time.Now().Unix(),
		Emotion:    emotion,
		Confidence: confidence,
		Metadata: AudioStreamMeta{
			AudioLength: sdk.Config.BufferSize,
			Features:    rawFeatures,
		},
	}

	// 6. 序列化结果
	data, err := json.Marshal(result)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal result: %v", err)
	}

	// 7. 更新缓冲区（保留未处理的数据）
	session.Buffer = session.Buffer[sdk.Config.BufferSize:]

	return data, nil
}

// StopAudioStream 停止音频流会话
func StopAudioStream(streamId string) error {
	mu.Lock()
	defer mu.Unlock()

	session, exists := sdk.Sessions[streamId]
	if !exists {
		return fmt.Errorf("session not found")
	}

	session.Active = false
	delete(sdk.Sessions, streamId)
	return nil
}

// ReleaseSDK 释放SDK资源
func ReleaseSDK() {
	mu.Lock()
	defer mu.Unlock()

	if sdk != nil {
		// 停止所有会话
		for id := range sdk.Sessions {
			StopAudioStream(id)
		}
		sdk = nil
	}
}
