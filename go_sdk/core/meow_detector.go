package core

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"path/filepath"
)

type EmotionTemplate struct {
	ID       string
	Feature  *AudioFeature
	Category string
}

type MeowDetector struct {
	templates []EmotionTemplate
}

func NewMeowDetector(templatesDir string) (*MeowDetector, error) {
	detector := &MeowDetector{
		templates: make([]EmotionTemplate, 0),
	}
	
	// 加载所有模板音频
	files, err := ioutil.ReadDir(templatesDir)
	if err != nil {
		return nil, err
	}
	
	for _, file := range files {
		if filepath.Ext(file.Name()) == ".MP3" {
			audioData, err := loadAudioFile(filepath.Join(templatesDir, file.Name()))
			if err != nil {
				continue
			}
			
			feature, err := ExtractFeature(audioData, 44100)
			if err != nil {
				continue
			}
			
			template := EmotionTemplate{
				ID:      file.Name()[:len(file.Name())-4], // 移除.MP3后缀
				Feature: feature,
			}
			
			detector.templates = append(detector.templates, template)
		}
	}
	
	return detector, nil
}

func (d *MeowDetector) DetectEmotion(audioData []float32) (string, float64) {
	feature, err := ExtractFeature(audioData, 44100)
	if err != nil {
		return "", 0
	}
	
	var bestMatch string
	var maxSimilarity float64
	
	for _, template := range d.templates {
		similarity := feature.CosineSimilarity(template.Feature)
		if similarity > maxSimilarity {
			maxSimilarity = similarity
			bestMatch = template.ID
		}
	}
	
	return bestMatch, maxSimilarity
} 