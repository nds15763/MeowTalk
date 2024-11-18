import librosa
import numpy as np
import json
import os
import re

# 使用绝对路径
audio_directory = r'D:\uso_dev\MeowTalk\public\audios'

# 读取 emotions.ts 文件
def parse_emotions_ts():
    emotions_file = r'D:\uso_dev\MeowTalk\src\config\emotions.ts'
    with open(emotions_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 使用正则表达式提取音频文件和ID的映射
    pattern = r"id: '([^']+)',[^}]*audioFile: '[^']*\/([^']+)'"
    matches = re.findall(pattern, content)
    
    # 创建文件名到ID的映射
    audio_to_id = {audio: emotion_id for emotion_id, audio in matches}
    return audio_to_id

# 存储特征的列表
features_list = []

# 获取情感ID映射
audio_to_emotion = parse_emotions_ts()

# 遍历每个音频文件
for filename in os.listdir(audio_directory):
    if filename.lower().endswith(('.mp3', '.wav')):
        # 特殊处理 scared_meow.MP3 -> scared
        base_filename = filename
        if base_filename == 'scared_meow.MP3':
            emotion_label = 'scared'
        else:
            # 从 emotions.ts 中获取对应的情感ID
            emotion_label = audio_to_emotion.get(filename)
        
        if emotion_label:  # 只处理在 emotions.ts 中定义的音频
            file_path = os.path.join(audio_directory, filename)
            print(f"Processing {filename} as {emotion_label}...")  # 添加处理日志

            # 加载音频文件
            y, sr = librosa.load(file_path, sr=16000)

            # 提取特征，例如 MFCCs
            mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
            mfccs_mean = np.mean(mfccs, axis=1)

            # 可以添加更多特征
            zero_crossing_rate = np.mean(librosa.feature.zero_crossing_rate(y))
            spectral_centroid = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr))

            # 组合特征向量
            feature_vector = mfccs_mean.tolist() + [zero_crossing_rate, spectral_centroid]

            # 存储特征和情感标签
            features_list.append({
                'emotion': emotion_label,
                'features': feature_vector
            })
        else:
            print(f"Warning: {filename} not found in emotions.ts")

# 将特征列表保存为 JSON 文件
with open('known_emotion_features.json', 'w') as f:
    json.dump(features_list, f)

print(f"Processed {len(features_list)} audio files")
