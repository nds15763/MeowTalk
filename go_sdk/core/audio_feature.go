package core

// #cgo pkg-config: libavcodec libavformat libavutil
// #include <libavcodec/avcodec.h>
// #include <libavformat/avformat.h>
import "C"
import (
	"math"
)

type AudioFeature struct {
	MFCC     []float64
	Spectrum []float64
	Pitch    float64
}

// ExtractFeature 从音频数据中提取特征
func ExtractFeature(audioData []float32, sampleRate int) (*AudioFeature, error) {
	// 计算MFCC
	mfcc := computeMFCC(audioData, sampleRate)
	
	// 计算频谱
	spectrum := computeSpectrum(audioData)
	
	// 计算基频
	pitch := computePitch(audioData, sampleRate)
	
	return &AudioFeature{
		MFCC:     mfcc,
		Spectrum: spectrum,
		Pitch:    pitch,
	}, nil
}

// 计算两个特征向量的余弦相似度
func (f *AudioFeature) CosineSimilarity(other *AudioFeature) float64 {
	dotProduct := 0.0
	normA := 0.0
	normB := 0.0
	
	for i := range f.MFCC {
		dotProduct += f.MFCC[i] * other.MFCC[i]
		normA += f.MFCC[i] * f.MFCC[i]
		normB += other.MFCC[i] * other.MFCC[i]
	}
	
	return dotProduct / (math.Sqrt(normA) * math.Sqrt(normB))
} 