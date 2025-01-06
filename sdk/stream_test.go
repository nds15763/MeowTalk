package main

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"sync"
	"testing"
	"time"
)

// 生成测试用的PCM音频数据
func generateTestPCMData(duration float64, sampleRate int) []byte {
	numSamples := int(duration * float64(sampleRate))
	data := make([]byte, numSamples*2) // 16-bit PCM

	// 生成一个440Hz的正弦波
	samples := generateTestAudio(440.0, duration, sampleRate)
	for i, sample := range samples {
		// 转换为16位整数
		pcmSample := int16(sample * 32767)
		binary.LittleEndian.PutUint16(data[i*2:], uint16(pcmSample))
	}

	return data
}

// 生成测试用的音频数据
func generateTestAudio(frequency float64, duration float64, sampleRate int) []float64 {
	numSamples := int(duration * float64(sampleRate))
	samples := make([]float64, numSamples)
	for i := 0; i < numSamples; i++ {
		t := float64(i) / float64(sampleRate)
		sample := math.Sin(2 * math.Pi * frequency * t)
		samples[i] = sample
	}
	return samples
}

// 设置测试环境
func setupTestEnvironment() (string, error) {
	testDir := "test_dir"
	err := os.MkdirAll(testDir, os.ModePerm)
	if err != nil {
		return "", fmt.Errorf("failed to create test directory: %v", err)
	}
	return testDir, nil
}

// 清理测试环境
func cleanupTestEnvironment(testDir string) {
	os.RemoveAll(testDir)
}

// 创建测试用的样本库文件
func createTestSampleLibrary(testDir string) error {
	sampleLib := struct {
		TotalSamples int                      `json:"totalSamples"`
		Emotions     []string                 `json:"emotions"`
		Samples      map[string][]AudioSample `json:"samples"`
	}{
		TotalSamples: 3,
		Emotions:     []string{"contented", "feels very tasty", "affectionate"},
		Samples: map[string][]AudioSample{
			"contented": {
				{
					FilePath: "emotion_samples\\contented\\contented_1.WAV",
					Emotion:  "contented",
					Features: AudioFeature{
						ZeroCrossRate:    0.016,
						Energy:           0.0003,
						Pitch:            6300,
						Duration:         4.3,
						PeakFreq:         275,
						RootMeanSquare:   0.016,
						SpectralCentroid: 1700,
						SpectralRolloff:  1250,
						FundamentalFreq:  6300,
					},
				},
			},
			"feels very tasty": {
				{
					FilePath: "emotion_samples\\feels very tasty\\feels-very-tasty_1.WAV",
					Emotion:  "feels very tasty",
					Features: AudioFeature{
						ZeroCrossRate:    0.019,
						Energy:           0.0007,
						Pitch:            3150,
						Duration:         3.3,
						PeakFreq:         226,
						RootMeanSquare:   0.026,
						SpectralCentroid: 2380,
						SpectralRolloff:  1499,
						FundamentalFreq:  3150,
					},
				},
			},
			"affectionate": {
				{
					FilePath: "emotion_samples\\affectionate\\affectionate_1.WAV",
					Emotion:  "affectionate",
					Features: AudioFeature{
						ZeroCrossRate:    0.025,
						Energy:           0.002,
						Pitch:            11025,
						Duration:         3.4,
						PeakFreq:         1358,
						RootMeanSquare:   0.044,
						SpectralCentroid: 2749,
						SpectralRolloff:  1719,
						FundamentalFreq:  11025,
					},
				},
			},
		},
	}

	// 将样本库写入文件
	data, err := json.MarshalIndent(sampleLib, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal sample library: %v", err)
	}

	err = os.WriteFile(testDir+"/sample_library.json", data, 0644)
	if err != nil {
		return fmt.Errorf("failed to write sample library file: %v", err)
	}

	return nil
}

