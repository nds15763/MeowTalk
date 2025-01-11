package soundsdk

import (
	"os"
	"path/filepath"
	"testing"
)

func TestEmotionIdentification(t *testing.T) {
	// 测试用例结构
	type testCase struct {
		name           string
		sampleDir      string
		expectedEmotion string
		minConfidence  float64
	}

	// 定义测试用例
	tests := []testCase{
		{
			name:           "Identify Affectionate Emotion",
			sampleDir:      "emotion_samples/affectionate",
			expectedEmotion: "affectionate",
			minConfidence:  0.7,
		},
		{
			name:           "Identify Contented Emotion",
			sampleDir:      "emotion_samples/contented",
			expectedEmotion: "contented",
			minConfidence:  0.7,
		},
		{
			name:           "Identify Tasty Feeling",
			sampleDir:      "emotion_samples/feels very tasty",
			expectedEmotion: "feels very tasty",
			minConfidence:  0.7,
		},
	}

	// 运行测试用例
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// 获取样本目录中的所有音频文件
			files, err := os.ReadDir(tc.sampleDir)
			if err != nil {
				t.Fatalf("Failed to read sample directory: %v", err)
			}

			for _, file := range files {
				if file.IsDir() {
					continue
				}

				// 读取音频文件
				audioPath := filepath.Join(tc.sampleDir, file.Name())
				audioData, err := os.ReadFile(audioPath)
				if err != nil {
					t.Errorf("Failed to read audio file %s: %v", audioPath, err)
					continue
				}

				// 分析音频
				result, err := AnalyzeAudio(audioData, &AudioConfig{
					SampleRate: 44100,
					Channels:   1,
					BitDepth:   16,
				})

				// 验证结果
				if err != nil {
					t.Errorf("Failed to analyze audio %s: %v", audioPath, err)
					continue
				}

				if result.Emotion != tc.expectedEmotion {
					t.Errorf("Wrong emotion for %s: got %s, want %s", 
						audioPath, result.Emotion, tc.expectedEmotion)
				}

				if result.Confidence < tc.minConfidence {
					t.Errorf("Low confidence for %s: got %.2f, want >= %.2f", 
						audioPath, result.Confidence, tc.minConfidence)
				}
			}
		})
	}
}

func TestAudioConfig(t *testing.T) {
	tests := []struct {
		name        string
		config      AudioConfig
		shouldError bool
	}{
		{
			name: "Valid Config",
			config: AudioConfig{
				SampleRate: 44100,
				Channels:   1,
				BitDepth:   16,
			},
			shouldError: false,
		},
		{
			name: "Invalid Sample Rate",
			config: AudioConfig{
				SampleRate: 0,
				Channels:   1,
				BitDepth:   16,
			},
			shouldError: true,
		},
		{
			name: "Invalid Channels",
			config: AudioConfig{
				SampleRate: 44100,
				Channels:   0,
				BitDepth:   16,
			},
			shouldError: true,
		},
		{
			name: "Invalid Bit Depth",
			config: AudioConfig{
				SampleRate: 44100,
				Channels:   1,
				BitDepth:   0,
			},
			shouldError: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// 使用一个简单的音频样本
			samplePath := filepath.Join("emotion_samples", "contented", "sample1.wav")
			audioData, err := os.ReadFile(samplePath)
			if err != nil {
				t.Skipf("Skipping test due to missing sample file: %v", err)
				return
			}

			_, err = AnalyzeAudio(audioData, &tc.config)
			if tc.shouldError && err == nil {
				t.Error("Expected error but got none")
			}
			if !tc.shouldError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}
		})
	}
}

func TestSampleLibrary(t *testing.T) {
	// 测试加载样本库
	t.Run("Load Sample Library", func(t *testing.T) {
		err := LoadSampleLibrary("emotion_samples")
		if err != nil {
			t.Errorf("Failed to load sample library: %v", err)
		}
	})

	// 测试更新模型
	t.Run("Update Model", func(t *testing.T) {
		samples := []Sample{
			{
				AudioData: []byte("test data"),
				Emotion:   "test emotion",
				Features: map[string]float64{
					"pitch":     440.0,
					"intensity": 0.8,
				},
			},
		}

		err := UpdateModel(samples)
		if err != nil {
			t.Errorf("Failed to update model: %v", err)
		}
	})
}
