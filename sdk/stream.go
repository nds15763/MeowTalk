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
	sdk *MeowTalkSDK // from types.go
	mu  sync.RWMutex
)

// InitializeSDK 初始化SDK
// @param config: AudioStreamConfig from types.go
func InitializeSDK(config AudioStreamConfig) bool {
	mu.Lock()
	defer mu.Unlock()

	sdk = &MeowTalkSDK{
		Config:    config,
		Sessions:  make(map[string]*AudioStreamSession),
		Processor: NewSampleProcessor(config),
	}

	// TODO: 加载模型
	// 1. 从ModelPath加载预训练模型
	// 2. 初始化特征提取器
	// 3. 初始化情感分类器

	return true
}

// StartAudioStream 开始音频流会话
// @param streamId: string - 会话唯一标识
func StartAudioStream(streamId string) error {
	mu.Lock()
	defer mu.Unlock()

	if sdk == nil {
		return fmt.Errorf("SDK not initialized")
	}

	// 创建新的会话
	session := &AudioStreamSession{
		ID:               streamId,
		FeatureExtractor: NewFeatureExtractor(sdk.Config.SampleRate),
		Buffer:           make([]float64, 0),
		Active:           true,
	}

	sdk.Sessions[streamId] = session
	return nil
}

// SendAudioChunk 发送音频数据块
// @param streamId: string - 会话ID
// @param chunk: []byte - 音频数据(PCM格式)
func SendAudioChunk(streamId string, chunk []byte) error {
	mu.RLock()
	session, exists := sdk.Sessions[streamId]
	mu.RUnlock()

	if !exists {
		return fmt.Errorf("session not found")
	}

	// 转换音频数据为float64
	samples := make([]float64, len(chunk)/2)
	for i := 0; i < len(samples); i++ {
		sample := float64(int16(binary.LittleEndian.Uint16(chunk[i*2 : (i+1)*2])))
		samples[i] = sample / 32768.0
	}

	// 添加到缓冲区
	session.Buffer = append(session.Buffer, samples...)

	// 当缓冲区达到处理窗口大小时进行处理
	if len(session.Buffer) >= sdk.Config.BufferSize {
		go processBuffer(session)
	}

	return nil
}

// 处理音频缓冲区
func processBuffer(session *AudioStreamSession) {
	// 1. 提取特征
	features := session.FeatureExtractor.Extract(&AudioData{
		Samples:    session.Buffer[:sdk.Config.BufferSize],
		SampleRate: sdk.Config.SampleRate,
	})

	// 2. 情感分类
	emotion, confidence := classifyEmotion(features)

	// 3. 构造结果
	result := AudioStreamResult{
		StreamID:   session.ID,
		Timestamp:  time.Now().Unix(),
		Emotion:    emotion,
		Confidence: confidence,
		Metadata: AudioStreamMeta{
			AudioLength:    sdk.Config.BufferSize,
			AdditionalInfo: fmt.Sprintf("Features: %+v", features),
		},
	}

	// 4. 发送结果
	if session.Callback != nil {
		jsonResult, _ := json.Marshal(result)
		session.Callback(jsonResult)
	}

	// 5. 更新缓冲区（保留未处理的数据）
	session.Buffer = session.Buffer[sdk.Config.BufferSize:]
}

// RegisterCallback 注册回调函数
func RegisterCallback(streamId string, callback func([]byte)) error {
	mu.Lock()
	defer mu.Unlock()

	session, exists := sdk.Sessions[streamId]
	if !exists {
		return fmt.Errorf("session not found")
	}

	session.Callback = callback
	return nil
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

// 情感分类（待实现）
func classifyEmotion(features map[string]float64) (string, float64) {
	// TODO: 实现情感分类逻辑
	// 1. 使用预训练模型进行推理
	// 2. 返回情感类型和置信度
	return "happy", 0.92
}

// CGO导出接口（待实现）
//export InitSDK
//export StartStream
//export SendAudio
//export StopStream
//export ReleaseSDK