// TestStartAudioStream 测试音频流启动
func TestStartAudioStream(t *testing.T) {
	// 设置测试环境
	testDir, err := setupTestEnvironment()
	if err != nil {
		t.Fatalf("Failed to setup test environment: %v", err)
	}
	defer cleanupTestEnvironment(testDir)

	// 创建测试样本库
	if err := createTestSampleLibrary(testDir); err != nil {
		t.Fatalf("Failed to create test sample library: %v", err)
	}

	// 初始化SDK
	config := AudioStreamConfig{
		SampleRate:        44100,
		BufferSize:        4096,
		SampleLibraryPath: testDir + "/sample_library.json",
	}
	if !InitializeSDK(config) {
		t.Fatal("Failed to initialize SDK")
	}
	defer ReleaseSDK()

	tests := []struct {
		name      string
		streamID  string
		wantError bool
	}{
		{
			name:      "正常启动流",
			streamID:  "test_stream_1",
			wantError: false,
		},
		{
			name:      "空流ID",
			streamID:  "",
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := StartAudioStream(tt.streamID)
			if (err != nil) != tt.wantError {
				t.Errorf("StartAudioStream() error = %v, wantError %v", err, tt.wantError)
			}
			if err == nil {
				// 如果成功启动，确保正确停止
				StopAudioStream(tt.streamID)
			}
		})
	}
}

// TestSendAudioChunk 测试音频数据发送
func TestSendAudioChunk(t *testing.T) {
	// 设置测试环境
	testDir, err := setupTestEnvironment()
	if err != nil {
		t.Fatalf("Failed to setup test environment: %v", err)
	}
	defer cleanupTestEnvironment(testDir)

	// 创建测试样本库
	if err := createTestSampleLibrary(testDir); err != nil {
		t.Fatalf("Failed to create test sample library: %v", err)
	}

	// 初始化SDK
	config := AudioStreamConfig{
		SampleRate:        44100,
		BufferSize:        4096,
		SampleLibraryPath: testDir + "/sample_library.json",
	}
	if !InitializeSDK(config) {
		t.Fatal("Failed to initialize SDK")
	}
	defer ReleaseSDK()

	streamID := "test_stream_2"
	if err := StartAudioStream(streamID); err != nil {
		t.Fatal("Failed to start audio stream")
	}
	defer StopAudioStream(streamID)

	tests := []struct {
		name      string
		data      []byte
		wantError bool
	}{
		{
			name:      "正常音频数据",
			data:      generateTestPCMData(0.1, 44100), // 100ms的音频
			wantError: false,
		},
		{
			name:      "空数据",
			data:      []byte{},
			wantError: true,
		},
		{
			name:      "无效长度数据",
			data:      []byte{1, 2, 3}, // 非偶数长度
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := SendAudioChunk(streamID, tt.data)
			if (err != nil) != tt.wantError {
				t.Errorf("SendAudioChunk() error = %v, wantError %v", err, tt.wantError)
			}
		})
	}
}

// TestProcessBuffer 测试缓冲区处理
func TestProcessBuffer(t *testing.T) {
	// 设置测试环境
	testDir, err := setupTestEnvironment()
	if err != nil {
		t.Fatalf("Failed to setup test environment: %v", err)
	}
	defer cleanupTestEnvironment(testDir)

	// 创建测试样本库
	if err := createTestSampleLibrary(testDir); err != nil {
		t.Fatalf("Failed to create test sample library: %v", err)
	}

	// 初始化SDK
	config := AudioStreamConfig{
		SampleRate:        44100,
		BufferSize:        4096,
		SampleLibraryPath: testDir + "/sample_library.json",
	}
	if !InitializeSDK(config) {
		t.Fatal("Failed to initialize SDK")
	}
	defer ReleaseSDK()

	streamID := "test_stream_3"
	if err := StartAudioStream(streamID); err != nil {
		t.Fatal("Failed to start audio stream")
	}
	defer StopAudioStream(streamID)

	// 发送足够的数据以触发处理
	audioData := generateTestPCMData(0.2, 44100) // 200ms的音频
	err = SendAudioChunk(streamID, audioData)
	if err != nil {
		t.Fatal("Failed to send audio chunk")
	}

	// 等待处理完成
	time.Sleep(100 * time.Millisecond)

	// 接收处理结果
	result, err := RecvMessage(streamID)
	if err != nil {
		t.Errorf("Failed to receive message: %v", err)
	}
	if len(result) == 0 {
		t.Error("Received empty result")
	}
}

