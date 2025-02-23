export interface Emotion {
  id: string;
  icon: string;
  title: string;
  description: string;
  audioFiles: any[]; // 改为数组类型，存储多个音频文件
  categoryId: string; // 新增字段，用于关联情绪类别
}

export interface EmotionCategory {
  id: string;
  title: string;
  description: string;
}
