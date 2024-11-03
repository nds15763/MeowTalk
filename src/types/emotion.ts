export interface EmotionCategory {
  id: string;
  title: string;
  description: string;
}

export interface Emotion {
  id: string;
  icon: string;
  title: string;
  description: string;
  audioFile?: any;
  categoryId: string;
  audioDuration?: number;
}