// TestStopStream 测试流停止
func TestStopStream(t *testing.T) {
	// 设置测试环境
	testDir, err := setupTestEnvironment()
	if err != nil {
		t.Fatalf("Failed to setup test environment: %v", err)
	}
	defer cleanupTestEnvironment(testDir)

	// 创建测试样本库
	if err := createTestSampleLibrary(testDir); err != nil {
		t.Fatalf("Failed to create test sample library: %v", err)
	}

	// 初始化SDK
	config := AudioStreamConfig{
		SampleRate:        44100,
		BufferSize:        4096,
		SampleLibraryPath: testDir + "/sample_library.json",
	}
	if !InitializeSDK(config) {
		t.Fatal("Failed to initialize SDK")
	}
	defer ReleaseSDK()

	tests := []struct {
		name      string
		setup     func() string
		wantError bool
	}{
		{
			name: "正常停止",
			setup: func() string {
				streamID := "test_stream_4"
				StartAudioStream(streamID)
				return streamID
			},
			wantError: false,
		},
		{
			name: "停止不存在的流",
			setup: func() string {
				return "nonexistent_stream"
			},
			wantError: true,
		},
		{
			name: "重复停止",
			setup: func() string {
				streamID := "test_stream_5"
				StartAudioStream(streamID)
				StopAudioStream(streamID)
				return streamID
			},
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			streamID := tt.setup()
			err := StopAudioStream(streamID)
			if (err != nil) != tt.wantError {
				t.Errorf("StopAudioStream() error = %v, wantError %v", err, tt.wantError)
			}
		})
	}
}

// TestErrorHandling 测试错误处理
func TestErrorHandling(t *testing.T) {
	// 设置测试环境
	testDir, err := setupTestEnvironment()
	if err != nil {
		t.Fatalf("Failed to setup test environment: %v", err)
	}
	defer cleanupTestEnvironment(testDir)

	// 创建测试样本库
	if err := createTestSampleLibrary(testDir); err != nil {
		t.Fatalf("Failed to create test sample library: %v", err)
	}

	sampleLibPath := testDir + "/sample_library.json"

	tests := []struct {
		name    string
		config  AudioStreamConfig
		wantErr bool
	}{
		{
			name: "无效采样率",
			config: AudioStreamConfig{
				SampleRate:        1000, // 低于最小采样率
				BufferSize:        4096,
				SampleLibraryPath: sampleLibPath,
			},
			wantErr: true,
		},
		{
			name: "无效缓冲区大小",
			config: AudioStreamConfig{
				SampleRate:        44100,
				BufferSize:        0,
				SampleLibraryPath: sampleLibPath,
			},
			wantErr: true,
		},
		{
			name: "有效配置",
			config: AudioStreamConfig{
				SampleRate:        44100,
				BufferSize:        4096,
				SampleLibraryPath: sampleLibPath,
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := InitializeSDK(tt.config)
			if result == tt.wantErr {
				t.Errorf("InitializeSDK() = %v, want %v", result, !tt.wantErr)
			}
			if result {
				ReleaseSDK()
			}
		})
	}
}

// TestConcurrentStreams 测试并发流处理
func TestConcurrentStreams(t *testing.T) {
	// 设置测试环境
	testDir, err := setupTestEnvironment()
	if err != nil {
		t.Fatalf("Failed to setup test environment: %v", err)
	}
	defer cleanupTestEnvironment(testDir)

	// 创建测试样本库
	if err := createTestSampleLibrary(testDir); err != nil {
		t.Fatalf("Failed to create test sample library: %v", err)
	}

	// 初始化SDK
	config := AudioStreamConfig{
		SampleRate:        44100,
		BufferSize:        4096,
		SampleLibraryPath: testDir + "/sample_library.json",
	}
	if !InitializeSDK(config) {
		t.Fatal("Failed to initialize SDK")
	}
	defer ReleaseSDK()

	numStreams := 5
	var wg sync.WaitGroup
	errors := make(chan error, numStreams)

	for i := 0; i < numStreams; i++ {
		wg.Add(1)
		go func(streamNum int) {
			defer wg.Done()

			streamID := fmt.Sprintf("concurrent_stream_%d", streamNum)

			// 启动流
			if err := StartAudioStream(streamID); err != nil {
				errors <- fmt.Errorf("stream %d start error: %v", streamNum, err)
				return
			}

			// 发送数据
			audioData := generateTestPCMData(0.1, 44100)
			if err := SendAudioChunk(streamID, audioData); err != nil {
				errors <- fmt.Errorf("stream %d send error: %v", streamNum, err)
				return
			}

			// 等待处理
			time.Sleep(50 * time.Millisecond)

			// 停止流
			if err := StopAudioStream(streamID); err != nil {
				errors <- fmt.Errorf("stream %d stop error: %v", streamNum, err)
				return
			}
		}(i)
	}

	// 等待所有goroutine完成
	wg.Wait()
	close(errors)

	// 检查错误
	for err := range errors {
		t.Error(err)
	}
}
