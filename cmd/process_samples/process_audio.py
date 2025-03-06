import os
import json
import re
import numpy as np
import librosa
import matplotlib.pyplot as plt
from pathlib import Path

# 配置参数
AUDIO_DIR = r'd:\uso_dev\MeowTalk\audios'
OUTPUT_PATH = r'd:\uso_dev\MeowTalk\sdk\new_sample_library.json'
SAMPLE_RATE = 44100  # 原始采样率
DOWNSAMPLE_FACTOR = 10  # 降采样因子
EFFECTIVE_SAMPLE_RATE = SAMPLE_RATE // DOWNSAMPLE_FACTOR  # 有效采样率

class AudioFeatureExtractor:
    """音频特征提取器"""
    
    def __init__(self):
        self.min_freq = 70.0  # 猫咪声音最低频率
        self.max_freq = 2000.0  # 猫咪声音最高频率
        
    def extract_features(self, audio_path):
        """从音频文件提取特征"""
        try:
            # 加载音频文件
            y, sr = librosa.load(audio_path, sr=SAMPLE_RATE)
            
            # 应用降采样
            y_downsample = librosa.resample(y, orig_sr=sr, target_sr=EFFECTIVE_SAMPLE_RATE)
            
            # 计算持续时间
            duration = librosa.get_duration(y=y, sr=sr)
            
            # 应用窗函数
            y_windowed = y_downsample * np.hamming(len(y_downsample))
            
            # 能量计算
            energy = np.sum(y_windowed ** 2)
            
            # RMS计算
            rms = np.sqrt(np.mean(y_windowed ** 2))
            
            # 过零率计算
            zero_crossings = librosa.feature.zero_crossing_rate(y_windowed, 
                                                             frame_length=len(y_windowed),
                                                             hop_length=len(y_windowed))[0][0]
            
            # 计算频谱
            D = librosa.stft(y_windowed)
            magnitude = np.abs(D)
            
            # 峰值频率计算
            peak_freq = self._calculate_peak_frequency(y_windowed, EFFECTIVE_SAMPLE_RATE)
            
            # 基频估计
            f0, voiced_flag, voiced_probs = librosa.pyin(y_windowed, 
                                                      fmin=self.min_freq,
                                                      fmax=self.max_freq,
                                                      sr=EFFECTIVE_SAMPLE_RATE)
            fundamental_freq = 0.0
            if voiced_flag.any() and np.nanmean(f0[voiced_flag]) > 0:
                fundamental_freq = np.nanmean(f0[voiced_flag])
            
            # 频谱质心
            spectral_centroid = librosa.feature.spectral_centroid(y=y_windowed, 
                                                              sr=EFFECTIVE_SAMPLE_RATE)[0][0]
            
            # 频谱滚降点
            spectral_rolloff = librosa.feature.spectral_rolloff(y=y_windowed, 
                                                           sr=EFFECTIVE_SAMPLE_RATE,
                                                           roll_percent=0.85)[0][0]
            
            # 确保基频与音高一致
            pitch = fundamental_freq
            
            # 验证特征
            features = self._validate_features({
                "Duration": duration,
                "Energy": float(energy),
                "RootMeanSquare": float(rms),
                "ZeroCrossRate": float(zero_crossings),
                "PeakFreq": float(peak_freq),
                "FundamentalFreq": float(fundamental_freq),
                "Pitch": float(pitch),
                "SpectralCentroid": float(spectral_centroid),
                "SpectralRolloff": float(spectral_rolloff)
            })
            
            print(f"处理文件: {os.path.basename(audio_path)}")
            print(f"  持续时间: {features['Duration']:.2f}秒")
            print(f"  基频: {features['FundamentalFreq']:.2f} Hz")
            print(f"  音高: {features['Pitch']:.2f} Hz")
            print(f"  峰值频率: {features['PeakFreq']:.2f} Hz")
            print(f"  过零率: {features['ZeroCrossRate']:.6f}")
            
            return features
            
        except Exception as e:
            print(f"处理文件 {audio_path} 时出错: {e}")
            return None
    
    def _calculate_peak_frequency(self, y, sr):
        """计算峰值频率"""
        # 执行FFT
        D = np.abs(librosa.stft(y))
        
        # 查找峰值频率
        freqs = librosa.fft_frequencies(sr=sr, n_fft=2*(D.shape[0]-1))
        # 仅考虑猫咪声音频率范围
        idx = np.where((freqs >= self.min_freq) & (freqs <= self.max_freq))[0]
        if len(idx) == 0:
            return 0.0
            
        # 计算每个频率的平均能量
        mean_magnitudes = np.mean(D[idx], axis=1)
        
        # 找到能量最大的频率
        if np.max(mean_magnitudes) > 0.05:
            peak_idx = idx[np.argmax(mean_magnitudes)]
            return freqs[peak_idx]
        return 0.0
    
    def _validate_features(self, features):
        """验证特征是否在合理范围内"""
        # 能量与RMS非负性检查
        if features["Energy"] < 0:
            features["Energy"] = 0.0
            
        if features["RootMeanSquare"] < 0:
            features["RootMeanSquare"] = 0.0
            
        # 频率范围检查
        if features["Pitch"] < self.min_freq or features["Pitch"] > 1500:
            features["Pitch"] = 0.0
            
        if features["PeakFreq"] < self.min_freq or features["PeakFreq"] > self.max_freq:
            features["PeakFreq"] = 0.0
            
        # 基频与音高一致性检查
        if features["FundamentalFreq"] > 0 and features["Pitch"] > 0:
            diff = abs(features["FundamentalFreq"] - features["Pitch"])
            if diff > 1.0:
                # 使用基频作为准确值
                features["Pitch"] = features["FundamentalFreq"]
                
        return features

