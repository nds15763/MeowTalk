package main

import (
	"testing"
)

func TestFeatureExtractor_Extract(t *testing.T) {
	tests := []struct {
		name    string
		audio   *AudioData
		want    map[string]float64
		wantErr bool
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fe := NewFeatureExtractor(44100)
			got := fe.Extract(tt.audio)
			// TODO: Add assertions
			_ = got
		})
	}
}

func TestCalculateZeroCrossRate(t *testing.T) {
	t.Skip("TODO: Implement test")
}

func TestCalculateEnergy(t *testing.T) {
	t.Skip("TODO: Implement test")
}

func TestEstimatePitch(t *testing.T) {
	t.Skip("TODO: Implement test")
}

func TestCalculatePeakFrequency(t *testing.T) {
	t.Skip("TODO: Implement test")
}

func TestFFT(t *testing.T) {
	t.Skip("TODO: Implement test")
}

func TestLoadWavFile(t *testing.T) {
	t.Skip("TODO: Implement test")
}
