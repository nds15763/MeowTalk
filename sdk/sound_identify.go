package main

import (
	"encoding/binary"
	"math"
	"os"
)

// AudioData 表示音频数据
type AudioData struct {
	Samples    []float64
	SampleRate int
}

// FeatureExtractor 特征提取器
type FeatureExtractor struct {
	sampleRate int
	frameSize  int
}

// 创建新的特征提取器
func NewFeatureExtractor(sampleRate int) *FeatureExtractor {
	return &FeatureExtractor{
		sampleRate: sampleRate,
		frameSize:  int(float64(sampleRate) * 0.025), // 25ms帧
	}
}

// LoadWavFile 加载WAV文件
func LoadWavFile(filename string) (*AudioData, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	// 跳过WAV头部
	header := make([]byte, 44)
	if _, err := file.Read(header); err != nil {
		return nil, err
	}

	// 读取采样率
	sampleRate := int(binary.LittleEndian.Uint32(header[24:28]))

	// 读取音频数据
	data := make([]byte, 0)
	buffer := make([]byte, 1024)
	for {
		n, err := file.Read(buffer)
		if err != nil {
			break
		}
		data = append(data, buffer[:n]...)
	}

	// 转换为float64
	samples := make([]float64, len(data)/2)
	for i := 0; i < len(samples); i++ {
		sample := float64(int16(binary.LittleEndian.Uint16(data[i*2 : (i+1)*2])))
		samples[i] = sample / 32768.0 // 归一化到 [-1,1]
	}

	return &AudioData{
		Samples:    samples,
		SampleRate: sampleRate,
	}, nil
}

// Extract 提取特征
func (fe *FeatureExtractor) Extract(audio *AudioData) map[string]float64 {
	frames := fe.splitFrames(audio.Samples)

	// 基于分帧计算特征
	var totalZCR, totalEnergy float64
	for _, frame := range frames {
		totalZCR += fe.calculateZeroCrossRate(frame)
		totalEnergy += fe.calculateEnergy(frame)
	}

	numFrames := float64(len(frames))
	feature := map[string]float64{
		"ZeroCrossRate": totalZCR / numFrames,    // 使用帧平均值
		"Energy":        totalEnergy / numFrames, // 使用帧平均值
		"Pitch":         fe.estimatePitch(audio.Samples),
		"Duration":      float64(len(audio.Samples)) / float64(audio.SampleRate),
		"PeakFreq":      fe.calculatePeakFrequency(audio.Samples),
	}

	return feature
}

// splitFrames 将音频分帧
func (fe *FeatureExtractor) splitFrames(samples []float64) [][]float64 {
	frameCount := len(samples) / fe.frameSize
	frames := make([][]float64, frameCount)

	for i := 0; i < frameCount; i++ {
		start := i * fe.frameSize
		end := start + fe.frameSize
		if end > len(samples) {
			end = len(samples)
		}
		frame := make([]float64, end-start)
		copy(frame, samples[start:end])
		frames[i] = frame
	}

	return frames
}

// calculateZeroCrossRate 计算过零率
func (fe *FeatureExtractor) calculateZeroCrossRate(samples []float64) float64 {
	if len(samples) < 2 {
		return 0
	}

	crossings := 0
	for i := 1; i < len(samples); i++ {
		if (samples[i-1] >= 0 && samples[i] < 0) || (samples[i-1] < 0 && samples[i] >= 0) {
			crossings++
		}
	}

	return float64(crossings) / float64(len(samples)-1)
}

// calculateEnergy 计算能量
func (fe *FeatureExtractor) calculateEnergy(samples []float64) float64 {
	energy := 0.0
	for _, sample := range samples {
		energy += sample * sample
	}
	return energy / float64(len(samples))
}

// estimatePitch 估计基音频率
func (fe *FeatureExtractor) estimatePitch(samples []float64) float64 {
	if len(samples) < fe.frameSize {
		return 0
	}

	// 使用自相关法估计基频
	minLag := fe.sampleRate / 2000 // 最高2000Hz
	maxLag := fe.sampleRate / 70   // 最低70Hz
	maxCorr := 0.0
	bestLag := 0

	// 计算自相关
	for lag := minLag; lag <= maxLag; lag++ {
		corr := 0.0
		for i := 0; i < len(samples)-lag; i++ {
			corr += samples[i] * samples[i+lag]
		}
		corr = corr / float64(len(samples)-lag)

		if corr > maxCorr {
			maxCorr = corr
			bestLag = lag
		}
	}

	if bestLag > 0 {
		return float64(fe.sampleRate) / float64(bestLag)
	}
	return 0
}

// calculatePeakFrequency 计算峰值频率
func (fe *FeatureExtractor) calculatePeakFrequency(samples []float64) float64 {
	if len(samples) < fe.frameSize {
		return 0
	}

	// 应用汉明窗
	windowed := make([]float64, fe.frameSize)
	for i := 0; i < fe.frameSize; i++ {
		// 汉明窗函数
		window := 0.54 - 0.46*math.Cos(2*math.Pi*float64(i)/float64(fe.frameSize-1))
		windowed[i] = samples[i] * window
	}

	// 执行FFT
	fft := make([]complex128, fe.frameSize)
	for i := 0; i < fe.frameSize; i++ {
		fft[i] = complex(windowed[i], 0)
	}
	fft = fe.fft(fft)

	// 寻找峰值频率
	maxMagnitude := 0.0
	peakBin := 0
	for i := 0; i < fe.frameSize/2; i++ {
		magnitude := cmplxAbs(fft[i])
		if magnitude > maxMagnitude {
			maxMagnitude = magnitude
			peakBin = i
		}
	}

	// 转换为频率
	return float64(peakBin) * float64(fe.sampleRate) / float64(fe.frameSize)
}

// fft 快速傅里叶变换
func (fe *FeatureExtractor) fft(x []complex128) []complex128 {
	N := len(x)
	if N <= 1 {
		return x
	}

	even := make([]complex128, N/2)
	odd := make([]complex128, N/2)
	for i := 0; i < N/2; i++ {
		even[i] = x[2*i]
		odd[i] = x[2*i+1]
	}

	even = fe.fft(even)
	odd = fe.fft(odd)

	factor := -2 * math.Pi / float64(N)
	result := make([]complex128, N)
	for k := 0; k < N/2; k++ {
		phase := factor * float64(k)
		t := cmplxMul(cmplxFromAngle(phase), odd[k])
		result[k] = cmplxAdd(even[k], t)
		result[k+N/2] = cmplxSub(even[k], t)
	}

	return result
}

// 复数运算辅助函数
func cmplxFromAngle(angle float64) complex128 {
	return complex(math.Cos(angle), math.Sin(angle))
}

func cmplxMul(a, b complex128) complex128 {
	return complex(
		real(a)*real(b)-imag(a)*imag(b),
		real(a)*imag(b)+imag(a)*real(b),
	)
}

func cmplxAdd(a, b complex128) complex128 {
	return complex(real(a)+real(b), imag(a)+imag(b))
}

func cmplxSub(a, b complex128) complex128 {
	return complex(real(a)-real(b), imag(a)-imag(b))
}

func cmplxAbs(a complex128) float64 {
	return math.Sqrt(real(a)*real(a) + imag(a)*imag(a))
}
