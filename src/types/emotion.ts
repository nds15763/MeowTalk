export interface Emotion {
  id: string;
  icon: string;
  title: string;
  description: string;
  audioFile: any; // 使用 any 类型，因为 require 的返回类型在 TypeScript 中不是很明确
  categoryId: string; // 新增字段，用于关联情绪类别
}

export interface EmotionCategory {
  id: string;
  title: string;
  description: string;
}