def extract_emotion_from_filename(filename):
    """从文件名中提取情感标签"""
    basename = os.path.basename(filename)
    # 处理具有序号的文件名
    if "_" in basename:
        emotion = basename.split("_")[0]
    else:
        # 处理没有序号的文件名
        emotion = os.path.splitext(basename)[0]
    
    # 标准化emotion名称
    emotion = emotion.replace("-", "_")
    return emotion

def process_audio_files():
    """处理目录中的所有音频文件"""
    # 创建新的样本库
    library = {
        "totalSamples": 0,
        "emotions": [],
        "samples": {}
    }
    
    # 获取所有MP3文件
    audio_files = list(Path(AUDIO_DIR).glob("*.mp3"))
    print(f"找到 {len(audio_files)} 个音频文件")
    
    # 创建特征提取器
    extractor = AudioFeatureExtractor()
    
    # 处理每个音频文件
    for audio_file in audio_files:
        audio_path = str(audio_file)
        emotion = extract_emotion_from_filename(audio_path)
        
        # 添加到情感列表(如果不存在)
        if emotion not in library["emotions"]:
            library["emotions"].append(emotion)
            library["samples"][emotion] = []
        
        # 分析音频文件并提取特征
        features = extractor.extract_features(audio_path)
        if features:
            # 创建样本
            sample = {
                "FilePath": audio_path,
                "Emotion": emotion,
                "Features": features
            }
            
            # 添加到样本库
            library["samples"][emotion].append(sample)
            library["totalSamples"] += 1
    
    # 保存样本库到JSON文件
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(library, f, indent=2, ensure_ascii=False)
    
    print(f"样本库已保存到 {OUTPUT_PATH}，包含 {library['totalSamples']} 个样本，{len(library['emotions'])} 种情感")
    return library

def visualize_features(library):
    """可视化特征分布"""
    # 提取所有特征
    emotions = []
    pitches = []
    durations = []
    zero_cross_rates = []
    peak_freqs = []
    
    for emotion, samples in library["samples"].items():
        for sample in samples:
            features = sample["Features"]
            emotions.append(emotion)
            pitches.append(features["Pitch"])
            durations.append(features["Duration"])
            zero_cross_rates.append(features["ZeroCrossRate"])
            peak_freqs.append(features["PeakFreq"])
    
    # 创建图表目录
    charts_dir = os.path.join(os.path.dirname(OUTPUT_PATH), "charts")
    os.makedirs(charts_dir, exist_ok=True)
    
    # 绘制音高分布
    plt.figure(figsize=(10, 6))
    for emotion in set(emotions):
        indices = [i for i, e in enumerate(emotions) if e == emotion]
        plt.scatter([emotion]*len(indices), [pitches[i] for i in indices], alpha=0.7, label=emotion)
    plt.title("各情感类别的音高分布")
    plt.ylabel("音高 (Hz)")
    plt.xticks(rotation=45)
    plt.legend()
    plt.tight_layout()
    plt.savefig(os.path.join(charts_dir, "pitch_distribution.png"))
    
    # 绘制持续时间分布
    plt.figure(figsize=(10, 6))
    for emotion in set(emotions):
        indices = [i for i, e in enumerate(emotions) if e == emotion]
        plt.scatter([emotion]*len(indices), [durations[i] for i in indices], alpha=0.7, label=emotion)
    plt.title("各情感类别的持续时间分布")
    plt.ylabel("持续时间 (秒)")
    plt.xticks(rotation=45)
    plt.legend()
    plt.tight_layout()
    plt.savefig(os.path.join(charts_dir, "duration_distribution.png"))
    
    print(f"特征分布图表已保存到 {charts_dir}")

if __name__ == "__main__":
    print("开始处理音频样本...")
    library = process_audio_files()
    visualize_features(library)
    print("处理完成!")
